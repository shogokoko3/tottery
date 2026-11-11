/**
 * 褒美・贈り物の配り口。
 *
 * ミッションの報酬と、運営からの手紙の添付は同じ形にしてある。
 *   { type: "ticket" | "ether" | "xp", amount }
 *   { type: "title" | "icon" | "skin", id }
 * 配る先が2か所(アカウントとスキンの持ち物)に分かれているので、ここでまとめる。
 */
import { addXp, grantIcon, grantTitle } from "./profile.js";
import { findIcon } from "./icons.js";
import { findTitle } from "./titles.js";
import { byId as skinById } from "../skins/catalog.js";
import {
  addEther,
  addTickets,
  grantSkin,
  addFreeGems,
} from "../skins/collection.js";
import { ETHER_NAME } from "../skins/ether.js";
import { updateCollection } from "../skins/store.js";
import { L, Lx, fmtNumber } from "../i18n/index.js";

/** 画面に出す呼び名。知らない id でも壊れない */
export function giftLabel(gift) {
  if (!gift) return "—";
  if (gift.type === "ticket") return L("ガチャチケット ×{n}", { n: gift.amount });
  if (gift.type === "gems") return L("ジェム ×{n}", { n: gift.amount });
  if (gift.type === "ether")
    return `${Lx(ETHER_NAME)} ${fmtNumber(gift.amount)}`;
  if (gift.type === "xp") return L("経験値 {n}", { n: gift.amount });
  if (gift.type === "title")
    return L("称号「{name}」", { name: Lx((findTitle(gift.id) || {}).name || gift.id) });
  if (gift.type === "icon") return L("アイコン「{name}」", { name: Lx(findIcon(gift.id).label) });
  if (gift.type === "skin")
    return L("スキン「{name}」", { name: Lx((skinById(gift.id) || {}).name || gift.id) });
  return "—";
}

/** まとめて読み上げる文 */
export const giftsLabel = (gifts) =>
  (gifts || []).map(giftLabel).join(L("、")) || L("（添付なし）");

/** 1つ配る。控えるのは呼んだ側の仕事 */
export async function giveGift(gift) {
  if (!gift) return;
  if (gift.type === "title") grantTitle(gift.id);
  if (gift.type === "icon") grantIcon(gift.id);
  if (gift.type === "xp") addXp(gift.amount);
  if (gift.type === "skin")
    await updateCollection((s) => grantSkin(s, gift.id));
  if (gift.type === "ticket")
    await updateCollection((s) => addTickets(s, gift.amount));
  if (gift.type === "gems")
    await updateCollection((s) => addFreeGems(s, gift.amount));
  if (gift.type === "ether")
    await updateCollection((s) => addEther(s, gift.amount));
}

/** 並びをまとめて配る */
export async function giveGifts(gifts) {
  for (const g of gifts || []) await giveGift(g);
}
