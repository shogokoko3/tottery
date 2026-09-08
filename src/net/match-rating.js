import { authedFetch, myUid } from "./auth.js";
import { DB_URL } from "./firebase.js";
import { normalizeRating, START_RATING } from "../game/rating.js";

/** 部屋の自己申告値ではなく、対戦前の公開記録を読む。再戦は別の組として読む。 */
export async function readMatchRatings(
  network,
  round,
  { fetcher = authedFetch, uid = myUid() } = {},
) {
  const ids =
    network.myPlayerIndex === 0 ? [uid, network.foeUid] : [network.foeUid, uid];
  if (!ids.every((id) => typeof id === "string" && /^[\w-]{1,128}$/.test(id)))
    throw new Error("対戦相手のレートを確認できませんでした。");
  const key = JSON.stringify([network.code, network.createdAt, round, ids]);
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("tottery.match-ratings.v2"),
    );
    if (
      saved?.key === key &&
      saved.ratings?.length === 2 &&
      saved.ratings.every(Number.isFinite)
    )
      return saved.ratings.map(normalizeRating);
  } catch {
    /* 保存できない環境でも通信から読む。 */
  }
  const ratings = await Promise.all(
    ids.map(async (id) => {
      const res = await fetcher(`${DB_URL}/ranks/${id}.json`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok)
        throw new Error("レートを確認できませんでした。再接続しています…");
      const record = await res.json();
      return normalizeRating(record?.rating ?? START_RATING);
    }),
  );
  try {
    sessionStorage.setItem(
      "tottery.match-ratings.v2",
      JSON.stringify({ key, ratings }),
    );
  } catch {
    /* 通信で取得済み。 */
  }
  return ratings;
}
