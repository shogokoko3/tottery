// 振動の好みは、この端末に保存する。音・動画の設定とは独立。
const KEY = "tottery.haptics.v1";
const listeners = new Set();
let enabled;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY))?.enabled !== false;
  } catch {
    return true;
  }
}

export function hapticsEnabled() {
  if (enabled === undefined) enabled = read();
  return enabled;
}

export function subscribeHaptics(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setHapticsEnabled(value) {
  enabled = !!value;
  try {
    localStorage.setItem(KEY, JSON.stringify({ enabled }));
  } catch {
    // 保存できない端末でも、今開いている間のOFFは有効にする。
  }
  listeners.forEach((listener) => listener());
  return enabled;
}

globalThis.addEventListener?.("storage", (event) => {
  if (event.key !== KEY && event.key !== null) return;
  enabled = read();
  listeners.forEach((listener) => listener());
});
