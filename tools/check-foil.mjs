import assert from "node:assert/strict";
import {
  ALL_SKINS,
  FOIL_CHANCE,
  FOIL_SKINS,
  FOIL_SUFFIX,
  ODDS,
  POOL,
  SKINS,
  baseSkinId,
  byId,
  draw,
  foilId,
  rate,
  sanitizeLoadout,
} from "../src/skins/catalog.js";
import {
  claimEarly,
  claimSpecial,
  craft,
  dismantle,
  dismantleAll,
  equip,
  grantSkin,
  normalize,
  pull,
} from "../src/skins/collection.js";
import {
  CRAFT,
  DUST,
  costOf,
  craftCheck,
  dismantleCheck,
  dustOf,
  spares,
  totalOfSpares,
} from "../src/skins/ether.js";

const sequence = (values) => {
  let calls = 0;
  const random = () => {
    assert.ok(calls < values.length, "余分な抽選をしていない");
    return values[calls++];
  };
  random.calls = () => calls;
  return random;
};
const fresh = () => normalize(null);
const completed = (state) => ({ ...state, pending: null, lastCraft: null });
const noRandom = () => assert.fail("この経路では再抽選しない");

assert.equal(FOIL_SUFFIX, ":foil");
assert.equal(FOIL_CHANCE, 0.01);
assert.equal(SKINS.length, 17);
assert.equal(POOL.length, 15);
assert.equal(FOIL_SKINS.length, 15);
assert.equal(ALL_SKINS.length, 32);
assert.equal(new Set(ALL_SKINS.map((s) => s.id)).size, 32);
assert.deepEqual(ODDS, { R: 65, SR: 32, SSR: 3 });
assert.equal(baseSkinId("elf-male:foil"), "elf-male");
assert.equal(baseSkinId("elf-male"), "elf-male");
assert.equal(foilId("elf-male:foil"), "elf-male:foil");
for (const base of POOL) {
  const foil = byId(foilId(base.id));
  assert.equal(foil.baseId, base.id);
  assert.equal(foil.foil, true);
  assert.equal(foil.name, base.name + "（フォイル）");
  for (const key of ["rank", "rarity", "family", "video", "videos"])
    assert.deepEqual(foil[key], base[key]);
  for (const key of ["card", "image", "boardCard"])
    assert.equal(foil[key], `skins/foils/${base.id}.webp`);
  assert.ok(!POOL.includes(foil), "仕上げをキャラ抽選の候補に混ぜない");
}
for (const id of ["pegasus-knight:foil", "genie-magician:foil", "evil:foil"])
  assert.equal(byId(id), undefined);

// どのキャラクターでも決定後に別の乱数を1回だけ使う。1%ちょうどは通常版。
let start = 0;
for (const skin of POOL) {
  const baseRoll = (start + rate(skin) / 2) / 100;
  start += rate(skin);
  for (const finish of [0, 0.009999999, 0.01, 0.999999999]) {
    const random = sequence([baseRoll, finish]);
    const result = pull(fresh(), 1, random);
    const id = finish < FOIL_CHANCE ? foilId(skin.id) : skin.id;
    assert.deepEqual(result.pending.results, [{ id, isNew: true }]);
    assert.deepEqual(result.owned, { [id]: 1 });
    assert.equal(random.calls(), 2);
  }
}
// キャラ乱数を全区間に配置し、仕上げ乱数を変えても既存65/32/3を保つ。
const histogram = { R: 0, SR: 0, SSR: 0 };
let foils = 0;
for (let i = 0; i < 10000; i++) {
  const baseRoll = (i + 0.5) / 10000;
  const random = sequence([baseRoll, (i % 100) / 100]);
  const id = pull(fresh(), 1, random).pending.results[0].id;
  assert.equal(baseSkinId(id), draw(() => baseRoll).id);
  histogram[byId(id).rarity]++;
  if (byId(id).foil) foils++;
}
assert.deepEqual(histogram, { R: 6500, SR: 3200, SSR: 300 });
assert.equal(foils, 100);

