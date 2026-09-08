import assert from "node:assert/strict";
import {
  initialState,
  reducer,
  autoArrange,
  autoPickKing,
} from "../src/game/reducer.js";
import { withInitialArmies } from "../src/game/adjudication.js";
import { emptyBoard } from "../src/game/board.js";
import { enrichAction } from "../src/game/actions.js";
import { captureDisplayState } from "../src/game/capture-presentation.js";
import { roomRuleVersion } from "../src/net/sync.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import {
  grantTurnTime,
  CLOCK_INITIAL_MS,
  CLOCK_INCREMENT_MS,
  CLOCK_EXTENSION_LIMIT,
  clockExtensionsRemaining,
} from "../src/game/clock.js";

function position(rank = "8", king = false) {
  const s = {
    ...initialState(),
    phase: "play",
    ruleVersion: GAME_RULE_VERSION,
    boardSize: 9,
    board: emptyBoard(9),
    setupMode: "simultaneous",
    clocks: [30000, 30000],
  };
  const specs = [
    ["a", rank, 0, 8, 2, king],
    ["b", "8", 1, 0, 6, false],
    ["k0", "2", 0, 8, 0, !king],
    ["k1", "2", 1, 0, 8, true],
  ];
  for (const [id, rank, owner, row, col, isKing] of specs) {
    const p = {
      id,
      rank,
      owner,
      row,
      col,
      isKing,
      suit: "spade",
      alive: true,
      revealed: false,
      history: [],
    };
    s.pieces[id] = p;
    s.board[row][col] = p;
    if (isKing) s.players[owner].kingId = id;
  }
  for (const p of Object.values(s.pieces)) {
    const counts = s.players[p.owner].armyRankCounts;
    counts[p.rank] = (counts[p.rank] || 0) + 1;
  }
  return withInitialArmies(s);
}
function move(s, spent = 0) {
  const p = s.pieces[s.currentTurn === 0 ? "a" : "b"];
  const row = p.owner === 0 ? (p.row === 8 ? 7 : 8) : p.row === 0 ? 1 : 0;
  const a = enrichAction(
    {
      type: "MOVE_PIECE",
      pieceId: p.id,
      row,
      col: p.col,
      elapsedMs: spent,
      player: s.currentTurn,
    },
    s,
  );
  const out = reducer(s, a);
  assert.deepEqual(
    reducer(structuredClone(s), structuredClone(a)),
    out,
    "same synchronized action produces identical clocks and counters",
  );
  return { ...out, interstitial: null, captureReveal: null };
}
for (const [ms, expected, uses] of [
  [30001, 30001, 0],
  [30000, 40000, 1],
  [29999, 39999, 1],
  [1, 10001, 1],
  [0, 0, 0],
]) {
  const s = position();
  s.clocks[1] = ms;
  const out = move(s);
  assert.equal(out.clocks[1], expected, `threshold ${ms}`);
  assert.deepEqual(out.clockExtensionUses, [0, uses]);
  assert.equal(s.clocks[1], ms, "input immutable");
}
let s = position();
const start = [...s.clocks];
const spent = [0, 0];
for (let n = 0; n < 14; n++) {
  const owner = s.currentTurn;
  spent[owner] += 10000;
  s = move(s, 10000);
  assert.equal(s.phase, "play");
  assert.ok(s.clockExtensionUses.every((n) => n <= 6));
}
assert.deepEqual(s.clockExtensionUses, [6, 6]);
assert.deepEqual(
  s.clocks,
  start.map((ms, p) => ms - spent[p] + 60000),
  "each player receives a total of exactly 60 seconds, never more",
);
assert.equal(clockExtensionsRemaining(s.clockExtensionUses[0]), 0);
const asymmetric = position();
asymmetric.clockExtensionUses = [6, 0];
const after = move(asymmetric);
assert.deepEqual(after.clockExtensionUses, [6, 1]);
assert.equal(
  move(after).clocks[0],
  30000,
  "one player exhausting the reserve does not affect the other",
);
for (const type of [
  "DISMISS_INTERSTITIAL",
  "DISMISS_CAPTURE",
  "CANCEL_SELECTION",
  "SELECT_PIECE",
  "SKIP_EXTRA_ACTION",
]) {
  const s = position(),
    out = reducer(s, { type, id: "a", elapsedMs: 5000 });
  assert.deepEqual(out.clocks, s.clocks, `${type} never grants time`);
  assert.deepEqual(out.clockExtensionUses, [0, 0]);
}
// A and 10 kings keep the same clock for their two actions.
for (const rank of ["10", "A"]) {
  let s = position(rank, true),
    out;
  if (rank === "10")
    out = reducer(s, {
      type: "MOVE_PIECE",
      pieceId: "a",
      row: 6,
      col: 1,
      elapsedMs: 5000,
    });
  else
    out = reducer(s, {
      type: "CONFIRM_SHUFFLE",
      aId: "a",
      pickIds: ["k0", "b"],
      order: [0, 1, 2],
      elapsedMs: 5000,
    });
  assert.equal(out.currentTurn, 0, rank);
  assert.ok(out.extraMoveFor, rank);
  assert.deepEqual(out.clockExtensionUses, [0, 0]);
  out = reducer(out, { type: "SKIP_EXTRA_ACTION", elapsedMs: 12000 });
  assert.equal(out.currentTurn, 1, rank);
  assert.deepEqual(
    out.clocks,
    [18000, 40000],
    "deduct cumulative elapsed once, grant incoming player once",
  );
  assert.deepEqual(out.clockExtensionUses, [0, 1]);
}
const timeout = move(position(), 30000);
assert.equal(timeout.phase, "gameover");
assert.equal(timeout.timeoutBy, 0);
assert.deepEqual(timeout.clockExtensionUses, [0, 0], "timeout beats extension");
const resigned = reducer(position(), { type: "RESIGN", player: 0 });
assert.equal(resigned.phase, "gameover");
assert.deepEqual(resigned.clockExtensionUses, [0, 0]);
const reset = reducer({ ...s, phase: "gameover" }, { type: "NEW_GAME" });
assert.deepEqual(reset.clockExtensionUses, [0, 0]);
assert.deepEqual(reset.clocks, [300000, 300000]);

