import assert from "node:assert/strict";
import {
  FOIL_MILESTONE,
  acquiredOf,
  claimEarly,
  claimFoilMilestone,
  claimSpecial,
  craft,
  dismantle,
  dismantleAll,
  foilMilestoneCheck,
  shatter,
  grantSkin,
  normalize,
  pull,
} from "../src/skins/collection.js";
import { POOL, foilId } from "../src/skins/catalog.js";

const clearResults = (state) => ({
  ...state,
  pending: null,
  lastCraft: null,
});
const saved = (state) => normalize(JSON.parse(JSON.stringify(state)));
const noRandom = () => assert.fail("無料の達成報酬は抽選しない");
const sequence = (values) => {
  let i = 0;
  return () => {
    assert.ok(i < values.length, "余分な抽選をしない");
    return values[i++];
  };
};
const id = "elf-male";
const foil = foilId(id);
assert.equal(FOIL_MILESTONE, 100);

// 初期値に使えるのは所持分だけ。総ガチャ回数・エーテルから配分しない。
const old = {
  owned: { [id]: 80, [foil]: 4, "pirate-male": 2 },
  draws: 99999,
  ether: 50000,
  pending: { results: [{ id, isNew: false }] },
  lastCraft: { id: foil, isNew: false },
};
let migrated = normalize(old);
assert.deepEqual(migrated.acquired, { [id]: 84, "pirate-male": 2 });
assert.deepEqual(migrated.foilMilestones, {});
assert.deepEqual(saved(migrated), migrated);
assert.equal(acquiredOf(normalize({ owned: [id, id, "pirate-male"] }), id), 1);
assert.equal(acquiredOf(normalize({ draws: 10000, ether: 99999 }), id), 0);
assert.equal(
  acquiredOf(migrated, foil),
  84,
  "仕上げが違っても同じキャラの累計",
);

// 新履歴のない状態を直接更新しても、分解前・配布前のbaselineを残す。
const brokenOld = dismantle(old, id);
assert.equal(brokenOld.owned[id], 79);
assert.equal(acquiredOf(brokenOld, id), 84);
assert.equal(saved(brokenOld).acquired[id], 84);
const allOld = dismantleAll(old);
assert.equal(allOld.owned[id], 1);
assert.equal(allOld.owned[foil], 4);
assert.equal(saved(allOld).acquired[id], 84);
assert.equal(saved(allOld).acquired["pirate-male"], 2);
const grantedOld = grantSkin(old, id);
assert.equal(grantedOld.acquired[id], 85);
assert.equal(grantedOld.acquired["pirate-male"], 2);
assert.equal(grantedOld.owned[id], 81);

// 99→100は通常当選・偶然のfoil・錬成・配布のどの入口でも加算する。
const near = normalize({
  owned: { [id]: 1 },
  acquired: { [id]: 99 },
  ether: 80,
});
for (const finish of [0.5, 0]) {
  const result = pull(near, 1, sequence([0.65, finish]));
  assert.equal(result.acquired[id], 100);
  assert.equal(result.pending.results[0].id, finish === 0 ? foil : id);
  assert.equal(
    foilMilestoneCheck(result, id).ok,
    false,
    "未確認結果を先に表示",
  );
  assert.equal(foilMilestoneCheck(clearResults(result), id).ok, true);
  const made = craft(near, id, () => finish);
  assert.equal(made.acquired[id], 100);
  assert.equal(made.ether, 0);
  assert.equal(made.lastCraft.id, finish === 0 ? foil : id);
  assert.ok(!("source" in made.lastCraft), "通常錬成の結果形式は維持");
}
assert.equal(grantSkin(near, id).acquired[id], 100);
assert.equal(grantSkin(near, foil).acquired[id], 100);
const ten = pull(
  normalize({ acquired: { [id]: 95 } }),
  10,
  sequence(
    Array.from({ length: 10 }, (_, i) => [0.65, i % 2 ? 0 : 0.5]).flat(),
  ),
);
assert.equal(ten.acquired[id], 105);
assert.equal(saved(ten).acquired[id], 105);
assert.equal(saved(clearResults(ten)).acquired[id], 105);

const incomplete = foilMilestoneCheck(near, id);
assert.deepEqual(
  {
    ok: incomplete.ok,
    total: incomplete.total,
    target: incomplete.target,
    remaining: incomplete.remaining,
    claimed: incomplete.claimed,
  },
  { ok: false, total: 99, target: 100, remaining: 1, claimed: false },
);
assert.throws(() => claimFoilMilestone(near, id), /あと1回/);

