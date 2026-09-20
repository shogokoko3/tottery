import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Wallet } from "../src/server/wallet.js";
import {
  qualifiesForFreeze,
  resolveSummonFreeze,
  normalizeSummonFreeze,
  freezeFoilUpgrade,
  freezeLadder,
  summonFoilOrder,
} from "../src/skins/summon-freeze.js";
import { normalize, applyPull, pull } from "../src/skins/collection.js";
import { byId, POOL } from "../src/skins/catalog.js";

const ten = (...heads) => [
  ...heads,
  ...Array(10 - heads.length).fill("zombie-male"),
];
const r = "zombie-male",
  sr = "elf-male",
  ssr = "angel-k";
for (const ids of [
  ten(ssr, "demon-k"),
  ten(ssr, r + ":foil"),
  ten(ssr + ":foil"),
])
  assert.ok(qualifiesForFreeze(ids));
for (const ids of [
  ten(),
  ten(ssr),
  ten(r + ":foil", sr + ":foil"),
  [ssr + ":foil"],
  ten("genie-magician", ssr),
]) {
  assert.equal(qualifiesForFreeze(ids), false);
  assert.deepEqual(
    resolveSummonFreeze(ids, () => {
      throw new Error("不要な再抽選");
    }).skins,
    ids,
  );
}
const initial = ten(ssr, "demon-k", sr, r + ":foil", sr + ":foil");
const unchanged = [...initial],
  values = [0.299999, 0.3, 0.9999, 0, 0, 0, 0, 0];
let at = 0;
const packet = resolveSummonFreeze(initial, () => values[at++]);
assert.deepEqual(initial, unchanged, "元の抽選結果を改変しない");
assert.equal(at, 8, "既存フォイルは追加抽選しない");
assert.equal(packet.skins[0], ssr + ":foil");
assert.equal(packet.skins[1], "demon-k");
assert.equal(byId(packet.skins[2]).rarity, "SSR");
assert.equal(
  !!byId(packet.skins[2]).foil,
  false,
  "SRからのSSRに追加フォイル抽選なし",
);
assert.deepEqual(packet.skins.slice(3, 5), initial.slice(3, 5));
assert.ok(
  packet.skins
    .slice(5)
    .every((id) => byId(id).rarity === "SR" && !byId(id).foil),
);
assert.deepEqual(
  normalizeSummonFreeze(packet.freeze, packet.skins),
  packet.freeze,
);
assert.equal(
  normalizeSummonFreeze(packet.freeze, initial),
  null,
  "旧結果との混線は演出に使わない",
);
assert.equal(
  normalizeSummonFreeze({ version: 2, initial }, packet.skins),
  null,
);
assert.equal(freezeFoilUpgrade(packet.freeze, 0, packet.skins[0]), true);
assert.equal(freezeFoilUpgrade(packet.freeze, 3, packet.skins[3]), false);
for (let i = 0; i < 10; i++)
  assert.equal(
    freezeLadder(initial[i], packet.skins[i]).length,
    2,
    "すべての札に回転区間がある",
  );
