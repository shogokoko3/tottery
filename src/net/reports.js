/**
 * 通報。
 *
 * App Store のガイドライン 1.2 は、利用者が作った文章を他人に見せるアプリに
 * 「不快なものを通報する手段と、それに応える体制」を求めている。
 *
 * 送り先は reports/<自動id>。読めるのは運営(OPERATOR_UID)だけ。
 * ルール(firebase-rules.json)が受け付けるのは
 * targetId / targetName / reason / reporterId / at の5欄だけで、
 * reporterId は Firebase の uid と一致していなければならず、
 * at はサーバーの時刻から±60秒以内。handled は運営しか書けない。
 *
 * 送信に失敗しても、画面には「受け付けた」と出さない。
 * 届いていないのに届いたことにするのは、通報の仕組みとして意味がない。
 */
import { DB_URL } from "./firebase.js";
import { authedFetch, myUid } from "./auth.js";

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
 * me:     {id, name} 通報する人。uid がまだ無いときの控えにだけ使う
 */
export async function sendReport(target, reason, me) {
  if (!target || !target.id) return { ok: false, error: "相手が分かりません" };
  try {
    const res = await withTimeout(
      authedFetch(`${DB_URL}/reports.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: String(target.id).slice(0, 64),
          targetName: [...String(target.name || "")].slice(0, 40).join(""),
          reason: String(reason || "other").slice(0, 20),
          // 誰からの通報か。名乗りではなく Firebase の uid(ルールが照合する)。
          // 名前は運営が players/<uid> から引けるので送らない
          reporterId: myUid() || (me && me.id) || null,
          at: Date.now(),
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
