// 先に読む。areas.js が評価される前に、検証用の数字の差し替えを置く
import "./experiment-tuning.mjs";
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
const AREA_BY_RANK_LOCAL = Object.fromEntries(
  Object.entries(groups).flatMap(([t, ranks]) => ranks.map((r) => [r, t])),
);
const types = Object.keys(groups),
  seeds = Number(process.env.SEEDS || 60),
  cap = Number(process.env.TURN_CAP || 160);
const policies = (process.env.POLICIES || "stock,informed").split(",");
// aware: 正体の分からない敵も見込みで脅威にする情報活用CPU(UNKNOWN_WEIGHT、既定 0.6)
const unknownWeight = Number(process.env.UNKNOWN_WEIGHT || 0.6);
// SIDE_POLICIES=aware,informed: 組の左側・右側で別の方針を使う(同じ方針同士なら POLICIES)
const sidePolicies = process.env.SIDE_POLICIES
  ? process.env.SIDE_POLICIES.split(",")
  : null;
function actOf(policy, s) {
  if (policy === "stock") return cpuAction(s, s.currentTurn);
  if (policy === "aware")
    return cpuInformedAction(s, s.currentTurn, { unknownWeight });
  return (
    baselineCpu && s.areas[s.currentTurn]?.type === "palace"
      ? baselineCpu.cpuInformedAction
      : cpuInformedAction
  )(s, s.currentTurn);
}
const strategicSetup = process.env.STRATEGIC_SETUP === "1";
// VS_NONE=1: 各エリアを「同じ王のランクでフォイルを持たない側」と当てる。
// 王の能力・ランクを揃えて、エリアの有無だけの差を測る。
const vsNone = process.env.VS_NONE === "1";
// OVERALL=1: 「フォイルを持つ側」対「持たない側」。両者とも手札から王を自由に選ぶ。
// FOIL_SET は持つフォイルの範囲(all / R / SR / SSR / エリア名のコンマ区切り)。
// AREA_VALUE=1 で、持つ側の構成にエリアの計測値(reports/area-vs-none)を足す。
const overall = process.env.OVERALL === "1";
const foilSets = {
  all: types,
  none: [],
  R: ["earth", "sea"],
  SR: ["forest", "ice"],
  SSR: ["sky", "palace"],
};
const foilAreas = overall
  ? foilSets[process.env.FOIL_SET || "all"] ||
    (process.env.FOIL_SET || "").split(",").filter((t) => types.includes(t))
  : null;
// フォイルあり対なし(同じ王)の勝率から 50% を引いた差(pt)。
// reports/area-vs-none/検証レポート.md(2026-09-09)より。
// AREA_VALUE=<倍率> で、この差に倍率を掛けた値を構成の点に足す(0 か未指定なら足さない)。
const AREA_EDGE = {
  sky: 24.6,
  ice: 12.6,
  forest: 11.9,
  palace: 7.5,
  sea: 2.9,
  earth: 0,
};
const areaValueScale = Number(process.env.AREA_VALUE || 0);
const planOptions = areaValueScale
  ? {
      areaValue: Object.fromEntries(
        Object.entries(AREA_EDGE).map(([t, pt]) => [t, pt * areaValueScale]),
      ),
    }
  : {};
