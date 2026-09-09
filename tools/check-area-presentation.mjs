import assert from "node:assert/strict";
import { areaFixture } from "./area-fixture.mjs";
import {
  automaticAreaAction,
  areaEvent,
  areaEventText,
  frozenTurnsLeft,
  hasVisibleSkyBonus,
} from "../src/game/area-presentation.js";
import { reducer } from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";
import { areaSoundSamples } from "../src/audio/area-sounds.js";
import { takePresentationBatch } from "../src/net/presentation.js";
for (const type of ["earth", "sea", "forest", "ice"]) {
  const s = areaFixture(type),
    action = automaticAreaAction(s);
  assert.equal(action?.type, "USE_AREA", type);
  const next = reducer(s, enrichAction(action, s));
  assert.equal(next.areas[0].uses, 1, type);
  assert.equal(automaticAreaAction(next), null, "once only");
  assert.equal(areaEvent(s, next, 0).type, type);
  assert.equal(s.areas[0].uses, 0, "no mutation");
  if (type === "forest") {
    assert.equal(areaEvent(s, next, 0).targets.length, 2);
    assert.deepEqual(
      areaEvent(s, next, 1).targets,
      [],
      "forest target private",
    );
  }
}
for (const type of ["sky", "palace"])
  assert.equal(
    automaticAreaAction(areaFixture(type)),
    null,
    "optional " + type,
  );
// 海の字幕は版で変わる。版11からは相手の駒だけ、版8〜10の旧対局は両者の駒
{
  const v10 = { ...areaFixture("sea"), ruleVersion: 11 },
    v9 = { ...areaFixture("sea"), ruleVersion: 10 };
  const e10 = areaEvent(v10, reducer(v10, { type: "USE_AREA" }), 0),
    e9 = areaEvent(v9, reducer(v9, { type: "USE_AREA" }), 0);
  assert.equal(e10.pullsOwn, false);
  assert.equal(e9.pullsOwn, true);
  assert.equal(areaEventText(e10, "apply"), "水流が相手の駒を中央へ引き寄せた");
  assert.equal(areaEventText(e9, "apply"), "水流が駒を中央へ引き寄せた");
  const opponentView = areaEvent(v10, reducer(v10, { type: "USE_AREA" }), 1);
  assert.equal(
    areaEventText(opponentView, "apply"),
    "水流が自分の駒を中央へ引き寄せた",
  );
  assert(
    e10.moves.every((m) => v10.pieces[m.id].owner !== v10.currentTurn),
    "v10 moves only enemy pieces",
  );
}
// 演出の字幕は発動者ではなく、画面を見ている側を基準にする。
for (const [type, action, ownText, foeText] of [
  [
    "ice",
    { type: "USE_AREA", picks: ["fx5"] },
    "凍結・相手の3手番は移動できない",
    "凍結・自分の3手番は移動できない",
  ],
  [
    "sky",
    { type: "USE_AREA", pieceId: "fx1" },
    "10へ変身・自軍の10は同じ1体で2回行動",
    "10へ変身・相手の10は同じ1体で2回行動",
  ],
]) {
  const before = { ...areaFixture(type), ruleVersion: 11 };
  const after = reducer(before, action);
  assert.equal(areaEventText(areaEvent(before, after, 0), "apply"), ownText);
  assert.equal(areaEventText(areaEvent(before, after, 1), "apply"), foeText);
}
const waiting = areaFixture("earth");
waiting.lastMove = null;
assert.equal(automaticAreaAction(waiting), null, "earth waits for footprint");
assert.equal(waiting.areas[0].uses, 0);
for (const key of [
  "captureReveal",
  "setupEffects",
  "kPlacement",
  "extraMoveFor",
  "pendingKingChoice",
]) {
  const s = areaFixture();
  s[key] = true;
  assert.equal(automaticAreaAction(s), null, key);
}
const ice = areaFixture();
const p = { ...ice.pieces.fx5, frozenUntil: 8 };
assert.deepEqual(
  [2, 3, 4, 5, 6, 7, 8].map((turnNo) => frozenTurnsLeft({ ...ice, turnNo }, p)),
  [3, 3, 2, 2, 1, 1, 0],
);
const thawed = { ...ice, pieces: { ...ice.pieces, fx5: p } };
assert.equal(areaEvent(thawed, { ...thawed, turnNo: 8 }, 0).type, "thaw");
const sky = areaFixture("sky");
sky.players[1].skyTwice = true;
assert.equal(
  hasVisibleSkyBonus(sky, sky.pieces.fx6, 0),
  false,
  "hidden 10 stays hidden",
);
assert.equal(hasVisibleSkyBonus(sky, sky.pieces.fx6, 1), true);
assert.equal(
  hasVisibleSkyBonus(sky, { ...sky.pieces.fx6, revealed: true }, 0),
  true,
);
const batch = takePresentationBatch([
  { type: "USE_AREA", __id: "a" },
  { type: "MOVE_PIECE", __id: "b" },
]);
assert.equal(batch.actions.length, 1, "show area before following move");
for (const type of [
  "earth",
  "sea",
  "forest",
  "ice",
  "sky",
  "palace",
  "thaw",
  "birth",
]) {
  const samples = areaSoundSamples(type);
  assert(samples.every((n) => Number.isFinite(n) && Math.abs(n) <= 0.65));
  assert(samples.some((n) => Math.abs(n) > 0.03));
  assert.equal(samples[0], 0);
  assert.equal(Math.abs(samples.at(-1)), 0);
}
console.log(
  "Area presentation: automatic/optional activation, single use, privacy, thaw, network ordering, sounds passed",
);

