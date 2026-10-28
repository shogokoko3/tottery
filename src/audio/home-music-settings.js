import { normalizeHomeMusic } from "./home-music-options.js";

// A single home preference for this device, independent of story progression.
export const HOME_MUSIC_KEY = "tottery.home-music.v1";
const listeners = new Set();
let selected;

function read() {
  try { return normalizeHomeMusic(JSON.parse(localStorage.getItem(HOME_MUSIC_KEY))?.choice); }
  catch { return "auto"; }
}

export function homeMusicChoice() {
  if (selected === undefined) selected = read();
  return selected;
}

export function subscribeHomeMusic(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setHomeMusicChoice(value) {
  selected = normalizeHomeMusic(value);
  try { localStorage.setItem(HOME_MUSIC_KEY, JSON.stringify({ choice: selected })); }
  catch { /* Keep the choice for this session when storage is unavailable. */ }
  listeners.forEach((listener) => listener());
  return selected;
}

if (typeof window !== "undefined") window.addEventListener("storage", (event) => {
  if (event.key !== HOME_MUSIC_KEY && event.key !== null) return;
  selected = read();
  listeners.forEach((listener) => listener());
});
