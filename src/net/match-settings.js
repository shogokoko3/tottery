const KEY = "tottery.online-rules.v1";
export const validMatchSize = (size) => size === 5 || size === 9;

export function loadOnlineSize() {
  try {
    const size = JSON.parse(localStorage.getItem(KEY))?.boardSize;
    return validMatchSize(size) ? size : 5;
  } catch {
    return 5;
  }
}

export function saveOnlineSize(boardSize) {
  if (!validMatchSize(boardSize)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ boardSize }));
  } catch {
    // The current selection still works when persistent storage is unavailable.
  }
}

/* ---- 詳細設定(src/game/custom-rules.js)。端末に覚えておく。null ならクラシック ---- */
const CUSTOM_KEY = "tottery.custom-rules.v1";
export function loadCustomRules() {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_KEY));
    return raw && typeof raw === "object" ? raw : null;
  } catch {
    return null;
  }
}
export function saveCustomRules(custom) {
  try {
    if (custom) localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    else localStorage.removeItem(CUSTOM_KEY);
  } catch {
    // 覚えられなくても、今回の設定はそのまま使える
  }
}

/** Missing settings belong to the older, host-priority matching protocol. */
export function matchesOnlineSize(entry, boardSize) {
  return validMatchSize(boardSize) && entry?.matchSize === boardSize;
}
