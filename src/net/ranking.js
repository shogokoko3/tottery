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

// 互換用の入口も同じ保存処理を使う。ランキングだけを更新しない。
export { publishProfile as publishRank } from "./profile-sync.js";
import { isRankedRecord, worldGamesOf } from "./profile-record.js";

/**
 * 全体の総対局数。持ち点の「全体分」に使う。
 *
 * ランキングの行にある rated(持ち点つき対局数)を全部足す。
 * 数えるのは9×9のオンライン対戦だけなので、この合計がそのまま
 * 「みんなが遊んだ数」になる。
 *
 * 読めなかったら0を返す(全体分が乗らないだけで、対局は進む)。
 * ※遊ぶ人が増えたら、全件を読むのはやめて合計を別に持たせること
 */
export async function readWorldGames() {
  try {
    const res = await withTimeout(
      authedFetch(`${DB_URL}/ranks.json`),
      TIMEOUT_MS,
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return worldGamesOf(Object.values(data || {}));
  } catch {
    return 0;
  }
}

/** 持ち点の高い順に読み出す */
export async function readRanks(limit = RANK_LIMIT) {
  const url = `${DB_URL}/ranks.json`;
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
      .filter(isRankedRecord)
      .sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id))
      .slice(0, limit);
    return {
      ok: true,
      list,
      world: worldGamesOf(Object.values(data || {})),
      error: null,
    };
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
