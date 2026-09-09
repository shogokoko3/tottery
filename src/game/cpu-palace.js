import {
  getLegalMoves,
  kingRankOf,
  territoryRows,
  pointInTriangle,
} from "./board.js";
import { isFrozen, palaceCandidates, palacePromotionRank } from "./areas.js";
import { knownThreats, transformationGain } from "./cpu-tactics.js";
import { CARD_VALUE } from "./cpu-strategy.js";
import { opponentKingBelief } from "./king-belief.js";

export function bestEncirclement(s, player, moved = null) {
  const allies = Object.values(s.pieces)
    .filter((p) => p.alive && p.owner === player)
    .map((p) => (p.id === moved?.id ? moved : p));
  const enemies = Object.values(s.pieces).filter(
    (p) => p.alive && p.owner !== player,
  );
  const belief = opponentKingBelief(s, player),
    candidates = new Set(belief.candidates.map((p) => p.id));
  let best = null;
  for (const ace of allies.filter(
    (p) =>
      p.rank === "A" &&
      !isFrozen(s, p) &&
      (!s.extraMoveFor || s.extraMoveFor === p.id),
  )) {
    const rest = allies.filter((p) => p.id !== ace.id);
    for (let i = 0; i < rest.length; i++)
      for (let j = i + 1; j < rest.length; j++) {
        const a = rest[i],
          b = rest[j];
        const caught = enemies.filter((p) => pointInTriangle(p, ace, a, b));
        if (!caught.length) continue;
        // 三角形の3頂点は入れ替え順によらず同じ。王を含む場合は公開敵の射程を警戒。
        let score =
          caught.length * 12 +
          80 *
            belief.weight *
            caught.filter((p) => candidates.has(p.id)).length;
        if (a.isKing || b.isKing || ace.isKing) {
          const threats = knownThreats(s, player);
          score -=
            [ace, a, b].filter((p) => threats.has(`${p.row}/${p.col}`)).length *
            22;
        }
        if (!best || score > best.score)
          best = {
            score,
            aceId: ace.id,
            pickIds: [a.id, b.id],
            caught: caught.map((p) => p.id),
          };
      }
  }
  return best;
}
export function palacePromotion(s, player, bestMoveScore, bestMove = null) {
  const king = Object.values(s.pieces).find(
    (p) => p.alive && p.owner === player && p.isKing,
  );
  const threats = knownThreats(s, player);
  const free = s.ruleVersion >= 7;
  if (!free && king && threats.has(`${king.row}/${king.col}`)) return null;
  const replacement =
    king?.rank === "K" && (s.ruleVersion >= 9 || (s.reserve?.length || 0) > 0);
  let best = null;
  for (const id of palaceCandidates(s, player)) {
    const p = s.pieces[id];
    if (isFrozen(s, p)) continue;
    for (const promotionSteps of [1, 2]) {
      const next = palacePromotionRank(s, p, promotionSteps);
      if (!next) continue;
      let score = transformationGain(s, player, id, next);
      // 10→Jで予備札を引ける駒を増やす。9は二段階先のJを見込んで育成。
      if (["J", "Q"].includes(next) && !["J", "Q"].includes(p.rank))
        score += replacement ? 9 : 4;
      if (p.rank === "9" && next === "10") score += replacement ? 5 : 2;
      // Q→Kでは補充能力を失う。射程の利益が大きい場合だけ進める。
      if (["J", "Q"].includes(p.rank) && next === "K" && replacement)
        score -= 7;
      if (threats.has(`${p.row}/${p.col}`)) score -= 7;
      // 昇格後に王候補を直接狙える場合は価値を加える。伏せ札は読まない。
      const belief = opponentKingBelief(s, player),
        ids = new Set(belief.candidates.map((c) => c.id));
      const attacks = getLegalMoves(
        { ...p, rank: next },
        s.board,
        s.boardSize,
        s.players[player].armyRankCounts,
        kingRankOf(s, player),
      );
      if (
        free &&
        bestMove?.pieceId === id &&
        bestMoveScore >= 12 &&
        !attacks.some((m) => m.row === bestMove.row && m.col === bestMove.col)
      )
        continue;
      score +=
        8 *
        belief.weight *
        Number(attacks.some((m) => ids.has(s.board[m.row][m.col]?.id)));
      if (score > 0 && (!best || score > best.score))
        best = {
          score,
          type: "USE_AREA",
          pieceId: id,
          ...(promotionSteps === 2 ? { promotionSteps } : {}),
        };
    }
  }
  // 即時の撃破・包囲より優先しない。静かな手より育成を優先。
  return best && (free || bestMoveScore < 12) ? best : null;
}
export function reserveDeployment(s, player) {
  if (s.kPlacement?.owner !== player || s.currentTurn !== player) return null;
  const cards = s.kPlacement.cards || [s.kPlacement.card],
    [lo, hi] = territoryRows(s.boardSize, player);
  const threats = knownThreats(s, player);
  let best = null;
  for (const card of cards)
    for (let row = lo; row <= hi; row++)
      for (let col = 0; col < s.boardSize; col++) {
        if (s.board[row][col]) continue;
        const p = {
          ...card,
          row,
          col,
          owner: player,
          alive: true,
          isKing: false,
        };
        const moves = getLegalMoves(
          p,
          s.board,
          s.boardSize,
          s.players[player].armyRankCounts,
          kingRankOf(s, player),
        );
        const attacks = moves.filter(
          (m) => s.board[m.row][m.col]?.owner === 1 - player,
        ).length;
        const allies = Object.values(s.pieces).filter(
          (c) => c.alive && c.owner === player,
        );
        const board = s.board.map((r) => r.slice());
        board[row][col] = { owner: 1 - player };
        const guards = allies.filter(
          (c) =>
            !isFrozen(s, c) &&
            getLegalMoves(
              c,
              board,
              s.boardSize,
              s.players[player].armyRankCounts,
              kingRankOf(s, player),
            ).some((m) => m.row === row && m.col === col),
        ).length;
        let score =
          CARD_VALUE[card.rank] +
          attacks * 3 +
          Math.min(moves.length, 12) * 0.2 +
          Math.min(guards, 2) * 2 -
          (threats.has(`${row}/${col}`) ? 8 : 0);
        if (["9", "10", "J", "Q"].includes(card.rank)) score += 2;
        if (card.rank === "A") {
          const simulated = { ...s, pieces: { ...s.pieces, [p.id]: p } };
          score += Math.min(
            12,
            bestEncirclement(simulated, player)?.score || 0,
          );
        }
        if (!best || score > best.score)
          best = {
            score,
            type: "PLACE_RESERVE_CARD",
            cardId: card.id,
            row,
            col,
          };
      }
  return best || { type: "SKIP_RESERVE_PLACEMENT" };
}
