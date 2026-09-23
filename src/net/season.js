import { ensureAuth } from "./auth.js";
import { updateCollection } from "../skins/store.js";
import { applySeasonReceipts } from "../game/season.js";
import { grantTitle } from "../game/profile.js";

/** シーズン API の置き場所(Cloudflare Worker)。Web は同じオリジンなので相対でよい */
export const SEASON_API_ORIGIN = "https://tottery.tsmanager.workers.dev";

/**
 * API の土台。iOS アプリ(capacitor://localhost)では相対パスが届かないので絶対 URL にする。
 * Web(https の本番・手元の localhost)は同じオリジンの相対パス(手元は tools/serve.mjs の見本が受ける)
 */
export function seasonApiBase(loc = globalThis.location) {
  const protocol = loc && typeof loc.protocol === "string" ? loc.protocol : "";
  return protocol === "capacitor:" || protocol === "ionic:" || protocol === "file:"
    ? SEASON_API_ORIGIN
    : "";
}

export async function seasonRequest(op, body = {}) {
  const auth = await ensureAuth();
  if (!auth) throw new Error("通信を確認して、もう一度お試しください。");
  let res;
  try {
    res = await fetch(`${seasonApiBase()}/api/season/${op}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.idToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("通信を確認して、もう一度お試しください。");
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("シーズンを読み込めませんでした。もう一度お試しください。");
  }
  if (!res.ok)
    throw new Error(data.error || "シーズンを読み込めませんでした。");
  if (data.uid && data.claims) {
    await updateCollection((c) => applySeasonReceipts(c, data));
    for (const id of data.owned?.titles || []) grantTitle(id);
  }
  return data;
}
/**
 * 自分のシーズン記録をサーバーから消す。「自分の記録を消す」から呼ぶ。
 * 通信できないときは投げる(消せていないのに消したことにしない)
 */
export function forgetSeason() {
  return seasonRequest("forget");
}

const QUEUE = "tottery.season.pending.v1";

/** 送り待ちの対局を捨てる。記録を消したあとに再送されて戻らないように */
export function clearSeasonQueue() {
  try {
    localStorage.removeItem(QUEUE);
  } catch {
    /* 消せなくても、uid が違えば再送はされない */
  }
}
/** 送る対局の形が正しいか。人との対局は部屋の鍵(code・createdAt・round)、Bot との対局は id */
function validMatch(m) {
  if (!m || typeof m.uid !== "string") return false;
  if (m.bot === true) return typeof m.id === "string" && [0, 1, null].includes(m.winner);
  return (
    typeof m.code === "string" &&
    Number.isSafeInteger(m.createdAt) &&
    Number.isInteger(m.round)
  );
}
/** 同じ対局かどうかを見分ける鍵 */
export function seasonMatchKey(m) {
  return m.bot === true
    ? `bot:${m.uid}:${m.id}`
    : `${m.code}:${m.createdAt}:${m.round}:${m.uid}`;
}
function pending() {
  try {
    const list = JSON.parse(localStorage.getItem(QUEUE) || "[]");
    return Array.isArray(list) ? list.filter(validMatch) : [];
  } catch {
    return [];
  }
}
export function queueSeasonMatch(match) {
  const list = pending();
  if (!list.some((m) => seasonMatchKey(m) === seasonMatchKey(match))) {
    list.push(match);
    localStorage.setItem(QUEUE, JSON.stringify(list));
  }
}
export async function finishSeasonMatch(match) {
  const result = await seasonRequest("finish", match);
  localStorage.setItem(
    QUEUE,
    JSON.stringify(
      pending().filter((m) => seasonMatchKey(m) !== seasonMatchKey(match)),
    ),
  );
  return result;
}
export async function retrySeasonMatches() {
  const auth = await ensureAuth();
  if (!auth) return;
  let lastError;
  for (const match of pending().filter((m) => m.uid === auth.uid)) {
    try {
      await finishSeasonMatch(match);
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) throw lastError;
}
