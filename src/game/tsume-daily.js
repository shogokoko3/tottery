import { missionPeriods } from "./periodic-missions.js";

export const TSUME_PARTICIPATION_ETHER = 50;
export const TSUME_CLEAR_TICKETS = 1;
// 推理2問、王を取る問題1問の順に、30日で一巡する。全員が同じ問題。
const ORDER = Array.from({ length: 10 }, (_, i) => [
  i * 2 + 1,
  i * 2 + 2,
  i + 21,
]).flat();
const START = Date.UTC(2026, 8, 8);
export function dailyTsume(at = Date.now()) {
  const period = missionPeriods(at);
  const n = Math.floor((Date.parse(period.day) - START) / 86400000);
  return { ...period, questionId: ORDER[((n % 30) + 30) % 30] };
}

export function sanitizeTsumeProgress(raw) {
  const days = {};
  for (const [day, value] of Object.entries(raw?.days || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)))
      continue;
    if (
      !value ||
      value.joined !== true ||
      !Number.isInteger(value.questionId) ||
      value.questionId < 1 ||
      value.questionId > 30
    )
      continue;
    days[day] = {
      questionId: value.questionId,
      joined: true,
      cleared: value.cleared === true,
    };
  }
  return { days };
}

export function tsumeReceipt(collection, day) {
  return sanitizeTsumeProgress(collection?.tsume).days[day] || null;
}

export function requireTsumeDay(day, at = Date.now()) {
  const today = dailyTsume(at);
  if (today.day !== day)
    throw new Error(
      "朝5時になり、問題が更新されました。今日の問題に挑戦してください。",
    );
  return today;
}

export function joinDailyTsume(collection, day, at = Date.now()) {
  const today = requireTsumeDay(day, at);
  const progress = sanitizeTsumeProgress(collection.tsume);
  if (progress.days[day]?.joined) return collection;
  return {
    ...collection,
    ether: Math.min(
      Number.MAX_SAFE_INTEGER,
      collection.ether + TSUME_PARTICIPATION_ETHER,
    ),
    tsume: {
      days: {
        ...progress.days,
        [day]: { questionId: today.questionId, joined: true, cleared: false },
      },
    },
  };
}