// 無消費で一度だけ1枚追加。通常版/フォイル既所持数は関係なく受け取れる。
for (const skin of POOL) {
  const ready = normalize({
    owned: { [skin.id]: 2, [foilId(skin.id)]: 1 },
    acquired: { [skin.id]: 100 },
    ether: 37,
    tickets: 5,
    draws: 500,
    equipped: { [skin.rank]: skin.id },
  });
  const originalRandom = Math.random;
  let claimed;
  try {
    Math.random = noRandom;
    claimed = claimFoilMilestone(ready, skin.id);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(claimed.owned[skin.id], 2);
  assert.equal(claimed.owned[foilId(skin.id)], 2);
  assert.equal(claimed.acquired[skin.id], 100);
  assert.equal(claimed.foilMilestones[skin.id], true);
  for (const key of ["ether", "tickets", "draws", "equipped"])
    assert.deepEqual(claimed[key], ready[key]);
  assert.deepEqual(claimed.lastCraft, {
    id: foilId(skin.id),
    isNew: false,
    source: "milestone",
  });
  for (let n = 0; n < 5; n++) {
    claimed = saved(claimed);
    assert.equal(claimed.acquired[skin.id], 100, "報酬を自己加算しない");
  }
  const closed = clearResults(claimed);
  assert.equal(foilMilestoneCheck(closed, skin.id).claimed, true);
  assert.throws(() => claimFoilMilestone(closed, skin.id), /受け取り済み/);
  assert.equal(
    saved(shatter(closed, foilId(skin.id))).acquired[skin.id],
    100,
    "フォイルを欠片にしても通算は減らない",
  );
}
const fullOwned = normalize({ owned: { [id]: 100 } });
let reward = claimFoilMilestone(fullOwned, id);
assert.equal(reward.lastCraft.isNew, true);
assert.equal(reward.owned[id], 100);
assert.equal(reward.owned[foil], 1);
assert.equal(saved(reward).acquired[id], 100, "所持101でも累計100");
reward = clearResults(saved(reward));
assert.equal(saved(dismantleAll(reward)).acquired[id], 100);
assert.equal(grantSkin(reward, id).acquired[id], 101);
assert.equal(grantSkin(reward, foil).acquired[id], 101);
assert.equal(pull(reward, 1, sequence([0.65, 0])).acquired[id], 101);

for (const bad of [
  undefined,
  "no-such",
  "genie-magician",
  "pegasus-knight",
  foil,
]) {
  const state = normalize({
    owned: { [bad]: 100 },
    acquired: { [bad]: 1000 },
  });
  assert.equal(foilMilestoneCheck(state, bad).ok, false);
  assert.throws(() => claimFoilMilestone(state, bad));
}
assert.deepEqual(claimEarly(normalize(null)).acquired, {});
assert.deepEqual(claimSpecial(normalize(null), "genie-magician").acquired, {});
const invalid = normalize({
  owned: { [id]: 2 },
  acquired: { [id]: -1, "pirate-male": 1.5, unknown: 500, [foil]: 500 },
  foilMilestones: { [id]: "true", unknown: true, [foil]: true },
  lastCraft: { id, isNew: true, source: "milestone" },
});
assert.deepEqual(invalid.acquired, { [id]: 2 });
assert.deepEqual(invalid.foilMilestones, {});
assert.ok(!("source" in invalid.lastCraft));
assert.equal(
  acquiredOf(
    normalize({ owned: { [id]: Number.MAX_SAFE_INTEGER, [foil]: 1 } }),
    id,
  ),
  Number.MAX_SAFE_INTEGER,
);
console.log(
  "通算100回: 旧所持の移行・分解前保持・全付与元・無消費・報酬非加算・特殊除外: OK",
);

// 実storeの同時操作・再読み込み・保存失敗。受取マークと所持を一括確定する。
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
};
memory.set(
  "tottery.skins.v1",
  JSON.stringify({ owned: { [id]: 100 }, ether: 50 }),
);
const store = await import("../src/skins/store.js?foil-progress-check");
const results = await Promise.allSettled([
  store.updateCollection((state) => claimFoilMilestone(state, id)),
  store.updateCollection((state) => claimFoilMilestone(state, id)),
]);
assert.deepEqual(
  results.map((result) => result.status),
  ["fulfilled", "rejected"],
);
const committed = store.getCollection();
assert.equal(committed.owned[foil], 1);
assert.equal(committed.acquired[id], 100);
assert.equal(committed.foilMilestones[id], true);
assert.equal(committed.ether, 50);
const reload = await import("../src/skins/store.js?foil-progress-reload");
assert.deepEqual(reload.getCollection(), committed);
await store.updateCollection((state) => ({
  ...state,
  lastCraft: null,
  acquired: { ...state.acquired, "pirate-male": 100 },
}));
const beforeFailure = store.getCollection();
const serialized = memory.get(store.COLLECTION_KEY);
globalThis.localStorage.setItem = () => {
  throw new Error("quota");
};
await assert.rejects(
  store.updateCollection((state) => claimFoilMilestone(state, "pirate-male")),
  /保存できません/,
);
assert.equal(store.getCollection(), beforeFailure);
assert.equal(memory.get(store.COLLECTION_KEY), serialized);
assert.equal(beforeFailure.foilMilestones["pirate-male"], undefined);
assert.equal(beforeFailure.owned["pirate-male:foil"], undefined);
globalThis.localStorage.setItem = (key, value) => memory.set(key, value);
await store.updateCollection((state) =>
  claimFoilMilestone(state, "pirate-male"),
);
assert.equal(store.getCollection().owned["pirate-male:foil"], 1);
assert.equal(store.getCollection().acquired["pirate-male"], 100);
console.log(
  "通算100回: store連打の二重受取防止・保存結果復元・保存失敗からの再受取: OK",
);
