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

const result = await build({
  entryPoints: ["src/main.jsx"],
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
});

const js = result.outputFiles[0].text;
const template = fs.readFileSync("index.template.html", "utf8");
const html = template.replace("__BUNDLE__", () => js);
fs.writeFileSync("index.html", html);

// 配信用。ここに置いたものだけが公開される。
// リポジトリの中身(src や tools)を一緒に配らないための箱
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/index.html", html);

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