// 10連も1枚ずつ独立。通常版所持済みでも初フォイルはNEW、同束の2枚目は重複。
const finishes = [0, 0, 0.01, 0.5, 0, 0.5, 0.5, 0.5, 0.5, 0.5];
const tenRandom = sequence(finishes.flatMap((n) => [0.65, n]));
let ten = pull(normalize({ owned: { "elf-male": 1 } }), 10, tenRandom);
assert.equal(tenRandom.calls(), 20);
assert.deepEqual(ten.pending.results.slice(0, 3), [
  { id: "elf-male:foil", isNew: true },
  { id: "elf-male:foil", isNew: false },
  { id: "elf-male", isNew: false },
]);
assert.equal(ten.owned["elf-male"], 8);
assert.equal(ten.owned["elf-male:foil"], 3);
assert.equal(ten.draws, 10);
let repeated = fresh();
for (let i = 0; i < 102; i++)
  repeated = pull(completed(repeated), 1, sequence([0, i < 100 ? 0.5 : 0]));
assert.equal(repeated.owned["zombie-male"], 100, "100回でも確定枠は加えない");
assert.equal(repeated.owned["zombie-male:foil"], 2, "連続当選を抑制しない");

const saved = JSON.parse(JSON.stringify(ten));
assert.deepEqual(normalize(saved), ten, "所持・pending結果を同じIDで復元");
assert.deepEqual(
  normalize({
    owned: ["elf-male", "elf-male", "elf-female", "evil:foil"],
    equipped: { 6: "elf-male" },
  }).owned,
  { "elf-male": 1, "elf-female": 1 },
);
assert.deepEqual(normalize({ owned: { "elf-male": 2 } }).owned, {
  "elf-male": 2,
});
const loaded = normalize({
  owned: { "elf-male": 1, "elf-male:foil": 2, "evil:foil": 4 },
  equipped: { 6: "elf-male:foil", 7: "elf-male:foil" },
});
assert.deepEqual(loaded.equipped, { 6: "elf-male:foil" });
assert.deepEqual(equip(loaded, "elf-male").equipped, { 6: "elf-male" });
assert.deepEqual(
  sanitizeLoadout({
    6: "elf-male:foil",
    7: "elf-male:foil",
    A: "genie-magician:foil",
    K: "evil:foil",
  }),
  { 6: "elf-male:foil" },
);
assert.throws(() =>
  equip(normalize({ owned: { "elf-male": 2 } }), "elf-male:foil"),
);
assert.equal(normalize({ lastCraft: { id: "elf-male:foil" } }).lastCraft, null);

for (const base of POOL) {
  for (const finish of [0, 0.009999999, 0.01, 0.5]) {
    const before = normalize({ ether: CRAFT[base.rarity] });
    const random = sequence([finish]);
    const next = craft(before, base.id, random);
    const id = finish < FOIL_CHANCE ? foilId(base.id) : base.id;
    assert.equal(next.ether, 0);
    assert.deepEqual(next.owned, { [id]: 1 });
    assert.deepEqual(next.lastCraft, { id, isNew: true });
    assert.equal(random.calls(), 1, "錬成では選んだキャラを再抽選しない");
    assert.deepEqual(normalize(JSON.parse(JSON.stringify(next))), next);
    assert.equal(before.ether, CRAFT[base.rarity], "入力を変更しない");
  }
  assert.equal(costOf(foilId(base.id)), null);
  assert.equal(
    craftCheck(normalize({ ether: 99999 }), foilId(base.id)).ok,
    false,
  );
  assert.throws(() =>
    craft(normalize({ ether: 99999 }), foilId(base.id), noRandom),
  );
}
const made = craft(
  normalize({ owned: { "elf-male": 3, "elf-male:foil": 1 }, ether: 160 }),
  "elf-male",
  () => 0,
);
assert.deepEqual(made.lastCraft, { id: "elf-male:foil", isNew: false });
assert.equal(made.owned["elf-male"], 3);
assert.equal(made.owned["elf-male:foil"], 2);
assert.throws(() => craft(made, "elf-male", noRandom), /結果/);
assert.throws(() => pull(made, 1, noRandom), /結果/);
assert.throws(() => craft(ten, "elf-male", noRandom), /結果/);
assert.throws(() => craft(fresh(), "elf-male", noRandom), /足りません/);
for (const bad of [-1, 1, NaN, Infinity]) {
  const before = normalize({ ether: 80 });
  assert.throws(() => pull(before, 1, sequence([0.65, bad])), /乱数/);
  assert.throws(() => craft(before, "elf-male", () => bad), /乱数/);
  assert.equal(before.ether, 80);
  assert.deepEqual(before.owned, {});
}

