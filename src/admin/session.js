import { ensureAuth, OPERATOR_UID } from "../net/auth.js";

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
