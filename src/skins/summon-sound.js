import { audioSettings, playSound, duckMusic } from "../audio/index.js";

export function prepareSummonSound() {}

export function startSummonSound() {
  const settings = audioSettings();
  if (settings.muted || !settings.se) return () => {};
  const stop = playSound("summon_bed", { presentation: true });
  const release = duckMusic(9000);
  return () => { stop?.(); release?.(); };
}
