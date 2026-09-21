import { useEffect, useState } from "react";
import { loadProfile, touchDay, PROFILE_CHANGED } from "../game/profile.js";
import { missionPeriods } from "../game/periodic-missions.js";

/** Refresh at 05:00 JST and on resume, even if the screen stays open overnight. */
export function useMissionProfile() {
  const [profile, setProfile] = useState(loadProfile);
  useEffect(() => {
    let timer;
    let active = true;
    const refresh = () => {
      if (!active) return;
      clearTimeout(timer);
      setProfile(
        document.visibilityState === "hidden" ? loadProfile() : touchDay(),
      );
      timer = setTimeout(
        refresh,
        Math.max(
          20,
          Math.min(60000, missionPeriods().nextDay - Date.now() + 10),
        ),
      );
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    // storage は他のタブにしか届かない。同じ画面で称号や名前を変えたときは
    // この合図で読み直す(2026-09-22)
    window.addEventListener(PROFILE_CHANGED, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(PROFILE_CHANGED, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return [profile, setProfile];
}
