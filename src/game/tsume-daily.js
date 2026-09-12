import { missionPeriods } from "./periodic-missions.js";

export const TSUME_PARTICIPATION_ETHER = 50;
export const TSUME_CLEAR_GEMS = 5;
// 導入前の日付だけは旧方式を維持する。
const LEGACY_ORDER = Array.from({ length: 10 }, (_, i) => [
  i * 2 + 1,
  i * 2 + 2,
  i + 21,
]).flat();
const START = Date.UTC(2026, 8, 8);
const QUESTION_IDS = Array.from({ length: 30 }, (_, i) => i + 1);
export function tsumeCandidates(history) {
  const recent = new Set(history.slice(-15));
  return QUESTION_IDS.filter((id) => !recent.has(id));
}

// 公開初日（9/8）の問題を維持し、9/9からランダム出題する。
// 共通の乱数シードから履歴を再現することで、全員・再読み込み・未参加の日も
// 同じ出題にする。シードと初日の問題は今後も変更しない。
let randomState = 2717676261;
const schedule = [1];
function random() {
  randomState = (randomState + 0x6d2b79f5) | 0;
  let value = Math.imul(randomState ^ (randomState >>> 15), randomState | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export function dailyTsume(at = Date.now()) {
  const period = missionPeriods(at);
  const n = Math.floor((Date.parse(period.day) - START) / 86400000);
  if (n < 0)
    return { ...period, questionId: LEGACY_ORDER[((n % 30) + 30) % 30] };
  // 日付を飛ばして起動しても、間の出題を含む直近15問を除外する。
  while (schedule.length <= n) {
    const candidates = tsumeCandidates(schedule);
    schedule.push(candidates[Math.floor(random() * candidates.length)]);
  }
  return { ...period, questionId: schedule[n] };
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
