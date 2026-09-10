// fortmatrix の結果を 6×6 の表に。未決着は引き分け(0.5)として得点率も出す
import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync(process.argv[2] || "fortmatrix.json"));
const types = ["earth", "sea", "forest", "ice", "sky", "palace"];
const jp = { earth: "土", sea: "海", forest: "森", ice: "氷", sky: "空", palace: "宮殿", none: "無し", free: "自由CPU" };
const cell = {};
for (const r of rows) {
  const [a, b] = r.label.split(" vs ");
  const k1 = a + "|" + b, k2 = b + "|" + a;
  const c1 = (cell[k1] ||= { w: 0, l: 0, u: 0 }), c2 = (cell[k2] ||= { w: 0, l: 0, u: 0 });
  if (r.winner === null) { c1.u++; c2.u++; }
  else if (r.winner === 0) { c1.w++; c2.l++; }
  else { c1.l++; c2.w++; }
}
const fmt = (c) => c ? `${(100 * c.w / (c.w + c.l || 1)).toFixed(0)}% (${(100 * (c.w + 0.5 * c.u) / (c.w + c.l + c.u)).toFixed(0)}) ${c.u}未` : "—";
const cols = [...new Set(rows.map((r) => r.label.split(" vs ")[1]))].filter((t) => !types.includes(t));
const header = ["自分＼相手", ...types.map((t) => jp[t]), ...cols.map((t) => jp[t])];
console.log("| " + header.join(" | ") + " |");
console.log("|" + header.map(() => "---").join("|") + "|");
for (const a of types) {
  const line = [jp[a], ...types.map((b) => a === b ? "—" : fmt(cell[a + "|" + b])), ...cols.map((b) => fmt(cell[a + "|" + b]))];
  console.log("| " + line.join(" | ") + " |");
}
// 総合
console.log("\n総合(対エリア6種): 決着局の勝率 / 未決着を引き分けにした得点率 / 未決着");
for (const a of types) {
  const t = { w: 0, l: 0, u: 0 };
  for (const b of types) { const c = cell[a + "|" + b]; if (c) { t.w += c.w; t.l += c.l; t.u += c.u; } }
  console.log(`${jp[a].padEnd(3)} ${(100 * t.w / (t.w + t.l || 1)).toFixed(1)}%  ${(100 * (t.w + 0.5 * t.u) / (t.w + t.l + t.u || 1)).toFixed(1)}  ${t.u}/${t.w + t.l + t.u}`);
}
