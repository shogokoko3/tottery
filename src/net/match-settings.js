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

/* ---- フェーズ(ストーリーとフェーズ.md)。フェーズごとに相手を分ける ---- */

/**
 * 掲示(lobby)の1件が、この盤・このフェーズの相手か。
 *
 * フェーズ3の掲示は今までどおり `matchSize` だけを書く(旧端末もそのまま拾える)。
 * フェーズ1・2の掲示は **`matchSize` を書かず** `phase` と `size` を書く。旧端末は
 * `matchSize === 自分の盤` で拾うので、これらの掲示を**拾わない**(盤がずれる事故を防ぐ)。
 */
export function matchesOnlineEntry(entry, boardSize, phase = 3) {
  if (!entry || !validMatchSize(boardSize)) return false;
  const mine = onlinePhase(phase);
  if (mine >= 3) return entry.matchSize === boardSize && entry.phase === undefined;
  return entry.phase === mine && entry.size === boardSize && entry.matchSize === undefined;
}

/** フェーズとして読めるのは 1・2・3 だけ。ほかは 3(今までどおりの対局) */
export function onlinePhase(value) {
  return value === 1 || value === 2 || value === 3 ? value : 3;
}

/** 部屋のフェーズ。書いていない部屋(旧端末のホスト)はフェーズ3 */
export function roomPhaseOf(room) {
  return onlinePhase(room?.phase);
}

/** 席についた相手のフェーズ。書けない相手(旧端末)はフェーズ3扱い */
export function guestPhaseOf(room) {
  return onlinePhase(room?.guestPhase);
}
