/** Reproducible, information-limited strategy comparison. Not a solving engine. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = [
  process.env.STRATEGY_REPO,
  path.resolve(here, ".."),
  path.resolve(here, "../../work/tottery-github-sync"),
]
  .filter(Boolean)
  .find((candidate) =>
    fs.existsSync(path.join(candidate, "src/game/reducer.js")),
  );
if (!repo) throw new Error("Set STRATEGY_REPO to the Tottery repository path");
const { reducer } = await import(
  pathToFileURL(path.join(repo, "src/game/reducer.js"))
);
const {
  buildDeck,
  getLegalMoves,
  totalSlots,
  territoryRows,
  pointInTriangle,
  maxAdopt,
} = await import(pathToFileURL(path.join(repo, "src/game/board.js")));
const { isStraight, isFlush } = await import(
  pathToFileURL(path.join(repo, "src/game/bonus.js"))
);
const { cpuAction } = await import(
  pathToFileURL(path.join(repo, "src/game/cpu.js"))
);

export const POLICIES = [
  { id: "low", name: "低合計重視" },
  { id: "heirs", name: "2・3同ランク王" },
  { id: "revenge", name: "4・5道連れ" },
  { id: "ace", name: "A包囲" },
  { id: "multi", name: "6〜9連撃王" },
  { id: "reserve", name: "K補充" },
  { id: "heavy", name: "既存高コスト志向" },
];
const BASE = {
  A: 5,
  2: 2,
  3: 2,
  4: 3,
  5: 3,
  6: 4,
  7: 4,
  8: 4,
  9: 4,
  10: 5,
  J: 6,
  Q: 6,
  K: 7,
};
const VALUE = {
  A: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
};
const PERMUTATIONS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

export function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(cards, random) {
  const result = cards.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function combinations(items, count) {
  const result = [];
  function visit(start, picked) {
    if (picked.length === count) {
      result.push(picked.slice());
      return;
    }
    for (let i = start; i <= items.length - (count - picked.length); i++) {
      picked.push(items[i]);
      visit(i + 1, picked);
      picked.pop();
    }
  }
  visit(0, []);
  return result;
}
function cardWeight(rank, policy) {
  const base = BASE[rank];
  if (policy === "low") return base * 0.55 - VALUE[rank] * 0.72;
  if (policy === "heirs")
    return (
      base * 0.65 + (["2", "3"].includes(rank) ? 3.8 : 0) - VALUE[rank] * 0.1
    );
  if (policy === "revenge")
    return (
      base * 0.8 + (["4", "5"].includes(rank) ? 3.0 : 0) - VALUE[rank] * 0.07
    );
  if (policy === "ace")
    return base + (rank === "A" ? 1.5 : 0) - VALUE[rank] * 0.12;
  if (policy === "multi")
    return base + (["6", "7", "8", "9"].includes(rank) ? 1.2 : 0);
  if (policy === "reserve")
    return base + (["K", "J", "Q"].includes(rank) ? 1.8 : 0);
  return base;
}
function armyScore(cards, king, policy) {
  const counts = {};
  for (const card of cards) counts[card.rank] = (counts[card.rank] || 0) + 1;
  if (
    Object.keys(counts).some((rank) => counts[rank] > maxAdopt(rank, king.rank))
  )
    return -Infinity;
  let score = cards.reduce(
    (sum, card) => sum + cardWeight(card.rank, policy),
    0,
  );
  score -= Math.max(0, (counts.A || 0) - 1) * 3.2;
  const kin = counts[king.rank];
  let kingBonus = BASE[king.rank] * 0.35;
  if (["2", "3"].includes(king.rank)) kingBonus += (kin - 1) * 2.6 + 1.0;
  if (["4", "5"].includes(king.rank)) kingBonus += (kin - 1) * 2.4;
  if (king.rank === "10") kingBonus += 3;
  if (king.rank === "A") kingBonus += 0.8;
  if (["6", "7", "8", "9"].includes(king.rank)) kingBonus -= 1.8; // Real rule: capture destinations only.
  if (king.rank === "K") kingBonus += ((counts.J || 0) + (counts.Q || 0)) * 1.3;
  if (policy === "heirs" && ["2", "3"].includes(king.rank))
    kingBonus += kin * 3;
  if (policy === "revenge" && ["4", "5"].includes(king.rank))
    kingBonus += (kin - 1) * 3 + 1;
  if (policy === "ace" && king.rank === "A") kingBonus += 5;
  if (policy === "multi" && ["6", "7", "8", "9"].includes(king.rank))
    kingBonus += 7;
  if (policy === "reserve" && king.rank === "K") kingBonus += 5;
  if (policy === "heavy")
    kingBonus =
      BASE[king.rank] + (["2", "3"].includes(king.rank) ? kin * 2 : 0);
  score += kingBonus;
  if (isStraight(cards)) score += 0.8;
  if (isFlush(cards)) score += 1.6;
  return score;
}
export function selectArmy(hand, size, policy) {
  let best = null;
  for (const cards of combinations(hand, totalSlots(size))) {
    const kings = cards.some((card) => card.rank === "K")
      ? cards.filter((card) => card.rank === "K")
      : cards;
    for (const king of kings) {
      const score = armyScore(cards, king, policy);
      if (!best || score > best.score) best = { cards, king, score };
    }
  }
  assert(best && Number.isFinite(best.score), "No legal initial army");
  return best;
}

/** This is the only interface consumed by battle decision functions. */
export function observe(state, player) {
  const all = Object.values(state.pieces)
    .filter((piece) => piece.alive)
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((piece) => {
      const visible = piece.owner === player || !!piece.revealed;
      return {
        id: piece.id,
        row: piece.row,
        col: piece.col,
        owner: piece.owner,
        alive: true,
        rank: visible ? piece.rank : null,
        isKing: visible ? !!piece.isKing : null,
        revealed: !!piece.revealed,
      };
    });
  const board = Array.from({ length: state.boardSize }, () =>
    Array(state.boardSize).fill(null),
  );
  for (const piece of all) board[piece.row][piece.col] = piece;
  const mine = all.filter((piece) => piece.owner === player);
  return {
    player,
    size: state.boardSize,
    all,
    mine,
    foes: all.filter((piece) => piece.owner !== player),
    board,
    ownCounts: { ...state.players[player].armyRankCounts },
    ownKing: mine.find((piece) => piece.isKing)?.rank || null,
    extraMoveFor: state.extraMoveFor,
    extraUsed: !!state.extraUsed,
  };
}
const dist = (a, b) =>
  Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
