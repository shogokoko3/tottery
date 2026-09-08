import { pathToFileURL } from "node:url";
import {
  chooseArmyPlan,
  strategicDiscards,
  arrangeArmy,
  formationMetrics,
} from "../src/game/cpu-strategy.js";
import { opponentKingBelief } from "../src/game/king-belief.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
// Offline experiment only. Uses the real reducer; never connects to production.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { reducer, autoArrange } from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";
import { cpuAction, bestShuffle } from "../src/game/cpu.js";
import {
  buildDeck,
  getLegalMoves,
  kingRankOf,
  shuffle,
} from "../src/game/board.js";
import { automaticAreaAction } from "../src/game/area-presentation.js";
import {
  canUseArea,
  isFrozen,
  isKnownTo,
  skyCandidates,
  palaceCandidates,
  promotedRank,
} from "../src/game/areas.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
const baselineDir = process.env.BASELINE_PALACE_DIR;
const baselineStrategy = baselineDir
  ? await import(
      pathToFileURL(path.resolve(baselineDir, "src/game/cpu-strategy.js"))
    )
  : null;
const baselineCpu = baselineDir
  ? await import(
      pathToFileURL(path.resolve(baselineDir, "src/game/cpu-informed.js"))
    )
  : null;
const setupStrategy = (rank) =>
  baselineStrategy && ["J", "Q", "K"].includes(rank)
    ? baselineStrategy
    : { chooseArmyPlan, strategicDiscards, arrangeArmy };
const RULE_VERSION = Number(process.env.RULE_VERSION || GAME_RULE_VERSION);
assert(RULE_VERSION >= 5 && RULE_VERSION <= GAME_RULE_VERSION);
const groups = {
  earth: ["2", "3"],
  sea: ["4", "5"],
  forest: ["6", "7"],
  ice: ["8", "9"],
  sky: ["10"],
  palace: ["J", "Q", "K"],
};
const types = Object.keys(groups),
  seeds = Number(process.env.SEEDS || 60),
  cap = Number(process.env.TURN_CAP || 160);
