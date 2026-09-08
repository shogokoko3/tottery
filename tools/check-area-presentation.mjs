import assert from "node:assert/strict";
import { areaFixture } from "./area-fixture.mjs";
import {
  automaticAreaAction,
  areaEvent,
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
    assert.equal(areaEvent(s, next, 0).targets.length, 1);
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
