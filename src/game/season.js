import { displayRating, rankTitle, RANK_TIERS } from "./rating.js";
import { L } from "../i18n/index.js";

/**
 * レート戦(9×9 のランダムマッチ)のシーズンの表(2026-11-11 本人の指示)。
 * それまでは毎月1日 5:00 区切りの月間シーズンだった(id は "2026-09" の形。古い記録と称号はその形のまま読む)。
 *   シーズン1 … 2026-11-16 09:00 〜 12-31 23:59(日本時間)
 *   シーズン2 … 2027-01-01 09:00 〜 02-28 23:59
 * end は「その時刻から外」(12/31 23:59 まで = 1/1 0:00 で閉じる)。
 * どのシーズンにも入らない時間はレート戦を閉じる(ランダムマッチの入口を閉じ、台帳も記録しない)。
 * 次のシーズンを足すときは、ここに1行足す。id は S と番号
 */
export const RATED_SEASONS = Object.freeze([
  Object.freeze({
    id: "S1",
    start: Date.parse("2026-11-16T09:00:00+09:00"),
    end: Date.parse("2027-01-01T00:00:00+09:00"),
  }),
  Object.freeze({
    id: "S2",
    start: Date.parse("2027-01-01T09:00:00+09:00"),
    end: Date.parse("2027-03-01T00:00:00+09:00"),
  }),
]);
const pick = ({ id, start, end }) => ({ id, start, end });
/** いま開いているシーズン。シーズンの外なら null。時刻は必ずサーバー時計で決める */
export function seasonAt(now = Date.now(), schedule = RATED_SEASONS) {
  const s = schedule.find((x) => x.start <= now && now < x.end);
  return s ? pick(s) : null;
}
/** これから始まるいちばん近いシーズン。無ければ null */
export function nextSeason(now = Date.now(), schedule = RATED_SEASONS) {
  const s = schedule.find((x) => x.start > now);
  return s ? pick(s) : null;
}
/** 終わったいちばん新しいシーズン。無ければ null */
export function lastSeason(now = Date.now(), schedule = RATED_SEASONS) {
  const s = schedule.filter((x) => x.end <= now).at(-1);
  return s ? pick(s) : null;
}
/** 画面に出すシーズン。開いていればそれ、外なら終わったばかりのもの、まだ1つも始まっていなければ最初のもの */
export function shownSeason(now = Date.now(), schedule = RATED_SEASONS) {
  return (
    seasonAt(now, schedule) ||
    lastSeason(now, schedule) ||
    nextSeason(now, schedule) ||
    pick(schedule[0])
  );
}
const MONTHLY = /^20\d{2}-(0[1-9]|1[0-2])$/;
const NUMBERED = /^S[1-9]\d{0,2}$/;
export const validSeason = (id) =>
  typeof id === "string" && (MONTHLY.test(id) || NUMBERED.test(id));
/** 報酬の id(<シーズン>:<種類>)からシーズンを読む */
export const seasonOfRewardId = (id) =>
  typeof id === "string" && id.includes(":") ? id.slice(0, id.indexOf(":")) : "";
// 名前は画面に出すだけ(保存も比べもしない)。端末の言語で作る
export const seasonName = (id) =>
  NUMBERED.test(id)
    ? L("シーズン{n}", { n: id.slice(1) })
    : L("{y}年{m}月", { y: id.slice(0, 4), m: Number(id.slice(5)) });
export const SEASON_TIERS = RANK_TIERS;
export const tierOf = (p) =>
  SEASON_TIERS.findIndex(
    (t) =>
      t.name ===
      rankTitle(p?.rating ?? displayRating(p?.wr ?? 0.5), p?.rated || 0),
  );
export const SEASON_BACK = "moon-crest";
export const SEASON_FRAME = "gold-laurel";
export function seasonTitle(id) {
  if (typeof id !== "string") return null;
  const match =
    /^season:(20\d{2}-(?:0[1-9]|1[0-2])|S[1-9]\d{0,2}):(king|first|three|ten)$/.exec(id);
  if (!match) return null;
  return {
    id,
    name: `${seasonName(match[1])} ${{ king: L("王の証"), first: L("覇者"), three: L("三傑"), ten: L("十傑") }[match[2]]}`,
    how: L("シーズン報酬"),
  };
}
export function seasonRewards(id) {
  if (!validSeason(id)) return [];
  return [
    {
      key: "participation",
      label: L("10戦達成"),
      name: L("ガチャチケット ×2"),
      tickets: 2,
      games: 10,
      mark: "✦",
    },
    {
      key: "soldier",
      label: L("士に到達"),
      name: L("カード裏面「月夜の紋章」"),
      back: SEASON_BACK,
      tier: 2,
      mark: "☾",
    },
    {
      key: "general",
      label: L("将に到達"),
      name: L("アイコンフレーム「金の月桂冠」"),
      frame: SEASON_FRAME,
      tier: 3,
      mark: "❧",
    },
    {
      key: "king",
      label: L("王に到達"),
      name: L("称号「王の証」"),
      title: `season:${id}:king`,
      tier: 4,
      mark: "♛",
    },
    ...[
      ["first", 1, L("覇者")],
      ["three", 3, L("三傑")],
      ["ten", 10, L("十傑")],
    ].map(([key, place, name]) => ({
      key,
      label: place === 1 ? L("最終1位") : L("最終{n}位以内", { n: place }),
      name: L("{season}の称号「{name}」", { season: seasonName(id), name }),
      title: `season:${id}:${key}`,
      place,
      mark: "♜",
    })),
  ].map((r) => ({ ...r, id: `${id}:${r.key}`, season: id }));
}
export function rewardReady(reward, player, closed) {
  if (!player) return false;
  if (reward.games) return player.rated >= reward.games;
  if (reward.tier) return player.highest >= reward.tier;
  return !!closed && player.place > 0 && player.place <= reward.place;
}
export function sanitizeSeasonCache(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    uid: typeof s.uid === "string" ? s.uid : null,
    // 受領印とチケットを同じ collection 更新で保存する。
    applied: Array.isArray(s.applied)
      ? [
          ...new Set(
            s.applied.filter((x) => typeof x === "string" && x.length < 180),
          ),
        ]
      : [],
    back: s.back === SEASON_BACK ? s.back : null,
    frame: s.frame === SEASON_FRAME ? s.frame : null,
    backs:
      Array.isArray(s.backs) && s.backs.includes(SEASON_BACK)
        ? [SEASON_BACK]
        : [],
    frames:
      Array.isArray(s.frames) && s.frames.includes(SEASON_FRAME)
        ? [SEASON_FRAME]
        : [],
  };
}
export function applySeasonReceipts(collection, data) {
  const cache = sanitizeSeasonCache(collection.season),
    applied = new Set(cache.applied);
  let tickets = collection.tickets;
  for (const receipt of data.claims || []) {
    const reward = seasonRewards(receipt.season).find(
      (r) => r.id === receipt.id,
    );
    const key = `${data.uid}:${receipt.id}`;
    if (reward && !applied.has(key)) {
      tickets += reward.tickets || 0;
      applied.add(key);
    }
  }
  return {
    ...collection,
    // サーバーの財布が残高を返したときはそれが正(足し算しない)
    tickets: Number.isSafeInteger(data.wallet?.tickets) ? data.wallet.tickets : tickets,
    season: {
      uid: data.uid,
      applied: [...applied],
      ...data.appearance,
      ...data.owned,
    },
  };
}
