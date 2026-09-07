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

/** Missing settings belong to the older, host-priority matching protocol. */
export function matchesOnlineSize(entry, boardSize) {
  return validMatchSize(boardSize) && entry?.matchSize === boardSize;
}
