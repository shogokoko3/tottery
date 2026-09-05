import {
  SKINS,
  ALL_SKINS,
  FOIL_CHANCE,
  byId,
  draw,
  foilId,
  sanitizeLoadout,
} from "./catalog.js";
import { craftCheck, dismantleCheck } from "./ether.js";

const count = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
export function normalize(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const owned = {};
  for (const skin of ALL_SKINS) {
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
    // エーテル。ダブりを崩すと増え、狙った1枚を作ると減る
    ether: count(value.ether),
    owned,
    equipped,
    draws: count(value.draws),
    earlyClaimed: value.earlyClaimed === true,
    motion: ["full", "short", "off"].includes(value.motion)
      ? value.motion
      : "full",
    pending: results.length ? { results } : null,
    lastCraft:
      byId(value.lastCraft?.id) && owned[value.lastCraft.id]
        ? { id: value.lastCraft.id, isNew: value.lastCraft.isNew === true }
        : null,
  };
}

// 所持数や過去の当落に依存しない、キャラ決定後の独立した1%判定。
function finishedId(baseId, random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1)
    throw new Error("乱数の範囲が不正です");
  return n < FOIL_CHANCE ? foilId(baseId) : baseId;
}

// 現在はテスト用の無料ガチャ。チケット数、購入、対局報酬には依存しない。
// 抽選と所持への追加を一度に確定し、演出の中断や再読み込みで失わない。
export function pull(state, amount, random = Math.random) {
  if (amount !== 1 && amount !== 10)
    throw new Error("1回または10回を選んでください");
  if (state.pending || state.lastCraft)
    throw new Error("先にガチャ・錬成の結果を確認してください");
  const owned = { ...state.owned };
  const results = Array.from({ length: amount }, () => {
    const id = finishedId(draw(random).id, random);
    const isNew = !owned[id];
    owned[id] = (owned[id] || 0) + 1;
    return { id, isNew };
  });
  return { ...state, owned, draws: state.draws + amount, pending: { results } };
}

/** チケットを足す */
export function addTickets(state, n) {
  const add = Number.isSafeInteger(n) && n > 0 ? n : 0;
  return add ? { ...state, tickets: state.tickets + add } : state;
}

/** チケットを使う。足りなければ何もしない */
/** エーテルを足す。運営からの手紙やミッションの褒美から呼ぶ */
export function addEther(state, n) {
  const add = count(n);
  return add ? { ...state, ether: count(state.ether) + add } : state;
}

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
/**
 * ダブりを1枚崩して、エーテルに変える。
 * 最後の1枚と早期特典の札は崩さない(ether.js の決まり)。
 */
export function dismantle(state, id) {
  const check = dismantleCheck(state, id);
  if (!check.ok) throw new Error(check.why);
  const owned = { ...state.owned, [id]: state.owned[id] - 1 };
  return { ...state, owned, ether: count(state.ether) + check.gain };
}

/** 通常版のダブりをまとめて崩す。フォイルは個別に選んだ場合だけ。 */
export function dismantleAll(state) {
  let next = state;
  for (const skin of SKINS) {
    // 1枚ずつ減らす。途中で崩せなくなったら、その札はそこで止める
    while (dismantleCheck(next, skin.id).ok) next = dismantle(next, skin.id);
  }
  return next;
}

/** エーテルを払って、好きな1枚を作る。すでに持っている札なら枚数が増える */
export function craft(state, id, random = Math.random) {
  if (state.pending || state.lastCraft)
    throw new Error("先にガチャ・錬成の結果を確認してください");
  const check = craftCheck(state, id);
  if (!check.ok) throw new Error(check.why);
  const resultId = finishedId(id, random);
  const isNew = !state.owned[resultId];
  const owned = {
    ...state.owned,
    [resultId]: (state.owned[resultId] || 0) + 1,
  };
  return {
    ...state,
    owned,
    ether: count(state.ether) - check.cost,
    lastCraft: { id: resultId, isNew },
  };
}

export function claimEarly(state) {
  if (state.earlyClaimed) return state;
  const owned = { ...state.owned };
  for (const skin of SKINS.filter((s) => s.rarity === "LIMITED"))
    owned[skin.id] = (owned[skin.id] || 0) + 1;
  return { ...state, owned, earlyClaimed: true };
}

export function claimSpecial(state, id) {
  if (byId(id)?.rarity !== "SPECIAL")
    throw new Error("特別スキンを選んでください");
  if (state.owned[id]) return state;
  return { ...state, owned: { ...state.owned, [id]: 1 } };
}
