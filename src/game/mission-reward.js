import { MISSIONS } from "./mission-catalog.js";
import { PERIODIC_MISSIONS, missionPeriods } from "./periodic-missions.js";

/** 金額はこの共通カタログだけから読む。達成判定は従来どおり端末側であり、独立した取得証明ではない。 */
export function missionRewardOf(id) {
  if (typeof id !== "string") return null;
  const normal = MISSIONS.find(m => m.id === id);
  if (normal) return ["ticket", "gems"].includes(normal.reward.type) ? { ...normal, period: null } : null;
  const match = /^(daily|weekly):(\d{4}-\d{2}-\d{2}):([a-z-]+)$/.exec(id);
  if (!match) return null;
  const [, category, period, key] = match;
  const at = Date.parse(period + "T00:00:00Z");
  if (!Number.isFinite(at) || new Date(at).toISOString().slice(0,10) !== period) return null;
  if (category === "weekly" && new Date(at).getUTCDay() !== 1) return null;
  const def = PERIODIC_MISSIONS.find(m => m.category === category && m.key === key);
  return def && ["ticket", "gems"].includes(def.reward.type) ? { ...def, id, period } : null;
}

/** 配布済み版は末尾にも同じ日付を付けていた。両方とも同じ受取IDへ寄せる。 */
export function missionFromLegacyId(eventId) {
  if (typeof eventId !== "string" || !eventId.startsWith("mission:")) return null;
  let id = eventId.slice(8);
  const duplicated = /^(daily|weekly):(\d{4}-\d{2}-\d{2}):([a-z-]+):(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (duplicated) {
    if (duplicated[2] !== duplicated[4]) return null;
    id = `${duplicated[1]}:${duplicated[2]}:${duplicated[3]}`;
  }
  return missionRewardOf(id)?.id || null;
}

export function validMissionReward(id, now = Date.now()) {
  const m = missionRewardOf(id);
  if (!m) return false;
  if (!m.period) return true;
  const current = missionPeriods(now)[m.category === "weekly" ? "week" : "day"];
  // 端末申告の過去分を無期限に新規発行しない。直近の通信保留は7日間再送できる。
  return m.period <= current && Date.parse(current) - Date.parse(m.period) <= 7 * 86400000;
}