function publicThreats(view) {
  const threats = new Map();
  const knownKing = view.foes.find((piece) => piece.isKing)?.rank || null;
  const knownCounts = {};
  for (const piece of view.foes)
    if (piece.rank)
      knownCounts[piece.rank] = (knownCounts[piece.rank] || 0) + 1;
  for (const piece of view.foes) {
    if (!piece.rank) continue;
    for (const move of getLegalMoves(
      piece,
      view.board,
      view.size,
      knownCounts,
      knownKing,
    )) {
      const key = move.row + "," + move.col;
      threats.set(key, (threats.get(key) || 0) + 1);
    }
  }
  return threats;
}
function knownWorth(piece) {
  return (
    12 + (piece.rank ? BASE[piece.rank] * 0.55 : 1.8) + (piece.isKing ? 45 : 0)
  );
}
function locationValue(piece, position, view, threats) {
  if (!view.foes.length) return 0;
  const nearest = Math.min(...view.foes.map((foe) => dist(position, foe)));
  const kingKin =
    piece.isKing && ["2", "3"].includes(piece.rank)
      ? view.mine.filter((p) => p.rank === piece.rank).length
      : 1;
  const kingRisk = piece.isKing ? (kingKin > 1 ? 3.5 : 11) : 1.8;
  const knownThreat = threats.get(position.row + "," + position.col) || 0;
  const unknownClose = view.foes.filter(
    (foe) => !foe.rank && dist(foe, position) <= 1,
  ).length;
  const center = (view.size - 1) / 2;
  const centerDistance =
    Math.abs(position.col - center) + Math.abs(position.row - center);
  return (
    -nearest * (piece.isKing && kingKin === 1 ? 0.12 : 0.55) -
    centerDistance * 0.025 -
    knownThreat * kingRisk -
    unknownClose * kingRisk * 0.1
  );
}
export function chooseBattleAction(
  view,
  random,
  memory = new Map(),
  style = "balanced",
) {
  if (style === "legacy") {
    const publicState = {
      phase: "play",
      currentTurn: view.player,
      boardSize: view.size,
      board: view.board,
      pieces: Object.fromEntries(view.all.map((piece) => [piece.id, piece])),
      players: [0, 1].map((player) => ({
        armyRankCounts: player === view.player ? view.ownCounts : {},
        kingId:
          player === view.player
            ? view.mine.find((piece) => piece.isKing)?.id
            : null,
      })),
      extraMoveFor: view.extraMoveFor,
    };
    const priorRandom = Math.random;
    let action;
    try {
      Math.random = random;
      action = cpuAction(publicState, view.player);
    } finally {
      Math.random = priorRandom;
    }
    if (action?.type === "__CPU_SHUFFLE")
      action = {
        type: "CONFIRM_SHUFFLE",
        aId: action.aceId,
        pickIds: action.pickIds,
      };
    action ||= { type: "SKIP_EXTRA_ACTION" };
    return { action, key: JSON.stringify(action), score: 0 };
  }
  const threats = publicThreats(view);
  const candidates = [];
  const aggression = style === "cautious" ? 0.8 : style === "greedy" ? 1.2 : 1;
  for (const piece of view.mine) {
    if (view.extraMoveFor && piece.id !== view.extraMoveFor) continue;
    if (piece.rank === "A") continue;
    for (const move of getLegalMoves(
      piece,
      view.board,
      view.size,
      view.ownCounts,
      view.ownKing,
    )) {
      const targets = (move.captures || (move.capture ? [move] : []))
        .map((at) => view.board[at.row][at.col])
        .filter(Boolean);
      const key = piece.id + ":" + move.row + ":" + move.col;
      const repeat = memory.get(key) || 0;
      const risk =
        locationValue(piece, move, view, threats) -
        locationValue(piece, piece, view, threats);
      let score =
        targets.reduce((sum, target) => sum + knownWorth(target), 0) *
          aggression +
        risk;
      if (
        piece.isKing &&
        targets.some((target) => ["4", "5"].includes(target.rank))
      )
        score -= 5;
      score -= repeat * 1.3;
      score += random() * 0.35;
      candidates.push({
        score,
        key,
        action: {
          type: "MOVE_PIECE",
          pieceId: piece.id,
          row: move.row,
          col: move.col,
          captures: move.captures,
        },
      });
    }
  }
  for (const ace of view.mine.filter(
    (p) => p.rank === "A" && (!view.extraMoveFor || view.extraMoveFor === p.id),
  )) {
    const others = view.all.filter((piece) => piece.id !== ace.id);
    for (let i = 0; i < others.length; i++)
      for (let j = i + 1; j < others.length; j++) {
        const pieces = [ace, others[i], others[j]];
        const allied = pieces.every((piece) => piece.owner === view.player);
        const trapped = allied
          ? view.foes.filter((foe) => pointInTriangle(foe, ...pieces))
          : [];
        let expected = 0;
        for (const permutation of PERMUTATIONS) {
          for (let k = 0; k < 3; k++)
            if (pieces[k].owner === view.player)
              expected +=
                (locationValue(
                  pieces[k],
                  pieces[permutation[k]],
                  view,
                  threats,
                ) -
                  locationValue(pieces[k], pieces[k], view, threats)) /
                6;
        }
        const key =
          "A:" + pieces.map((piece) => piece.row + "," + piece.col).join(";");
        const score =
          trapped.reduce((sum, target) => sum + knownWorth(target), 0) *
            aggression +
          expected -
          0.45 -
          (memory.get(key) || 0) * 1.3 +
          random() * 0.35;
        candidates.push({
          score,
          key,
          action: {
            type: "CONFIRM_SHUFFLE",
            aId: ace.id,
            pickIds: [others[i].id, others[j].id],
          },
        });
      }
  }
  if (!candidates.length)
    return {
      action: { type: "SKIP_EXTRA_ACTION" },
      key: "pass",
      score: -Infinity,
    };
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}
function memoryAdd(memory, queue, key) {
  memory.set(key, (memory.get(key) || 0) + 1);
  queue.push(key);
  if (queue.length > 18) {
    const old = queue.shift(),
      value = memory.get(old) - 1;
    if (value) memory.set(old, value);
    else memory.delete(old);
  }
}
function placeArmy(army, size, owner) {
  const [lo, hi] = territoryRows(size, owner);
  const rear = owner === 0 ? hi : lo,
    front = owner === 0 ? lo : hi;
  const center = (size - 1) / 2;
  const cells = [];
  for (let row = lo; row <= hi; row++)
    for (let col = 0; col < size; col++) cells.push({ row, col });
  const ordered = army.cards
    .slice()
    .sort(
      (a, b) =>
        (a.id === army.king.id ? -100 : BASE[a.rank]) -
        (b.id === army.king.id ? -100 : BASE[b.rank]),
    );
  const placement = {};
  for (const card of ordered) {
    const wantRear = card.id === army.king.id || card.rank === "A";
    cells.sort(
      (a, b) =>
        Math.abs(a.row - (wantRear ? rear : front)) * 3 +
        Math.abs(a.col - center) -
        (Math.abs(b.row - (wantRear ? rear : front)) * 3 +
          Math.abs(b.col - center)),
    );
    placement[card.id] = cells.shift();
  }
  return placement;
}
function stripped(state) {
  // Only presentation data is bounded; rule state, armies and hidden information remain intact.
  return { ...state, log: [], replay: [] };
}
function apply(state, action, stats) {
  const before = state;
  const next = reducer(state, { ...action, elapsedMs: 0 });
  if (next === before) stats.rejected++;
  if (action.type === "MOVE_PIECE") stats.moves++;
  if (action.type === "CONFIRM_SHUFFLE") stats.swaps++;
  if (action.type === "CHOOSE_HEIR") stats.heirChoices++;
  if (action.type === "PLACE_RESERVE_CARD") stats.reservePlacements++;
  if (
    before.extraMoveFor &&
    ["MOVE_PIECE", "CONFIRM_SHUFFLE"].includes(action.type)
  )
    stats.secondActions++;
  if (next.lastRevenge !== before.lastRevenge) stats.revenges++;
  if (next.lastDefeat?.seq !== before.lastDefeat?.seq) {
    stats.captures += next.lastDefeat?.cells?.length || 0;
    if ((next.lastDefeat?.cells?.length || 0) > 1) stats.multipleCaptures++;
    if (next.lastDefeat?.via === "surround") stats.surrounds++;
  }
  return stripped(next);
}
function chooseReserve(state, owner) {
  const view = observe(state, owner),
    threats = publicThreats(view),
    card = state.kPlacement.card;
  let best = null;
  for (let row = 0; row < view.size; row++)
    for (let col = 0; col < view.size; col++)
      if (!view.board[row][col]) {
        const piece = { ...card, row, col, owner, isKing: false };
        const score =
          locationValue(piece, piece, view, threats) +
          getLegalMoves(
            piece,
            view.board,
            view.size,
            view.ownCounts,
            view.ownKing,
          ).length *
            0.08;
        if (!best || score > best.score) best = { score, row, col };
      }
  return best
    ? { type: "PLACE_RESERVE_CARD", row: best.row, col: best.col }
    : { type: "SKIP_RESERVE_PLACEMENT" };
}
function hiddenInvariant(state, player) {
  const before = observe(state, player);
  const altered = {
    ...state,
    initialArmyTotals: [999, 1],
    pieces: { ...state.pieces },
    players: state.players.map((p, i) =>
      i === player
        ? p
        : { ...p, armyRankCounts: { K: 99 }, kingId: "not-visible" },
    ),
  };
  for (const piece of Object.values(state.pieces))
    if (piece.owner !== player && !piece.revealed)
      altered.pieces[piece.id] = {
        ...piece,
        rank: piece.rank === "A" ? "K" : "A",
        isKing: !piece.isKing,
      };
  const after = observe(altered, player);
  assert.deepEqual(before, after);
  assert.deepEqual(
    chooseBattleAction(before, rng(77)),
    chooseBattleAction(after, rng(77)),
  );
}

