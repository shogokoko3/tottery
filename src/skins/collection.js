import { SKINS, byId, draw, sanitizeLoadout } from "./catalog.js";

const count = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
export function normalize(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const owned = {};
  for (const skin of SKINS) {
    // 旧プレビューの所持リストも引き継ぐ。
    const n = Array.isArray(value.owned)
      ? Number(value.owned.includes(skin.id))
      : count(value.owned?.[skin.id]);
    if (n) owned[skin.id] = n;
  }
  const equipped = Object.fromEntries(
    Object.entries(sanitizeLoadout(value.equipped)).filter(
      ([, id]) => owned[id],
    ),
  );
  const results = Array.isArray(value.pending?.results)
    ? value.pending.results
        .slice(0, 10)
        .filter((r) => byId(r?.id) && owned[r.id])
        .map((r) => ({ id: r.id, isNew: r.isNew === true }))
    : [];
  return {
    version: 1,
    // ガチャチケット。ミッションの褒美で増える。
    // いまのガチャは無料のテスト版なので、まだ減らない
    tickets: count(value.tickets),
    owned,
    equipped,
    draws: count(value.draws),
    earlyClaimed: value.earlyClaimed === true,
    motion: ["full", "short", "off"].includes(value.motion)
      ? value.motion
      : "full",
    pending: results.length ? { results } : null,
  };
}

// 現在はテスト用の無料ガチャ。チケット数、購入、対局報酬には依存しない。
// 抽選と所持への追加を一度に確定し、演出の中断や再読み込みで失わない。
export function pull(state, amount, random = Math.random) {
  if (amount !== 1 && amount !== 10)
    throw new Error("1回または10回を選んでください");
  if (state.pending) throw new Error("先にガチャの結果を確認してください");
  const owned = { ...state.owned };
  const results = Array.from({ length: amount }, () => {
    const skin = draw(random);
    const isNew = !owned[skin.id];
    owned[skin.id] = (owned[skin.id] || 0) + 1;
    return { id: skin.id, isNew };
  });
  return { ...state, owned, draws: state.draws + amount, pending: { results } };
}

/** チケットを足す */
export function addTickets(state, n) {
  const add = Number.isSafeInteger(n) && n > 0 ? n : 0;
  return add ? { ...state, tickets: state.tickets + add } : state;
}

/** チケットを使う。足りなければ何もしない */
export function spendTickets(state, n) {
  const cost = Number.isSafeInteger(n) && n > 0 ? n : 0;
  if (!cost || state.tickets < cost) return state;
  return { ...state, tickets: state.tickets - cost };
}

/** ガチャを通さずにスキンを配る。ミッションの褒美から呼ぶ */
export function grantSkin(state, id) {
  if (!byId(id)) return state;
  return {
    ...state,
    owned: { ...state.owned, [id]: (state.owned[id] || 0) + 1 },
  };
}

export function equip(state, id) {
  const skin = byId(id);
  if (!skin || !state.owned[id])
    throw new Error("このスキンはまだ所持していません");
  return { ...state, equipped: { ...state.equipped, [skin.rank]: id } };
}
export function unequip(state, rank) {
  const equipped = { ...state.equipped };
  delete equipped[rank];
  return { ...state, equipped };
}
export function claimEarly(state) {
  if (state.earlyClaimed) return state;
  const owned = { ...state.owned };
  for (const skin of SKINS.filter((s) => s.rarity === "LIMITED"))
    owned[skin.id] = (owned[skin.id] || 0) + 1;
  return { ...state, owned, earlyClaimed: true };
}
