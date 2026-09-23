/**
 * フレンドとプロフィール(端末側)。Worker の /api/friends/<op> を叩く(2026-09-23 本人の指示)。
 *
 * 正はサーバー(src/server/friends.js)。端末は一覧の写しを持たず、画面を開くたびに読む。
 * 通信の口は season.js・wallet.js と同じ(Firebase の本人確認つき)。
 */
import { ensureAuth } from "./auth.js";
import { seasonApiBase } from "./season.js";
import { updateCollection } from "../skins/store.js";

async function friendsRequest(op, body = {}) {
  const auth = await ensureAuth();
  if (!auth) throw new Error("通信を確認して、もう一度お試しください。");
  let res;
  try {
    res = await fetch(`${seasonApiBase()}/api/friends/${op}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.idToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("通信を確認して、もう一度お試しください。");
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("フレンドを読み込めませんでした。");
  }
  if (!res.ok) throw new Error(data.error || "フレンドを読み込めませんでした。");
  return data;
}

/** フレンド画面に要るものを一度に(自分の ID・一覧・申請・贈り物・招待) */
export const readFriends = () => friendsRequest("state");
/** フレンド ID で申請する。互いに申請していればその場でフレンドになる({friend:true}) */
export const requestFriend = (code) => friendsRequest("request", { code: String(code || "").trim() });
/** 対戦した相手(source "match")・ランキングの人(source "rank")へ uid で申請する。相手が受け付けていなければ「いっぱい」の文で断られる */
export const requestFriendByUid = (uid, source) => friendsRequest("request", { uid, source });
export const acceptFriend = (uid) => friendsRequest("accept", { uid });
export const declineFriend = (uid) => friendsRequest("decline", { uid });
export const cancelFriendRequest = (uid) => friendsRequest("cancel", { uid });
export const removeFriend = (uid) => friendsRequest("remove", { uid });
/** 1日1回、フレンド1人にガチャチケットを1枚 */
export const giftFriend = (uid) => friendsRequest("gift", { uid });
/** 届いている贈り物を全部受け取る。サーバーが財布に足すので、残高の写しをここで直す */
export async function claimFriendGifts() {
  const data = await friendsRequest("claim");
  const w = data.wallet;
  if (w && Number.isSafeInteger(w.tickets))
    await updateCollection((s) => ({
      ...s,
      tickets: w.tickets,
      gems: Number.isSafeInteger(w.gems) ? w.gems : s.gems || 0,
      gemsPaid: Number.isSafeInteger(w.gemsPaid) ? w.gemsPaid : s.gemsPaid || 0,
      gemsFree: Number.isSafeInteger(w.gemsFree) ? w.gemsFree : s.gemsFree || 0,
    }));
  return data.claimed || [];
}
/** フレンド対戦の合言葉(部屋の code)を相手に届ける。3分で古くなる */
export const inviteFriend = (uid, code) => friendsRequest("invite", { uid, code });
export const cancelFriendInvite = (uid) => friendsRequest("cancel-invite", { uid });
/** 自分のプロフィールの写しをサーバーへ(フレンドが見る) */
export const publishProfileCard = (card) => friendsRequest("profile-set", { card });
/** フレンド(か自分)のプロフィール。持ち点・順位はサーバーの台帳から */
export const readFriendProfile = (uid) => friendsRequest("profile-get", { uid });