// ガチャ以外の配布は指定された通常版をそのまま付与し、仕上げ抽選をしない。
const originalRandom = Math.random;
try {
  Math.random = noRandom;
  assert.deepEqual(grantSkin(fresh(), "elf-male").owned, { "elf-male": 1 });
  assert.deepEqual(claimEarly(fresh()).owned, { "pegasus-knight": 1 });
  assert.deepEqual(claimSpecial(fresh(), "genie-magician").owned, {
    "genie-magician": 1,
  });
  assert.deepEqual(normalize(saved), ten);
} finally {
  Math.random = originalRandom;
}

const stock = normalize({
  owned: { "elf-male": 3, "elf-male:foil": 3, "angel-k:foil": 2 },
  equipped: { 6: "elf-male:foil", K: "angel-k:foil" },
});
assert.equal(dustOf("elf-male:foil"), DUST.SR);
assert.deepEqual(dismantleCheck(stock, "elf-male:foil"), {
  ok: true,
  gain: DUST.SR,
});
assert.ok(spares(stock, ALL_SKINS).some((r) => r.skin.foil));
assert.equal(totalOfSpares(stock, ALL_SKINS), 40, "一括の下見は通常版だけ");
const bulk = dismantleAll(stock);
assert.deepEqual(bulk.owned, {
  "elf-male": 1,
  "elf-male:foil": 3,
  "angel-k:foil": 2,
});
assert.equal(bulk.ether, 40);
let individual = dismantle(dismantle(bulk, "elf-male:foil"), "elf-male:foil");
assert.equal(individual.ether, 80);
assert.equal(individual.owned["elf-male:foil"], 1);
assert.equal(individual.equipped["6"], "elf-male:foil");
assert.throws(() => dismantle(individual, "elf-male:foil"), /最後の1枚/);
assert.throws(() => dismantle(individual, "elf-male"), /最後の1枚/);
console.log(
  "フォイル: キャラ率維持・独立1%境界・10連・旧データ・装備・別版保護: OK",
);

// 本物のstoreで連打を直列化。結果と所持/支払いが同じ保存で確定する。
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
};
const store = await import("../src/skins/store.js?foil-check");
assert.equal(store.COLLECTION_KEY, "tottery.skins.v1", "保存キーを変更しない");
const gachaRandom = sequence([0.65, 0]);
const gachaOutcomes = await Promise.allSettled([
  store.updateCollection((state) => pull(state, 1, gachaRandom)),
  store.updateCollection((state) => pull(state, 1, gachaRandom)),
]);
assert.deepEqual(
  gachaOutcomes.map((r) => r.status),
  ["fulfilled", "rejected"],
);
assert.equal(gachaRandom.calls(), 2);
assert.equal(
  JSON.parse(memory.get(store.COLLECTION_KEY)).owned["elf-male:foil"],
  1,
);
const reloaded = await import("../src/skins/store.js?foil-check-reload");
assert.deepEqual(reloaded.getCollection(), store.getCollection());
await store.updateCollection((state) => ({
  ...state,
  pending: null,
  ether: 160,
}));
const craftRandom = sequence([0]);
const craftOutcomes = await Promise.allSettled([
  store.updateCollection((state) => craft(state, "elf-male", craftRandom)),
  store.updateCollection((state) => craft(state, "elf-male", craftRandom)),
]);
assert.deepEqual(
  craftOutcomes.map((r) => r.status),
  ["fulfilled", "rejected"],
);
assert.equal(craftRandom.calls(), 1);
const committed = store.getCollection();
assert.equal(committed.ether, 80);
assert.equal(committed.owned["elf-male:foil"], 2);
assert.deepEqual(committed.lastCraft, { id: "elf-male:foil", isNew: false });
const reloadedCraft =
  await import("../src/skins/store.js?foil-check-craft-reload");
assert.deepEqual(reloadedCraft.getCollection(), committed);
await store.updateCollection((state) => ({ ...state, lastCraft: null }));
const beforeFailure = store.getCollection();
const savedBeforeFailure = memory.get(store.COLLECTION_KEY);
globalThis.localStorage.setItem = () => {
  throw new Error("quota");
};
await assert.rejects(
  store.updateCollection((state) => craft(state, "elf-male", () => 0)),
  /保存できません/,
);
assert.equal(store.getCollection(), beforeFailure);
assert.equal(memory.get(store.COLLECTION_KEY), savedBeforeFailure);
console.log(
  "フォイル: store連打排他・再読込の結果保持・錬成同時確定・保存失敗保護: OK",
);
