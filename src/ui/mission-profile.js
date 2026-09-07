import { useEffect, useState } from "react";
import { loadProfile, touchDay } from "../game/profile.js";
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
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return [profile, setProfile];
}
