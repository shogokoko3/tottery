/**
 * src/ を1枚の HTML に束ねる。
 * 画像は data URI として、CSS は文字列として埋め込むので、
 * 出来上がった index.html はそれ単体で動く（サーバー側の設定に依存しない）。
 *
 * 音だけは別にして、assets/audio/ の m4a を audio/ と dist/audio/ へ写す。
 * 7曲を data URI で入れると HTML が1MB以上太り、1曲も鳴らないうちに
 * 全部を落としてくることになる。置くファイルが増えるだけで、
 * サーバー側の設定に頼らないのは変わらない。
 *
 * 写すときは中身のハッシュを名前に埋める(title.m4a → title.a1b2c3d4.m4a)。
 * 配信側(_headers)は audio/ を1年キャッシュしてよく、曲を差し替えたときだけ
 * 新しい名前で落ちてくる。元の名前との対応表は __AUDIO_FILES__ として
 * スクリプトに埋め込み、src/audio/tracks.js の audioUrl() が引く。
 */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs";

const dev = process.argv.includes("--dev");

// 音。index.html からは audio/ という相対の場所として見えている。
// 束ねる前に写して、元の名前 → ハッシュ付きの名前 の表を作っておく
const audioFiles = {};
let audioKb = 0;
for (const dir of ["audio", "dist/audio"]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
if (fs.existsSync("assets/audio"))
  for (const name of fs.readdirSync("assets/audio")) {
    if (!name.endsWith(".m4a")) continue;
    const data = fs.readFileSync(`assets/audio/${name}`);
    audioKb += data.length;
    const hash = createHash("sha256").update(data).digest("hex").slice(0, 8);
    const hashed = name.replace(/\.m4a$/, `.${hash}.m4a`);
    audioFiles[name] = hashed;
    for (const dir of ["audio", "dist/audio"])
      fs.writeFileSync(`${dir}/${hashed}`, data);
  }

/** 束ね方。本体と管理画面で同じ */
const bundleOptions = {
  bundle: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  minify: !dev,
  legalComments: "none",
  loader: {
    ".jsx": "jsx",
    ".webp": "dataurl",
    ".png": "dataurl",
    ".css": "text",
  },
  write: false,
  logLevel: "info",
  define: { __AUDIO_FILES__: JSON.stringify(audioFiles) },
};

/** 入口と枠を渡して、1枚の HTML にする */
async function bundleInto(entry, templateFile) {
  const result = await build({ ...bundleOptions, entryPoints: [entry] });
  const js = result.outputFiles[0].text;
  const template = fs.readFileSync(templateFile, "utf8");
  return { html: template.replace("__BUNDLE__", () => js), js };
}

const { html, js } = await bundleInto("src/main.jsx", "index.template.html");
fs.writeFileSync("index.html", html);

// 配信用。ここに置いたものだけが公開される。
// リポジトリの中身(src や tools)を一緒に配らないための箱
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/index.html", html);

// スキンの画像と映像は別ファイルで必要な場面だけ読み込む。
for (const dir of ["skins", "dist/skins"]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync("assets/skins", dir, { recursive: true });
}

// 管理画面。サーバーに載っている成績(ranks)と待ち合わせ(lobby)を見る。
// 運営用の管理画面。
//
// **配信先(dist/)には置かない。** 置くと URL を知っている誰でも開けてしまい、
// 台帳の一覧・使用停止・お知らせの送信まで触れる。認証の仕組みが無いので、
// 公開しないことで塞ぐ。
//
// 使うときは手元で `npm run serve` して http://localhost:4199/admin.html を開く。
// Firebase へは手元からでも同じように届くので、できることは変わらない。
const admin = await bundleInto("src/admin/admin.jsx", "admin.template.html");
fs.writeFileSync("admin.html", admin.html);
// 前に配信していた名残が dist に残っていたら消す(消し忘れると公開が続く)
if (fs.existsSync("dist/admin.html")) fs.rmSync("dist/admin.html");

// 配信側の設定。Cloudflare Pages と Netlify のどちらも、この2ファイルを
// 公開フォルダに置くだけで読む(キャッシュの期限・セキュリティ用のヘッダー)
for (const name of ["_headers", "_redirects"])
  if (fs.existsSync(name)) fs.copyFileSync(name, `dist/${name}`);

const kb = (n) => (n / 1024).toFixed(0) + "KB";
console.log(
  `\nindex.html と dist/index.html を書き出しました: ${kb(Buffer.byteLength(html))} (スクリプト ${kb(Buffer.byteLength(js))})`,
);
console.log(`audio/ と dist/audio/ に曲を写しました: ${kb(audioKb)}`);
console.log(
  `admin.html を書き出しました(手元だけ。配信先には置かない): ${kb(Buffer.byteLength(admin.html))}`,
);
