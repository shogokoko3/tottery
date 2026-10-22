/**
 * alice-arena.mjs の記録(1局1行の JSONL)を集計して、振り返りの材料を出す。
 *   node tools/alice-arena-report.mjs reports/alice-tactics/baseline-a.jsonl [more.jsonl ...]
 *   MODE=series node tools/alice-arena-report.mjs run.jsonl      # そのモードだけ
 *   BY=king|area|both (既定 both)
 *
 * 出すもの
 *   - 測る側の王の数字 × 相手の王の数字 の勝率(局数つき)
 *   - 測る側のエリア × 相手のエリア の勝率
 *   - 負け方(王がどう倒れたか)の内訳と平均手数
 */
import fs from "node:fs";

const files = process.argv.slice(2);
if (!files.length) { console.error("JSONL を渡してください"); process.exit(1); }
const onlyMode = process.env.MODE || null;
const onlyLabel = process.env.LABEL || null;
const rows = files.flatMap((f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)))
  .filter((r) => (!onlyMode || r.mode === onlyMode) && (!onlyLabel || r.label === onlyLabel));
console.log(`${rows.length} 局`);

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const pct = (w, l) => (w + l ? ((w / (w + l)) * 100).toFixed(0) + "%" : "-");

function table(title, keyA, keyB, order) {
  const cell = {};
  const rowTot = {}, colTot = {};
  for (const r of rows) {
    if (r.result === "open") continue;
    const a = r[keyA] || "?", b = r[keyB] || "?";
    const k = `${a}|${b}`;
    cell[k] = cell[k] || { w: 0, l: 0 };
    rowTot[a] = rowTot[a] || { w: 0, l: 0 };
    colTot[b] = colTot[b] || { w: 0, l: 0 };
    const win = r.result === "win" ? 1 : 0;
    cell[k].w += win; cell[k].l += 1 - win;
    rowTot[a].w += win; rowTot[a].l += 1 - win;
    colTot[b].w += win; colTot[b].l += 1 - win;
  }
  const as = order ? order.filter((x) => rowTot[x]) : Object.keys(rowTot).sort();
  const bs = order ? order.filter((x) => colTot[x]) : Object.keys(colTot).sort();
  console.log(`\n## ${title}(測る側の勝率。行=測る側、列=相手)`);
  console.log(["", ...bs, "計"].map((x) => String(x).padStart(6)).join(""));
  for (const a of as) {
    const line = [a, ...bs.map((b) => { const c = cell[`${a}|${b}`]; return c ? pct(c.w, c.l) : "·"; }), pct(rowTot[a].w, rowTot[a].l)];
    console.log(line.map((x) => String(x).padStart(6)).join("") + `  (${rowTot[a].w + rowTot[a].l}局)`);
  }
  console.log(["計", ...bs.map((b) => pct(colTot[b].w, colTot[b].l)), ""].map((x) => String(x).padStart(6)).join(""));
}

const by = process.env.BY || "both";
if (by !== "area") table("王の数字", "testedKing", "baseKing", RANKS);
if (by !== "king") table("エリア", "testedArea", "baseArea", null);

/** 負け方の分類(記録の末尾3行から) */
function cause(r) {
  const t = r.tail.join(" / ");
  if (/時間切れ/.test(t)) return "時間切れ";
  if (/王を立てられない/.test(t)) return "王を立てられない";
  if (/帰還できず/.test(t)) return "帰還できず(2・3)";
  if (/包囲で/.test(t) && /王が倒された/.test(t)) return "包囲で王を撃破";
  if (/盤面効果を発動した$/.test(r.tail[r.tail.length - 1]) && /王が倒された/.test(t)) return "クロッケーで王を撃破";
  if (/王が倒された/.test(t)) return "王を撃破";
  if (/同点|引き分け/.test(t)) return "引き分け";
  return "その他";
}
console.log("\n## 決着の形(測る側から見た勝ち/負け)");
const causes = {};
let turnsW = 0, nW = 0, turnsL = 0, nL = 0;
for (const r of rows) {
  if (r.result === "open") continue;
  const c = cause(r);
  causes[c] = causes[c] || { win: 0, lose: 0 };
  causes[c][r.result]++;
  if (r.result === "win") { turnsW += r.turns; nW++; } else { turnsL += r.turns; nL++; }
}
for (const [c, v] of Object.entries(causes).sort((a, b) => b[1].win + b[1].lose - a[1].win - a[1].lose))
  console.log(`  ${c.padEnd(14, "　")} 勝ち ${String(v.win).padStart(4)}  負け ${String(v.lose).padStart(4)}`);
console.log(`  平均手数: 勝ち ${(turnsW / Math.max(1, nW)).toFixed(1)}  負け ${(turnsL / Math.max(1, nL)).toFixed(1)}`);

// 短い決着(10手以内)の割合と、そのときの相手のエリア
const quick = rows.filter((r) => r.result !== "open" && r.turns <= 10);
console.log(`\n## 10手以内の決着: ${quick.length}/${rows.length} 局`);
const quickBy = {};
for (const r of quick) { const k = `${r.result} 相手:${r.baseArea}`; quickBy[k] = (quickBy[k] || 0) + 1; }
for (const [k, n] of Object.entries(quickBy).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${k.padEnd(28)} ${n}`);

if (process.env.SAMPLES) {
  const n = Number(process.env.SAMPLES);
  console.log(`\n## 負けた局の例(${n}局)`);
  for (const r of rows.filter((r) => r.result === "lose").slice(0, n))
    console.log(`  seed ${r.seed} 席${r.seat} 王 ${r.testedKing}(${r.testedArea}) 対 ${r.baseKing}(${r.baseArea}) ${r.turns}手: ${r.tail.join(" / ")}`);
}