// Full setup, including scripted opening, starts at five minutes with all six uses.
for (const scripted of [false, true]) {
  let state = reducer(initialState(), {
    type: "START_SETUP",
    size: 5,
    ruleVersion: GAME_RULE_VERSION,
    setupMode: "simultaneous",
    scripted,
  });
  for (const a of [
    { type: "ROLL_DICE_SINGLE", value: 6 },
    { type: "NEXT_DICE_STEP" },
    { type: "ROLL_DICE_SINGLE", value: 2 },
    { type: "NEXT_DICE_STEP" },
    { type: "GOTO_MULLIGAN" },
    { type: "CONFIRM_MULLIGAN", discardIds: [] },
    { type: "CONFIRM_MULLIGAN", discardIds: [] },
  ])
    state = reducer(state, a);
  for (const player of [0, 1]) {
    const placement = autoArrange(state, player, null, null, null);
    state = reducer(state, {
      type: "SETUP_CONFIRM",
      player,
      placement,
      kingId: autoPickKing(state, player, placement),
    });
  }
  assert.equal(state.phase, "play");
  assert.deepEqual(state.clocks, [CLOCK_INITIAL_MS, CLOCK_INITIAL_MS]);
  assert.deepEqual(state.clockExtensionUses, [0, 0]);
}
for (const ruleVersion of [null, 1]) {
  let s = position();
  s.ruleVersion = ruleVersion;
  s.clocks = [300000, 300000];
  assert.equal(
    grantTurnTime(s, 0).clocks[0],
    310000,
    "old replay retains opening bonus",
  );
  const next = move(s, 12000);
  assert.deepEqual(next.clocks, [288000, 310000]);
  assert.deepEqual(next.clockExtensionUses, [0, 0]);
}
for (const [host, guest, expected] of [
  [2, 2, 2],
  [1, 1, 1],
  [2, 1, null],
  [1, 2, null],
  [2, undefined, null],
  [undefined, 2, null],
  [2, 999, null],
]) {
  assert.equal(
    roomRuleVersion({ hostRuleVersion: host, guestRuleVersion: guest }),
    expected,
  );
  const start = reducer(initialState(), {
    type: "START_SETUP",
    size: 5,
    ruleVersion: expected,
    clockExtensionUses: [6, 6],
  });
  assert.equal(start.ruleVersion, expected);
  assert.deepEqual(
    start.clockExtensionUses,
    [0, 0],
    "network payload cannot supply the extension counters",
  );
}
// A pending capture keeps the incoming player's extension count hidden until reveal.
const captureBefore = position();
const captureAfter = {
  ...captureBefore,
  currentTurn: 1,
  captureReveal: { capturedBy: 0 },
  clockExtensionUses: [0, 1],
};
assert.deepEqual(
  captureDisplayState(captureAfter, captureBefore).clockExtensionUses,
  [0, 0],
);
assert.deepEqual(
  captureDisplayState({ ...captureAfter, captureReveal: null }, captureBefore)
    .clockExtensionUses,
  [0, 1],
);
assert.equal(CLOCK_INCREMENT_MS * CLOCK_EXTENSION_LIMIT, 60000);
console.log(
  "Clock: threshold, six-use cap per player, extra turns, timeout, reset, new setup, legacy and synchronized replay passed.",
);
