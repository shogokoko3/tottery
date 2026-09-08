import {
  palacePromotion,
  reserveDeployment,
  bestEncirclement,
} from "./cpu-palace.js";
import { moveSafety, transformationGain } from "./cpu-tactics.js";
import {
  chooseArmyPlan,
  strategicDiscards,
  arrangeArmy,
} from "./cpu-strategy.js";
import { opponentKingBelief } from "./king-belief.js";
// 公開情報と自分だけが見抜いた情報を使うCPU。伏せ札の数字・王かどうかは評価に使わない。
import { cpuAction, bestShuffle } from "./cpu.js";
import { getLegalMoves, kingRankOf, territoryRows } from "./board.js";
import { canUseArea, isFrozen, isKnownTo, skyCandidates } from "./areas.js";
import { automaticAreaAction } from "./area-presentation.js";
export function cpuInformedAction(state, player) {
  if (
    !state.captureReveal &&
    state.kPlacement?.owner === player &&
    state.currentTurn === player
  ) {
    const act = reserveDeployment(state, player);
    if (act) {
      const { score, ...action } = act;
      return action;
    }
  }
  if (state.phase === "mulligan" && state.mulliganIdx === player)
    return {
      type: "CONFIRM_MULLIGAN",
      discardIds: strategicDiscards(state, player),
    };
  if (
    state.phase === "setup" &&
    state.setupPlacements &&
    !state.setupDone[player] &&
    (state.setupMode === "simultaneous" || state.setupIdx === player)
  ) {
    const plan = chooseArmyPlan(state, player);
    if (plan)
      return {
        type: "SETUP_CONFIRM",
        player,
        kingId: plan.kingId,
        placement: arrangeArmy(state, player, plan),
      };
  }
  if (
    state.phase !== "play" ||
    state.captureReveal ||
    state.pendingKingChoice ||
    state.kPlacement
  )
    return cpuAction(state, player);
  if (state.currentTurn !== player) return null;
  return automaticAreaAction(state) || informedPlay(state);
}
const value = {
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
export function informedPlay(s) {
  const player = s.currentTurn;
  const size = s.boardSize;
  const [lo, hi] = territoryRows(size, 1 - player);
  if (s.pendingKingChoice || s.kPlacement) return cpuAction(s, player);
  const belief = opponentKingBelief(s, player);
  const candidateIds = new Set(belief.candidates.map((p) => p.id));
  const enclosure = bestEncirclement(s, player);
  let moves = [];
  for (const p of Object.values(s.pieces)) {
    if (
      !p.alive ||
      p.owner !== player ||
      p.rank === "A" ||
      isFrozen(s, p) ||
      (s.extraMoveFor && s.extraMoveFor !== p.id)
    )
      continue;
    for (const m of getLegalMoves(
      p,
      s.board,
      size,
      s.players[player].armyRankCounts,
      kingRankOf(s, player),
    )) {
      const target = s.board[m.row][m.col],
        goal = player === 0 ? lo : hi;
      let score =
        Math.random() * 0.8 +
        (Math.abs(m.row - goal) < Math.abs(p.row - goal) ? 1.2 : 0) -
        (p.isKing ? 2 : 0);
      // 絞り込んだ王候補への攻撃と接近を評価する。内部の王IDは使わない。
      const capturedIds = new Set(
        (m.captures || [])
          .map((c) => s.board[c.row]?.[c.col]?.id)
          .filter(Boolean),
      );
      if (target && target.owner !== player) capturedIds.add(target.id);
      score +=
        80 *
        belief.weight *
        [...capturedIds].filter((id) => candidateIds.has(id)).length;
      if (belief.excluded > 0 && !capturedIds.size) {
        const distance = (row, col, c) =>
          Math.max(Math.abs(row - c.row), Math.abs(col - c.col));
        score +=
          3 *
          belief.weight *
          belief.candidates.reduce(
            (total, c) =>
              total + distance(p.row, p.col, c) - distance(m.row, m.col, c),
            0,
          );
      }
      if (target && target.owner !== player) {
        score += 12 + Math.max(0, (m.captures?.length || 1) - 1) * 10;
        if (isKnownTo(s, player, target)) {
          score += value[target.rank] * 0.7;

          if (["4", "5"].includes(target.rank) && !target.isKing) {
            const visibleKing = Object.values(s.pieces).find(
              (c) =>
                c.alive &&
                c.owner !== player &&
                isKnownTo(s, player, c) &&
                c.isKing,
            );
            const risk = visibleKing
              ? Number(visibleKing.rank === target.rank)
              : s.areas?.[1 - player]
                ? Number(s.areas[1 - player].type === "sea") * 0.5
                : 0.25;
            score -= risk * (p.isKing ? 100 : value[p.rank] * 2);
          }
        }
      }
      score += moveSafety(s, player, p, m, capturedIds);
      if (
        p.rank === "10" &&
        !s.extraMoveFor &&
        (p.isKing || p.skyTwice || s.players[player].skyTwice)
      ) {
        const board = s.board.map((row) => row.slice());
        board[p.row][p.col] = null;
        const after = { ...p, row: m.row, col: m.col };
        board[m.row][m.col] = after;
        const follow = getLegalMoves(
          after,
          board,
          size,
          s.players[player].armyRankCounts,
          kingRankOf(s, player),
        );
        const attacks = follow.filter(
          (n) => board[n.row][n.col]?.owner === 1 - player,
        );
        if (attacks.length)
          score +=
            4 +
            45 *
              belief.weight *
              Number(
                attacks.some((n) => candidateIds.has(board[n.row][n.col].id)),
              );
      }
      if (["J", "Q", "K", "10"].includes(p.rank)) {
        const future = bestEncirclement(s, player, {
          ...p,
          row: m.row,
          col: m.col,
        });
        score += Math.min(
          6,
          Math.max(0, (future?.score || 0) - (enclosure?.score || 0)) * 0.2,
        );
      }
      moves.push({
        score,
        type: "MOVE_PIECE",
        pieceId: p.id,
        row: m.row,
        col: m.col,
        captures: m.captures,
      });
    }
  }
  moves.sort((a, b) => b.score - a.score);
  const best = moves[0];
  const can = canUseArea(s, player);
  if (can.ok && can.type === "sky") {
    // Preserve A utility; turn low-value pieces into 10 first. Never reads hidden enemy cards.
    const ids = skyCandidates(s, player).filter(
      (id) => s.pieces[id].rank !== "A" && !isFrozen(s, s.pieces[id]),
    );
    ids.sort(
      (a, b) =>
        transformationGain(s, player, b, "10") -
        transformationGain(s, player, a, "10"),
    );
    // 王を取れる駒の動きを変えない。変身で戦力が落ちる場合は見送る。
    const chosen = ids.find(
      (id) =>
        transformationGain(s, player, id, "10") >= 0 &&
        !(best?.pieceId === id && best.score >= 12),
    );
    if (chosen) return { type: "USE_AREA", pieceId: chosen };
  }
  if (enclosure && enclosure.score > (best?.score || 0))
    return {
      type: "__CPU_SHUFFLE",
      aceId: enclosure.aceId,
      pickIds: enclosure.pickIds,
    };
  if (can.ok && can.type === "palace") {
    const promotion = palacePromotion(
      s,
      player,
      Math.max(best?.score || 0, enclosure?.score || 0),
      best,
    );
    if (promotion) return { type: "USE_AREA", pieceId: promotion.pieceId };
  }
  const swap = bestShuffle(s, player);
  if (swap && (!best || best.score < 12)) {
    const frozen = Object.values(s.pieces)
      .filter(
        (p) =>
          p.alive &&
          p.owner === player &&
          p.id !== swap.aceId &&
          isFrozen(s, p),
      )
      .sort((a, b) => value[b.rank] - value[a.rank]);
    const partners = Object.values(s.pieces).filter(
      (p) =>
        p.alive &&
        p.owner === player &&
        p.id !== swap.aceId &&
        !frozen.includes(p) &&
        !p.isKing,
    );
    const rescue = [...frozen, ...partners].slice(0, 2);
    if (frozen.length && rescue.length === 2)
      return {
        type: "__CPU_SHUFFLE",
        aceId: swap.aceId,
        pickIds: rescue.map((p) => p.id),
      };
  }
  if (swap && swap.promising && (!best || best.score < 12))
    return { type: "__CPU_SHUFFLE", ...swap };
  if (best) {
    const { score, ...act } = best;
    return act;
  }
  if (swap) return { type: "__CPU_SHUFFLE", ...swap };
  return cpuAction(s, player);
}
