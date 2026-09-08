import { totalSlots, maxAdopt, territoryRows, getLegalMoves } from "./board.js";
import { areaForKing } from "./areas.js";

export const CARD_VALUE = {
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
// 手札だけで構成を比較する。引く前に山札や相手の採用札を見ることはない。
const affinity = {
  earth: { A: 1, J: 1, Q: 1, 10: 1 },
  sea: { A: 3, 4: 1, 5: 1, 8: 1, 9: 1, 10: 2 },
  forest: { J: 2, Q: 2, 6: 1, 7: 1, 10: 2 },
  ice: { J: 2, Q: 2, 8: 2, 9: 2, 10: 1 },
  sky: { 2: 2, 3: 2, 10: 4, A: 1 },
  palace: { 9: 2, J: 2, Q: 3, 4: 1, 5: 1 },
};
export function chooseArmyPlan(state, player, preferredKingRank = null) {
  const hand = state.players[player].hand,
    slots = totalSlots(state.boardSize);
  let best = null;
  for (const king of hand) {
    if (
      king.rank === "A" ||
      (preferredKingRank && king.rank !== preferredKingRank)
    )
      continue;
    const area =
      state.areasEnabled &&
      state.boardSize === 9 &&
      state.areaLoadouts?.[player]?.[king.rank]
        ? areaForKing(king.rank)
        : null;
    const cards = [king],
      counts = { [king.rank]: 1 };
    let score = CARD_VALUE[king.rank];
    const marginal = (c) => {
      let n = CARD_VALUE[c.rank] + (affinity[area]?.[c.rank] || 0);
      // 後継者と王の射程、海賊王と同数字の射程を構成に織り込む。
      if (["2", "3", "4", "5"].includes(king.rank) && c.rank === king.rank)
        n += 3;
      if (c.rank === "A" && counts.A) n -= 4;
      // 一方向・一種類だけに偏るより、代わりに働ける役割を残す。
      n -= (counts[c.rank] || 0) * 0.65;
      return n;
    };
    while (cards.length < slots) {
      const options = hand.filter(
        (c) =>
          !cards.includes(c) &&
          (counts[c.rank] || 0) < maxAdopt(c.rank, king.rank),
      );
      options.sort((a, b) => marginal(b) - marginal(a));
      if (!options.length) break;
      const c = options[0];
      score += marginal(c);
      cards.push(c);
      counts[c.rank] = (counts[c.rank] || 0) + 1;
    }
    if (cards.length === slots && (!best || score > best.score))
      best = {
        cards,
        kingId: king.id,
        kingRank: king.rank,
        counts,
        area,
        score,
      };
  }
  return best;
}
export function strategicDiscards(state, player, preferredKingRank = null) {
  const plan = chooseArmyPlan(state, player, preferredKingRank);
  if (!plan) return [];
  const keep = new Set(plan.cards.map((c) => c.id));
  return state.players[player].hand
    .filter((c) => !keep.has(c.id))
    .slice(0, 4)
    .map((c) => c.id);
}

/** 味方を敵の仮駒に置き換え、そのマスに実際に到達できる味方を数える。
 * 味方が射線を遮る場合・偶数/奇数射程・ナイト移動も実ルールで判定する。
 * 相手の非公開布陣は一切参照しない。 */
export function formationMetrics(plan, placement, size, player) {
  const board = Array.from({ length: size }, () => Array(size).fill(null));
  const pieces = plan.cards.map((c) => ({
    ...c,
    ...placement[c.id],
    owner: player,
    alive: true,
    isKing: c.id === plan.kingId,
  }));
  for (const p of pieces) board[p.row][p.col] = p;
  let covered = 0,
    links = 0,
    mutual = 0,
    kingGuards = 0,
    mobility = 0;
  const edges = new Set();
  for (const target of pieces) {
    board[target.row][target.col] = {
      id: "hypothetical-capturer",
      owner: 1 - player,
      row: target.row,
      col: target.col,
    };
    let guards = 0;
    for (const p of pieces) {
      if (p.id === target.id) continue;
      if (
        getLegalMoves(p, board, size, plan.counts, plan.kingRank).some(
          (m) => m.row === target.row && m.col === target.col,
        )
      ) {
        guards++;
        edges.add(`${p.id}/${target.id}`);
      }
    }
    board[target.row][target.col] = target;
    if (guards) covered++;
    links += Math.min(guards, 3);
    if (target.isKing) kingGuards = guards;
  }
  for (const a of pieces)
    for (const b of pieces)
      if (
        a.id < b.id &&
        edges.has(`${a.id}/${b.id}`) &&
        edges.has(`${b.id}/${a.id}`)
      )
        mutual++;
  for (const p of pieces)
    mobility += Math.min(
      10,
      getLegalMoves(p, board, size, plan.counts, plan.kingRank).length,
    );
  const king = pieces.find((p) => p.isKing),
    front = territoryRows(size, player)[player === 0 ? 0 : 1];
  // 王は「取られた後の取り返し」では守れないので後列と護衛を別評価する。
  const safety = Math.abs(king.row - front);
  const heirs = ["2", "3"].includes(plan.kingRank)
    ? pieces
        .filter((p) => p.rank === plan.kingRank && !p.isKing)
        .reduce((n, p) => n + Math.min(3, Math.abs(p.col - king.col)), 0)
    : 0;
  return {
    covered,
    links,
    mutual,
    kingGuards,
    mobility,
    score:
      covered * 8 +
      links * 1.5 +
      mutual * 2 +
      Math.min(kingGuards, 2) * 4 +
      mobility * 0.2 +
      safety * 3 +
      heirs * 0.5,
  };
}

export function arrangeArmy(state, player, plan) {
  const size = state.boardSize,
    [lo, hi] = territoryRows(size, player);
  const cells = [];
  for (let row = lo; row <= hi; row++)
    for (let col = 0; col < size; col++) cells.push({ row, col });
  const front = player === 0 ? lo : hi,
    back = player === 0 ? hi : lo,
    mid = Math.floor(size / 2);
  // まず中央の前衛・中衛・王の後衛から組み、実際の取り返し関係で改善する。
  const ordered = cells
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.col - mid) * 2 +
        Math.abs(a.row - front) -
        (Math.abs(b.col - mid) * 2 + Math.abs(b.row - front)),
    );
  const placement = {},
    used = new Set();
  placement[plan.kingId] = { row: back, col: mid };
  used.add(`${back}/${mid}`);
  for (const card of plan.cards)
    if (card.id !== plan.kingId) {
      const cell = ordered.find((c) => !used.has(`${c.row}/${c.col}`));
      placement[card.id] = cell;
      used.add(`${cell.row}/${cell.col}`);
    }
  let best = placement,
    score = formationMetrics(plan, best, size, player).score;
  // 決定的な局所探索。空きマスへの移動と駒同士の交換を両方試す。
  for (let pass = 0; pass < 2; pass++) {
    let improved = false;
    for (const card of plan.cards)
      for (const cell of cells) {
        const from = best[card.id];
        if (from.row === cell.row && from.col === cell.col) continue;
        const other = plan.cards.find(
          (c) => best[c.id].row === cell.row && best[c.id].col === cell.col,
        );
        const trial = { ...best, [card.id]: cell };
        if (other) trial[other.id] = from;
        const next = formationMetrics(plan, trial, size, player).score;
        if (next > score + 0.001) {
          best = trial;
          score = next;
          improved = true;
        }
      }
    if (!improved) break;
  }
  return best;
}
