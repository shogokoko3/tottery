/**
 * フォイルの欠片と交換の検査。
 * 値づけが決め(R1/SR2/SSR5)どおりか、崩す・交換の決まりが守られているか、保存で残るか。
 */
import assert from "node:assert/strict";
import {
  EXCHANGE_COST,
  SHARD_VALUE,
  exchangeCheck,
  exchangeCostOf,
  foilSpares,
  shardValueOf,
  shardsOf,
  shatterCheck,
} from "../src/skins/shards.js";
import { DUST, CRAFT, dismantleCheck } from "../src/skins/ether.js";
import {
  acquiredOf,
  dismantle,
  dismantleAll,
  exchangeFoil,
  normalize,
  shatter,
} from "../src/skins/collection.js";
import { POOL, FOIL_CHANCE, byId, foilId } from "../src/skins/catalog.js";

const saved = (state) => normalize(JSON.parse(JSON.stringify(state)));

// 値づけ: 1欠片 ≒ Rの錬成でフォイル1枚を作る期待エーテル(40 ÷ 1%)。SR はその2倍。
assert.deepEqual(SHARD_VALUE, { R: 1, SR: 2, SSR: 5 });
assert.deepEqual(EXCHANGE_COST, { R: 1, SR: 2, SSR: 5 });
const etherPerShard = CRAFT.R / FOIL_CHANCE;
assert.equal(etherPerShard, 4000);
assert.equal(
  Math.round(CRAFT.SR / FOIL_CHANCE / etherPerShard),
  SHARD_VALUE.SR,
  "SR の欠片は R の2倍の手間",
);
assert.ok(
  CRAFT.SSR / FOIL_CHANCE / etherPerShard > SHARD_VALUE.SSR,
  "SSR のダブりは作る手間より安く数える(1枚で何とでも交換できれば十分)",
);
for (const base of POOL) {
  const foil = byId(foilId(base.id));
  assert.equal(shardValueOf(foil), SHARD_VALUE[base.rarity]);
  assert.equal(shardValueOf(base), 0, "通常版は欠片にならない");
  assert.equal(exchangeCostOf(base), EXCHANGE_COST[base.rarity]);
  assert.equal(exchangeCostOf(foil), EXCHANGE_COST[base.rarity]);
}
assert.equal(exchangeCostOf("pegasus-knight"), null, "早期特典は対象外");
assert.equal(exchangeCostOf("genie-magician"), null, "特別スキンは対象外");
assert.ok(
  EXCHANGE_COST.SSR * etherPerShard > DUST.SSR * 4,
  "交換は分解より高い",
);

// 崩す: 2枚目以降だけ。通常版・最後の1枚・持っていない札は崩せない
let s = normalize({
  owned: {
    "zombie-male": 3,
    "zombie-male:foil": 3,
    "elf-male:foil": 2,
    "dragon-knight:foil": 1,
  },
});
assert.equal(shardsOf(s), 0);
assert.deepEqual(shatterCheck(s, "zombie-male:foil"), { ok: true, gain: 1 });
assert.deepEqual(shatterCheck(s, "elf-male:foil"), { ok: true, gain: 2 });
assert.equal(shatterCheck(s, "dragon-knight:foil").ok, false, "最後の1枚");
assert.match(shatterCheck(s, "dragon-knight:foil").why, /最後の1枚/);
assert.equal(shatterCheck(s, "zombie-male").ok, false, "通常版");
assert.equal(shatterCheck(s, "angel-k:foil").ok, false, "持っていない");
assert.equal(shatterCheck(s, "nope").ok, false);
assert.deepEqual(
  foilSpares(s).map((r) => [r.skin.id, r.spare, r.gain]),
  [
    ["zombie-male:foil", 2, 1],
    ["elf-male:foil", 1, 2],
  ],
);
assert.equal(
  dismantleCheck(s, "zombie-male:foil").ok,
  false,
  "フォイルはエーテルにしない",
);
assert.throws(() => dismantle(s, "zombie-male:foil"), /欠片/);
s = shatter(s, "zombie-male:foil");
s = shatter(s, "elf-male:foil");
assert.equal(shardsOf(s), 3);
assert.equal(s.ether, 0, "欠片にしてもエーテルは増えない");
assert.equal(s.owned["zombie-male:foil"], 2);
assert.equal(s.owned["elf-male:foil"], 1);
assert.throws(() => shatter(s, "elf-male:foil"), /最後の1枚/);
assert.equal(acquiredOf(s, "zombie-male"), 6, "崩しても通算は減らない");
assert.equal(dismantleAll(s).shards, 3, "一括分解はフォイルに触れない");
assert.equal(dismantleAll(s).owned["zombie-male:foil"], 2);
assert.equal(saved(s).shards, 3, "保存で残る");
assert.equal(normalize({ shards: -4 }).shards, 0);
assert.equal(normalize({ shards: 2.5 }).shards, 0);

// 交換: 持っていないフォイルだけ。欠片が足りなければ作れない。抽選はない
assert.equal(exchangeCheck(s, "zombie-male").ok, false, "持っている");
assert.match(exchangeCheck(s, "zombie-male").why, /持っています/);
assert.deepEqual(exchangeCheck(s, "pirate-male"), { ok: true, cost: 1 });
assert.deepEqual(exchangeCheck(s, "viking-male"), { ok: true, cost: 2 });
assert.equal(exchangeCheck(s, "angel-k").ok, false, "SSR は 5 要る");
assert.equal(exchangeCheck(s, "angel-k").short, 2);
assert.equal(exchangeCheck(s, "pegasus-knight").ok, false);
assert.equal(exchangeCheck(s, "genie-magician").ok, false);
assert.throws(() => exchangeFoil(s, "angel-k"), /足りません/);
assert.throws(() => exchangeFoil(s, "zombie-male"), /持っています/);
const made = exchangeFoil(s, "viking-male");
assert.equal(made.shards, 1);
assert.equal(made.owned["viking-male:foil"], 1);
assert.deepEqual(made.lastCraft, {
  id: "viking-male:foil",
  isNew: true,
  source: "exchange",
});
assert.equal(acquiredOf(made, "viking-male"), 1, "交換も通算獲得に数える");
assert.throws(() => exchangeFoil(made, "pirate-male"), /結果を確認/);
assert.equal(
  saved(made).lastCraft.source,
  "exchange",
  "結果の種類は保存で残る",
);
assert.equal(
  saved({
    ...made,
    owned: { ...made.owned, "viking-male": 1 },
    lastCraft: { id: "viking-male", source: "exchange" },
  }).lastCraft.source,
  undefined,
  "通常版に exchange の印は付かない",
);
const again = { ...made, lastCraft: null };
assert.equal(exchangeCheck(again, "viking-male").ok, false, "各キャラ1回");
// 空(10)と宮殿(J・Q・K)は同じ 5。欠片5で必ず1枚
const rich = normalize({ shards: 5, owned: { "zombie-male:foil": 1 } });
for (const id of ["dragon-knight", "angel-k", "demon-q"]) {
  const got = exchangeFoil(rich, id);
  assert.equal(got.shards, 0);
  assert.equal(got.owned[foilId(id)], 1);
}
assert.deepEqual(saved(made), made, "保存して戻しても同じ");

console.log(
  "フォイルの欠片: 値づけ(R1/SR2/SSR5)・2枚目以降だけ・エーテルにしない・交換は未所持だけ・各1回・通算獲得・保存: OK",
);
