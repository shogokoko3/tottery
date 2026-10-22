/**
 * ガチャ・バトルパスの「コンテンツのシーズン」(2026-10-15 本人の指示)。
 * ランキングの月次シーズン(season.js)とは別の表。
 *
 *   ・開始日時を過ぎたシーズンのガチャ(召喚)とバトルパスが開く。まだのシーズンは画面に出さない(隠す)
 *   ・バトルパスはシーズンごとに買い切り(各 1,500 ジェム)。前のシーズンのパスも買えて進められる
 *   ・進めるパスは1つだけ選ぶ(対局で取った駒は選んだパスにだけ数える)。battlepass-store.js の active
 *   ・サーバー(src/server/wallet.js)もこの表から gachaSeries と権利の名前を決める
 */
export const CONTENT_SEASONS = Object.freeze([
  Object.freeze({
    id: "heroes",
    series: "heroes",
    name: "レジェンド・ゲート",
    passName: "魔術師のバトルパス",
    passReward: "genie-magician",
    entitlement: "battlepass",
    start: Date.parse("2026-09-01T05:00:00+09:00"),
  }),
  // アリス。本番の開始日は未定。TestFlight で全部を確かめるため、過去の日時にして解放してある(2026-10-15 本人)。
  // 開始日が決まったら、ここの start だけを書き換える
  Object.freeze({
    id: "alice",
    series: "alice",
    name: "ワンダーランド・ゲート",
    passName: "アリスのバトルパス",
    passReward: "alice-A-alice",
    entitlement: "battlepass-alice",
    start: Date.parse("2026-10-01T05:00:00+09:00"),
  }),
]);
export const DEFAULT_SEASON = "heroes";
export const contentSeason = (id) => CONTENT_SEASONS.find((s) => s.id === id) || null;
export const seasonOfSeries = (series) => CONTENT_SEASONS.find((s) => s.series === series) || null;
export const seasonOfEntitlement = (ent) => CONTENT_SEASONS.find((s) => s.entitlement === ent) || null;
export const isSeasonOpen = (id, now = Date.now()) => {
  const s = contentSeason(id);
  return !!s && s.start <= now;
};
export const openSeasons = (now = Date.now()) => CONTENT_SEASONS.filter((s) => s.start <= now);
export const openSeries = (now = Date.now()) => openSeasons(now).map((s) => s.series);
export const isSeriesOpen = (series, now = Date.now()) => openSeries(now).includes(series);
export const latestOpenSeason = (now = Date.now()) => openSeasons(now).at(-1) || CONTENT_SEASONS[0];
export const PASS_ENTITLEMENTS = Object.freeze(CONTENT_SEASONS.map((s) => s.entitlement));
/** バトルパスのマス報酬の出来事 id。魔術師(heroes)は従来の形を保つ(配布済みのビルドと同じ) */
export const passTicketId = (seasonId, cycle, cellId) =>
  seasonId === DEFAULT_SEASON ? `bp:pass:${cycle}:${cellId}` : `bp:pass:${seasonId}:${cycle}:${cellId}`;
/** 出来事 id からシーズンを読む(bp:pass:<周>:<マス> は heroes、bp:pass:<シーズン>:<周>:<マス> はそのシーズン) */
export function passSeasonOfTicketId(id) {
  const p = typeof id === "string" ? id.split(":") : [];
  if (p[0] !== "bp" || p[1] !== "pass") return null;
  return p.length >= 5 ? p[2] : DEFAULT_SEASON;
}
