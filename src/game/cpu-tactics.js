import { getLegalMoves, kingRankOf } from "./board.js";
import { isKnownTo, isFrozen } from "./areas.js";
import { CARD_VALUE } from "./cpu-strategy.js";

// 見えている敵のみで脅威を計算する。敵軍の非公開採用枚数は使わない。
export function knownThreats(s, player, board = s.board, removed = new Set()) {
  const enemies = Object.values(s.pieces).filter(
    (p) =>
      p.alive &&
      p.owner !== player &&
      !removed.has(p.id) &&
      isKnownTo(s, player, p) &&
      !isFrozen(s, p),
  );
  const kingRank = enemies.find((p) => p.isKing)?.rank;
  const counts = {};
  for (const p of enemies) counts[p.rank] = (counts[p.rank] || 0) + 1;
  const cells = new Set();
  for (const p of enemies)
    for (const m of getLegalMoves(p, board, s.boardSize, counts, kingRank)) {
      cells.add(`${m.row}/${m.col}`);
      for (const c of m.captures || []) cells.add(`${c.row}/${c.col}`);
    }
  return cells;
}
/**
 * 正体の分からない敵が、どのマスをどれくらいの見込みで取れるか。
 * 各駒について「2〜K のどのランクでもありうる」として実際の移動規則で到達マスを数え、
 * 到達できるランクの割合をそのマスの見込みにする(駒ごとに足し、1 を上限)。
 * 伏せ札の数字・王かどうかは読まない。採用枚数の伸びも読めないので 0 とする。
 * 手番の初めに 1 回だけ作り、その手番の全候補手で使う(動かす駒による遮りの変化は無視)。
 */
const UNKNOWN_RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
export function unknownThreatMap(s, player) {
  const map = new Map();
  const unknown = Object.values(s.pieces).filter(
    (p) =>
      p.alive &&
      p.owner !== player &&
      !isKnownTo(s, player, p) &&
      !isFrozen(s, p),
  );
  for (const p of unknown) {
    const hits = new Map();
    for (const rank of UNKNOWN_RANKS)
      for (const m of getLegalMoves(
        { ...p, rank, isKing: false },
        s.board,
        s.boardSize,
        {},
        undefined,
      )) {
        const cells = [`${m.row}/${m.col}`].concat(
          (m.captures || []).map((c) => `${c.row}/${c.col}`),
        );
        for (const key of new Set(cells))
          hits.set(key, (hits.get(key) || 0) + 1);
      }
    for (const [key, n] of hits)
      map.set(key, Math.min(1, (map.get(key) || 0) + n / UNKNOWN_RANKS.length));
  }
  return map;
}
export function moveSafety(s, player, p, move, capturedIds, options = {}) {
  const board = s.board.map((r) => r.slice());
  board[p.row][p.col] = null;
  for (const id of capturedIds) {
    const c = s.pieces[id];
    if (c) board[c.row][c.col] = null;
  }
  const moved = { ...p, row: move.row, col: move.col };
  board[move.row][move.col] = moved;
  const threats = knownThreats(s, player, board, capturedIds);
  const king = Object.values(s.pieces).find(
    (c) => c.alive && c.owner === player && c.isKing,
  );
  const kingAt = p.isKing ? moved : king;
  let score = kingAt && threats.has(`${kingAt.row}/${kingAt.col}`) ? -65 : 0;
  if (threats.has(`${move.row}/${move.col}`)) score -= CARD_VALUE[p.rank] * 1.3;
  // 正体の分からない敵の見込み(options.unknownThreats)。正体が分かれば上の確実な判定に移る。
  const unknownWeight = options.unknownWeight || 0;
  if (unknownWeight && options.unknownThreats) {
    const risk = (cell) => options.unknownThreats.get(cell) || 0;
    if (kingAt && !threats.has(`${kingAt.row}/${kingAt.col}`))
      score -= 65 * unknownWeight * risk(`${kingAt.row}/${kingAt.col}`);
    if (!threats.has(`${move.row}/${move.col}`))
      score -=
        CARD_VALUE[p.rank] *
        1.3 *
        unknownWeight *
        risk(`${move.row}/${move.col}`);
  }
  // 前進後も取り返せる味方を残す。仮の敵以外の盤面はそのまま。
  board[move.row][move.col] = { id: "recapture", owner: 1 - player };
  const guarded = Object.values(s.pieces).some(
    (c) =>
      c.alive &&
      c.owner === player &&
      c.id !== p.id &&
      !isFrozen(s, c) &&
      getLegalMoves(
        c,
        board,
        s.boardSize,
        s.players[player].armyRankCounts,
        kingRankOf(s, player),
      ).some((m) => m.row === move.row && m.col === move.col),
  );
  if (guarded) score += 1.8;
  if (
    s.areas?.[player]?.type === "ice" &&
    [...capturedIds].some((id) => isFrozen(s, s.pieces[id]))
  )
    score += 3;
  if (
    ["2", "3"].includes(kingRankOf(s, player)) &&
    !p.isKing &&
    p.rank === kingRankOf(s, player) &&
    threats.has(`${move.row}/${move.col}`)
  )
    score -= 5;
  return score;
}
export function transformationGain(s, player, id, rank) {
  const p = s.pieces[id],
    counts = s.players[player].armyRankCounts,
    king = kingRankOf(s, player);
  const mobility = (q) => {
    const moves = getLegalMoves(q, s.board, s.boardSize, counts, king);
    return (
      Math.min(16, moves.length) * 0.15 +
      moves.filter((m) => s.board[m.row][m.col]?.owner === 1 - player).length *
        3
    );
  };
  return (
    CARD_VALUE[rank] -
    CARD_VALUE[p.rank] +
    mobility({ ...p, rank }) -
    mobility(p)
  );
}
