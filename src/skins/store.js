import { useSyncExternalStore } from "react";
import { normalize } from "./collection.js";

export const COLLECTION_KEY = "tottery.skins.v1";
const LEGACY_KEY = "tottery.skin-preview.v1";
const listeners = new Set();
let snapshot;
function read() {
  try {
    return normalize(
      JSON.parse(
        localStorage.getItem(COLLECTION_KEY) ||
          localStorage.getItem(LEGACY_KEY) ||
          "null",
      ),
    );
  } catch {
    return snapshot || normalize(null);
  }
}
export function getCollection() {
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
    if (e.key !== null && e.key !== COLLECTION_KEY) return;
    snapshot = read();
    emit();
  });
export function useCollection() {
  return useSyncExternalStore(subscribe, getCollection, getCollection);
}

// 同一タブの連打を直列に処理し、対応ブラウザーでは他タブとの更新も排他する。
let tail = Promise.resolve();
export function updateCollection(change) {
  const commit = () => {
    const next = normalize(change(read()));
    try {
      localStorage.setItem(COLLECTION_KEY, JSON.stringify(next));
    } catch {
      throw new Error(
        "保存できませんでした。ブラウザーの保存設定や空き容量をご確認ください。",
      );
    }
    snapshot = next;
    emit();
    return next;
  };
  const result = tail.then(() =>
    typeof window !== "undefined" && window.navigator?.locks
      ? window.navigator.locks.request(COLLECTION_KEY, commit)
      : commit(),
  );
  tail = result.catch(() => {});
  return result;
}
