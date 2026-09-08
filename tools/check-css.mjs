/**
 * CSS の括弧が閉じているかを見る。
 *
 * 2026-09-08、合流で `.account-id { ... ` の閉じ括弧が落ち、そこから後ろの
 * CSS(ホーム画面など)が丸ごと無効になった。ブラウザは黙って読み飛ばすので、
 * 画面を見るまで気づけない。括弧の数だけでも機械に数えさせておく。
 */
import fs from "node:fs";

const files = ["src/styles.css", ...fs.readdirSync("src/ui").filter((f) => f.endsWith(".css")).map((f) => `src/ui/${f}`), "src/skins/styles.css", "src/admin/admin.css"].filter((f) => fs.existsSync(f));
let bad = 0;
for (const file of files) {
  // コメントと文字列の中の括弧は数えない
  const css = fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
  let depth = 0,
    line = 1,
    firstBad = null;
  for (const ch of css) {
    if (ch === "\n") line++;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth < 0) {
      firstBad = firstBad ?? line;
      depth = 0;
    }
  }
  if (depth !== 0 || firstBad !== null) {
    bad++;
    console.error(
      `× ${file}: 括弧が合わない(${depth > 0 ? `閉じ忘れ ${depth} 個` : `余分な閉じ括弧 ${firstBad} 行目`})。` +
        "そこから後ろの CSS が全部無効になる",
    );
  }
}
if (bad) process.exit(1);
console.log(`CSS ${files.length} 本、括弧はどれも閉じている`);
