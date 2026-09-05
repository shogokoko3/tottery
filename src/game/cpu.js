import {
  totalSlots,
  territoryRows,
  getLegalMoves,
  kingRankOf,
} from "./board.js";

/** ランクのざっくりした強さ。CPU の評価にだけ使う */
const RANK_VALUE = {
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

/** 布陣済みのカードから王を選ぶ。Kがあれば必ずK */
export function pickKing(state, player = state.setupIdx) {
  const me = state.players[player];
  const placed = Object.keys(state.setupPlacements[player])
    .map((id) => me.hand.find((c) => c.id === id))
    .filter(Boolean);

  if (placed.some((c) => c.rank === "K"))
    return placed.find((c) => c.rank === "K").id;

  // 2と3は同ランクが多いほど王として強い(移動が伸びる・王位を継げる)
  const score = (card) => {
    if (card.rank === "A") return 0;
    const base = RANK_VALUE[card.rank] || 1;
    const kin = ["2", "3"].includes(card.rank)
      ? placed.filter((c) => c.rank === card.rank).length * 2
      : 0;
    return base + kin;
  };
  return placed.slice().sort((a, b) => score(b) - score(a))[0].id;
}

/** 引き直すカードを選ぶ。採用上限を超えた余りから最大4枚 */
export function pickMulliganDiscards(state) {
  const me = state.players[state.mulliganIdx];
  const slots = totalSlots(state.boardSize);
  const counts = {};
  const keep = [];
  const spare = [];

  const byValue = me.hand
    .slice()
    .sort((a, b) => (RANK_VALUE[b.rank] || 0) - (RANK_VALUE[a.rank] || 0));
  for (const card of byValue) {
    const limit =
      card.rank === "K" ? 1 : card.rank === "J" || card.rank === "Q" ? 2 : 4;
    const have = counts[card.rank] || 0;
    if (keep.length < slots + 2 && have < limit) {
      keep.push(card);
      counts[card.rank] = have + 1;
    } else {
      spare.push(card);
    }
  }
  return spare.slice(0, 4).map((c) => c.id);
}

/** 一番よさそうな移動。取れる手を強く優先し、あとは前進を少し評価する */
export function bestMove(state, player) {
  const size = state.boardSize;
  const mine = Object.values(state.pieces).filter(
    (p) => p.alive && p.owner === player,
  );
  const foe = 1 - player;
  const [lo, hi] = territoryRows(size, foe);
  const goalRow = player === 0 ? lo : hi;

  const candidates = [];
  for (const piece of mine) {
    if (piece.rank === "A") continue;
    if (state.extraMoveFor && piece.id !== state.extraMoveFor) continue;

    for (const move of getLegalMoves(
      piece,
      state.board,
      size,
      state.players[player].armyRankCounts,
      kingRankOf(state, player),
    )) {
      let score = Math.random() * 0.8;
      const target = state.board[move.row][move.col];
      if (target && target.owner !== player) {
        score += 12;
        if (move.captures) score += (move.captures.length - 1) * 10;
      }
      const wasFar = Math.abs(piece.row - goalRow);
      const nowFar = Math.abs(move.row - goalRow);
      if (nowFar < wasFar) score += 1.2;
      // 王は前に出したくない
      if (piece.isKing) {
        score -= 2;
        if (nowFar < wasFar) score -= 1.5;
      }
      candidates.push({
        score,
        pieceId: piece.id,
        row: move.row,
        col: move.col,
        captures: move.captures,
      });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/** Aの入れ替え候補。2駒とも敵に近いほど、包囲が決まりやすい */
export function bestShuffle(state, player) {
  const ace = Object.values(state.pieces).find(
    (p) =>
      p.alive &&
      p.owner === player &&
      p.rank === "A" &&
      (!state.extraMoveFor || state.extraMoveFor === p.id),
  );
  if (!ace) return null;

  const allies = Object.values(state.pieces).filter(
    (p) => p.alive && p.owner === player && p.id !== ace.id,
  );
  if (allies.length < 2) return null;
  const foes = Object.values(state.pieces).filter(
    (p) => p.alive && p.owner !== player,
  );
  if (!foes.length) return null;

  const pairs = [];
  for (let i = 0; i < allies.length; i++) {
    for (let j = i + 1; j < allies.length; j++) {
      const a = allies[i];
      const b = allies[j];
      const near = foes.filter(
        (f) =>
          Math.abs(f.row - a.row) + Math.abs(f.col - a.col) <= 3 &&
          Math.abs(f.row - b.row) + Math.abs(f.col - b.col) <= 3,
      ).length;
      pairs.push({ score: near + Math.random() * 0.5, ids: [a.id, b.id] });
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  return {
    aceId: ace.id,
    pickIds: pairs[0].ids,
    promising: pairs[0].score >= 1,
  };
}

/**
 * その局面で CPU が取る行動を1つ返す。自分の番でなければ null。
 * __CPU_SHUFFLE だけは合成アクションで、呼び出し側が
 * SELECT_PIECE → TOGGLE_SHUFFLE_PICK ×2 → CONFIRM_SHUFFLE に展開する。
 */
export function cpuAction(state, player) {
  if (state.phase === "gameover" || state.captureReveal) return null;

  if (state.pendingKingChoice) {
    const pending = state.pendingKingChoice;
    if (pending.owner !== player) return null;
    return pending.acknowledged
      ? { type: "CHOOSE_HEIR", id: pending.candidateIds[0] }
      : { type: "ACK_KING_CHOICE" };
  }

  if (state.phase === "dice") {
    if (state.diceIdx !== player) return null;
    return state.dice[player] === null
      ? { type: "ROLL_DICE_SINGLE" }
      : { type: "NEXT_DICE_STEP" };
  }

  if (state.phase === "mulligan") {
    if (state.mulliganIdx !== player) return null;
    return {
      type: "CONFIRM_MULLIGAN",
      discardIds: pickMulliganDiscards(state),
    };
  }

  if (state.phase === "setup") {
    // 同時配置では自分の番を待たない。順番モードでは今の番だけ動く
    if (state.setupMode !== "simultaneous" && state.setupIdx !== player)
      return null;
    if (!state.setupPlacements) return null;
    if (state.setupDone[player]) return null;
    if (state.setupSteps[player] === "place") {
      return Object.keys(state.setupPlacements[player]).length <
        totalSlots(state.boardSize)
        ? { type: "SETUP_AUTO_ARRANGE", player }
        : { type: "SETUP_GOTO_KING_STEP", player };
    }
    return state.setupPickKings[player]
      ? { type: "SETUP_CONFIRM", player }
      : { type: "SETUP_PICK_KING", player, cardId: pickKing(state, player) };
  }

  if (state.phase === "play") {
    if (state.currentTurn !== player) return null;

    if (state.kPlacement) {
      if (state.kPlacement.owner !== player) return null;
      const [lo, hi] = territoryRows(state.boardSize, player);
      for (let r = lo; r <= hi; r++)
        for (let c = 0; c < state.boardSize; c++)
          if (!state.board[r][c])
            return {
              type: "PLACE_RESERVE_CARD",
              row: r,
              col: c,
              cardId: state.kPlacement.cards[0].id,
            };
      return { type: "SKIP_RESERVE_PLACEMENT" };
    }

    const move = bestMove(state, player);
    const swap = bestShuffle(state, player);
    if (swap && swap.promising && (!move || move.score < 12))
      return { type: "__CPU_SHUFFLE", ...swap };
    if (move) {
      return {
        type: "MOVE_PIECE",
        pieceId: move.pieceId,
        row: move.row,
        col: move.col,
        captures: move.captures,
      };
    }
    if (swap) return { type: "__CPU_SHUFFLE", ...swap };
    return { type: "SKIP_EXTRA_ACTION" };
  }

  return null;
}
