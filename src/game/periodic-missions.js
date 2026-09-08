// Mission days begin at 05:00 JST; mission weeks begin Monday at 05:00 JST.
const DAY = 86400000;
const OFFSET = 4 * 3600000;
const dateKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const validDay = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const unique = (value, test, limit) =>
  [...new Set(Array.isArray(value) ? value.filter(test) : [])].slice(-limit);

export function missionPeriods(at = Date.now()) {
  const shifted = new Date(Number(at) + OFFSET);
  const dayStart = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const weekStart = dayStart - ((shifted.getUTCDay() + 6) % 7) * DAY;
  return {
    day: dateKey(dayStart),
    week: dateKey(weekStart),
    nextDay: dayStart + DAY - OFFSET,
    nextWeek: weekStart + 7 * DAY - OFFSET,
  };
}

export function sanitizeMissionProgress(raw = {}) {
  return {
    week: validDay(raw?.week) ? raw.week : null,
    loginDays: unique(raw?.loginDays, validDay, 7),
    gameDays: unique(raw?.gameDays, validDay, 7),
    wins: Number.isSafeInteger(raw?.wins)
      ? Math.max(0, Math.min(5, raw.wins))
      : 0,
    ranks: unique(raw?.ranks, (r) => ["K", "10", "4", "2"].includes(r), 4),
    // Retain recent match receipts across resets so a replay cannot count again tomorrow.
    seen: unique(
      raw?.seen,
      (id) => typeof id === "string" && id.length > 0 && id.length < 200,
      4096,
    ),
  };
}

function currentProgress(raw, at) {
  const value = sanitizeMissionProgress(raw);
  const { day, week } = missionPeriods(at);
  if (value.week !== week)
    return { ...sanitizeMissionProgress(), week, seen: value.seen };
  return {
    ...value,
    loginDays: value.loginDays.filter((d) => d >= week && d <= day),
    gameDays: value.gameDays.filter((d) => d >= week && d <= day),
  };
}

export function recordMissionLogin(raw, at = Date.now()) {
  const value = currentProgress(raw, at);
  const { day } = missionPeriods(at);
  return { ...value, loginDays: [...new Set([...value.loginDays, day])] };
}

export function recordMissionGame(
  raw,
  { online, tutorial, won, ranks = [], matchId } = {},
  at = Date.now(),
) {
  const value = currentProgress(raw, at);
  if (
    !online ||
    tutorial ||
    typeof matchId !== "string" ||
    !matchId ||
    matchId.length >= 200 ||
    value.seen.includes(matchId)
  )
    return value;
  const { day } = missionPeriods(at);
  return {
    ...value,
    seen: [...value.seen, matchId].slice(-4096),
    gameDays: [...new Set([...value.gameDays, day])],
    wins: Math.min(5, value.wins + (won === true ? 1 : 0)),
    ranks:
      won === true
        ? [
            ...new Set([
              ...value.ranks,
              ...ranks
                .map(String)
                .filter((r) => ["K", "10", "4", "2"].includes(r)),
            ]),
          ]
        : value.ranks,
  };
}

export const PERIODIC_MISSIONS = [
  {
    key: "login",
    category: "daily",
    name: "ログインする",
    goal: 1,
    reward: { type: "ether", amount: 10 },
  },
  {
    key: "all",
    category: "daily",
    name: "デイリーミッションを全てクリアする",
    goal: 3,
    unit: "件",
    reward: { type: "ticket", amount: 2 },
  },
  {
    key: "online",
    category: "daily",
    name: "オンライン対戦をする",
    goal: 1,
    reward: { type: "ticket", amount: 1 },
  },
  {
    key: "gacha",
    category: "daily",
    name: "ガチャを1回する",
    goal: 1,
    reward: { type: "ether", amount: 30 },
  },
  {
    key: "login",
    category: "weekly",
    name: "ログインする",
    goal: 5,
    unit: "日",
    segments: true,
    reward: { type: "ticket", amount: 2 },
  },
  {
    key: "wins",
    category: "weekly",
    name: "オンライン対戦で勝利する",
    goal: 5,
    segments: true,
    reward: { type: "ticket", amount: 2 },
  },
  ...["K", "10", "4", "2"].map((rank) => ({
    key: `rank-${rank}`,
    category: "weekly",
    name: `オンライン対戦で${rank}を使って勝利する`,
    goal: 1,
    reward: { type: "ticket", amount: 2 },
  })),
];

export const sanitizeMissionClaims = (raw) =>
  unique(
    raw,
    (id) =>
      typeof id === "string" &&
      /^(daily|weekly):\d{4}-\d{2}-\d{2}:(login|all|online|gacha|wins|rank-(K|10|4|2))$/.test(
        id,
      ),
    32,
  );

export function periodicMissionRows(profile, collection, at = Date.now()) {
  const periods = missionPeriods(at);
  const progress = currentProgress(profile?.missionProgress, at);
  const daily = {
    login: Number(progress.loginDays.includes(periods.day)),
    online: Number(progress.gameDays.includes(periods.day)),
    gacha: Number(collection?.missionDrawDay === periods.day),
  };
  const claims = sanitizeMissionClaims(collection?.missionClaims);
  return PERIODIC_MISSIONS.map((def) => {
    const period = def.category === "daily" ? periods.day : periods.week;
    const id = `${def.category}:${period}:${def.key}`;
    const raw =
      def.category === "daily"
        ? def.key === "all"
          ? daily.login + daily.online + daily.gacha
          : daily[def.key]
        : def.key === "login"
          ? progress.loginDays.length
          : def.key === "wins"
            ? progress.wins
            : Number(progress.ranks.includes(def.key.slice(5)));
    const claimed = claims.includes(id);
    const now = claimed ? def.goal : Math.min(def.goal, raw);
    return {
      ...def,
      id,
      periodic: true,
      kind: def.category,
      kindLabel: def.category === "daily" ? "デイリー" : "ウィークリー",
      unit: def.unit || "回",
      now,
      raw,
      claimed,
      done: claimed || raw >= def.goal,
      ratio: now / def.goal,
    };
  });
}

/** Reward and receipt share the collection's single durable, serialized write. */
export function claimPeriodicMission(collection, profile, id, at = Date.now()) {
  const rows = periodicMissionRows(profile, collection, at);
  const row = rows.find((m) => m.id === id);
  if (!row)
    throw new Error(
      "ミッションが更新されました。現在のミッションをご確認ください。",
    );
  if (row.claimed) return collection;
  if (!row.done) throw new Error("まだミッションの条件を満たしていません。");
  const field = row.reward.type === "ticket" ? "tickets" : "ether";
  const old =
    Number.isSafeInteger(collection[field]) && collection[field] >= 0
      ? collection[field]
      : 0;
  return {
    ...collection,
    [field]: Math.min(Number.MAX_SAFE_INTEGER, old + row.reward.amount),
    missionClaims: [
      ...sanitizeMissionClaims(collection.missionClaims).filter((claim) =>
        rows.some((m) => m.id === claim),
      ),
      id,
    ],
  };
}