export function playGame({
  size,
  policyA,
  policyB,
  seed,
  leg,
  maxActions,
  style = "balanced",
  verify = false,
}) {
  const originalRandom = Math.random;
  Math.random = rng(seed ^ 0x827ab17);
  const stats = {
    moves: 0,
    swaps: 0,
    heirChoices: 0,
    reservePlacements: 0,
    secondActions: 0,
    revenges: 0,
    captures: 0,
    multipleCaptures: 0,
    surrounds: 0,
    rejected: 0,
  };
  try {
    const deck = shuffled(buildDeck(), rng(seed));
    // Keep the deal fixed and exchange the policies. Each policy receives both
    // initial hands and both dice-defined move orders once per two-game pair.
    const policies = leg === 0 ? [policyA, policyB] : [policyB, policyA];
    let state = apply(
      { phase: "intro" },
      {
        type: "START_SETUP",
        size,
        deck,
        setupMode: "simultaneous",
        ruleVersion: 1,
      },
      stats,
    );
    for (const action of [
      { type: "ROLL_DICE_SINGLE", value: 6 },
      { type: "NEXT_DICE_STEP" },
      { type: "ROLL_DICE_SINGLE", value: 1 },
      { type: "NEXT_DICE_STEP" },
      { type: "GOTO_MULLIGAN" },
    ])
      state = apply(state, action, stats);
    const chosen = [];
    for (let n = 0; n < 2; n++) {
      const player = state.mulliganIdx,
        hand = state.players[player].hand;
      const selected = selectArmy(hand, size, policies[player]);
      const keep = new Set(selected.cards.map((card) => card.id));
      const discards = hand
        .filter((card) => !keep.has(card.id))
        .sort(
          (a, b) =>
            cardWeight(a.rank, policies[player]) -
            cardWeight(b.rank, policies[player]),
        )
        .slice(0, 4)
        .map((card) => card.id);
      state = apply(
        state,
        { type: "CONFIRM_MULLIGAN", discardIds: discards },
        stats,
      );
    }
    for (let player = 0; player < 2; player++) {
      const army = selectArmy(
        state.players[player].hand,
        size,
        policies[player],
      );
      chosen[player] = {
        ranks: army.cards.map((card) => card.rank),
        king: army.king.rank,
        total: army.cards.reduce((sum, card) => sum + VALUE[card.rank], 0),
      };
      const placement = placeArmy(army, size, player);
      // Validate every adopted card through the same placement and king-selection gates as the UI.
      for (const card of army.cards)
        state = apply(
          state,
          {
            type: "SETUP_PLACE_CARD",
            player,
            cardId: card.id,
            ...placement[card.id],
          },
          stats,
        );
      state = apply(state, { type: "SETUP_GOTO_KING_STEP", player }, stats);
      state = apply(
        state,
        { type: "SETUP_PICK_KING", player, cardId: army.king.id },
        stats,
      );
      state = apply(state, { type: "SETUP_CONFIRM", player }, stats);
    }
    assert.equal(state.phase, "play");
    assert.equal(stats.rejected, 0, "A setup action was rejected");
    if (verify) {
      hiddenInvariant(state, 0);
      hiddenInvariant(state, 1);
    }
    const memory = [new Map(), new Map()],
      queues = [[], []];
    let actions = 0,
      administrative = 0;
    const actualFirst = state.currentTurn;
    while (
      state.phase !== "gameover" &&
      actions < maxActions &&
      administrative < maxActions * 8
    ) {
      administrative++;
      let action;
      if (state.captureReveal) action = { type: "DISMISS_CAPTURE" };
      else if (state.setupEffects) action = { type: "DISMISS_SETUP_EFFECTS" };
      else if (state.interstitial) action = { type: "DISMISS_INTERSTITIAL" };
      else if (state.pendingKingChoice) {
        const pending = state.pendingKingChoice;
        if (!pending.acknowledged) action = { type: "ACK_KING_CHOICE" };
        else {
          const view = observe(state, pending.owner),
            threats = publicThreats(view);
          const heirs = pending.candidateIds.map((id) =>
            view.mine.find((p) => p.id === id),
          );
          heirs.sort(
            (a, b) =>
              locationValue({ ...b, isKing: true }, b, view, threats) -
              locationValue({ ...a, isKing: true }, a, view, threats),
          );
          action = { type: "CHOOSE_HEIR", id: heirs[0].id };
        }
      } else if (state.kPlacement)
        action = chooseReserve(state, state.kPlacement.owner);
      else {
        const player = state.currentTurn,
          view = observe(state, player);
        const choice = chooseBattleAction(
          view,
          rng(seed ^ ((actions + 1) * 63689) ^ (player * 191)),
          memory[player],
          style,
        );
        action = choice.action;
        memoryAdd(memory[player], queues[player], choice.key);
        actions++;
      }
      state = apply(state, action, stats);
    }
    const winner =
      state.phase === "gameover"
        ? state.winner === 0 || state.winner === 1
          ? state.winner
          : "draw"
        : null;
    return {
      size,
      seed,
      leg,
      policyA,
      policyB,
      policies,
      style,
      actions,
      actualFirst,
      winner,
      winnerPolicy: typeof winner === "number" ? policies[winner] : winner,
      result:
        state.phase === "gameover"
          ? winner === "draw"
            ? "draw"
            : "win"
          : "unresolved",
      endReason:
        state.endReason ||
        (state.phase === "gameover" ? "king-capture" : "action-limit"),
      chosen,
      stats,
      ruleVersion: state.adjudicationRuleVersion ?? state.ruleVersion ?? null,
    };
  } finally {
    Math.random = originalRandom;
  }
}

