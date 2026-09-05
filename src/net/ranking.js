/**
 * ランキング。
 *
 * 対局が終わるたびに、自分の持ち点を ranks/<id> に置き直す。
 * 一覧は持ち点の高い順に読み出す。
 *
 * いまの id は端末ごとの目印で、消して入れ直せば作り直せてしまう。
 * つまりこの順位は自己申告に近い。端末を替えても続く本人確認
 * (Sign in with Apple や Game Center)を入れるまでは、そのつもりで扱う。
 */
import { DB_URL } from "./firebase.js";
import { authedFetch } from "./auth.js";

const TIMEOUT_MS = 8000;
/** 一覧に出す人数 */
export const RANK_LIMIT = 50;

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

/** 自分の成績を載せる。失敗しても対局には影響しないので黙って諦める */
export async function publishRank(profile) {
  if (!profile || !profile.id || !profile.name) return { ok: false };
  try {
    await withTimeout(
      authedFetch(`${DB_URL}/ranks/${profile.id}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          icon: profile.icon || "",
          title: profile.title || "",
          rating: profile.rating,
          rated: profile.rated,
          wins: profile.wins,
          plays: profile.plays,
          at: Date.now(),
        }),
      }),
      TIMEOUT_MS,
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** 持ち点の高い順に読み出す */
export async function readRanks(limit = RANK_LIMIT) {
  const url = `${DB_URL}/ranks.json?orderBy=%22rating%22&limitToLast=${limit}`;
  try {
    const res = await withTimeout(authedFetch(url), TIMEOUT_MS);
    // 401 は ranks の読み書きを許すルールがまだ公開されていないとき
    if (res.status === 401)
      return {
        ok: false,
        list: [],
        error:
          "ランキングの置き場所がまだ開いていません。Firebase のルールに ranks を足して公開してください。",
      };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = Object.entries(data || {})
      .map(([id, row]) => ({ id, ...row }))
      .filter((r) => r && typeof r.rating === "number" && r.name)
      .sort((a, b) => b.rating - a.rating);
    return { ok: true, list, error: null };
  } catch (err) {
    return {
      ok: false,
      list: [],
      error:
        err && err.__timeout
          ? "通信が8秒以内に応答しませんでした。"
          : `ランキングを読めませんでした: ${(err && err.message) || "不明なエラー"}`,
    };
  }
}
