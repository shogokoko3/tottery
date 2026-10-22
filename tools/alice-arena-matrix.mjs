/**
 * alice-arena.mjs の matrix / amatrix モードの出力(テキスト)を集めて、王×王の勝率の表にする。
 *   node tools/alice-arena-matrix.mjs reports/alice-tactics/best-matrix-*.txt
 *   FORMAT=md node tools/alice-arena-matrix.mjs ...   # Markdown の表
 * 行=アリス側の王(測る側)、列=相手の王。セルはアリス側の勝率(%)。
 */
import fs from "node:fs";

const files = process.argv.slice(2);
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const cell = {}, rowAvg = {}, colAvg = {};
for (const f of files) {
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^(\S+) 対 (\S+)\s*　*\s+([\d.]+)%\s+\(([\d.]+)–([\d.]+)\)\s+(\d+)-\s*(\d+)-\s*(\d+)/);
    if (!m) continue;
    const [, a, b, rate, lo, hi, w, l] = m;
    cell[`${a}|${b}`] = { rate: Number(rate), lo: Number(lo), hi: Number(hi), w: Number(w), l: Number(l) };
  }
}
const md = process.env.FORMAT === "md";
const fmt = (c) => (c ? `${c.rate.toFixed(0)}` : "·");
const head = ["", ...RANKS, "平均"];
const lines = [];
if (md) {
  lines.push(`| ${head.join(" | ")} |`);
  lines.push(`|${head.map(() => "---:").join("|")}|`);
} else lines.push(head.map((x) => String(x).padStart(5)).join(""));
for (const a of RANKS) {
  const cs = RANKS.map((b) => cell[`${a}|${b}`]).filter(Boolean);
  if (!cs.length) continue;
  const avg = cs.reduce((t, c) => t + c.w, 0) / Math.max(1, cs.reduce((t, c) => t + c.w + c.l, 0)) * 100;
  rowAvg[a] = avg;
  const row = [a, ...RANKS.map((b) => fmt(cell[`${a}|${b}`])), avg.toFixed(0)];
  lines.push(md ? `| ${row.join(" | ")} |` : row.map((x) => String(x).padStart(5)).join(""));
}
const colRow = ["平均", ...RANKS.map((b) => {
  const cs = RANKS.map((a) => cell[`${a}|${b}`]).filter(Boolean);
  if (!cs.length) return "·";
  const avg = cs.reduce((t, c) => t + c.w, 0) / Math.max(1, cs.reduce((t, c) => t + c.w + c.l, 0)) * 100;
  colAvg[b] = avg;
  return avg.toFixed(0);
}), ""];
lines.push(md ? `| ${colRow.join(" | ")} |` : colRow.map((x) => String(x).padStart(5)).join(""));
console.log(lines.join("\n"));
console.log(`\nセル数 ${Object.keys(cell).length}。95%区間の幅は各セル ±8〜10 ポイント(各100局)`);
