import { authedFetch, myUid } from "./auth.js";
import { DB_URL } from "./firebase.js";
import { profileRecord, profilePatch } from "./profile-record.js";

const KEY = "tottery.profile.pending.v1";
const chains = new Map();
let memory = null;
let memoryOnly = false;
function pending() {
  if (memoryOnly) return memory;
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return memory;
  }
}
function save(value) {
  memory = value;
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
    /* 次の起動でもプロフィール本体から同期する */
  }
}
const notice = (status) => {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("tottery:profile-sync", { detail: status }),
    );
};
export function profileSyncPending() {
  return !!pending();
}

/**
 * 送り待ちを捨てる。「自分の記録を消す」のときに呼ぶ。
 * 残しておくと、消したあとに古い成績が再送されて記録が戻ってしまう
 */
export async function clearProfileSync() {
  save(null);
  // 送っている最中のものは止められないので、終わるのを待ってから返す。
  // 待たずに消しに行くと、消した直後に古い成績が着いて戻ってしまう
  const inflight = [...chains.values()];
  chains.clear();
  await Promise.allSettled(inflight);
  save(null);
  notice("saved");
}

async function transmit(entry) {
  try {
    const get = async (path) => {
      const res = await authedFetch(`${DB_URL}/${path}.json`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };
    const [previous, rank] = await Promise.all([
      get(`players/${entry.id}`),
      get(`ranks/${entry.id}`),
    ]);
    // 別タブですでに更新された場合、古い再送で新しい成績を巻き戻さない。
    if (previous?.at > entry.record.at) {
      if (pending()?.key === entry.key) save(null);
      notice(profileSyncPending() ? "pending" : "saved");
      return { ok: true };
    }
    const res = await authedFetch(`${DB_URL}/.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        profilePatch(entry.id, entry.record, previous, rank, entry.since),
      ),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (pending()?.key === entry.key) save(null);
    notice(profileSyncPending() ? "pending" : "saved");
    return { ok: true };
  } catch {
    notice("failed");
    return { ok: false };
  }
}
function enqueue(entry) {
  const run = () =>
    typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request(`tottery-profile-${entry.id}`, () =>
          transmit(entry),
        )
      : transmit(entry);
  const job = (chains.get(entry.id) || Promise.resolve()).then(run, run);
  chains.set(entry.id, job);
  job.finally(() => {
    if (chains.get(entry.id) === job) chains.delete(entry.id);
  });
  return job;
}
export function publishProfile(profile, extra) {
  const record = profileRecord(profile);
  if (!record) return Promise.resolve({ ok: false });
  const entry = {
    id: profile.id,
    record,
    since: extra?.since,
    key: `${record.at}-${Math.random()}`,
  };
  save(entry);
  return enqueue(entry);
}
export function retryProfileSync() {
  const entry = pending();
  if (!entry || entry.id !== myUid()) return Promise.resolve({ ok: true });
  return enqueue(entry);
}
export function watchProfileSync() {
  const retry = () => {
    if (document.visibilityState !== "hidden") retryProfileSync();
  };
  const timer = setInterval(retry, 30000);
  window.addEventListener("online", retry);
  document.addEventListener("visibilitychange", retry);
  return () => {
    clearInterval(timer);
    window.removeEventListener("online", retry);
    document.removeEventListener("visibilitychange", retry);
  };
}
