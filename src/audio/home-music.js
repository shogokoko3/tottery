import { homeThemeForProfile } from "../skins/home-themes.js";
import { DEFAULT_HOME_MUSIC, HOME_PHASE_TRACK, normalizeHomeMusic } from "./home-music-options.js";

/** Follow the picture actually displayed on the home screen, unless pinned. */
export function homeMusicForProfile(collection, profile, preference = "auto") {
  const choice = normalizeHomeMusic(preference);
  if (choice !== "auto") return choice;
  const theme = homeThemeForProfile(collection, profile);
  return theme?.series === "story"
    ? HOME_PHASE_TRACK[theme.phase] || DEFAULT_HOME_MUSIC
    : DEFAULT_HOME_MUSIC;
}
