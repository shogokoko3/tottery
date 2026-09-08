import { GAME_RULE_VERSION } from "./rule-version.js";

export const CLOCK_INITIAL_MS = 5 * 60 * 1000;
export const CLOCK_INCREMENT_MS = 10 * 1000;
export const CLOCK_EXTENSION_THRESHOLD_MS = 30 * 1000;
export const CLOCK_EXTENSION_LIMIT = 6;

export function hasLimitedClock(version) {
  return version === GAME_RULE_VERSION;
}

export function clockExtensionsRemaining(used = 0) {
  return Math.max(0, CLOCK_EXTENSION_LIMIT - used);
}

/** 本当の手番開始時だけ呼ぶ。追加行動・表示更新では回数を消費しない。 */
export function grantTurnTime(state, player) {
  const limited = hasLimitedClock(state.ruleVersion);
  const uses = state.clockExtensionUses || [0, 0];
  const ms = state.clocks[player];
  if (
    limited &&
    (ms <= 0 ||
      ms > CLOCK_EXTENSION_THRESHOLD_MS ||
      clockExtensionsRemaining(uses[player]) === 0)
  )
    return state;
  const clocks = [...state.clocks];
  clocks[player] += CLOCK_INCREMENT_MS;
  if (!limited) return { ...state, clocks }; // 旧対局の再生結果を保つ。
  const clockExtensionUses = [...uses];
  clockExtensionUses[player]++;
  return { ...state, clocks, clockExtensionUses };
}
