import { missionPeriods } from "./periodic-missions.js";

/** One update per open session, using the existing 05:00 JST mission boundary. */
export function watchDailySession(onUpdate, {
  now = Date.now, page = document, host = window,
  later = setTimeout, cancel = clearTimeout,
} = {}) {
  const initialDay = missionPeriods(now()).day;
  let closed = false, notified = false, timer;
  const check = () => {
    cancel(timer);
    if (closed || notified) return;
    const at = now(), period = missionPeriods(at);
    if (!page.hidden && period.day > initialDay) {
      notified = true;
      onUpdate(period.day);
      return;
    }
    timer = later(check, Math.max(20, Math.min(60000, period.nextDay - at + 20)));
  };
  const audioState = event => {
    if ((event.status || event.detail?.status) === "active") check();
  };
  page.addEventListener("visibilitychange", check);
  for (const name of ["focus", "pageshow"]) host.addEventListener(name, check);
  host.addEventListener("tottery-audio-state", audioState);
  check();
  return () => {
    closed = true;
    cancel(timer);
    page.removeEventListener("visibilitychange", check);
    for (const name of ["focus", "pageshow"]) host.removeEventListener(name, check);
    host.removeEventListener("tottery-audio-state", audioState);
  };
}

/** Finish games, matchmaking, summons and purchases before returning to title. */
export function canRefreshDailySession(screen, intro) {
  return !intro && !["game", "skins", "shop", "battlepass", "online", "room", "nearby"].includes(screen);
}
