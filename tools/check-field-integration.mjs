import assert from "node:assert/strict";
import { areaFixture } from "./area-fixture.mjs";
import { seaPull } from "../src/game/areas.js";
import { areaEvent } from "../src/game/area-presentation.js";
import {
  boardFieldTheme,
  areaTheme,
  areaApplyMs,
  areaDuration,
  areaTransformClass,
} from "../src/game/field-presentation.js";
import { areaSoundSamples } from "../src/audio/area-sounds.js";
import { reducer } from "../src/game/reducer.js";
const state = { ...areaFixture("sea"), ruleVersion: 8 };
const moved = seaPull(state);
for (const p of Object.values(moved.pieces)) {
  const old = state.pieces[p.id];
  assert(Math.max(Math.abs(p.row - old.row), Math.abs(p.col - old.col)) <= 1);
  assert.equal(moved.board[p.row][p.col].id, p.id);
  assert.equal(p.frozenUntil, old.frozenUntil);
}
assert.equal(Object.values(moved.pieces).filter((p) => p.alive).length, 8);
assert.deepEqual(
  state.board[8][4],
  state.pieces.fx0,
  "input remains unchanged",
);
// 版11: 手番側(自分)の駒は流されず、相手の駒だけが中央へ最大1マス寄る
const v10 = seaPull({ ...state, ruleVersion: 11 });
for (const p of Object.values(v10.pieces)) {
  const before = state.pieces[p.id];
  if (p.owner === state.currentTurn)
    assert.deepEqual(
      [p.row, p.col],
      [before.row, before.col],
      "own piece stays",
    );
  else
    assert(
      Math.max(Math.abs(p.row - before.row), Math.abs(p.col - before.col)) <= 1,
      "enemy piece moves at most one square",
    );
}
assert(
  Object.values(v10.pieces).some(
    (p) =>
      p.owner !== state.currentTurn &&
      (p.row !== state.pieces[p.id].row || p.col !== state.pieces[p.id].col),
  ),
  "some enemy piece is pulled",
);
const old = seaPull({ ...state, ruleVersion: 7 });
assert(
  Object.values(old.pieces).some(
    (p) =>
      Math.max(
        Math.abs(p.row - state.pieces[p.id].row),
        Math.abs(p.col - state.pieces[p.id].col),
      ) > 1,
  ),
  "old matches retain old pull",
);
const crowded = {
  ...state,
  board: Array.from({ length: 9 }, () => Array(9).fill(null)),
  pieces: {},
};
for (const [id, row, col] of [
  ["a", 4, 4],
  ["b", 5, 4],
  ["c", 6, 4],
  ["d", 8, 4],
]) {
  const p = { ...state.pieces.fx0, id, row, col };
  crowded.pieces[id] = p;
  crowded.board[row][col] = p;
}
const result = seaPull(crowded);
assert.deepEqual(
  ["a", "b", "c", "d"].map((id) => result.pieces[id].row),
  [4, 5, 6, 7],
  "occupied inward square blocks, distant card advances one",
);
assert.deepEqual(
  seaPull(JSON.parse(JSON.stringify(state))),
  moved,
  "network replay deterministic",
);
let seed = 781;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
for (let game = 0; game < 100; game++) {
  const s = {
    ...state,
    board: Array.from({ length: 9 }, () => Array(9).fill(null)),
    pieces: {},
  };
  for (let i = 0; i < 18; i++) {
    let r, c;
    do {
      r = Math.floor(random() * 9);
      c = Math.floor(random() * 9);
    } while (s.board[r][c]);
    const p = {
      ...state.pieces.fx0,
      id: String(i),
      row: r,
      col: c,
      owner: i % 2,
    };
    s.board[r][c] = p;
    s.pieces[p.id] = p;
  }
  const t = seaPull(s),
    occupied = new Set();
  for (const p of Object.values(t.pieces)) {
    const prev = s.pieces[p.id];
    assert(
      Math.max(Math.abs(prev.row - p.row), Math.abs(prev.col - p.col)) <= 1,
    );
    assert(
      Math.max(Math.abs(p.row - 4), Math.abs(p.col - 4)) <=
        Math.max(Math.abs(prev.row - 4), Math.abs(prev.col - 4)),
    );
    assert(!occupied.has(`${p.row},${p.col}`));
    occupied.add(`${p.row},${p.col}`);
    assert.equal(t.board[p.row][p.col].id, p.id);
  }
}
const both = { ...state, areas: [{ type: "sea" }, { type: "forest" }] };
assert.equal(boardFieldTheme(both), "sea");
assert.equal(boardFieldTheme({ ...both, currentTurn: 1 }), "forest");
assert.equal(
  boardFieldTheme({ ...state, currentTurn: 1 }),
  "sea",
  "single field stays",
);
assert.equal(boardFieldTheme({ ...both, boardSize: 5 }), null);
assert.equal(boardFieldTheme({ ...both, areasEnabled: false }), null);
assert.equal(boardFieldTheme({ ...both, areas: [null, null] }), null);
assert.equal(boardFieldTheme({ ...both, phase: "setup" }), null);
assert.equal(areaTheme({ type: "palace", skin: "demon-q" }), "hell");
assert.equal(areaTheme({ type: "palace", skin: "angel-k" }), "heaven");
const castles = {
  ...both,
  areas: [
    { type: "palace", skin: "angel-j" },
    { type: "palace", skin: "demon-k" },
  ],
};
assert.equal(boardFieldTheme(castles), "heaven");
assert.equal(boardFieldTheme({ ...castles, currentTurn: 1 }), "hell");
const forest = { ...areaFixture("forest"), ruleVersion: 8 };
const revealed = reducer(forest, { type: "USE_AREA", picks: ["fx5", "fx6"] });
assert.deepEqual(areaEvent(forest, revealed, 1).targets, []);
assert.equal(areaApplyMs({ type: "ice" }), 4350);
assert.equal(areaApplyMs({ type: "sea" }), 1500);
assert.equal(areaApplyMs({ type: "palace" }), 4200);
assert.equal(areaDuration({ type: "sky" }), 6000);
assert(
  areaTransformClass(
    { event: { type: "palace", targets: [{ row: 6, col: 3 }] } },
    state.pieces.fx1,
  ).includes("piece-area-palace"),
);
assert.equal(
  areaTransformClass(
    { event: { type: "forest", targets: [{ row: 6, col: 3 }] } },
    state.pieces.fx1,
  ),
  "",
);
for (const type of ["earth", "sea", "forest", "ice", "sky", "heaven", "hell"]) {
  const samples = areaSoundSamples(type, 8000);
  assert.equal(samples.length, 48000);
  assert(samples.every((n) => Number.isFinite(n) && Math.abs(n) <= 0.65));
}
console.log(
  "Fields: turn switching, single-field fallback, palace variants, one-cell sea/collisions/100 layouts, legacy/network compatibility, private forest and reveal timing passed",
);
