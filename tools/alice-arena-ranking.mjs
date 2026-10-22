/**
 * フォイル持ちの王 24 種(最初のシリーズ 12 ＋ アリス 12)の優劣の早見表。
 * alice-arena.mjs の matrix(アリス対最初)・amatrix(アリス同士)・hmatrix(最初同士)の出力を集めて、
 * 24×24 の勝率表と、全員との平均勝率で順位を付ける。
 *   node tools/alice-arena-ranking.mjs reports/alice-tactics/all-*.txt
 *   FORMAT=md node tools/alice-arena-ranking.mjs ...   # Markdown
 */
import fs from "node:fs";
import { SKINS } from "../src/skins/catalog.js";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const KINGS = [...RANKS.map((r) => `H${r}`), ...RANKS.map((r) => `A${r}`)]; // H=最初のシリーズ、A=アリス
const name = (k) => {
  const series = k[0] === "H" ? "heroes" : "alice", rank = k.slice(1);
  const skin = SKINS.find((s) => s.series === series && s.rank === rank && s.id !== "pegasus-knight");
  return `${k[0] === "H" ? "レ" : "ア"} ${rank} ${skin?.name || ""}`;
};
const cell = {};
const put = (a, b, w, l) => {
  cell[`${a}|${b}`] = { w, l };
  if (!cell[`${b}|${a}`]) cell[`${b}|${a}`] = { w: l, l: w };
};
let mode = null;
for (const f of process.argv.slice(2)) {
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    if (/アリスの王\(固定\) 対 最初のシリーズの王/.test(line)) mode = "matrix";
    else if (/アリスの王\(固定\) 対 アリスの王/.test(line)) mode = "amatrix";
    else if (/最初のシリーズの王\(固定\) 対 最初のシリーズの王/.test(line)) mode = "hmatrix";
    const m = line.match(/^(\S+) 対 (\S+)\s*　*\s+([\d.]+)%\s+\([\d.–]+\)\s+(\d+)-\s*(\d+)-\s*(\d+)/);
    if (!m || !mode) continue;
    const [, r, q, , w, l] = m;
    const a = mode === "hmatrix" ? `H${r}` : `A${r}`;
    const b = mode === "matrix" ? `H${q}` : mode === "amatrix" ? `A${q}` : `H${q}`;
    // 同じ型どうしの表は r 対 q と q 対 r の両方を測っている。先に出た方を優先せず、両方あれば足す
    if (a === b) { put(a, b, Number(w), Number(l)); continue; }
    const key = `${a}|${b}`;
    if (cell[key] && cell[key].src === mode) continue;
    cell[key] = { w: Number(w), l: Number(l), src: mode };
    if (!cell[`${b}|${a}`] || cell[`${b}|${a}`].src !== mode) cell[`${b}|${a}`] = { w: Number(l), l: Number(w), src: mode };
  }
}
// 同じ型どうしの表は両向きが測られているので、足し合わせて1つにする
for (const a of KINGS) for (const b of KINGS) {
  if (a >= b) continue;
  const x = cell[`${a}|${b}`], y = cell[`${b}|${a}`];
  if (x && y && x.src === y.src && x.src !== "matrix" && !x.merged) {
    const w = x.w + y.l, l = x.l + y.w;
    cell[`${a}|${b}`] = { w, l, src: x.src, merged: true };
    cell[`${b}|${a}`] = { w: l, l: w, src: x.src, merged: true };
  }
}
const avg = {};
for (const a of KINGS) {
  let w = 0, l = 0;
  for (const b of KINGS) { const c = cell[`${a}|${b}`]; if (c) { w += c.w; l += c.l; } }
  avg[a] = w + l ? (w / (w + l)) * 100 : null;
}
const order = KINGS.filter((k) => avg[k] != null).sort((a, b) => avg[b] - avg[a]);
if (process.env.FORMAT === "json") {
  const rows = {};
  for (const a of KINGS) rows[a] = Object.fromEntries(KINGS.map((b) => { const c = cell[`${a}|${b}`]; return [b, c ? Math.round((c.w / (c.w + c.l)) * 100) : null]; }));
  console.log(JSON.stringify({ kings: KINGS, names: Object.fromEntries(KINGS.map((k) => [k, name(k)])), avg, rows }));
  process.exit(0);
}
const md = process.env.FORMAT === "md";
const tier = (v) => (v >= 60 ? "S" : v >= 55 ? "A" : v >= 48 ? "B" : v >= 42 ? "C" : "D");
console.log(md ? "| 順位 | 王 | 全員との平均勝率 | 格 | 対レジェンド | 対アリス |\n|---:|---|---:|:---:|---:|---:|" : "順位  王                      平均   格  対レ  対ア");
for (const [i, k] of order.entries()) {
  const sub = (prefix) => {
    let w = 0, l = 0;
    for (const b of KINGS) if (b[0] === prefix) { const c = cell[`${k}|${b}`]; if (c) { w += c.w; l += c.l; } }
    return w + l ? ((w / (w + l)) * 100).toFixed(0) + "%" : "-";
  };
  const v = avg[k];
  console.log(md ? `| ${i + 1} | ${name(k)} | ${v.toFixed(1)}% | ${tier(v)} | ${sub("H")} | ${sub("A")} |`
    : `${String(i + 1).padStart(3)}  ${name(k).padEnd(22, "　")} ${v.toFixed(1).padStart(5)}%  ${tier(v)}  ${sub("H").padStart(4)} ${sub("A").padStart(4)}`);
}
if (process.env.TABLE) {
  console.log(md ? "\n| | " + KINGS.map((k) => k).join(" | ") + " |\n|---|" + KINGS.map(() => "---:").join("|") + "|" : "\n" + ["", ...KINGS].map((x) => x.padStart(4)).join(""));
  for (const a of KINGS) {
    const row = KINGS.map((b) => { const c = cell[`${a}|${b}`]; return c ? ((c.w / (c.w + c.l)) * 100).toFixed(0) : "·"; });
    console.log(md ? `| ${a} | ${row.join(" | ")} |` : [a, ...row].map((x) => x.padStart(4)).join(""));
  }
}
console.log(`\nセル ${Object.keys(cell).length}。各セル 100 局(同じシリーズ同士は両向き 200 局)。格: S 60%以上、A 55〜60、B 48〜55、C 42〜48、D 42 未満`);
