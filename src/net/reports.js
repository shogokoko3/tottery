/**
 * 通報。
 *
 * App Store のガイドライン 1.2 は、利用者が作った文章を他人に見せるアプリに
 * 「不快なものを通報する手段と、それに応える体制」を求めている。
 *
 * 送り先は reports/<自動id>。読めるのは運営だけ(firebase-rules.json で
 * ".read": false にしてある)。管理画面 /admin から一覧して、
 * 問題があれば ranks/<id> を消す。
 *
 * 送信に失敗しても、画面には「受け付けた」と出さない。
 * 届いていないのに届いたことにするのは、通報の仕組みとして意味がない。
 */
import { DB_URL } from "./firebase.js";

const TIMEOUT_MS = 8000;

/** 通報の理由。画面に出す順で並べる */
export const REASONS = [
  { id: "name", label: "名前が不快・不適切" },
  { id: "impersonation", label: "運営や他人になりすましている" },
  { id: "cheating", label: "不正な遊び方をしている" },
  { id: "other", label: "その他" },
];

export function reasonLabel(id) {
  const r = REASONS.find((x) => x.id === id);
  return r ? r.label : id;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_r, reject) =>
      setTimeout(() => {
        const err = new Error("timeout");
        err.__timeout = true;
        reject(err);
      }, ms),
    ),
  ]);
}

/**
 * 通報を送る。
 *
 * target: {id, name} 通報される相手
 * reason: REASONS の id
 * me:     {id, name} 通報する人。誰からの通報かを運営が追えるようにする
 */
export async function sendReport(target, reason, me) {
  if (!target || !target.id) return { ok: false, error: "相手が分かりません" };
  try {
    const res = await withTimeout(
      fetch(`${DB_URL}/reports.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: target.id,
          targetName: String(target.name || "").slice(0, 40),
          reason: String(reason || "other").slice(0, 20),
          reporterId: (me && me.id) || null,
          reporterName: String((me && me.name) || "").slice(0, 40),
          at: Date.now(),
          handled: false,
        }),
      }),
      TIMEOUT_MS,
    );
    // 401 は reports を許すルールがまだ公開されていないとき
    if (res.status === 401)
      return {
        ok: false,
        error:
          "通報の置き場所がまだ開いていません。Firebase のルールに reports を足して公開してください。",
      };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error:
        err && err.__timeout
          ? "通信が8秒以内に応答しませんでした。もう一度お試しください。"
          : `通報を送れませんでした: ${(err && err.message) || "不明なエラー"}`,
    };
  }
}
