import assert from "node:assert/strict";
import { initialState, reducer } from "../src/game/reducer.js";
import { palaceDoubleRemaining } from "../src/game/areas.js";
import {
  discardCards,
  replenishReserve,
  reserveSeed,
} from "../src/game/reserve.js";
import { getLegalMoves, buildDeck } from "../src/game/board.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { cpuAction } from "../src/game/cpu.js";
import { palacePromotion } from "../src/game/cpu-palace.js";
import { areaFixture } from "./area-fixture.mjs";
import { canWrite } from "./check-rules.mjs";
import { roomRuleVersion } from "../src/net/sync.js";
const fixture = () => ({ ...areaFixture("palace"), ruleVersion: 9 });
const ready = (s) => ({
  ...s,
  currentTurn: 0,
  turnNo: s.turnNo + 2,
  captureReveal: null,
  interstitial: null,
  extraMoveFor: null,
  extraUsed: false,
});
const reposition = (s, id, row, col) => {
  s.board[s.pieces[id].row][s.pieces[id].col] = null;
  Object.assign(s.pieces[id], { row, col });
  s.board[row][col] = s.pieces[id];
};

// One use per side; invalid choices don't spend it. Ordinary promotions remain per turn.
const s = fixture();
for (const rank of ["A", "Q", "K"]) {
  const a = fixture();
  a.pieces.fx1.rank = rank;
  assert.equal(
    reducer(a, { type: "USE_AREA", pieceId: "fx1", promotionSteps: 2 }),
    a,
  );
  assert.equal(palaceDoubleRemaining(a, 0), 1);
}
for (const promotionSteps of [0, 3, 1.5, "2"])
  assert.equal(
    reducer(s, { type: "USE_AREA", pieceId: "fx1", promotionSteps }),
    s,
  );
for (const pieceId of ["fx0", "fx5"])
  assert.equal(reducer(s, { type: "USE_AREA", pieceId, promotionSteps: 2 }), s);
assert.equal(
  reducer(s, {
    type: "USE_AREA",
    pieceId: "fx1",
    promotionSteps: 2,
    player: 1,
  }),
  s,
);
const old = { ...s, ruleVersion: 8 };
assert.equal(
  reducer(old, { type: "USE_AREA", pieceId: "fx1", promotionSteps: 2 }),
  old,
);
assert.equal(
  reducer(old, { type: "USE_AREA", pieceId: "fx1" }).pieces.fx1.rank,
  "7",
);
const promoted = reducer(s, {
  type: "USE_AREA",
  pieceId: "fx1",
  promotionSteps: 2,
});
assert.equal(promoted.pieces.fx1.rank, "8");
assert.equal(promoted.pieces.fx1.originalRank, "6");
assert.equal(promoted.currentTurn, 0);
assert(promoted.pieces.fx1.revealed);
assert.equal(palaceDoubleRemaining(promoted, 0), 0);
assert.equal(reducer(promoted, { type: "USE_AREA", pieceId: "fx2" }), promoted);
for (const id of ["fx1", "fx2"]) {
  const p = promoted.pieces[id],
    m = getLegalMoves(
      p,
      promoted.board,
      9,
      promoted.players[0].armyRankCounts,
      "K",
    ).find((m) => !promoted.board[m.row][m.col]);
  assert(m);
  assert.notEqual(
    reducer(promoted, {
      type: "MOVE_PIECE",
      pieceId: id,
      row: m.row,
      col: m.col,
    }),
    promoted,
  );
}
const later = ready(promoted);
assert.equal(
  reducer(later, { type: "USE_AREA", pieceId: "fx2", promotionSteps: 2 }),
  later,
);
const normal = reducer(later, { type: "USE_AREA", pieceId: "fx1" });
assert.equal(normal.pieces.fx1.rank, "9");
assert.equal(normal.pieces.fx1.originalRank, "6");
const foe = {
  ...normal,
  currentTurn: 1,
  turnNo: normal.turnNo + 1,
  areas: [normal.areas[0], { type: "palace", used: false, uses: 0 }],
};
assert.equal(
  reducer(foe, { type: "USE_AREA", pieceId: "fx5", promotionSteps: 2 }).pieces
    .fx5.rank,
  "10",
);
const fresh = reducer(promoted, {
  type: "START_SETUP",
  size: 9,
  deck: buildDeck(),
  ruleVersion: 9,
});
assert.equal(fresh.reserveRefills, 0);
assert.deepEqual(fresh.discardPile, []);

