import { displayRating, rankTitle, RANK_TIERS } from "./rating.js";

// JST 05:00 は前日の UTC 20:00。月の境界は必ずサーバー時計で決める。
export function seasonAt(now = Date.now()) {
  const shifted = new Date(now + 4 * 3600000);
  const y = shifted.getUTCFullYear(),
    m = shifted.getUTCMonth();
  return {
    id: `${y}-${String(m + 1).padStart(2, "0")}`,
    start: Date.UTC(y, m, 1) - 4 * 3600000,
    end: Date.UTC(y, m + 1, 1) - 4 * 3600000,
  };
}
export const validSeason = (id) =>
  typeof id === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(id);
export const seasonName = (id) => `${id.slice(0, 4)}年${Number(id.slice(5))}月`;
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
    /^season:(20\d{2}-(?:0[1-9]|1[0-2])):(king|first|three|ten)$/.exec(id);
  if (!match) return null;
  return {
    id,
    name: `${seasonName(match[1])} ${{ king: "王の証", first: "覇者", three: "三傑", ten: "十傑" }[match[2]]}`,
    how: "シーズン報酬",
  };
}
export function seasonRewards(id) {
  if (!validSeason(id)) return [];
  return [
    {
      key: "participation",
      label: "10戦達成",
      name: "ガチャチケット ×2",
      tickets: 2,
      games: 10,
      mark: "✦",
    },
    {
      key: "soldier",
      label: "士に到達",
      name: "カード裏面「月夜の紋章」",
      back: SEASON_BACK,
      tier: 2,
      mark: "☾",
    },
    {
      key: "general",
      label: "将に到達",
      name: "プロフィール枠「金の月桂冠」",
      frame: SEASON_FRAME,
      tier: 3,
      mark: "❧",
    },
    {
      key: "king",
      label: "王に到達",
      name: "称号「王の証」",
      title: `season:${id}:king`,
      tier: 4,
      mark: "♛",
    },
    ...[
      ["first", 1, "覇者"],
      ["three", 3, "三傑"],
      ["ten", 10, "十傑"],
    ].map(([key, place, name]) => ({
      key,
      label: `最終${place === 1 ? "1位" : `${place}位以内`}`,
      name: `${seasonName(id)}の称号「${name}」`,
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
    tickets,
    season: {
      uid: data.uid,
      applied: [...applied],
      ...data.appearance,
      ...data.owned,
    },
  };
}