// 氷: 各手番1回、凍結中も抽選、上書きではなく残り期間に加算。
const recurring = areaFixture("ice");
const freeze = { type: "USE_AREA", picks: ["fx5"] };
const first = reducer(recurring, freeze);
assert.equal(first.pieces.fx5.frozenUntil, 8);
assert.equal(first.areas[0].lastUsedTurn, 2);
assert.equal(automaticAreaAction(first), null, "same turn cannot repeat");
assert.deepEqual(
  reducer(first, freeze),
  first,
  "duplicate network action is harmless",
);
const nextTurn = { ...first, turnNo: 4, currentTurn: 0, interstitial: null };
assert.equal(
  automaticAreaAction(nextTurn)?.type,
  "USE_AREA",
  "next own turn auto fires",
);
assert.equal(frozenTurnsLeft(nextTurn, nextTurn.pieces.fx5), 2);
const second = reducer(nextTurn, freeze);
assert.equal(
  second.pieces.fx5.frozenUntil,
  14,
  "add 6 half turns to previous expiry",
);
assert.equal(frozenTurnsLeft(second, second.pieces.fx5), 5);
assert.equal(areaEvent(nextTurn, second, 0).extended, true);
const expired = { ...second, turnNo: 16 };
assert.equal(
  reducer(expired, freeze).pieces.fx5.frozenUntil,
  22,
  "expired freeze starts a fresh three turns",
);
const other = { ...second, turnNo: 6 };
assert.equal(
  reducer(other, { ...freeze, picks: ["fx6"] }).pieces.fx5.frozenUntil,
  14,
  "other target does not extend previous target",
);
const { iceCandidates } = await import("../src/game/areas.js");
assert(iceCandidates(second, 0).includes("fx5"), "frozen target stays in pool");
assert(!iceCandidates(second, 0).includes("fx4"), "king excluded");
assert.deepEqual(
  iceCandidates(recurring, 0),
  iceCandidates(second, 0),
  "freezing does not bias candidate pool",
);
let old = areaFixture("ice");
old.ruleVersion = 3;
old = reducer(old, freeze);
assert.equal(
  automaticAreaAction({ ...old, turnNo: 4 }),
  null,
  "ongoing version 3 match keeps old rule",
);
assert(!iceCandidates(old, 0).includes("fx5"));
assert.equal(
  JSON.stringify(
    reducer(
      JSON.parse(JSON.stringify(nextTurn)),
      JSON.parse(JSON.stringify(freeze)),
    ),
  ),
  JSON.stringify(second),
  "both clients replay the same extension",
);
console.log(
  "Recurring ice: per-turn guard, cumulative duration, full random pool, king exclusion, version compatibility passed",
);

