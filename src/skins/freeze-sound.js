import { audioSettings, playSound, duckMusic } from "../audio/index.js";

export function startFreezeSound(kind) {
  const settings = audioSettings();
  if (settings.muted || !settings.se) return () => {};
  const stop = playSound(kind === "collapse" ? "thaw" : "summon_freeze", { presentation: true });
  const release = duckMusic(kind === "collapse" ? 1300 : 2500);
  return () => { stop?.(); release?.(); };
}
