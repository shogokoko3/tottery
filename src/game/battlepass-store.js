/**
 * バトルパスの保存。端末の localStorage だけに置く。
 * スキンの持ち物(skins/store.js)と同じ作りにしてある。
 *
 * シーズンごとに盤を分ける(2026-10-15 本人の指示)。魔術師(heroes)は従来の鍵のまま、
 * ほかのシーズンは鍵にシーズン名を付ける。「進めるパス」(active)は1つだけ。
 */
import { useSyncExternalStore } from "react";
import { normalize, rewardIdOf } from "./battlepass.js";
import { CONTENT_SEASONS, DEFAULT_SEASON, contentSeason } from "./content-seasons.js";

export const PASS_KEY = "tottery.battlepass.v1";
export const ACTIVE_KEY = "tottery.battlepass.active.v1";
export const passKeyOf = (seasonId = DEFAULT_SEASON) =>
  seasonId === DEFAULT_SEASON ? PASS_KEY : `tottery.battlepass.${seasonId}.v1`;
const listeners = new Set();
const snapshots = new Map();
const unsaved = new Set();
let activeSnapshot;

function save(seasonId, next, serialized = JSON.stringify(next)) {
  try {
    localStorage.setItem(passKeyOf(seasonId), serialized);
    unsaved.delete(seasonId);
  } catch {
    // 保存が戻るまでは、次の更新もこのタブの最新状態を基準にする。
    unsaved.add(seasonId);
  }
}

function read(seasonId) {
  if (unsaved.has(seasonId) && snapshots.has(seasonId)) return snapshots.get(seasonId);
  const rewardId = rewardIdOf(seasonId);
  try {
    const stored = localStorage.getItem(passKeyOf(seasonId));
    let raw;
    try {
      raw = JSON.parse(stored || "null");
    } catch {
      raw = snapshots.get(seasonId) || null;
    }
    const next = normalize(raw, rewardId);
    const serialized = JSON.stringify(next);
    // 初回生成・旧版からの移行時に順序を保存し、再読込や別タブでも共有する。
    if (serialized !== stored) {
      snapshots.set(seasonId, next);
      save(seasonId, next, serialized);
    }
    return next;
  } catch {
    unsaved.add(seasonId);
    return snapshots.get(seasonId) || normalize(null, rewardId);
  }
}
function seasonOrDefault(seasonId) {
  return contentSeason(seasonId) ? seasonId : DEFAULT_SEASON;
}
export function getPass(seasonId = DEFAULT_SEASON) {
  const id = seasonOrDefault(seasonId);
  if (!snapshots.has(id)) snapshots.set(id, read(id));
  return snapshots.get(id);
}
function emit() {
  for (const fn of listeners) fn();
}
function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 「進めるパス」。保存が無ければ魔術師。知らない名前は魔術師に戻す */
function readActive() {
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    return contentSeason(v) ? v : DEFAULT_SEASON;
  } catch {
    return activeSnapshot || DEFAULT_SEASON;
  }
}
export function getActivePassId() {
  if (!activeSnapshot) activeSnapshot = readActive();
  return activeSnapshot;
}
export function setActivePassId(seasonId) {
  const id = seasonOrDefault(seasonId);
  activeSnapshot = id;
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* 保存できなくてもこのタブでは効く */
  }
  emit();
  return id;
}
export function useActivePassId() {
  return useSyncExternalStore(subscribe, getActivePassId, getActivePassId);
}

if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key === ACTIVE_KEY) {
      activeSnapshot = readActive();
      emit();
      return;
    }
    const hit = CONTENT_SEASONS.filter((s) => e.key === null || e.key === passKeyOf(s.id));
    if (!hit.length) return;
    for (const s of hit) snapshots.set(s.id, read(s.id));
    emit();
  });
export function usePass(seasonId = DEFAULT_SEASON) {
  const id = seasonOrDefault(seasonId);
  const get = () => getPass(id);
  return useSyncExternalStore(subscribe, get, get);
}

/** 書き換える。保存できなくても遊びは止めない */
export function updatePass(change, seasonId = DEFAULT_SEASON) {
  const id = seasonOrDefault(seasonId);
  const next = normalize(change(read(id)), rewardIdOf(id));
  snapshots.set(id, next);
  save(id, next);
  emit();
  return next;
}
