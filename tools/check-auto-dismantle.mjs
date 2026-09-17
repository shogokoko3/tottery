import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalize,
  pull,
  dismantleResults,
  dismantleAll,
  dismantledIndexes,
  DISMANTLE_RARITIES,
  DEFAULT_DISMANTLE_RARITIES,
} from "../src/skins/collection.js";
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

// どのレア度を崩すかを選べる(2026-09-17 本人の指示)。既定は R と SR で、SSR は守る
assert.deepEqual(DISMANTLE_RARITIES, ["R", "SR", "SSR"]);
assert.deepEqual(DEFAULT_DISMANTLE_RARITIES, ["R", "SR"], "SSR は既定で崩さない");
assert.deepEqual(normalize(null).dismantleRarities, ["R", "SR"]);
assert.deepEqual(normalize({ dismantleRarities: ["SSR", "bogus", "R"] }).dismantleRarities, ["R", "SSR"], "知らない値は落とし、並びはそろえる");
assert.deepEqual(normalize({ dismantleRarities: [] }).dismantleRarities, [], "全部外せる");
assert.deepEqual(normalize({ dismantleRarities: "R" }).dismantleRarities, ["R", "SR"], "配列でなければ既定");
{
  const ssr = POOL.find((s) => s.rarity === "SSR");
  const s = normalize({ owned: { [r.id]: 2, [ssr.id]: 2 } });
  const res = [{ id: r.id }, { id: ssr.id }];
  assert.deepEqual(dismantleResults(s, res, ["R", "SR"]).rows.map((x) => x.id), [r.id], "既定では SSR を崩さない");
  assert.equal(dismantleResults(s, res, ["R", "SR", "SSR"]).rows.length, 2, "SSR を入れれば崩す");
  assert.equal(dismantleResults(s, res, []).gain, 0, "空なら何も崩さない");
  assert.equal(dismantleResults(s, res).rows.length, 2, "指定なしは今までどおり全部");
}

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

// 10連で、どの札が崩れたかを1枚ずつ目で追える(2026-09-17 本人の指示)
{
  const res = [{ id: "x" }, { id: "x" }, { id: "x" }, { id: "y" }, { id: "z" }];
  const at = dismantledIndexes(res, { rows: [{ id: "x", count: 2, gain: 20 }, { id: "y", count: 1, gain: 375 }] });
  assert.deepEqual([...at.keys()], [1, 2, 3], "同じ札が複数なら後ろから印(先頭の1枚は残る)");
  assert.equal(at.get(1), 10, "1枚あたりのエーテルを出す");
  assert.equal(at.get(3), 375);
  assert.equal(at.has(0), false, "残した1枚には印を付けない");
  assert.equal(at.has(4), false, "崩していない札には付けない");
  assert.equal(dismantledIndexes(res, null).size, 0, "崩していなければ何も付かない");
  const all = dismantledIndexes(res, { rows: [{ id: "x", count: 3, gain: 30 }] });
  assert.deepEqual([...all.keys()], [0, 1, 2], "全部崩したら全部に印");
}

// 画面の配線
const css = fs.readFileSync("src/skins/styles.css", "utf8");
assert.match(css, /\.skins-result-dismantle \{/);
assert.match(css, /\.skins-auto-dismantle input \{[\s\S]*?width: 20px/, "触れる大きさのチェック");
const ui = fs.readFileSync("src/ui/skins.jsx", "utf8");
assert.match(ui, /function ResultDismantle\(/, "結果画面の欄");
assert.match(ui, /collection\.pending\?\.results && \(\s*<ResultDismantle/, "ガチャの結果にだけ出す(錬成・交換・加工には出さない)");
assert.match(ui, /dismantleResults\(s, results, s\.dismantleRarities\)\.state/, "崩すのは台帳の更新の中で行う");
assert.match(ui, /autoDismantle: !s\.autoDismantle/, "自動の入り切りを覚える");
assert.match(ui, /dismantleResults\(s, results, s\.dismantleRarities\)\.state/, "崩すのは選んだレア度だけ");
assert.match(ui, /dismantleRarities: s\.dismantleRarities\.includes\(rarity\)/, "レア度の入り切りを覚える");
assert.match(ui, /DISMANTLE_RARITIES\.map\(\(r\) => \(/, "レア度の選択を結果画面に出す");
assert.match(ui, /const crushed = dismantledAt\.has\(index\);/, "崩した札は1枚ずつ印を出す");
assert.match(ui, /崩した \+\$\{dismantledAt\.get\(index\)\}/, "その1枚で得たエーテルを出す");
assert.match(ui, /is-dismantled/, "崩した札は見た目でも分かる");
assert.match(ui, /setDismantled\(null\);/, "結果を閉じたら印を消す(次の抽選に持ち越さない)");
assert.match(css, /\.skin-dismantled \{/);
assert.match(css, /\.skins-result\.is-dismantled \.skins-result-art \{[\s\S]*?opacity/, "崩した札は薄く");
assert.match(ui, /if \(fired\.current \|\| !auto \|\| preview\.gain <= 0\) return;/, "自動は開いた時点で一度だけ");
assert.doesNotMatch(ui, /dismantleAll\(c\)[\s\S]{0,80}autoDismantle/, "自動で一括分解はしない");
console.log("ガチャ結果の自動分解: 既定切・抽選の分だけ・フォイルと記念札と最後の1枚は残す・二度取りなし・配線: OK");
