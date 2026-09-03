/**
 * src/ を1枚の HTML に束ねる。
 * 画像は data URI として、CSS は文字列として埋め込むので、
 * 出来上がった index.html はそれ単体で動く（サーバー側の設定に依存しない）。
 *
 * 音だけは別にして、assets/audio/ の m4a を audio/ と dist/audio/ へ写す。
 * 7曲を data URI で入れると HTML が1MB以上太り、1曲も鳴らないうちに
 * 全部を落としてくることになる。置くファイルが増えるだけで、
 * サーバー側の設定に頼らないのは変わらない。
 */
import { build } from "esbuild";
import fs from "node:fs";

const dev = process.argv.includes("--dev");

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

// 管理画面。サーバーに載っている成績(ranks)と待ち合わせ(lobby)を見る。
// 本体とは別の1枚にして、/admin.html で開く
const admin = await bundleInto("src/admin/admin.jsx", "admin.template.html");
fs.writeFileSync("admin.html", admin.html);
fs.writeFileSync("dist/admin.html", admin.html);

// 音。index.html からは audio/ という相対の場所として見えている
let audioKb = 0;
for (const dir of ["audio", "dist/audio"]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
if (fs.existsSync("assets/audio"))
  for (const name of fs.readdirSync("assets/audio")) {
    if (!name.endsWith(".m4a")) continue;
    const from = `assets/audio/${name}`;
    audioKb += fs.statSync(from).size;
    for (const dir of ["audio", "dist/audio"])
      fs.copyFileSync(from, `${dir}/${name}`);
  }
for (const name of ["_headers", "_redirects"])
  if (fs.existsSync(name)) fs.copyFileSync(name, `dist/${name}`);

const kb = (n) => (n / 1024).toFixed(0) + "KB";
console.log(
  `\nindex.html と dist/index.html を書き出しました: ${kb(Buffer.byteLength(html))} (スクリプト ${kb(Buffer.byteLength(js))})`,
);
console.log(`audio/ と dist/audio/ に曲を写しました: ${kb(audioKb)}`);
console.log(`admin.html と dist/admin.html を書き出しました: ${kb(Buffer.byteLength(admin.html))}`);