// CPU can use both choices and can preserve a winning move instead of promoting blindly.
const cpu = fixture();
cpu.pieces.fx1.rank = "9";
cpu.pieces.fx2.rank = "K";
cpu.reserve = [{ id: "c50", rank: "10", suit: "heart" }];
const cp = palacePromotion(cpu, 0, 0);
assert(cp);
assert.notEqual(reducer(cpu, cp), cpu);
const ca = cpuInformedAction(cpu, 0);
assert(ca);
assert.notEqual(reducer(cpu, ca), cpu);
const win = fixture();
reposition(win, "fx1", 4, 0);
win.pieces.fx1.rank = "J";
reposition(win, "fx4", 4, 3);
win.pieces.fx4.revealed = true;
win.pieces.fx2.rank = "K";
const wp = palacePromotion(win, 0, 10000, { pieceId: "fx1", row: 4, col: 3 });
if (wp) {
  const w = reducer(win, wp);
  assert(
    getLegalMoves(
      w.pieces.fx1,
      w.board,
      9,
      w.players[0].armyRankCounts,
      "K",
    ).some((m) => m.row === 4 && m.col === 3),
  );
}

// Physical discards are separate from capture history. Refill is deterministic and only at zero.
const a = fixture();
a.discardPile = [
  { id: "m0", rank: "2", suit: "heart" },
  { id: "m1", rank: "4", suit: "club" },
];
a.players[0].discard = [a.discardPile[0]];
a.players[1].discard = [a.discardPile[1]];
a.reserveShuffleState = reserveSeed(buildDeck());
const filled = replenishReserve(a);
assert.equal(filled.reserve.length, 2);
assert.equal(filled.discardPile.length, 0);
assert(filled.players.every((p) => !p.discard.length));
assert.equal(replenishReserve(filled), filled);
assert.deepEqual(replenishReserve(structuredClone(a)), filled);
assert.equal(replenishReserve({ ...a, ruleVersion: 8 }).reserve.length, 0);
assert.equal(replenishReserve(fixture()).reserve.length, 0);
let mull = reducer(initialState(), {
  type: "START_SETUP",
  size: 9,
  deck: buildDeck(),
  ruleVersion: 9,
});
mull = { ...mull, phase: "mulligan", interstitial: null, mulliganIdx: 0 };
const d0 = mull.players[0].hand[1].id;
mull = reducer(mull, {
  type: "CONFIRM_MULLIGAN",
  discardIds: [d0],
  reserveOrder: mull.reserve.map((c) => c.id),
});
assert(mull.discardPile.some((c) => c.id === d0));
mull = { ...mull, interstitial: null };
const d1 = mull.players[1].hand[1].id;
mull = reducer(mull, {
  type: "CONFIRM_MULLIGAN",
  discardIds: [d1],
  reserveOrder: mull.reserve.map((c) => c.id),
});
assert.deepEqual(new Set(mull.discardPile.map((c) => c.id)), new Set([d0, d1]));

// A promoted J is killed at zero reserve and redeploys as its original 6 without effects.
const battle = fixture();
battle.areas = [null, null];
battle.currentTurn = 1;
Object.assign(battle.pieces.fx1, {
  rank: "J",
  originalRank: "6",
  frozenUntil: 99,
  mark: "palace",
  skyTwice: true,
});
reposition(battle, "fx5", 6, 0);
battle.pieces.fx5.rank = "J";
const capture = {
  type: "MOVE_PIECE",
  pieceId: "fx5",
  row: 6,
  col: 3,
  player: 1,
};
const dead = reducer(battle, capture);
assert.equal(dead.pieces.fx1.alive, false);
assert.equal(dead.kPlacement.owner, 0);
assert.deepEqual(dead.kPlacement.cards, [
  { id: "fx1", rank: "6", suit: "spade" },
]);
assert.equal(dead.players[0].capturedOwn[0].rank, "J");
assert.deepEqual(
  reducer(structuredClone(battle), capture),
  dead,
  "both peers and server agree",
);
const deploy = reducer(
  { ...dead, captureReveal: null, interstitial: null },
  { type: "PLACE_RESERVE_CARD", cardId: "fx1", row: 8, col: 0, player: 0 },
);
assert.equal(deploy.pieces.fx1.rank, "6");
assert(deploy.pieces.fx1.alive);
for (const key of ["mark", "frozenUntil", "skyTwice", "originalRank"])
  assert.equal(deploy.pieces.fx1[key], undefined);
