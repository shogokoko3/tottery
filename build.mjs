/**
 * src/ を1枚の HTML に束ねる。
 * 画像は data URI として、CSS は文字列として埋め込むので、
 * 出来上がった index.html はそれ単体で動く（サーバー側の設定に依存しない）。
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

const kb = (n) => (n / 1024).toFixed(0) + "KB";
console.log(`\nindex.html を書き出しました: ${kb(Buffer.byteLength(html))} (スクリプト ${kb(Buffer.byteLength(js))})`);
