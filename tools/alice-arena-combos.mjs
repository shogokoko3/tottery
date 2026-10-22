/**
 * alice-arena.mjs の combo モードの出力(combo-<王のシリーズ>-<Aのスキン>-vs-<相手>.txt)を集めて、
 * 「王 × A のスキン」の勝率と、元の A(同じシリーズの A)との差を表にする。
 *   node tools/alice-arena-combos.mjs reports/alice-tactics/combo-*.txt
 *   FORMAT=md node tools/alice-arena-combos.mjs ...
 */
import fs from "node:fs";
import path from "node:path";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const data = {}; // data[kingSeries][aVariant][base][rank] = {rate, lo, hi, n}
for (const f of process.argv.slice(2)) {
  const m = path.basename(f).match(/^combo-(hero|alice)-(hero|alice|alice-foil|hero-foil)-vs-(hero|alice)\.txt$/);
  if (!m) continue;
  const [, ks, av, base] = m;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const r = line.match(/^(\S+) [^ ]+\s*　*\s+([\d.]+)%\s+\(([\d.]+)–([\d.]+)\)\s+(\d+)-\s*(\d+)-/);
    if (!r) continue;
    (((data[ks] ||= {})[av] ||= {})[base] ||= {})[r[1]] = { rate: Number(r[2]), lo: Number(r[3]), hi: Number(r[4]), n: Number(r[5]) + Number(r[6]) };
  }
}
const md = process.env.FORMAT === "md";
const fmt = (c) => (c ? `${c.rate.toFixed(0)}%` : "·");
const diff = (c, ref) => (c && ref ? `${c.rate - ref.rate >= 0 ? "+" : ""}${(c.rate - ref.rate).toFixed(0)}` : "·");
for (const ks of ["hero", "alice"]) {
  const own = ks === "hero" ? "hero" : "alice";
  const variants = Object.keys(data[ks] || {});
  if (!variants.length) continue;
  console.log(`\n## 王のシリーズ: ${ks === "hero" ? "レジェンド" : "アリス"}(元の A は ${own === "hero" ? "レジェンドの A(入れ替え)" : "アリスの A(逆転)"})`);
  for (const base of ["hero", "alice"]) {
    const cols = variants.filter((v) => data[ks][v][base]);
    if (!cols.length) continue;
    console.log(`\n### 相手: ${base === "hero" ? "レジェンド" : "アリス"}(王は CPU が選ぶ)。各 200 局。括弧は元の A との差(ポイント)`);
    const head = ["王", ...cols.map((v) => `A:${v}`)];
    if (md) { console.log(`| ${head.join(" | ")} |`); console.log(`|${head.map(() => "---:").join("|")}|`); }
    else console.log(head.map((x) => String(x).padStart(16)).join(""));
    for (const rank of RANKS) {
      const ref = data[ks][own]?.[base]?.[rank];
      const cells = cols.map((v) => { const c = data[ks][v][base][rank]; return v === own ? fmt(c) : `${fmt(c)} (${diff(c, ref)})`; });
      const row = [rank, ...cells];
      console.log(md ? `| ${row.join(" | ")} |` : row.map((x) => String(x).padStart(16)).join(""));
    }
    // 列の平均
    const avgRow = ["平均", ...cols.map((v) => {
      const xs = RANKS.map((r) => data[ks][v][base][r]).filter(Boolean);
      const refs = RANKS.map((r) => data[ks][own]?.[base]?.[r]).filter(Boolean);
      const a = xs.reduce((t, c) => t + c.rate, 0) / Math.max(1, xs.length);
      const b = refs.reduce((t, c) => t + c.rate, 0) / Math.max(1, refs.length);
      return v === own ? `${a.toFixed(1)}%` : `${a.toFixed(1)}% (${a - b >= 0 ? "+" : ""}${(a - b).toFixed(1)})`;
    })];
    console.log(md ? `| ${avgRow.join(" | ")} |` : avgRow.map((x) => String(x).padStart(16)).join(""));
  }
}
console.log("\n差が +8 を超えるものが「化ける組み合わせ」の候補(各 200 局で区間の幅は ±7 ポイント)");
