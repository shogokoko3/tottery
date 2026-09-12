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

/** 王にできる数字。A は王にできないので入れない */
export const KING_RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

// 週の文字列から決める、全員共通の乱数。同じ週なら端末・再読み込みを問わず同じ数字になる。
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 今週の数字。2〜K から週ごとに抽選し、月曜朝5時(JST)に切り替わる */
export function weeklyKingRank(at = Date.now()) {
  const { week } = missionPeriods(at);
  return { week, rank: KING_RANKS[hash(`king:${week}`) % KING_RANKS.length] };
}

export function sanitizeMissionProgress(raw = {}) {
  return {
    week: validDay(raw?.week) ? raw.week : null,
    loginDays: unique(raw?.loginDays, validDay, 7),
    gameDays: unique(raw?.gameDays, validDay, 7),
    wins: Number.isSafeInteger(raw?.wins)
      ? Math.max(0, Math.min(5, raw.wins))
      : 0,
    // この週に、その数字を王にしてオンラインで勝った記録(数字の一覧)
    kingWins: unique(
      raw?.kingWins,
      (r) => KING_RANKS.includes(r),
      KING_RANKS.length,
    ),
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
  { online, tutorial, won, kingRank = null, matchId } = {},
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
    kingWins:
      won === true && KING_RANKS.includes(String(kingRank))
        ? [...new Set([...value.kingWins, String(kingRank)])]
        : value.kingWins,
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
    reward: { type: "ether", amount: 30 },
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
    key: "tsume",
    category: "weekly",
    name: "詰めトッタリーをクリアする",
    goal: 5,
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
  {
    key: "king",
    category: "weekly",
    // 実際の名前は periodicMissionRows が今週の数字を入れて作る
    name: "今週の数字を王にしてオンライン対戦で勝利する",
    goal: 1,
    reward: { type: "ticket", amount: 2 },
  },
];

/** 今週の数字を入れた、王のミッションの名前 */
export const kingMissionName = (rank) =>
  `今週の数字「${rank}」を王にしてオンライン対戦で勝利する`;

export const sanitizeMissionClaims = (raw) =>
  unique(
    raw,
    (id) =>
      typeof id === "string" &&
      /^(daily|weekly):\d{4}-\d{2}-\d{2}:(login|all|online|gacha|wins|tsume|king|rank-(K|10|4|2))$/.test(
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
  // 今週クリアした詰めトッタリーの日数。受取記録は collection.tsume にあり、
  // 形は tsume-daily.js の sanitizeTsumeProgress が保証している(ここでは読むだけ)
  const tsumeDays = Object.entries(collection?.tsume?.days || {}).filter(
    ([d, v]) =>
      validDay(d) &&
      v?.cleared === true &&
      d >= periods.week &&
      d <= periods.day,
  ).length;
  const king = weeklyKingRank(at);
  return PERIODIC_MISSIONS.map((def) => {
    const period = def.category === "daily" ? periods.day : periods.week;
    const id = `${def.category}:${period}:${def.key}`;
    const raw =
      def.category === "daily"
        ? def.key === "all"
          ? daily.login + daily.online + daily.gacha
          : daily[def.key]
        : def.key === "tsume"
          ? tsumeDays
          : def.key === "wins"
            ? progress.wins
            : Number(progress.kingWins.includes(king.rank));
    const claimed = claims.includes(id);
    const now = claimed ? def.goal : Math.min(def.goal, raw);
    return {
      ...def,
      ...(def.key === "king"
        ? { name: kingMissionName(king.rank), rank: king.rank }
        : {}),
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
  // 受け取り済みの控え(今の期間のぶんだけ残し、今回の分を足す)
  const missionClaims = [
    ...sanitizeMissionClaims(collection.missionClaims).filter((claim) =>
      rows.some((m) => m.id === claim),
    ),
    id,
  ];
  // 報酬が gems なら、端末の写し(合計と無償)を増やす。サーバーへは画面側が earnGems で送る
  if (row.reward.type === "gems") {
    const g = Number.isSafeInteger(collection.gems) ? collection.gems : 0;
    const f = Number.isSafeInteger(collection.gemsFree) ? collection.gemsFree : 0;
    return {
      ...collection,
      gems: g + row.reward.amount,
      gemsFree: f + row.reward.amount,
      missionClaims,
    };
  }
  const field = row.reward.type === "ticket" ? "tickets" : "ether";
  const old =
    Number.isSafeInteger(collection[field]) && collection[field] >= 0
      ? collection[field]
      : 0;
  return {
    ...collection,
    [field]: Math.min(Number.MAX_SAFE_INTEGER, old + row.reward.amount),
    missionClaims,
  };
}
