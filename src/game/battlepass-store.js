/**
 * バトルパスの保存。端末の localStorage だけに置く。
 * スキンの持ち物(skins/store.js)と同じ作りにしてある。
 */
import { useSyncExternalStore } from "react";
import { normalize } from "./battlepass.js";

export const PASS_KEY = "tottery.battlepass.v1";
const listeners = new Set();
let snapshot;
let unsaved = false;

function save(next, serialized = JSON.stringify(next)) {
  try {
    localStorage.setItem(PASS_KEY, serialized);
    unsaved = false;
  } catch {
    // 保存が戻るまでは、次の更新もこのタブの最新状態を基準にする。
    unsaved = true;
  }
}

function read() {
  if (unsaved && snapshot) return snapshot;
  try {
    const stored = localStorage.getItem(PASS_KEY);
    let raw;
    try {
      raw = JSON.parse(stored || "null");
    } catch {
      raw = snapshot || null;
    }
    const next = normalize(raw);
    const serialized = JSON.stringify(next);
    // 初回生成・旧版からの移行時に順序を保存し、再読込や別タブでも共有する。
    if (serialized !== stored) {
      snapshot = next;
      save(next, serialized);
    }
    return next;
  } catch {
    unsaved = true;
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
  snapshot = next;
  save(next);
  emit();
  return next;
}