// A bonus in slot 0 must wait for existing foils later in the grid. Replay
// preserves both ordering and grants; multiple bonuses are all at the end.
assert.deepEqual(summonFoilOrder(packet.skins.map(id => ({ id })), packet.freeze), [3, 4, 0]);
const multi = resolveSummonFreeze(initial, () => .1);
assert.deepEqual(summonFoilOrder(multi.skins.map(id => ({ id })), multi.freeze), [3, 4, 0, 1]);
assert.deepEqual(summonFoilOrder(packet.skins.map(id => ({ id })), null), [0, 3, 4]);
assert.deepEqual(summonFoilOrder(ten().map(id => ({ id })), null), []);
assert.deepEqual(packet.skins.slice(3, 5), initial.slice(3, 5));
for (const rarity of ["SR", "SSR"]) {
  const pool = POOL.filter((s) => s.rarity === rarity);
  for (let i = 0; i < pool.length; i++) {
    const before = ten(ssr + ":foil", rarity === "SR" ? r : sr);
    assert.equal(
      resolveSummonFreeze(before, () => (i + 0.5) / pool.length).skins[1],
      pool[i].id,
    );
  }
}
const state = normalize({
  tickets: 10,
  pendingPull: { id: "pull:test", amount: 10 },
});
const granted = normalize(
  applyPull(state, { ...packet, receipt: "pull:test" }),
);
assert.equal(granted.tickets, 0);
assert.equal(granted.draws, 10);
assert.equal(granted.pendingPull, null);
assert.deepEqual(granted.pending.freeze, packet.freeze);
assert.deepEqual(
  granted.pending.results.map((r) => r.id),
  packet.skins,
);
assert.equal(
  Object.values(granted.owned).reduce((a, b) => a + b, 0),
  10,
  "獲得は最終結果だけ10枚",
);
assert.equal(granted.owned[r] || 0, 0, "元Rは配らない");
assert.deepEqual(
  applyPull({ ...granted, pending: null }, { ...packet, receipt: "pull:test" }),
  { ...granted, pending: null },
  "処理済み応答は二度配らない",
);
assert.throws(
  () =>
    applyPull(
      { ...granted, pending: null, lastPullId: "pull:newer" },
      { ...packet, receipt: "pull:test" },
    ),
  /一致しません/,
  "遅れて届いた過去の応答も配らない",
);
const localValues = [
  ...Array.from({ length: 10 }, (_, i) => [
    i === 0 ? 0.971 : 0,
    i === 0 ? 0 : 0.5,
  ]).flat(),
  ...Array(9).fill(0.5),
];
let k = 0;
const local = pull(normalize({ tickets: 10 }), 10, () => localValues[k++]);
assert.ok(local.pending.freeze);
assert.equal(k, 29);
assert.equal(local.tickets, 0);
// Force real server draws, then forbid any new random calls when replaying the request.
const original = crypto.getRandomValues.bind(crypto);
let calls = 0;
const numbers = [
  0.972,
  0.5,
  0.995,
  0.5,
  ...Array.from({ length: 8 }, () => [0, 0.5]).flat(),
  0.1,
  0.9,
  ...Array(8).fill(0.5),
];
crypto.getRandomValues = (array) => {
  array[0] = Math.floor(numbers[calls++] * 4294967296);
  return array;
};
try {
  const db = new DatabaseSync(":memory:"),
    wallet = new Wallet((q, ...p) => db.prepare(q).all(...p));
  wallet.credit("tester", "seed", 20, "migrate", 1800000000000);
  const saved = wallet.pull("tester", "freeze-test", 10, 1800000000000);
  assert.ok(saved.freeze);
  assert.equal(saved.skins.length, 10);
  assert.equal(calls, 30);
  assert.equal(saved.tickets, 10);
  assert.ok(byId(saved.skins[0]).foil);
  assert.equal(!!byId(saved.skins[1]).foil, false);
  crypto.getRandomValues = () => {
    throw new Error("再送で乱数を使ってはいけない");
  };
  const replay = wallet.pull("tester", "freeze-test", 10, 1800000000100);
  assert.deepEqual(replay.skins, saved.skins);
  assert.deepEqual(replay.freeze, saved.freeze);
  assert.equal(replay.tickets, 10);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM gacha_log").get().n, 10);
  const known = db
    .prepare("SELECT skinId FROM skin_first_seen")
    .all()
    .map((r) => r.skinId);
  assert.deepEqual([...new Set(saved.skins)].sort(), known.sort());
  assert.throws(
    () => wallet.pull("other", "freeze-test", 10, 1800000000000),
    /他の人/,
  );
  assert.throws(
    () => wallet.pull("tester", "freeze-test", 1, 1800000000000),
    /枚数/,
  );
  db.prepare("INSERT INTO gacha_draws VALUES (?,?,?,?)").run(
    "legacy",
    "tester",
    JSON.stringify(initial),
    1800000000000,
  );
  const legacy = wallet.pull("tester", "legacy", 10, 1800000000000);
  assert.deepEqual(legacy.skins, initial);
  assert.equal(legacy.freeze, null);
  db.close();
} finally {
  crypto.getRandomValues = original;
}
console.log(
  "フリーズ: 2条件・SSR箔1枚・30%境界・昇格先・既存箔維持・実獲得・保存復元・再送・旧記録互換 OK",
);
