import assert from "node:assert/strict";
import {
  opponentObservations,
  opponentKingBelief,
  inferKingCandidates,
} from "../src/game/king-belief.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { areaFixture } from "./area-fixture.mjs";
const s = areaFixture("forest");
s.areas = [null, null];
assert.equal(opponentKingBelief(s, 0).candidates.length, 4);
s.known[0] = { fx5: true, fx6: true };
assert.deepEqual(
  opponentKingBelief(s, 0).candidates.map((p) => p.id),
  ["fx4", "fx7"],
);
s.known[0].fx7 = true;
assert.equal(opponentKingBelief(s, 0).inferred, true);
assert.equal(opponentKingBelief(s, 0).candidates[0].id, "fx4");
assert(!("rank" in opponentObservations(s, 0)[0]));
assert(!("isKing" in opponentObservations(s, 0)[0]));
// 候補の実際の正体を読もうとしたら失敗させる。
Object.defineProperty(s.pieces.fx4, "rank", {
  get() {
    throw Error("hidden rank read");
  },
  configurable: true,
});
Object.defineProperty(s.pieces.fx4, "isKing", {
  get() {
    throw Error("hidden king flag read");
  },
  configurable: true,
});
Object.defineProperty(s.players[1], "kingId", {
  get() {
    throw Error("hidden king id read");
  },
  configurable: true,
});
assert.equal(opponentKingBelief(s, 0).inferred, true);
assert(cpuInformedAction(s, 0));
// 仮の公開盤面だけでも推理が完結する。
const seen = [
  { id: "a", visible: true, isKing: false },
  { id: "b", visible: false },
  { id: "c", visible: false },
];
assert.deepEqual(
  inferKingCandidates(seen).candidates.map((p) => p.id),
  ["b", "c"],
);
assert.equal(
  inferKingCandidates([
    ...seen.slice(0, 2),
    { id: "c", visible: true, isKing: false },
  ]).inferred,
  true,
);
assert.equal(
  inferKingCandidates([
    { id: "a", visible: true, isKing: true },
    ...seen.slice(1),
  ]).candidates[0].id,
  "a",
);
// 公開されていない最後の候補を、取れる非王より優先する。
const duel = areaFixture("forest");
duel.areas = [null, null];
const positions = { fx0: [8, 4], fx1: [4, 4], fx4: [4, 5], fx5: [4, 3] };
duel.board = Array.from({ length: 9 }, () => Array(9).fill(null));
for (const p of Object.values(duel.pieces)) {
  p.alive = !!positions[p.id];
  if (p.alive) {
    [p.row, p.col] = positions[p.id];
    duel.board[p.row][p.col] = p;
  }
}
duel.pieces.fx1.rank = "8";
duel.known[0] = { fx5: true };
const saved = Math.random;
Math.random = () => 0.5;
try {
  const a = cpuInformedAction(duel, 0);
  assert.equal(a.row, 4);
  assert.equal(a.col, 5);
} finally {
  Math.random = saved;
}
// 死亡・継承・情報の失効はその時点の観測から再計算し、古い候補を持ち越さない。
duel.pieces.fx4.alive = false;
duel.pieces.fx5.isKing = true;
assert.equal(opponentKingBelief(duel, 0).candidates[0].id, "fx5");
duel.known[0] = {};
duel.pieces.fx4.alive = true;
assert.equal(opponentKingBelief(duel, 0).candidates.length, 2);
console.log(
  "King deduction: visible-only projection, forbidden hidden reads, exclusion, single-candidate capture, fresh inference after changes passed",
);
// 実際の森の発動 → 候補4体から2体、さらに1体への絞り込み。
const { reducer } = await import("../src/game/reducer.js");
const forest = areaFixture("forest");
const first = reducer(forest, { type: "USE_AREA", picks: ["fx5", "fx6"] });
assert.equal(opponentKingBelief(first, 0).candidates.length, 2);
const second = reducer(
  { ...first, turnNo: 4 },
  { type: "USE_AREA", picks: ["fx7"] },
);
assert.equal(opponentKingBelief(second, 0).inferred, true);
assert.equal(opponentKingBelief(second, 0).candidates[0].id, "fx4");
assert.equal(
  second.pieces.fx4.revealed,
  false,
  "inference does not reveal the piece to either player",
);
