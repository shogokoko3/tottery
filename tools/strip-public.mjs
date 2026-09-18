/**
 * cap copy が dist/ を丸ごとアプリの中へ写したあと、
 * アプリに入れてはいけないものを落とす。
 *
 * admin.html は Firebase の記録を読み書き・削除できる運営用の画面。
 * バイナリに入れると IPA / AAB から誰でも取り出せるので、必ず落とす。
 * _headers は Cloudflare の配信設定で、アプリの中では意味がない。
 *
 * cap copy のあとに必ず走らせること(npm run ios:sync / android:sync がそうしている)。
 *
 *   node tools/strip-public.mjs ios      → ios/App/App/public
 *   node tools/strip-public.mjs android  → android/app/src/main/assets/public
 */
import fs from "node:fs";
import path from "node:path";

const 写し先 = {
  ios: "ios/App/App/public",
  android: "android/app/src/main/assets/public",
};
const platform = process.argv[2] || "ios";
const PUBLIC_DIR = 写し先[platform];
if (!PUBLIC_DIR) {
  console.error(`× 知らない配信先: ${platform}(ios か android)`);
  process.exit(1);
}
const 落とすもの = ["admin.html", "_headers", "_redirects"];

if (!fs.existsSync(PUBLIC_DIR)) {
  console.error(
    `× ${PUBLIC_DIR} が無い。先に npx cap copy ${platform} を走らせること`,
  );
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
    ? `アプリに入れないものを落とした(${platform}): ${落とした.join(", ")}`
    : `落とすものは無かった(${platform})`,
);
