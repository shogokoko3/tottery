/**
 * 配布された原画(PNG)を、盤に出す webp へ落とし込む。
 *
 *   node tools/import-cards.mjs <原画のフォルダ>
 *
 * 原画のフォルダは normal/ と captain/ を持ち、AS.png のような名前で
 * 並んでいること。ファイル名は差し替え先と同じでなければならない。
 *
 * 160x213 に縮めて quality 82 で書き出す。カードが画面に出る最大は
 * 50x67 なので、3倍密度の端末でも 150x201。これ以上大きく持っても
 * 見た目は変わらず、index.html が重くなるだけになる。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("使い方: node tools/import-cards.mjs <原画のフォルダ>");
  process.exit(1);
}

const py = `
from PIL import Image
import glob, os, sys
src = sys.argv[1]
n = 0
total = 0
missing = []
for f in sorted(glob.glob(os.path.join(src, "*", "*.png"))):
    kind = os.path.basename(os.path.dirname(f))
    code = os.path.splitext(os.path.basename(f))[0]
    out = f"assets/cards/{kind}/{code}.webp"
    if not os.path.exists(out):
        missing.append(out)
        continue
    Image.open(f).convert("RGB").resize((160, 213), Image.LANCZOS).save(
        out, "WEBP", quality=82, method=6)
    total += os.path.getsize(out)
    n += 1
if missing:
    print("差し替え先が無い:", *missing, sep="\\n  ")
    sys.exit(1)
print(f"{n}枚 / 合計 {total/1024:.0f}KB")
`;

execFileSync("python3", ["-c", py, src], { stdio: "inherit" });
console.log("npm run build で index.html に埋め直す");
