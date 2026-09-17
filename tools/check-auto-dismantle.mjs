import assert from "node:assert/strict";
import fs from "node:fs";
import { normalize, pull, dismantleResults, dismantleAll } from "../src/skins/collection.js";
import { byId, foilId, POOL } from "../src/skins/catalog.js";
import { dustOf, spareOf, isKeepsake } from "../src/skins/ether.js";

// ガチャ結果のダブりを崩す(2026-09-17 本人の指示)。崩すのは**その抽選で来たダブりだけ**
const r = POOL.find((s) => s.rarity === "R");
const sr = POOL.find((s) => s.rarity === "SR");

// 既定は切。入れた値だけを覚える
assert.equal(normalize(null).autoDismantle, false, "既定は自動で崩さない");
assert.equal(normalize({ autoDismantle: true }).autoDismantle, true);
assert.equal(normalize({ autoDismantle: "yes" }).autoDismantle, false, "真偽以外は切");
assert.equal(normalize(JSON.parse(JSON.stringify(normalize({ autoDismantle: true })))).autoDismantle, true, "保存して読み直しても残る");

// 何も無ければ何も起きない
{
  const s = normalize({ owned: { [r.id]: 1 } });
  const out = dismantleResults(s, [{ id: r.id }]);
  assert.equal(out.gain, 0, "最後の1枚は崩さない");
  assert.deepEqual(out.rows, []);
  assert.deepEqual(out.state.owned, s.owned, "状態を変えない");
  assert.equal(dismantleResults(s, null).gain, 0, "結果が無くても落ちない");
  assert.equal(dismantleResults(s, [{}, { id: 42 }]).gain, 0, "壊れた結果は無視する");
}

// この抽選で来たぶんだけ崩す。前から持っていたダブりには触らない
{
  const s = normalize({ owned: { [r.id]: 5 } });
  const out = dismantleResults(s, [{ id: r.id }, { id: r.id }]);
  assert.equal(out.gain, dustOf(r) * 2);
  assert.deepEqual(out.rows, [{ id: r.id, count: 2, gain: dustOf(r) * 2 }]);
  assert.equal(out.state.owned[r.id], 3, "5枚 → 抽選の2枚ぶんだけ減って3枚");
  assert.ok(spareOf(out.state, r.id) > 0, "前からのダブりは残る(一括分解と違う)");
}

// フォイル・記念の札は崩さない
{
  const s = normalize({
    owned: { [foilId(r.id)]: 3, "pegasus-knight": 3, "genie-magician": 3, [r.id]: 3 },
  });
  const out = dismantleResults(s, [
    { id: foilId(r.id) },
    { id: "pegasus-knight" },
    { id: "genie-magician" },
    { id: r.id },
  ]);
  assert.deepEqual(out.rows.map((x) => x.id), [r.id], "崩すのは通常版だけ");
  assert.equal(out.state.owned[foilId(r.id)], 3, "フォイルは欠片の道があるので崩さない");
  assert.equal(out.state.owned["pegasus-knight"], 3);
  assert.equal(out.state.owned["genie-magician"], 3);
  for (const id of Object.keys(out.state.owned))
    if (isKeepsake(id)) assert.equal(out.state.owned[id], 3);
}

// 実際に10連を引いて、崩したあとも所持が1枚を下回らない・二度目は何も起きない
{
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  let s = normalize({ tickets: 100, ether: 0 });
  s = pull(s, 10, rnd, { free: false });
  const results = s.pending.results;
  const before = { ...s.owned };
  const out = dismantleResults(s, results);
  assert.ok(out.gain > 0, "10連なら普通はダブりが出る");
  for (const [id, n] of Object.entries(out.state.owned)) {
    assert.ok(n >= 1, `${id} が 1枚を下回らない`);
    assert.ok(n <= before[id], `${id} が増えない`);
  }
  // 崩した枚数は、その抽選で来た枚数の範囲に収まる
  for (const row of out.rows) {
    const pulled = results.filter((x) => x.id === row.id).length;
    assert.ok(row.count <= pulled, `${row.id}: 崩した ${row.count} ≦ 引いた ${pulled}`);
  }
  assert.equal(out.state.ether, out.gain, "得たエーテルが入る(はじめは0だったので、そのまま)");
  assert.equal(dismantleResults(out.state, results).gain, 0, "二度目は何も崩さない(取りこぼしも二重取りも無い)");
  // 一括分解は今までどおり、前からのダブりも含めて全部崩す(別の道として残す)
  assert.ok(dismantleAll(s).ether >= out.state.ether, "一括分解は結果だけの分解以上に崩す");
}

// 画面の配線
const ui = fs.readFileSync("src/ui/skins.jsx", "utf8");
assert.match(ui, /function ResultDismantle\(/, "結果画面の欄");
assert.match(ui, /collection\.pending\?\.results && \(\s*<ResultDismantle/, "ガチャの結果にだけ出す(錬成・交換・加工には出さない)");
assert.match(ui, /dismantleResults\(s, results\)\.state/, "崩すのは台帳の更新の中で行う");
assert.match(ui, /autoDismantle: !s\.autoDismantle/, "自動の入り切りを覚える");
assert.match(ui, /if \(fired\.current \|\| !auto \|\| preview\.gain <= 0\) return;/, "自動は開いた時点で一度だけ");
assert.doesNotMatch(ui, /dismantleAll\(c\)[\s\S]{0,80}autoDismantle/, "自動で一括分解はしない");
const css = fs.readFileSync("src/skins/styles.css", "utf8");
assert.match(css, /\.skins-result-dismantle \{/);
assert.match(css, /\.skins-auto-dismantle input \{[\s\S]*?width: 20px/, "触れる大きさのチェック");
console.log("ガチャ結果の自動分解: 既定切・抽選の分だけ・フォイルと記念札と最後の1枚は残す・二度取りなし・配線: OK");