assert.equal(deploy.players[0].capturedOwn.length, 1);
assert.equal(reducer({ ...battle, ruleVersion: 8 }, capture).kPlacement, null);
let transform = fixture();
transform.areas[0].type = "sky";
transform = reducer(transform, { type: "USE_AREA", pieceId: "fx3" });
assert.equal(transform.pieces.fx3.originalRank, "A");
transform = ready(transform);
transform.areas[0].type = "palace";
transform = reducer(transform, {
  type: "USE_AREA",
  pieceId: "fx3",
  promotionSteps: 2,
});
assert.equal(transform.pieces.fx3.rank, "Q");
assert.equal(
  discardCards(transform, [transform.pieces.fx3]).discardPile[0].rank,
  "A",
);

// Multiple simultaneous J/Q defeats exhaust the reserve mid-action, without duplicating IDs.
const multi = fixture();
multi.areas = [null, null];
for (const [id, row, col] of [
  ["fx0", 8, 8],
  ["fx1", 4, 0],
  ["fx2", 4, 4],
  ["fx3", 0, 0],
  ["fx4", 0, 8],
  ["fx5", 2, 1],
  ["fx6", 3, 2],
  ["fx7", 8, 7],
])
  reposition(multi, id, row, col);
multi.pieces.fx5.rank = "J";
multi.pieces.fx6.rank = "Q";
multi.board = Array.from({ length: 9 }, () => Array(9).fill(null));
for (const p of Object.values(multi.pieces)) multi.board[p.row][p.col] = p;
multi.reserve = [{ id: "last", rank: "7", suit: "heart" }];
multi.discardPile = [{ id: "discard", rank: "4", suit: "heart" }];
const multiAct = {
  type: "CONFIRM_SHUFFLE",
  aId: "fx3",
  pickIds: ["fx1", "fx2"],
  order: [0, 1, 2],
  player: 0,
};
const caught = reducer(multi, multiAct);
assert.equal(caught.kPlacement.cards.length, 2);
assert.equal(caught.reserveRefills, 1);
assert.equal(caught.reserve.length, 2);
const physical = [
  ...Object.values(caught.pieces).filter((p) => p.alive),
  ...caught.reserve,
  ...caught.discardPile,
  ...caught.kPlacement.cards,
];
assert.equal(new Set(physical.map((c) => c.id)).size, physical.length);
const skipped = reducer(
  { ...caught, captureReveal: null, interstitial: null },
  { type: "SKIP_RESERVE_PLACEMENT", player: 1 },
);
assert.equal(skipped.kPlacement, null);
assert.equal(skipped.discardPile.length, 2);
assert.deepEqual(reducer(structuredClone(multi), multiAct), caught);
const repeated = replenishReserve(
  discardCards({ ...deploy, reserve: [], discardPile: [] }, [
    { ...deploy.pieces.fx1, alive: false },
  ]),
);
assert.equal(repeated.reserve.length, 1);
assert.equal(repeated.reserve[0].rank, "6");
assert.equal(repeated.players[0].capturedOwn.length, 1);

// Strict network payload and old-version compatibility.
const pending = fixture();
pending.areas = [null, null];
pending.extraMoveFor = "fx2";
pending.extraUsed = true;
pending.kPlacement = {
  owner: 1,
  cards: [{ id: "c50", rank: "2", suit: "heart" }],
};
for (const choose of [cpuAction, cpuInformedAction]) {
  const action = choose(pending, 0);
  assert(action, "pending enemy reserve must not stall the current CPU");
  assert.notEqual(reducer(pending, action), pending);
}
const db = {
  rooms: { ABCD: { seats: { host: "a", guest: "b" }, createdAt: 1 } },
};
const act = {
  type: "USE_AREA",
  pieceId: "c1",
  promotionSteps: 2,
  by: "a",
  __id: "test-1",
};
assert(
  canWrite(
    db,
    ["rooms", "ABCD", "acts", "-NxxxxxxxxxxxxxxxxxA"],
    { uid: "a" },
    act,
  ),
);
for (const value of [3, 0, 1.5, "2", {}])
  assert(
    !canWrite(
      db,
      ["rooms", "ABCD", "acts", "-NxxxxxxxxxxxxxxxxxA"],
      { uid: "a" },
      { ...act, promotionSteps: value },
    ),
  );
assert.equal(roomRuleVersion({ hostRuleVersion: 9, guestRuleVersion: 9 }), 9);
assert.equal(
  roomRuleVersion({ hostRuleVersion: 9, guestRuleVersion: 8 }),
  null,
);
console.log(
  "Palace quota, movement, CPU, original ranks, discard refills, multi-captures, replay, card uniqueness and network schema passed",
);
