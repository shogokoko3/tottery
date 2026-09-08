#!/bin/bash
# アプリのアイコンと起動画像を、渡した絵から作る。
#
#   bash tools/make-icon.sh アイコンの元.png [起動画像の元.png]
#
# 起動画像を省くと、アイコンと同じ絵から作る。
# **リポジトリのルートで実行すること**(書き出し先を相対パスで持っている)。
#
# 元の絵に必要なもの:
#   アイコン   … 1024x1024 以上。正方形でなくてもよい(足りない側を盤の紺で足す)
#   起動画像   … 2732x2732 以上。同上。端は機種ごとに切られるので中央に絵を置く
#
# **透明は自動で落とす**(盤の紺に重ねる)。Apple はアルファ付きのアイコンを
# ITMS-90717 で弾く。角丸は付けない。iOS が丸める。
#
# 画像の処理は Python(Pillow)で行う。sips は
#   - -c の引数順が「高さ 幅」で取り違えやすい
#   - --deleteAlpha が無く、JPEG を経由すると非可逆になる
#   - -z が縦横比を保たない
# ため、ここでは使わない。
set -euo pipefail

ICON_SRC="${1:-}"
SPLASH_SRC="${2:-${1:-}}"

if [ -z "$ICON_SRC" ] || [ ! -f "$ICON_SRC" ]; then
  echo "使い方: bash tools/make-icon.sh アイコンの元.png [起動画像の元.png]" >&2
  exit 1
fi
if [ ! -f "tools/make-icon.sh" ]; then
  echo "× リポジトリのルートで実行すること(いま: $(pwd))" >&2
  exit 1
fi

python3 - "$ICON_SRC" "$SPLASH_SRC" <<'PY'
import sys, shutil
from PIL import Image, ImageDraw

icon_src, splash_src = sys.argv[1], sys.argv[2]
# 盤の紺。足りない側と、透明だった場所をこの色で埋める
NAVY = (7, 17, 32)

ICON_DIR = "ios/App/App/Assets.xcassets/AppIcon.appiconset"
SPLASH_DIR = "ios/App/App/Assets.xcassets/Splash.imageset"


def build(src, size, out_paths, label):
    im = Image.open(src)
    w, h = im.size
    if max(w, h) < size:
        print(f"× {label}の元が {w}x{h} で、{size}x{size} に足りない。", file=sys.stderr)
        print("  引き伸ばすとぼやけて審査で弾かれるので、大きい絵を用意すること。", file=sys.stderr)
        sys.exit(1)

    im = im.convert("RGBA")
    # 正方形でなければ、長辺に合わせて紺で足す(切らない。絵を欠けさせないため)
    if w != h:
        side = max(w, h)
        pad = Image.new("RGBA", (side, side), NAVY + (255,))
        pad.paste(im, ((side - w) // 2, (side - h) // 2), im)
        im = pad
        print(f"  {label}: {w}x{h} を {side}x{side} に整えた(足りない側を紺で埋めた)")

    if im.size[0] != size:
        im = im.resize((size, size), Image.LANCZOS)

    # 透明を落とす。JPEG を通さないので輪郭が濁らない
    flat = Image.new("RGB", (size, size), NAVY)
    flat.paste(im, mask=im.split()[3])

    # 角が丸めてある絵を直す。
    # 生成AIのアイコンは角を丸めて出すことが多いが、Apple のアイコンは
    # 角を丸めない正方形で用意する決まりで、丸めるのは iOS 側。
    # 丸みが二重になると、隅に元の背景(たいてい白)が三日月形に残る。
    #
    # 隅から連結している範囲だけを塗るので、絵の中の白は巻き込まない。
    edge = flat.getpixel((size // 2, 1))  # 辺の中央 = 本来の縁の色
    corners = [(1, 1), (size - 2, 1), (1, size - 2), (size - 2, size - 2)]
    ずれ = max(
        sum(abs(a - b) for a, b in zip(flat.getpixel(c), edge)) for c in corners
    )
    if ずれ > 60:
        for c in [(0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)]:
            ImageDraw.floodfill(flat, c, edge, thresh=70)
        なお = max(
            sum(abs(a - b) for a, b in zip(flat.getpixel(c), edge))
            for c in corners
        )
        print(f"  {label}: 角が丸めてあったので、隅を縁の色 {edge} で埋めた"
              f"(ずれ {ずれ} → {なお})")

    flat.save(out_paths[0], "PNG")
    for extra in out_paths[1:]:
        shutil.copyfile(out_paths[0], extra)

    # 出来上がりを自分で検査する
    chk = Image.open(out_paths[0])
    ok = chk.size == (size, size) and chk.mode == "RGB"
    mark = "○" if ok else "×"
    print(f"{mark} {label}: {chk.size[0]}x{chk.size[1]} {chk.mode} "
          f"(アルファ無し={'A' not in chk.mode}) ×{len(out_paths)}枚")
    if not ok:
        sys.exit(1)


build(icon_src, 1024, [ICON_DIR + "/AppIcon-512@2x.png"], "アイコン")
build(splash_src, 2732,
      [SPLASH_DIR + "/splash-2732x2732.png",
       SPLASH_DIR + "/splash-2732x2732-1.png",
       SPLASH_DIR + "/splash-2732x2732-2.png"], "起動画像")
PY

echo ""
echo "次: npm run ios:sync && node tools/check-submit.mjs"
