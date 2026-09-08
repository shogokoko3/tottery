// 公開情報と自分だけが見抜いた情報を使うCPU。伏せ札の数字・王かどうかは評価に使わない。
import { cpuAction, bestShuffle } from "./cpu.js";
import { getLegalMoves, kingRankOf, territoryRows } from "./board.js";
import {
  canUseArea,
  isFrozen,
  isKnownTo,
  skyCandidates,
  palaceCandidates,
  promotedRank,
} from "./areas.js";
import { automaticAreaAction } from "./area-presentation.js";
export function cpuInformedAction(state, player) {
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
      if (target && target.owner !== player) {
        score += 12 + Math.max(0, (m.captures?.length || 1) - 1) * 10;
        if (isKnownTo(s, player, target)) {
          score += value[target.rank] * 0.7;
          if (target.isKing) score += 80;
          if (["4", "5"].includes(target.rank))
            score -= p.isKing ? 100 : value[p.rank] * 2;
        }
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
    ids.sort((a, b) => value[s.pieces[a].rank] - value[s.pieces[b].rank]);
    if (ids.length) return { type: "USE_AREA", pieceId: ids[0] };
  }
  if (can.ok && can.type === "palace" && (!best || best.score < 12)) {
    // Continue promoting beyond opening, but do not skip an available capture.
    const ids = palaceCandidates(s, player).filter(
      (id) => !isFrozen(s, s.pieces[id]),
    );
    ids.sort(
      (a, b) =>
        value[promotedRank(s.pieces[b].rank)] -
        value[s.pieces[b].rank] -
        (value[promotedRank(s.pieces[a].rank)] - value[s.pieces[a].rank]),
    );
    if (ids.length) return { type: "USE_AREA", pieceId: ids[0] };
  }
  const swap = bestShuffle(s, player);
  if (swap && swap.promising && (!best || best.score < 12))
    return { type: "__CPU_SHUFFLE", ...swap };
  if (best) {
    const { score, ...act } = best;
    return act;
  }
  if (swap) return { type: "__CPU_SHUFFLE", ...swap };
  return cpuAction(s, player);
}