const policies = (process.env.POLICIES || "stock,informed").split(",");
const strategicSetup = process.env.STRATEGIC_SETUP === "1";
const output = process.env.OUTPUT || "reports/area-matchups/results.json";
fs.mkdirSync(path.dirname(output), { recursive: true });
const realRandom = Math.random;
function rng(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function setup(seed, kings) {
  Math.random = rng(seed);
  const deck = shuffle(buildDeck(null)),
    used = new Set();
  const pick = (r) => {
    const c = deck.find((c) => c.rank === r && !used.has(c.id));
    used.add(c.id);
    return c;
  };
  const a = pick(kings[0]),
    b = pick(kings[1]),
    rest = deck.filter((c) => !used.has(c.id));
  const all = Object.fromEntries(
    Object.values(groups)
      .flat()
      .map((r) => [r, "fixture-skin"]),
  );
  let s = reducer(
    { phase: "intro" },
    {
      type: "START_SETUP",
      size: 9,
      setupMode: "simultaneous",
      deck: [a, ...rest.slice(0, 12), b, ...rest.slice(12)],
      areas: true,
      loadouts: [all, all],
      ruleVersion: RULE_VERSION,
    },
  );
  const formations = [];
  for (let guard = 0; s.phase !== "play" && guard < 120; guard++) {
    if (s.interstitial) {
      s = reducer(s, { type: "DISMISS_INTERSTITIAL" });
      continue;
    }
    if (s.phase === "dice") {
      const act =
        s.diceIdx <= 1 && s.dice[s.diceIdx] === null
          ? { type: "ROLL_DICE_SINGLE", value: s.diceIdx === 0 ? 6 : 1 }
          : s.diceIdx === 2
            ? { type: "GOTO_MULLIGAN" }
            : s.diceIdx === 3
              ? { type: "REROLL_DICE" }
              : { type: "NEXT_DICE_STEP" };
      s = reducer(s, act);
      continue;
    }
    if (s.phase === "mulligan") {
      s = reducer(
        s,
        enrichAction(
          {
            type: "CONFIRM_MULLIGAN",
            discardIds: strategicSetup
              ? setupStrategy(kings[s.mulliganIdx]).strategicDiscards(
                  s,
                  s.mulliganIdx,
                  kings[s.mulliganIdx],
                )
              : [],
          },
          s,
        ),
      );
      continue;
    }
    if (s.phase === "setup") {
      for (const player of [0, 1]) {
        if (s.setupDone[player]) continue;
        if (strategicSetup) {
          const strategy = setupStrategy(kings[player]);
          const plan = strategy.chooseArmyPlan(s, player, kings[player]);
          assert(
            plan,
            JSON.stringify({
              hand: s.players[player].hand,
              kings,
              player,
              seed,
            }),
          );
          const placement = strategy.arrangeArmy(s, player, plan);
          formations[player] = formationMetrics(plan, placement, 9, player);
          s = reducer(s, {
            type: "SETUP_CONFIRM",
            player,
            kingId: plan.kingId,
            placement,
          });
          assert(s.setupDone[player], "strategic setup accepted");
          continue;
        }
        const hand = s.players[player].hand;
        const order = shuffle(hand)
          .filter((c) => c.rank !== "K" || kings[player] === "K")
          .sort(
            (a, b) =>
              Number(b.rank === kings[player]) -
              Number(a.rank === kings[player]),
          );
        const placement = autoArrange(
          s,
          player,
          null,
          order.map((c) => c.id),
          null,
        );
        const king = order.find(
          (c) => c.rank === kings[player] && placement[c.id],
        );
        assert(
          king,
          JSON.stringify({
            seed,
            kings,
            player,
            hand: hand.map((c) => c.rank),
            order: order.map((c) => c.rank),
          }),
        );
        s = reducer(s, {
          type: "SETUP_CONFIRM",
          player,
          placement,
          kingId: king.id,
        });
      }
      continue;
    }
    throw Error("unexpected setup " + s.phase);
  }
  if (s.setupEffects) s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" });
  if (s.interstitial) s = reducer(s, { type: "DISMISS_INTERSTITIAL" });
  assert.equal(s.phase, "play");
  kings.forEach((k, i) => assert.equal(kingRankOf(s, i), k));
  return { ...s, experimentFormations: formations };
}

function play(base, first, seed, policy) {
  Math.random = rng(seed);
  let s = {
      ...structuredClone(base),
      firstPlayer: first,
      currentTurn: first,
      interstitial: null,
    },
    steps = 0,
    extensions = 0,
    stopped = null;
  const palaceStats = [0, 1].map(() => ({
    toJ: 0,
    toQ: 0,
    toK: 0,
    reservePlaced: 0,
    surrounds: 0,
    surroundKills: 0,
  }));
  const deduction = [0, 1].map(() => ({
    moves: 0,
    narrowed: 0,
    inferred: 0,
    candidateAttacks: 0,
    inferredAttacks: 0,
  }));
  const step = (act) => {
    const prior = s;
    s = reducer(s, act);
    s = { ...s, replay: [] };
    return s !== prior;
  };
  while (s.phase !== "gameover" && steps++ < 2400) {
    if (s.captureReveal) {
      step({ type: "DISMISS_CAPTURE" });
      continue;
    }
    if (s.interstitial) {
      step({ type: "DISMISS_INTERSTITIAL" });
      continue;
    }
    if (s.setupEffects) {
      step({ type: "DISMISS_SETUP_EFFECTS" });
      continue;
    }
    if (s.turnNo >= cap) {
      stopped = "turn_cap";
      break;
    }
    let act =
      automaticAreaAction(s) ||
      (policy === "stock"
        ? cpuAction(s, s.currentTurn)
        : (baselineCpu && s.areas[s.currentTurn]?.type === "palace"
            ? baselineCpu.cpuInformedAction
            : cpuInformedAction)(s, s.currentTurn));
    if (!act) {
      stopped = "no_action";
      break;
    }
    if (act.type === "MOVE_PIECE") {
      const b = opponentKingBelief(s, s.currentTurn),
        d = deduction[s.currentTurn];
      d.moves++;
      if (b.excluded > 0) d.narrowed++;
      if (b.inferred) d.inferred++;
      const captured = new Set(
        (act.captures || []).map((c) => s.board[c.row]?.[c.col]?.id),
      );
      captured.add(s.board[act.row]?.[act.col]?.id);
      if (b.candidates.some((c) => captured.has(c.id))) {
        d.candidateAttacks++;
        if (b.inferred) d.inferredAttacks++;
      }
    }
    if (act.type === "__CPU_SHUFFLE") {
      step({ type: "SELECT_PIECE", id: act.aceId });
      for (const id of act.pickIds) step({ type: "TOGGLE_SHUFFLE_PICK", id });
      act = { type: "CONFIRM_SHUFFLE", aId: act.aceId, pickIds: act.pickIds };
    }
    const prior = s;
    const actor = s.currentTurn;
    const priorEnemies = Object.values(s.pieces).filter(
      (p) => p.alive && p.owner !== actor,
    ).length;
    const next = reducer(s, enrichAction({ ...act, elapsedMs: 0 }, s));
    if (next === prior) {
      stopped = "rejected:" + act.type;
      break;
    }
    if (act.type === "PLACE_RESERVE_CARD") palaceStats[actor].reservePlaced++;
    if (act.type === "USE_AREA" && next.lastArea?.type === "palace") {
      const rank = next.pieces[act.pieceId]?.rank;
      if (["J", "Q", "K"].includes(rank)) palaceStats[actor]["to" + rank]++;
    }
    if (act.type === "CONFIRM_SHUFFLE") {
      palaceStats[actor].surrounds++;
      palaceStats[actor].surroundKills += Math.max(
        0,
        priorEnemies -
          Object.values(next.pieces).filter((p) => p.alive && p.owner !== actor)
            .length,
      );
    }
    s = { ...next, replay: [] };
    if (act.type === "USE_AREA" && s.lastArea?.extended) extensions++;
  }
  if (s.phase !== "gameover" && !stopped) stopped = "action_cap";
  return {
    winner: s.phase === "gameover" ? s.winner : null,
    completed: s.phase === "gameover",
    stop: stopped,
    reason:
      s.endReason ||
      (s.adjudication
        ? "adjudication"
        : s.resignedBy != null
          ? "resignation"
          : "king"),
    turns: s.turnNo,
    uses: s.areas.map((a) => a?.uses || 0),
    extensions,
    deduction,
    palaceStats,
  };
}
const results = [];
let setupResamples = 0;
const started = new Date().toISOString();
try {
  for (const policy of policies)
    for (let i = 0; i < types.length; i++)
      for (let j = i + 1; j < types.length; j++) {
        if (
          process.env.ONLY_AREA &&
          ![types[i], types[j]].includes(process.env.ONLY_AREA)
        )
          continue;
        const pair = [types[i], types[j]],
          t0 = Date.now();
        for (let n = 0; n < seeds; n++) {
          const sides = n % 2 ? [...pair].reverse() : pair;
          const kings = sides.map(
            (t) => groups[t][Math.floor(n / 2) % groups[t].length],
          );
          let seed = 20260909 + n * 7919 + i * 997 + j * 113,
            base;
          for (let attempt = 0; attempt < 100; attempt++) {
            try {
              base = setup(seed, kings);
              break;
            } catch (error) {
              if (!String(error.message).includes("hand")) throw error;
              setupResamples++;
              seed += 15485863;
            }
          }
          assert(base);
          assert.deepEqual(
            base.areas.map((a) => a?.type),
            sides,
          );
          for (const first of [0, 1])
            results.push({
              policy,
              pair,
              sides,
              kings,
              seed,
              first,
              formations: base.experimentFormations,
              ...play(base, first, seed + first * 104729, policy),
            });
        }
        const r = results.filter(
          (r) =>
            r.policy === policy &&
            r.pair[0] === pair[0] &&
            r.pair[1] === pair[1],
        );
        console.log(
          JSON.stringify({
            policy,
            pair,
            n: r.length,
            winA: r.filter(
              (r) =>
                r.completed &&
                r.winner != null &&
                r.sides[r.winner] === pair[0],
            ).length,
            winB: r.filter(
              (r) =>
                r.completed &&
                r.winner != null &&
                r.sides[r.winner] === pair[1],
            ).length,
            draw: r.filter((r) => r.completed && r.winner === null).length,
            unfinished: r.filter((r) => !r.completed).length,
            ms: Date.now() - t0,
          }),
        );
        fs.writeFileSync(
          output,
          JSON.stringify(
            {
              started,
              updated: new Date().toISOString(),
              ruleVersion: RULE_VERSION,
              strategicSetup,
              baselinePalace: !!baselineDir,
              seeds,
              cap,
              setupResamples,
              results,
            },
            null,
            2,
          ),
        );
      }
} finally {
  Math.random = realRandom;
}
