import { ensureAuth, OPERATOR_UID } from "../net/auth.js";

export async function readAdminSeason() {
  const auth = await ensureAuth();
  if (!auth) throw new Error("もう一度サインインしてください。");
  const res = await fetch("/api/admin/season", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`,
    },
    body: "{}",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok)
    throw new Error("月間成績を読み込めませんでした。更新してください。");
  return res.json();
}

/** 保存されているUIDだけで入場せず、認証済みトークンをサーバーで照合する。 */
export async function verifyOperatorSession() {
  const auth = await ensureAuth();
  if (!auth) return null;
  if (auth.uid !== OPERATOR_UID)
    throw new Error("このアカウントには運営権限がありません。");
  const res = await fetch("/api/admin/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`,
    },
    body: "{}",
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 401) throw new Error("もう一度サインインしてください。");
  if (res.status === 403)
    throw new Error("このアカウントには運営権限がありません。");
  if (!res.ok)
    throw new Error(
      "運営権限を確認できませんでした。通信を確認して再度お試しください。",
    );
  const session = await res.json();
  if (session.uid !== OPERATOR_UID)
    throw new Error("運営権限を確認できませんでした。");
  return session.uid;
}

/** 運営の口を叩く共通処理。認証トークンを付けて POST し、JSON を返す */
async function adminPost(path, body = {}) {
  const auth = await ensureAuth();
  if (!auth) throw new Error("もう一度サインインしてください。");
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "処理できませんでした。");
  return data;
}

/** 手動付与(チケット・無償ジェム)。id で冪等。相手の uid を渡す */
export async function grantResources(uid, { tickets = 0, gemsFree = 0 }) {
  const id = `grant:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return adminPost("/api/admin/grant", { uid, tickets, gemsFree, id });
}
/** 購入履歴。uid を渡せばその人、空なら全体 */
export async function readPurchases(uid) {
  return adminPost("/api/admin/purchases", uid ? { uid } : {});
}
/** ガチャ履歴。uid を渡せばその人、空なら全体 */
export async function readGacha(uid) {
  return adminPost("/api/admin/gacha", uid ? { uid } : {});
}
