import assert from "node:assert/strict";
import {
  palacePromotion,
  reserveDeployment,
  bestEncirclement,
} from "../src/game/cpu-palace.js";
import { reducer } from "../src/game/reducer.js";
import { areaFixture } from "./area-fixture.mjs";
const s = areaFixture("palace");
s.reserve = [{ id: "replacement", rank: "10", suit: "heart" }];
s.pieces.fx1.rank = "10";
s.pieces.fx2.rank = "Q";
const promotion = palacePromotion(s, 0, 0);
assert.equal(
  promotion.pieceId,
  "fx1",
  "produce J before sacrificing Q replacement eligibility",
);
const promoted = reducer(s, { type: "USE_AREA", pieceId: promotion.pieceId });
assert.equal(promoted.pieces.fx1.rank, "J");
assert.equal(promoted.currentTurn, 1);
const enemy = promoted.pieces.fx5;
promoted.board[enemy.row][enemy.col] = null;
enemy.row = 6;
enemy.col = 2;
promoted.board[6][2] = enemy;
let captured = reducer(promoted, {
  type: "MOVE_PIECE",
  pieceId: enemy.id,
  row: 6,
  col: 3,
});
assert(
  captured.kPlacement?.cards.some((c) => c.id === "replacement"),
  "promoted J triggers K reserve rule",
);
captured = { ...captured, currentTurn: 0, captureReveal: null };
const deploy = reserveDeployment(captured, 0);
assert.equal(deploy.type, "PLACE_RESERVE_CARD");
assert(
  reducer(captured, deploy).pieces.replacement?.alive,
  "strategic reserve deployment accepted",
);
const qOnly = areaFixture("palace");
qOnly.reserve = s.reserve;
qOnly.pieces.fx1.rank = "Q";
qOnly.pieces.fx2.rank = "K";
assert.equal(
  palacePromotion(qOnly, 0, 0),
  null,
  "do not blindly lose Q replacement eligibility",
);
// 二つのAから実際に敵2体を囲える方を選ぶ。
const t = areaFixture("palace");
t.areas = [null, null];
const coords = {
  fx0: [8, 8],
  fx1: [4, 0],
  fx2: [4, 4],
  fx3: [0, 0],
  fx4: [8, 7],
  fx5: [2, 1],
  fx6: [3, 2],
  fx7: [0, 8],
};
for (const p of Object.values(t.pieces)) {
  [p.row, p.col] = coords[p.id];
  if (p.id === "fx1") p.rank = "J";
  if (p.id === "fx2") p.rank = "Q";
}
t.pieces.extraAce = {
  id: "extraAce",
  rank: "A",
  row: 8,
  col: 0,
  owner: 0,
  alive: true,
};
t.board = Array.from({ length: 9 }, () => Array(9).fill(null));
for (const p of Object.values(t.pieces)) t.board[p.row][p.col] = p;
const surround = bestEncirclement(t, 0);
assert(surround.caught.includes("fx5") && surround.caught.includes("fx6"));
for (const p of Object.values(t.pieces).filter((p) => p.owner === 1)) {
  Object.defineProperty(p, "rank", {
    get() {
      throw Error("hidden rank");
    },
  });
  Object.defineProperty(p, "isKing", {
    get() {
      throw Error("hidden king");
    },
  });
}
assert(bestEncirclement(t, 0));
console.log(
  "J production, Q retention, actual reserve trigger/deployment, exact multi-capture and hidden information isolation passed",
);
const { chooseArmyPlan, strategicDiscards } =
  await import("../src/game/cpu-strategy.js");
const ranks = [
  "9",
  "9",
  "10",
  "10",
  "10",
  "10",
  "J",
  "Q",
  "K",
  "2",
  "3",
  "4",
  "5",
];
const setup = {
  boardSize: 9,
  areasEnabled: true,
  areaLoadouts: [{ K: "skin", J: "skin", Q: "skin" }, {}],
  players: [{ hand: ranks.map((rank, i) => ({ id: `goal${i}`, rank })) }, {}],
};
const plan = chooseArmyPlan(setup, 0);
assert.equal(plan.kingRank, "K");
assert.deepEqual(plan.counts, { K: 1, 10: 4, J: 1, Q: 1, 9: 2 });
assert.deepEqual(
  strategicDiscards(setup, 0).map(
    (id) => setup.players[0].hand.find((c) => c.id === id).rank,
  ),
  ["2", "3", "4", "5"],
);
console.log("Requested 9x2, 10x4, J/Q/Kx1 build and targeted mulligan passed");
