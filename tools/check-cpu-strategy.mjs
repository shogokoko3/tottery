import assert from "node:assert/strict";
import {
  chooseArmyPlan,
  strategicDiscards,
  arrangeArmy,
  formationMetrics,
} from "../src/game/cpu-strategy.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { reducer } from "../src/game/reducer.js";
import { maxAdopt } from "../src/game/board.js";
const ranks = [
  "2",
  "2",
  "3",
  "4",
  "4",
  "6",
  "8",
  "9",
  "10",
  "10",
  "J",
  "Q",
  "A",
];
const state = {
  boardSize: 9,
  areasEnabled: true,
  areaLoadouts: [Object.fromEntries(ranks.map((r) => [r, "skin"])), {}],
  players: [
    { hand: ranks.map((rank, i) => ({ rank, id: `c${i}`, suit: "spade" })) },
    {},
  ],
};
const plans = [];
for (const rank of ["2", "4", "6", "8", "10", "Q"]) {
  const plan = chooseArmyPlan(state, 0, rank);
  plans.push(plan);
  assert.equal(plan.cards.length, 9);
  assert.equal(plan.kingRank, rank);
  for (const [r, n] of Object.entries(plan.counts))
    assert(n <= maxAdopt(r, rank));
  const discards = strategicDiscards(state, 0, rank);
  assert.equal(discards.length, 4);
  assert(!discards.includes(plan.kingId));
  const placement = arrangeArmy(state, 0, plan);
  assert.equal(
    new Set(Object.values(placement).map((c) => `${c.row}/${c.col}`)).size,
    9,
  );
  assert(
    Object.values(placement).every(
      (c) => c.row >= 6 && c.row <= 8 && c.col >= 0 && c.col < 9,
    ),
  );
  const metrics = formationMetrics(plan, placement, 9, 0);
  assert(metrics.covered >= 7, `${rank}: ${JSON.stringify(metrics)}`);
  assert(metrics.mutual >= 2, `mutual support ${rank}`);
  console.log(rank, metrics);
}
assert(plans.find((p) => p.area === "earth").counts["2"] >= 2);
assert(plans.find((p) => p.area === "sky").counts["10"] >= 2);
assert(
  new Set(
    plans.map((p) =>
      p.cards
        .map((c) => c.id)
        .sort()
        .join(),
    ),
  ).size >= 3,
  "different area compositions",
);
// 狙いの10が引けなくても手元の合法構成を選び直す。
const missed = structuredClone(state);
missed.players[0].hand = missed.players[0].hand.filter((c) => c.rank !== "10");
assert(chooseArmyPlan(missed, 0));
Object.defineProperty(state.players[1], "hand", {
  get() {
    throw Error("hidden enemy hand");
  },
});
Object.defineProperty(state, "reserve", {
  get() {
    throw Error("future draws");
  },
});
assert(chooseArmyPlan(state, 0));
assert(strategicDiscards(state, 0));
// CPUの実際のsetupアクションが実reducerで受理される。
const plan = plans[0];
const fixture = reducer(
  { phase: "intro" },
  {
    type: "START_SETUP",
    size: 9,
    setupMode: "simultaneous",
    areas: true,
    loadouts: state.areaLoadouts,
  },
);
fixture.phase = "setup";
fixture.players[0].hand = state.players[0].hand;
const action = cpuInformedAction(fixture, 0),
  result = reducer(fixture, action);
assert(result.setupDone[0], "real setup accepted");
console.log(
  "Area plans, mulligan, fallback, mutual recapture, hidden-hand isolation and reducer acceptance passed",
);
for (const player of [0, 1]) {
  const small = structuredClone(missed);
  small.boardSize = 5;
  small.players[player] = {
    hand: ranks.map((rank, i) => ({ rank, id: `small${i}`, suit: "spade" })),
  };
  const plan = chooseArmyPlan(small, player);
  assert.equal(plan.area, null);
  assert.equal(plan.cards.length, 5);
  const placement = arrangeArmy(small, player, plan);
  assert.equal(
    new Set(Object.values(placement).map((c) => `${c.row}/${c.col}`)).size,
    5,
  );
  assert(
    Object.values(placement).every((c) =>
      player === 0 ? c.row >= 3 && c.row <= 4 : c.row >= 0 && c.row <= 1,
    ),
  );
}
console.log("5x5 retains legal territory and no area bonuses");
