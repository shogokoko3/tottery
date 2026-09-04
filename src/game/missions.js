/**
 * 通常ミッション。条件を満たすと褒美を受け取れる。
 *
 * 台帳に1行足せば増える。条件は「いまの数字」と「目標」の比べ算だけにして、
 * 進み具合をそのまま帯で出せるようにしてある。
 *
 * kind は条件の種類。増やすときは STATS に読み方を足す。
 *   days    使用頻度(遊んだ日数)     → 称号・スキン
 *   level   プレイヤーレベル          → ガチャチケット・アイコン
 *   battles 対戦回数(チュートリアルは含めない) → ガチャチケット
 *
 * reward の type:
 *   title / icon / skin  それぞれの id を配る
 *   ticket               amount 枚のガチャチケットを配る
 */
import { levelOf } from "./profile.js";

/** 条件ごとの、いまの数字の読み方 */
export const STATS = {
  days: (p) => p.days || 0,
  level: (p) => levelOf(p),
  battles: (p) => p.battles || 0,
};

/** 条件ごとの見出しと単位 */
export const KINDS = {
  days: { label: "使用頻度", unit: "日" },
  level: { label: "プレイヤーレベル", unit: "" },
  battles: { label: "対戦回数", unit: "戦" },
};

export const MISSIONS = [
  // 使用頻度 → 称号・スキン
  {
    id: "days-3",
    kind: "days",
    goal: 3,
    name: "3日あそぶ",
    reward: { type: "title", id: "regular" },
  },
  {
    id: "days-10",
    kind: "days",
    goal: 10,
    name: "10日あそぶ",
    reward: { type: "skin", id: "pirate-male" },
  },
  {
    id: "days-30",
    kind: "days",
    goal: 30,
    name: "30日あそぶ",
    reward: { type: "title", id: "devoted" },
  },

  // プレイヤーレベル → ガチャチケット・アイコン
  {
    id: "level-5",
    kind: "level",
    goal: 5,
    name: "レベル5になる",
    reward: { type: "ticket", amount: 1 },
  },
  {
    id: "level-10",
    kind: "level",
    goal: 10,
    name: "レベル10になる",
    reward: { type: "icon", id: "crown" },
  },
  {
    id: "level-20",
    kind: "level",
    goal: 20,
    name: "レベル20になる",
    reward: { type: "ticket", amount: 3 },
  },
  {
    id: "level-30",
    kind: "level",
    goal: 30,
    name: "レベル30になる",
    reward: { type: "icon", id: "star" },
  },

  // 対戦回数 → ガチャチケット
  {
    id: "battles-10",
    kind: "battles",
    goal: 10,
    name: "10戦する",
    reward: { type: "ticket", amount: 1 },
  },
  {
    id: "battles-50",
    kind: "battles",
    goal: 50,
    name: "50戦する",
    reward: { type: "ticket", amount: 2 },
  },
  {
    id: "battles-100",
    kind: "battles",
    goal: 100,
    name: "100戦する",
    reward: { type: "ticket", amount: 3 },
  },
  {
    id: "battles-500",
    kind: "battles",
    goal: 500,
    name: "500戦する",
    reward: { type: "ticket", amount: 5 },
  },
];

export const byId = (id) => MISSIONS.find((m) => m.id === id) || null;

/**
 * ミッション1つの様子。
 * now が goal に届いていれば done、受け取り済みなら claimed。
 */
export function statusOf(mission, profile) {
  const read = STATS[mission.kind];
  const now = read ? read(profile) : 0;
  const done = now >= mission.goal;
  return {
    ...mission,
    now: Math.min(now, mission.goal),
    raw: now,
    done,
    claimed: (profile.missions || []).includes(mission.id),
    ratio: mission.goal ? Math.min(1, now / mission.goal) : 0,
  };
}

/**
 * 一覧。受け取れるものを先に、次に進行中、最後に受け取り済み。
 * 同じ種類の中では目標の小さい順。
 */
export function listMissions(profile) {
  const rank = (s) => (s.done && !s.claimed ? 0 : s.claimed ? 2 : 1);
  return MISSIONS.map((m) => statusOf(m, profile)).sort(
    (a, b) => rank(a) - rank(b) || a.goal - b.goal,
  );
}

/** 受け取れるものの数。入り口に出す印に使う */
export function claimableCount(profile) {
  return MISSIONS.filter((m) => {
    const s = statusOf(m, profile);
    return s.done && !s.claimed;
  }).length;
}
