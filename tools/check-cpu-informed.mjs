import assert from "node:assert/strict";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { areaFixture } from "./area-fixture.mjs";
import { reducer } from "../src/game/reducer.js";
const realRandom = Math.random;
function choose(s) {
  let n = 12;
  Math.random = () =>
    (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
  try {
    return cpuInformedAction(s, 0);
  } finally {
    Math.random = realRandom;
  }
}
const palace = { ...areaFixture("palace"), turnNo: 20 };
palace.pieces.fx0.rank = "2";
palace.pieces.fx1.rank = "2";
assert.equal(
  choose(palace).type,
  "USE_AREA",
  "palace remains useful past opening",
);
const promoted = reducer(palace, choose(palace));
assert.equal(promoted.currentTurn, 1, "palace consumes turn");
const sky = areaFixture("sky"),
  transform = choose(sky);
assert.equal(transform.type, "USE_AREA");
assert.notEqual(sky.pieces[transform.pieceId].rank, "A", "preserve A");
const transformed = reducer(sky, transform);
assert.equal(transformed.currentTurn, 0);
assert.equal(
  choose(transformed).type,
  "MOVE_PIECE",
  "move after transformation",
);
const hidden = { ...areaFixture("forest"), areas: [null, null] };
const altered = structuredClone(hidden);
for (const p of Object.values(altered.pieces))
  if (p.owner === 1) {
    p.rank = p.rank === "K" ? "2" : "K";
    p.isKing = !p.isKing;
    altered.board[p.row][p.col] = p;
  }
assert.deepEqual(
  choose(hidden),
  choose(altered),
  "changing hidden ranks/king flags does not alter choice",
);
// A visible enemy king in reach is prioritized over an ordinary capture.
const duel = areaFixture("forest");
duel.areas = [null, null];
for (const p of Object.values(duel.pieces)) {
  if (p.owner === 0 && p.id !== "fx1" && p.id !== "fx0") p.alive = false;
}
const attacker = duel.pieces.fx1;
attacker.rank = "8";
attacker.row = 4;
attacker.col = 4;
const king = duel.pieces.fx4;
king.row = 4;
king.col = 5;
king.revealed = true;
const other = duel.pieces.fx5;
other.row = 4;
other.col = 3;
other.revealed = true;
duel.board = Array.from({ length: 9 }, () => Array(9).fill(null));
for (const p of Object.values(duel.pieces))
  if (p.alive) duel.board[p.row][p.col] = p;
const attack = choose(duel);
assert.equal(attack.row, 4);
assert.equal(attack.col, 5);
assert.equal(cpuInformedAction(duel, 1), null, "no action out of turn");
console.log(
  "Informed CPU: hidden-information invariance, known king priority, ongoing palace use, A preservation, move after sky passed",
);
king.revealed = false;
duel.known[0][king.id] = true;
assert.equal(choose(duel).col, 5, "privately learned king prioritized");
duel.known = [{}, {}];
other.revealed = false;
const hiddenInReach = choose(duel);
king.rank = "4";
king.isKing = false;
other.rank = "K";
other.isKing = true;
assert.deepEqual(
  choose(duel),
  hiddenInReach,
  "hidden identities in capture range do not affect decision",
);
const small = areaFixture("forest");
small.areas = [null, null];
small.areasEnabled = false;
small.boardSize = 5;
const positions = { fx0: [4, 2], fx1: [3, 1], fx4: [0, 2], fx5: [1, 1] };
small.board = Array.from({ length: 5 }, () => Array(5).fill(null));
for (const p of Object.values(small.pieces)) {
  p.alive = !!positions[p.id];
  if (p.alive) {
    [p.row, p.col] = positions[p.id];
    small.board[p.row][p.col] = p;
  }
}
const smallAct = choose(small);
assert.equal(smallAct.type, "MOVE_PIECE");
assert.notEqual(reducer(small, smallAct), small, "5x5 move is legal");
