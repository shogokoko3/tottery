"""
Google Play の掲載用画像を作る(アイコン 512×512 とフィーチャーグラフィック 1024×500)。

元はアプリの絵(ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png)。
フィーチャーグラフィックは Play の必須で、App Store には無い欄。

  python3 tools/play-graphics.py
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

SRC = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
OUT = "reports/play/assets"
# 絵の地の色。起動画面とアダプティブアイコンの背景に合わせてある
GROUND = (6, 12, 24)
GOLD = (212, 175, 85)
SOFT = (222, 214, 196)
FAINT = (150, 140, 120)

os.makedirs(OUT, exist_ok=True)
icon = Image.open(SRC).convert("RGBA")

# アイコン 512×512
icon.resize((512, 512), Image.LANCZOS).convert("RGB").save(f"{OUT}/icon-512.png")

# フィーチャーグラフィック 1024×500
W, H = 1024, 500
bg = Image.new("RGB", (W, H), GROUND)
d = ImageDraw.Draw(bg)
for y in range(H):  # 中ほどが少し明るい紺
    v = max(1 - abs(y / H - 0.42) * 1.5, 0)
    d.line([(0, y), (W, y)], fill=(int(6 + 18 * v), int(12 + 26 * v), int(24 + 52 * v)))

s = 430
art = icon.resize((s, s), Image.LANCZOS)
pos = (58, (H - s) // 2)
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
glow.paste(art, pos, art)
bg.paste(Image.alpha_composite(bg.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(28))).convert("RGB"), (0, 0))
bg.paste(art.convert("RGB"), pos, art)

d = ImageDraw.Draw(bg)
mincho = "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc"
gothic = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
f_title = ImageFont.truetype(mincho if os.path.exists(mincho) else gothic, 92)
f_sub = ImageFont.truetype(gothic, 31)
f_tag = ImageFont.truetype(gothic, 24)

x = 540
d.text((x, 150), "トッタリー", font=f_title, fill=GOLD)
d.text((x + 3, 268), "配られた札で陣を組み、", font=f_sub, fill=SOFT)
d.text((x + 3, 312), "隠れた王を討つ。", font=f_sub, fill=SOFT)
d.line([(x + 4, 372), (x + 330, 372)], fill=(120, 100, 52), width=2)
d.text((x + 4, 392), "二人対戦・心理戦ボードゲーム", font=f_tag, fill=FAINT)
bg.save(f"{OUT}/feature-1024x500.png")

print(f"できました: {OUT}/icon-512.png (512×512), {OUT}/feature-1024x500.png (1024×500)")
