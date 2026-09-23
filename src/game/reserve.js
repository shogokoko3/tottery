/** 版9以降の捨て札循環。撃破履歴(capturedOwn)と、再利用できる札を分ける。 */
export const recyclesReserve = (state) => state.ruleVersion >= 9;

// 既に通信へ載せている初期山札の乱数から、補充専用の乱数状態を決める。
// 同じ開始山札・手順なら端末とサーバーで必ず同じシャッフルになる。
export function reserveSeed(deck) {
  let seed = 2166136261;
  for (const c of deck)
    for (const char of `${c.id}:${c.rank}:${c.suit};`)
      seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return seed || 1;
}

/**
 * 決定的な並べ替え(xorshift32)。同じ札と同じ seed なら、端末とサーバーで必ず同じ並びになる。
 * 補充(replenishReserve)と、版18の引き直しの並び(両者が同時に引くので、乱数を手に載せられない)で使う
 */
export function seededShuffle(list, seed) {
  const cards = [...list];
  let s = (seed >>> 0) || 1;
  for (let i = cards.length - 1; i > 0; i--) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    const j = Math.floor((s / 4294967296) * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, seed: s };
}

export function discardCards(state, cards) {
  if (!recyclesReserve(state) || !cards.length) return state;
  const pool = new Map((state.discardPile || []).map((c) => [c.id, c]));
  for (const c of cards)
    pool.set(c.id, { id: c.id, rank: c.originalRank || c.rank, suit: c.suit });
  return { ...state, discardPile: [...pool.values()] };
}

export function replenishReserve(state) {
  if (
    !recyclesReserve(state) ||
    state.reserve.length ||
    !state.discardPile?.length ||
    state.winner != null
  )
    return state;
  const { cards, seed } = seededShuffle(
    state.discardPile,
    state.reserveShuffleState || reserveSeed(state.discardPile),
  );
  const ids = new Set(cards.map((c) => c.id));
  return {
    ...state,
    reserve: cards,
    discardPile: [],
    reserveShuffleState: seed,
    reserveRefills: (state.reserveRefills || 0) + 1,
    // 引き直しの捨て札欄からは消す。撃破の履歴は褒賞・対局記録のため残す。
    players: state.players.map((p) => ({
      ...p,
      discard: (p.discard || []).filter((c) => !ids.has(c.id)),
    })),
    log: [
      ...state.log,
      `予備札がなくなったため、捨て札${cards.length}枚をシャッフルして補充した`,
    ],
  };
}
