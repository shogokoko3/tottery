import { canUseArea, isFrozen, isKnownTo, seaPull } from "./areas.js";
import { getLegalMoves, kingRankOf } from "./board.js";
import { bestEncirclement } from "./cpu-palace.js";
import { knownThreats, moveSafety } from "./cpu-tactics.js";

// 引き寄せる前後で、その後に指せる手を比較する。伏せ駒は位置だけを使う。
function positionScore(s, player) {
  const enemies = Object.values(s.pieces).filter(
    (p) => p.alive && p.owner !== player,
  );
  const captureScore = (ids) => {
    if (
      [...ids].some((id) => {
        const p = s.pieces[id];
        return isKnownTo(s, player, p) && p.isKing;
      })
    )
      return 10000;
    return ids.size * 12;
  };
  let best = -1000;
  let mobility = 0;
  for (const p of Object.values(s.pieces)) {
    if (!p.alive || p.owner !== player || isFrozen(s, p)) continue;
    const moves = getLegalMoves(
      p,
      s.board,
      s.boardSize,
      s.players[player].armyRankCounts,
      kingRankOf(s, player),
    );
    mobility += moves.length;
    for (const m of moves) {
      const ids = new Set(
        (m.captures || [])
          .map((c) => s.board[c.row]?.[c.col]?.id)
          .filter(Boolean),
      );
      const target = s.board[m.row][m.col];
      if (target?.owner === 1 - player) ids.add(target.id);
      const distance = enemies.length
        ? Math.min(
            ...enemies.map((e) =>
              Math.max(Math.abs(e.row - m.row), Math.abs(e.col - m.col)),
            ),
          )
        : 0;
      const score =
        captureScore(ids) + moveSafety(s, player, p, m, ids) - distance * 0.15;
      best = Math.max(best, score);
    }
  }
  const encirclement = bestEncirclement(s, player);
  if (encirclement) {
    const ids = new Set(encirclement.caught);
    const threats = knownThreats(s, player, s.board, ids);
    const king = Object.values(s.pieces).find(
      (p) => p.alive && p.owner === player && p.isKing,
    );
    best = Math.max(
      best,
      captureScore(ids) -
        (king && threats.has(`${king.row}/${king.col}`) ? 65 : 0),
    );
  }
  return best + Math.min(mobility, 60) * 0.01;
}

export function shouldUseSea(state, player) {
  const can = canUseArea(state, player);
  if (!can.ok || can.type !== "sea") return false;
  const pulled = seaPull(state);
  if (!pulled._seaMoves.length) return false;
  return positionScore(pulled, player) > positionScore(state, player) + 0.05;
}
