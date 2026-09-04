/**
 * バトルパスの保存。端末の localStorage だけに置く。
 * スキンの持ち物(skins/store.js)と同じ作りにしてある。
 */
import { useSyncExternalStore } from "react";
import { normalize } from "./battlepass.js";

export const PASS_KEY = "tottery.battlepass.v1";
const listeners = new Set();
let snapshot;

function read() {
  try {
    return normalize(JSON.parse(localStorage.getItem(PASS_KEY) || "null"));
  } catch {
    return snapshot || normalize(null);
  }
}
export function getPass() {
  if (!snapshot) snapshot = read();
  return snapshot;
}
function emit() {
  for (const fn of listeners) fn();
}
function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key !== null && e.key !== PASS_KEY) return;
    snapshot = read();
    emit();
  });
export function usePass() {
  return useSyncExternalStore(subscribe, getPass, getPass);
}

/** 書き換える。保存できなくても遊びは止めない */
export function updatePass(change) {
  const next = normalize(change(read()));
  try {
    localStorage.setItem(PASS_KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても、この画面のあいだは進んだ形で見せる
  }
  snapshot = next;
  emit();
  return next;
}
