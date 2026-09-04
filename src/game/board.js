import { RANKS, SUITS, ORTH, DIAG, KNIGHT_OFFSETS } from "./constants.js";

/* ---------------------------- デッキ ---------------------------- */

/**
 * デッキを組む。ranks を渡すと、そのランクだけの小さなデッキになる。
 * チュートリアルでカードプールを絞るために使う。
 */
export function buildDeck(ranks) {
  const use =
    ranks && ranks.length ? RANKS.filter((r) => ranks.includes(r)) : RANKS;
  const deck = [];
  let n = 0;
  for (const suit of SUITS)
    for (const rank of use) deck.push({ id: `c${n++}`, rank, suit });
  return deck;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------------------- 盤面 ---------------------------- */

export function inBounds(row, col, size) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

export function emptyBoard(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
}

/** 盤面サイズごとの配置枚数 */
export function totalSlots(size) {
  return size === 5 ? 5 : 9;
}

/** 自陣の行範囲 [先頭行, 末尾行] */
export function territoryRows(size, player) {
  const rows = size === 5 ? 2 : 3;
  return player === 0 ? [size - rows, size - 1] : [0, rows - 1];
}

/** 盤上の座標をa1形式で表す */
export function squareName(row, col, size) {
  return `${String.fromCharCode(97 + col)}${size - row}`;
}

/* ---------------------------- Aの包囲判定 ---------------------------- */

/** 3点の外積。符号で回り方が分かる */
export function cross(o, a, b) {
  return (a.col - o.col) * (b.row - o.row) - (b.col - o.col) * (a.row - o.row);
}

/** 点pが三角形abcの内側(辺上を含む)にあるか。つぶれた三角形は常に false */
export function pointInTriangle(p, a, b, c) {
  if (cross(a, b, c) === 0) return false;
  const d1 = cross(p, a, b);
  const d2 = cross(p, b, c);
  const d3 = cross(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/* ---------------------------- 移動生成 ---------------------------- */

/**
 * 6〜9用。決まった偶奇のマスにだけ着地する。
 *
 * 進路は塞がれる。味方の駒に当たったらそこで止まり、越えられない。
 * 相手の駒に当たったら、着地できる偶奇なら取って止まる。
 *
 * multiCapture(=王のとき)だけは、相手の駒を取りながら進み続けられる。
 * 同じ線に並んだ相手を手前からまとめて取る手を返す。ただし味方には止められる。
 */
export function parityMoves(piece, dirs, board, size, parity, multiCapture) {
  const moves = [];
  for (const [dr, dc] of dirs) {
    let dist = 0;
    let row = piece.row;
    let col = piece.col;
    const chain = [];
    for (;;) {
      dist++;
      row += dr;
      col += dc;
      if (!inBounds(row, col, size)) break;
      const target = board[row][col];
      const okParity = parity === "even" ? dist % 2 === 0 : dist % 2 === 1;

      // 味方は越えられない
      if (target && target.owner === piece.owner) break;

      if (multiCapture) {
        if (target && okParity) {
          chain.push({ row, col });
          moves.push({ row, col, capture: true, captures: [...chain] });
        }
        continue;
      }

      if (target) {
        if (okParity) moves.push({ row, col, capture: true });
        break;
      }
      if (okParity) moves.push({ row, col, capture: false });
    }
  }
  return moves;
}

/**
 * 駒に進路を塞がれる、ふつうのスライド移動。
 * minDist〜maxDist の範囲だけを着地可能とし、parity を渡すと偶奇でも絞る。
 */
export function slideMoves(piece, dirs, board, size, minDist, maxDist, parity) {
  const moves = [];
  for (const [dr, dc] of dirs) {
    let dist = 0;
    let row = piece.row;
    let col = piece.col;
    for (;;) {
      dist++;
      row += dr;
      col += dc;
      if (!inBounds(row, col, size)) break;
      const target = board[row][col];
      const reachable =
        dist >= minDist &&
        dist <= maxDist &&
        (!parity || (parity === "even" ? dist % 2 === 0 : dist % 2 === 1));
      if (target) {
        if (target.owner !== piece.owner && reachable)
          moves.push({ row, col, capture: true });
        break;
      }
      if (reachable) moves.push({ row, col, capture: false });
      if (dist >= maxDist) break;
    }
  }
  return moves;
}

/** 10とKが使う桂馬跳び */
export function knightMoves(piece, board, size) {
  const moves = [];
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const row = piece.row + dr;
    const col = piece.col + dc;
    if (!inBounds(row, col, size)) continue;
    const target = board[row][col];
    if (target) {
      if (target.owner !== piece.owner) moves.push({ row, col, capture: true });
    } else {
      moves.push({ row, col, capture: false });
    }
  }
  return moves;
}

/** 採用1枚あたり何マス伸びるか */
export const KING_RANGE_PER_CARD = 2;

/**
 * その駒の移動距離が何マス伸びるか。伸び幅は「採用枚数 × 2マス」。
 *
 *   2・3 が王 … 王自身が伸びる。小回りの利く王が、そのぶん遠くまで動ける
 *   4・5 が王 … 王以外の同じ数字が伸びる。王は動かず、兄弟が前に出る
 *
 * 例) 2を4枚採用して王にすると、王の2は 1 + 2×4 = 9マス。
 *
 * 伸びるのは距離の決まっている2〜5だけ。6以降は「偶数マス」「何マスでも」と
 * 上限が無いので関わらない。
 */
export function rangeBonus(piece, armyRankCounts, kingRank) {
  const rank = piece.rank;
  const cards = (armyRankCounts && armyRankCounts[rank]) || 1;
  const grows =
    rank === "2" || rank === "3"
      ? piece.isKing
      : (rank === "4" || rank === "5") && !piece.isKing && kingRank === rank;
  return grows ? KING_RANGE_PER_CARD * cards : 0;
}

/** その軍の王の数字。まだ王が決まっていなければ null */
export function kingRankOf(state, owner) {
  const id = state?.players?.[owner]?.kingId;
  const king = id ? state.pieces?.[id] : null;
  return king ? king.rank : null;
}

/**
 * ある駒の合法手。
 * armyRankCounts は軍内のランク別の採用枚数、kingRank はその軍の王の数字。
 * 4・5 の王は自分ではなく同じ数字を伸ばすので、駒だけを見ても伸び幅が決まらない。
 */
export function getLegalMoves(piece, board, size, armyRankCounts, kingRank) {
  const bonus = rangeBonus(piece, armyRankCounts, kingRank);
  switch (piece.rank) {
    case "A":
      return [];
    case "2":
      return slideMoves(piece, ORTH, board, size, 1, 1 + bonus, null);
    case "3":
      return slideMoves(piece, DIAG, board, size, 1, 1 + bonus, null);
    case "4":
      return slideMoves(piece, ORTH, board, size, 1, 2 + bonus, null);
    case "5":
      return slideMoves(piece, DIAG, board, size, 1, 2 + bonus, null);
    case "6":
      return parityMoves(piece, ORTH, board, size, "even", piece.isKing);
    case "7":
      return parityMoves(piece, DIAG, board, size, "even", piece.isKing);
    case "8":
      return parityMoves(piece, ORTH, board, size, "odd", piece.isKing);
    case "9":
      return parityMoves(piece, DIAG, board, size, "odd", piece.isKing);
    case "10":
      return knightMoves(piece, board, size);
    case "J": {
      let moves = slideMoves(piece, ORTH, board, size, 1, size, null);
      if (piece.isKing)
        moves = moves.concat(slideMoves(piece, DIAG, board, size, 1, 1, null));
      return moves;
    }
    case "Q": {
      let moves = slideMoves(piece, DIAG, board, size, 1, size, null);
      if (piece.isKing)
        moves = moves.concat(slideMoves(piece, ORTH, board, size, 1, 1, null));
      return moves;
    }
    case "K":
      return slideMoves(piece, ORTH, board, size, 1, size, null)
        .concat(slideMoves(piece, DIAG, board, size, 1, size, null))
        .concat(knightMoves(piece, board, size));
    default:
      return [];
  }
}

/* ---------------------------- 採用枚数 ---------------------------- */

/** そのランクを最大何枚まで軍に入れられるか */
export function maxAdopt(rank, kingRank) {
  if (rank === "K") return kingRank === "K" ? 1 : 0;
  if (rank === "J" || rank === "Q") return kingRank === "K" ? 1 : 2;
  return 4;
}

/** 配置済みカードのランク別枚数 */
export function placedRankCounts(placement, hand) {
  const counts = {};
  Object.keys(placement).forEach((cardId) => {
    const card = hand.find((c) => c.id === cardId);
    if (card) counts[card.rank] = (counts[card.rank] || 0) + 1;
  });
  return counts;
}

/** 相手の駒の履歴は、移動以外を伏せて見せる */
export function sanitizeHistory(piece, viewer, revealAll) {
  if (piece.owner === viewer || !piece.alive || revealAll) return piece.history;
  return piece.history.map((h) =>
    h.includes("へ移動") ? h : "何らかの効果が発生した",
  );
}

/** プレイヤーの初期状態 */
export function makePlayer(idx) {
  return {
    idx,
    hand: [],
    discard: [],
    capturedOwn: [],
    armyRankCounts: {},
    kingId: null,
    ready: false,
  };
}
