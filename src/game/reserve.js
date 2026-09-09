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
  const cards = [...state.discardPile];
  let seed = state.reserveShuffleState || reserveSeed(cards);
  for (let i = cards.length - 1; i > 0; i--) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    const j = Math.floor((seed / 4294967296) * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
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
