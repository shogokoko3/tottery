/**
 * まとめ錬成と、同じフォイルの一括分解(本人の指示 2026-09-19)。
 *
 * いちばん守りたいのは **まとめ錬成の結果を pending に入れないこと**。
 * pending は召喚の席で、自動分解(ResultDismantle)がそこにぶら下がっている。
 * 錬成は払った 1/4 しか戻らない(CRAFT_RATIO=4)ので、自動分解を入れている人が
 * まとめて作った瞬間に大半を無言で失う。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  craft,
  craftMany,
  shatter,
  shatterMany,
  normalize,
} from "../src/skins/collection.js";
import { CRAFT_MAX, craftCheck, craftableCount, costOf } from "../src/skins/ether.js";
import { shatterCheck } from "../src/skins/shards.js";
import { byId, foilId } from "../src/skins/catalog.js";

const ui = readFileSync(new URL("../src/ui/skins.jsx", import.meta.url), "utf8");
const picker = readFileSync(
  new URL("../src/ui/amount-picker.jsx", import.meta.url),
  "utf8",
);

const never = () => 0.9; // フォイルを出さない
const always = () => 0.001; // かならずフォイル
const R = "zombie-male";
const RCOST = costOf(byId(R));

// --- 1枚版と同じであること(既存の道を変えていない証明) ---
const one = normalize({ owned: { [R]: 1 }, ether: 1000 });
assert.deepEqual(craftMany(one, R, 1, never), craft(one, R, never), "1枚の錬成は従来と同じ");
const foils = normalize({ owned: { [foilId(R)]: 5 } });
assert.deepEqual(
  shatterMany(foils, foilId(R), 1),
  shatter(foils, foilId(R)),
  "1枚の分解は従来と同じ",
);

// --- まとめ錬成は召喚の席(pending)を使わない ---
const made = craftMany(one, R, 5, never);
assert.ok(!made.pending, "pending には触らない(自動分解の対象にしない)");
assert.equal(made.lastCraft.results.length, 5, "結果は lastCraft.results に入る");
assert.equal(made.lastCraft.id, made.lastCraft.results[0].id, "id は1枚目のぶんを残す");
assert.ok(!craftMany(one, R, 1, never).lastCraft.results, "1枚なら results を付けない");

// --- 残高と所持の算術 ---
assert.equal(made.ether, 1000 - RCOST * 5, "エーテルは枚数ぶんちょうど減る");
assert.equal(made.owned[R], 1 + 5, "所持は枚数ぶん増える");
const broke = shatterMany(foils, foilId(R), 4);
assert.equal(broke.owned[foilId(R)], 1, "最後の1枚は必ず残る");
assert.equal(broke.shards, 4, "欠片は枚数ぶんちょうど増える");

// --- 抽選は1枚ごとに独立して引く ---
let calls = 0;
craftMany(one, R, 7, () => ((calls += 1), 0.9));
assert.equal(calls, 7, "乱数は1枚につき1回");
assert.equal(
  craftMany(one, R, 3, always).lastCraft.results.filter((r) => byId(r.id).foil).length,
  3,
  "1枚ごとに抽選するので、当たり続ければ全部フォイル",
);

// --- NEW の印は同じ回の中で1枚目だけ ---
assert.deepEqual(
  craftMany(normalize({ owned: {}, ether: 1000 }), R, 3, never).lastCraft.results.map(
    (r) => r.isNew,
  ),
  [true, false, false],
  "同じ回の2枚目以降は NEW にしない",
);

// --- 全か無か。断るときは state を1バイトも変えない ---
const before = JSON.parse(JSON.stringify(one));
for (const n of [0, -1, 2.5, 1e9, CRAFT_MAX + 1, "3", null, NaN]) {
  assert.throws(() => craftMany(one, R, n, never), `枚数 ${String(n)} は断る`);
}
// 枚数を省いたら1枚(craftCheck の既定に合わせる)
assert.deepEqual(craftMany(one, R, undefined, never), craft(one, R, never));
assert.throws(
  () => craftMany(normalize({ owned: {}, ether: 10 }), R, 5, never),
  /足りません/,
  "エーテルが足りなければ1枚も作らない",
);
assert.deepEqual(one, before, "断ったときに state は無傷");
for (const n of [0, 2.5, 5, "2"]) {
  assert.throws(() => shatterMany(foils, foilId(R), n), `分解 ${String(n)} は断る`);
}
assert.match(shatterCheck(foils, foilId(R), 5).why, /崩せるのは 4 枚まで/);

// --- 上限。ぴったりは通り、+1 は断る ---
const rich = normalize({ owned: { [R]: 1 }, ether: 999999 });
assert.equal(craftableCount(rich, R), CRAFT_MAX, "上限で頭打ちにする");
assert.equal(craftableCount(normalize({ ether: RCOST * 3 }), R), 3, "持っているぶんだけ");
assert.equal(craftableCount(normalize({ ether: 0 }), R), 0, "無ければ0");
assert.ok(craftCheck(rich, R, CRAFT_MAX).ok);
assert.equal(craftCheck(rich, R, CRAFT_MAX + 1).ok, false);

// --- 未確認の結果があるうちは作らせない(不変条件) ---
assert.throws(() => craftMany(made, R, 2, never), /結果を確認/, "結果が残っていたら断る");

// --- 保存を往復しても結果が落ちない ---
const saved = normalize(JSON.parse(JSON.stringify(made)));
assert.equal(saved.lastCraft.results.length, 5, "往復しても枚数が残る");
assert.deepEqual(
  saved,
  normalize(JSON.parse(JSON.stringify(saved))),
  "2周目で変わらない",
);
assert.ok(
  !normalize({ ...made, lastCraft: { ...made.lastCraft, results: [{ id: "nope" }] } })
    .lastCraft.results,
  "知らない札しか無ければ results ごと落とす",
);

// --- 画面の配線 ---
assert.match(
  ui,
  /\{\/\* 崩せるのはガチャの結果だけ[\s\S]*?\{collection\.pending\?\.results && \(\s*<ResultDismantle/,
  "自動分解は pending(ガチャ)のときだけ。まとめ錬成の結果に付けない",
);
assert.match(ui, /craftResult\?\.results/, "結果の並びは lastCraft.results も見る");
assert.match(ui, /<AmountPicker/, "枚数を選ぶ部品を確認の中に置く");
assert.equal((ui.match(/<AmountPicker/g) || []).length, 2, "錬成と分解の両方に置く");
assert.match(ui, /craftMany\(c, skin\.id, n\)/, "まとめ錬成は1回の更新で確定する");
assert.match(ui, /shatterMany\(c, skin\.id, n\)/, "一括分解も1回の更新で確定する");
assert.match(ui, /setConfirmCraft\(skin\)/, "作るときも確認を挟む(選ぶ→確認→確定)");
assert.match(picker, /aria-label="1つ増やす"/, "読み上げの名前を付ける");
assert.match(picker, /最大（\{max\}/, "上限までまとめて選べる");

console.log(
  "まとめ錬成・一括分解: 1枚版と同値・pending 不使用・抽選は1枚ごと・全か無か・上限・保存往復・配線: OK",
);