// 版5: 全6種が毎手番1回。空と宮殿は自動では選ばない。
const { canUseArea } = await import("../src/game/areas.js");
for (const type of ["earth", "sea", "forest", "ice", "sky", "palace"]) {
  const s = areaFixture(type);
  const act = { type: "USE_AREA", hit: false, picks: ["fx5"], pieceId: "fx1" };
  const used = reducer(s, act);
  assert.equal(used.areas[0].uses, 1, type + " first use");
  assert.equal(used.areas[0].used, false, type + " not exhausted for match");
  const sameTurn = {
    ...used,
    currentTurn: 0,
    turnNo: s.turnNo,
    interstitial: null,
  };
  assert.equal(
    canUseArea(sameTurn, 0).ok,
    false,
    type + " cannot use twice in same turn",
  );
  const following = {
    ...used,
    currentTurn: 0,
    turnNo: s.turnNo + 2,
    interstitial: null,
  };
  assert.equal(
    canUseArea(following, 0).ok,
    true,
    type + " available next own turn",
  );
  assert.equal(
    automaticAreaAction(following)?.type || null,
    ["sky", "palace"].includes(type) ? null : "USE_AREA",
    type + " auto/optional",
  );
  const twice = reducer(following, {
    ...act,
    picks: ["fx6"],
    pieceId: type === "palace" ? "fx1" : "fx3",
  });
  assert.equal(twice.areas[0].uses, 2, type + " second turn use");
  const skipped = { ...s, turnNo: s.turnNo + 2 };
  assert.equal(
    canUseArea(skipped, 0).ok,
    true,
    type + " skipping does not lose future use",
  );
}
for (const type of ["earth", "sea", "forest", "sky", "palace"]) {
  const s = { ...areaFixture(type), ruleVersion: 4 };
  const used = reducer(s, {
    type: "USE_AREA",
    hit: false,
    picks: ["fx5"],
    pieceId: "fx1",
  });
  assert.equal(
    canUseArea({ ...used, currentTurn: 0, turnNo: 4 }, 0).ok,
    false,
    "old version 4 remains once per match: " + type,
  );
}
console.log(
  "All areas: every-turn availability, same-turn guard, optional sky/palace, skipped turns and old-match compatibility passed",
);

// 森2体: 重複・王・既知を除外し、残り1体なら1体だけ。
const woods = areaFixture("forest");
const two = reducer(woods, {
  type: "USE_AREA",
  picks: ["fx4", "fx5", "fx5", "fx6"],
});
assert.deepEqual(Object.keys(two.known[0]).sort(), ["fx5", "fx6"]);
assert.deepEqual(two.known[1], {});
assert.equal(two.pieces.fx5.revealed, false);
assert.equal(two.pieces.fx6.revealed, false);
const one = reducer(
  { ...two, turnNo: 4 },
  { type: "USE_AREA", picks: ["fx5", "fx6", "fx7"] },
);
assert.deepEqual(one.lastArea.pieceIds, ["fx7"]);
assert.equal(automaticAreaAction({ ...one, turnNo: 6 }), null);
const legacy = reducer(
  { ...woods, ruleVersion: 5 },
  { type: "USE_AREA", picks: ["fx5", "fx6"] },
);
assert.equal(
  Object.keys(legacy.known[0]).length,
  1,
  "old match retains one target",
);
assert.deepEqual(
  areaEvent(woods, two, 1).targets,
  [],
  "opponent does not see chosen squares",
);
console.log(
  "Forest two targets: uniqueness, king exclusion, privacy, single remaining target and old-match compatibility passed",
);