if (overall) {
  assert(strategicSetup, "OVERALL には STRATEGIC_SETUP=1 が要る");
  assert(foilAreas, "FOIL_SET が不正");
}
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
function setup(seed, kings, sides = null) {
  Math.random = rng(seed);
  const deck = shuffle(buildDeck(null)),
    used = new Set();
  const pick = (r) => {
    const c = deck.find((c) => c.rank === r && !used.has(c.id));
    used.add(c.id);
    return c;
  };
  // kings が無ければ(OVERALL)配札をそのまま使い、王は手札から各自が選ぶ
  const a = kings && pick(kings[0]),
    b = kings && pick(kings[1]),
    rest = deck.filter((c) => !used.has(c.id));
  const all = Object.fromEntries(
    Object.values(groups)
      .flat()
      .map((r) => [r, "fixture-skin:foil"]),
  );
  const foilOnly = Object.fromEntries(
    Object.entries(all).filter(([rank]) =>
      (foilAreas || []).includes(AREA_BY_RANK_LOCAL[rank]),
    ),
  );
  let s = reducer(
    { phase: "intro" },
    {
      type: "START_SETUP",
      size: 9,
      setupMode: "simultaneous",
      deck: kings ? [a, ...rest.slice(0, 12), b, ...rest.slice(12)] : rest,
      areas: true,
      // "none" の側は装備なし。王のランクにフォイルが無いのでエリアは立たない。
      // "foil" の側(OVERALL)は FOIL_SET の範囲だけ装備する
      loadouts: sides
        ? sides.map((t) => (t === "none" ? {} : t === "foil" ? foilOnly : all))
        : [all, all],
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
              ? setupStrategy(kings?.[s.mulliganIdx]).strategicDiscards(
                  s,
                  s.mulliganIdx,
                  kings?.[s.mulliganIdx] ?? null,
                  planOptions,
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
          const strategy = setupStrategy(kings?.[player]);
          const plan = strategy.chooseArmyPlan(
            s,
            player,
            kings?.[player] ?? null,
            planOptions,
          );
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
  if (kings) kings.forEach((k, i) => assert.equal(kingRankOf(s, i), k));
  return { ...s, experimentFormations: formations };
}
// 対戦の組。通常は15組の総当たり、VS_NONE では各エリア対「なし」の6組
const pairs = overall
  ? [{ i: types.length + 1, j: types.length, pair: ["foil", "none"] }]
  : vsNone
    ? types.map((t, i) => ({ i, j: types.length, pair: [t, "none"] }))
    : types.flatMap((t, i) =>
        types.slice(i + 1).map((u, k) => ({ i, j: i + 1 + k, pair: [t, u] })),
      );

function play(base, first, seed, policy, policyOf = () => policy) {
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
    let act = automaticAreaAction(s) || actOf(policyOf(s.currentTurn), s);
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
    for (const { i, j, pair } of pairs) {
      if (process.env.ONLY_AREA && !pair.includes(process.env.ONLY_AREA))
        continue;
      const t0 = Date.now();
      for (let n = 0; n < seeds; n++) {
        const sides = n % 2 ? [...pair].reverse() : pair;
        // "なし" の側も相手と同じ帯の王を使う(能力差を消してエリアだけを比べる)
        const band = vsNone ? groups[pair[0]] : null;
        const kings = overall
          ? null
          : sides.map((t) =>
              band
                ? band[Math.floor(n / 2) % band.length]
                : groups[t][Math.floor(n / 2) % groups[t].length],
            );
        let seed = 20260909 + n * 7919 + i * 997 + j * 113,
          base;
        for (let attempt = 0; attempt < 100; attempt++) {
          try {
            base = setup(seed, kings, vsNone || overall ? sides : null);
            break;
          } catch (error) {
            if (!String(error.message).includes("hand")) throw error;
            setupResamples++;
            seed += 15485863;
          }
        }
        assert(base);
        const areaTypes = base.areas.map((a) => a?.type || "none");
        if (overall) {
          // なし側にエリアは立たない。持つ側は FOIL_SET の範囲だけ
          assert.equal(areaTypes[sides.indexOf("none")], "none");
          const stood = areaTypes[sides.indexOf("foil")];
          assert(stood === "none" || foilAreas.includes(stood));
        } else assert.deepEqual(areaTypes, sides);
        for (const first of [0, 1])
          results.push({
            policy,
            pair,
            sides,
            kings: kings || [0, 1].map((i) => kingRankOf(base, i)),
            areaTypes,
            seed,
            first,
            formations: base.experimentFormations,
            ...play(base, first, seed + first * 104729, policy, (player) =>
              sidePolicies
                ? sidePolicies[pair.indexOf(sides[player])] || policy
                : policy,
            ),
            sidePolicies: sidePolicies
              ? sides.map((t) => sidePolicies[pair.indexOf(t)] || policy)
              : null,
          });
      }
      const r = results.filter(
        (r) =>
          r.policy === policy && r.pair[0] === pair[0] && r.pair[1] === pair[1],
      );
      console.log(
        JSON.stringify({
          policy,
          pair,
          n: r.length,
          winA: r.filter(
            (r) =>
              r.completed && r.winner != null && r.sides[r.winner] === pair[0],
          ).length,
          winB: r.filter(
            (r) =>
              r.completed && r.winner != null && r.sides[r.winner] === pair[1],
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
            vsNone,
            overall,
            foilAreas,
            areaValue: planOptions.areaValue || null,
            unknownWeight,
            sidePolicies,
            tuning: globalThis.TOTTERY_AREA_TUNING || null,
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