function summarize(games) {
  const rows = [];
  for (const size of [5, 9])
    for (const policy of POLICIES) {
      const selected = games.filter(
        (game) => game.size === size && game.policies.includes(policy.id),
      );
      if (!selected.length) continue;
      const wins = selected.filter(
        (game) => game.winnerPolicy === policy.id,
      ).length;
      const losses = selected.filter(
        (game) => game.result === "win" && game.winnerPolicy !== policy.id,
      ).length;
      const draws = selected.filter((game) => game.result === "draw").length;
      const unresolved = selected.filter(
        (game) => game.result === "unresolved",
      ).length;
      const kings = {},
        ranks = {},
        endReasons = {};
      let total = 0;
      for (const game of selected) {
        const army = game.chosen[game.policies.indexOf(policy.id)];
        total += army.total;
        kings[army.king] = (kings[army.king] || 0) + 1;
        for (const rank of army.ranks) ranks[rank] = (ranks[rank] || 0) + 1;
        endReasons[game.endReason] = (endReasons[game.endReason] || 0) + 1;
      }
      rows.push({
        size,
        policy: policy.id,
        name: policy.name,
        games: selected.length,
        wins,
        losses,
        draws,
        unresolved,
        winRate: wins / selected.length,
        unresolvedRate: unresolved / selected.length,
        scoreLower: (wins + draws / 2) / selected.length,
        scoreUpper: (wins + draws / 2 + unresolved) / selected.length,
        resolvedScore: (wins + draws / 2) / (wins + losses + draws || 1),
        meanArmyTotal: total / selected.length,
        kings,
        ranks,
        endReasons,
      });
    }
  return rows;
}
function main() {
  const args = process.argv.slice(2);
  const arg = (name, fallback) => {
    const i = args.indexOf("--" + name);
    return i < 0 ? fallback : args[i + 1];
  };
  const stage = arg("stage", "pilot"),
    seeds = Number(arg("seeds", "1")),
    baseSeed = Number(arg("base-seed", "41001"));
  const max5 = Number(arg("max5", "220")),
    max9 = Number(arg("max9", "320"));
  const styles = arg("styles", "balanced").split(",");
  const output = path.resolve(
    arg("output", path.join(repo, "../../outputs/strategy-analysis")),
  );
  const games = [];
  const started = Date.now();
  for (const style of styles)
    for (const size of [5, 9])
      for (let i = 0; i < POLICIES.length; i++)
        for (let j = i + 1; j < POLICIES.length; j++) {
          for (let trial = 0; trial < seeds; trial++)
            for (let leg = 0; leg < 2; leg++) {
              const seed = (baseSeed + trial * 104729 + size * 65537) >>> 0;
              games.push(
                playGame({
                  size,
                  policyA: POLICIES[i].id,
                  policyB: POLICIES[j].id,
                  seed,
                  leg,
                  maxActions: size === 5 ? max5 : max9,
                  style,
                  verify: stage === "pilot" && trial === 0,
                }),
              );
            }
          process.stdout.write(
            JSON.stringify({
              stage,
              size,
              pair: [POLICIES[i].id, POLICIES[j].id],
              completed: games.length,
              seconds: (Date.now() - started) / 1000,
            }) + "\n",
          );
        }
  const summary = summarize(games);
  const result = {
    stage,
    settings: {
      seeds,
      baseSeed,
      max5,
      max9,
      styles,
      ruleVersion: 1,
      pairing: "fixed-deck-swapped-policies",
    },
    seconds: (Date.now() - started) / 1000,
    games: games.length,
    summary,
    coverage: games.reduce((all, game) => {
      for (const [key, value] of Object.entries(game.stats))
        all[key] = (all[key] || 0) + value;
      return all;
    }, {}),
    completeRules: games.every((game) => game.ruleVersion === 1),
    sample: games.slice(0, 4),
  };
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    path.join(output, stage + "-games.jsonl"),
    games.map((game) => JSON.stringify(game)).join("\n") + "\n",
  );
  fs.writeFileSync(
    path.join(output, stage + "-summary.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  if (
    path.resolve(output, "strategy-lab.mjs") !== fileURLToPath(import.meta.url)
  )
    fs.copyFileSync(
      fileURLToPath(import.meta.url),
      path.join(output, "strategy-lab.mjs"),
    );
  console.log(
    JSON.stringify(
      {
        stage,
        seconds: result.seconds,
        games: games.length,
        coverage: result.coverage,
        completeRules: result.completeRules,
        summary,
      },
      null,
      2,
    ),
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
