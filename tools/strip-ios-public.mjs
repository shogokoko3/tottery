/**
 * cap copy が dist/ を丸ごと ios/App/App/public/ へ写したあと、
 * アプリに入れてはいけないものを落とす。
 *
 * admin.html は Firebase の記録を読み書き・削除できる運営用の画面。
 * バイナリに入れると IPA から誰でも取り出せるので、必ず落とす。
 * _headers は Cloudflare の配信設定で、アプリの中では意味がない。
 *
 * cap copy のあとに必ず走らせること(npm run ios:sync がそうしている)。
 */
import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = "ios/App/App/public";
const 落とすもの = ["admin.html", "_headers", "_redirects"];

if (!fs.existsSync(PUBLIC_DIR)) {
  console.error(`× ${PUBLIC_DIR} が無い。先に npx cap copy ios を走らせること`);
  process.exit(1);
}

// 本体が居ることを確かめてから消す。写し損ねに気づかず消すのを防ぐ
if (!fs.existsSync(path.join(PUBLIC_DIR, "index.html"))) {
  console.error(`× ${PUBLIC_DIR}/index.html が無い。写しが失敗している`);
  process.exit(1);
}

const 落とした = [];
for (const name of 落とすもの) {
  const p = path.join(PUBLIC_DIR, name);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true });
    落とした.push(name);
  }
}

console.log(
  落とした.length
    ? `アプリに入れないものを落とした: ${落とした.join(", ")}`
    : "落とすものは無かった",
);

// Finder の属性(リソースフォークなど)が付いた素材が混ざると、署名で
// 「resource fork, Finder information, or similar detritus not allowed」になる(2026-09-12 に当たった)。
// 写したあとに全部落とす
import { execFileSync } from "node:child_process";
try {
  execFileSync("xattr", ["-cr", PUBLIC_DIR], { stdio: "ignore" });
  console.log("Finder の属性を落とした: " + PUBLIC_DIR);
} catch {
  console.warn("xattr が使えなかった(署名で detritus と言われたら手で xattr -cr " + PUBLIC_DIR + ")");
}
