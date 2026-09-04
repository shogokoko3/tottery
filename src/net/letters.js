/**
 * 運営からの手紙。
 *
 * 補填やプレゼントを渡すための一方向の連絡。サーバーの letters/<id> に置き、
 * 端末は起動時に読んで、受け取っていないものを未読として出す。
 *
 *   宛先 to: "all"      … 全員宛て
 *        to: "<端末id>" … その端末だけ
 *
 * 受け取ったかどうかは端末側(profile.letters)にだけ控える。サーバーには
 * 誰が受け取ったかを書かない(端末を替えれば取り直せてしまうが、いまは
 * 本人確認の仕組みが無いので、そこは割り切る)。
 *
 * 添付(gifts)は [{ type, id?, amount? }] の並び。ミッションの褒美と同じ形に
 * してあるので、配る側の処理も同じものを使える。
 */
import { DB_URL } from "./firebase.js";

const TIMEOUT_MS = 8000;
/** 一度に読む手紙の数 */
export const LETTER_LIMIT = 50;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_r, reject) =>
      setTimeout(() => {
        const err = new Error("timeout");
        err.__timeout = true;
        reject(err);
      }, ms),
    ),
  ]);
}

/** 添付1つの形をそろえる。知らないものは落とす */
export function normalizeGift(raw) {
  if (!raw || typeof raw !== "object") return null;
  const type = raw.type;
  if (type === "ticket" || type === "xp") {
    const amount = Number(raw.amount);
    return Number.isSafeInteger(amount) && amount > 0 ? { type, amount } : null;
  }
  if (type === "title" || type === "icon" || type === "skin")
    return typeof raw.id === "string" && raw.id ? { type, id: raw.id } : null;
  return null;
}

/** 手紙1通の形をそろえる */
export function normalizeLetter(id, raw) {
  if (!raw || typeof raw !== "object") return null;
  const subject = String(raw.subject || "").slice(0, 60);
  if (!subject) return null;
  return {
    id,
    to: typeof raw.to === "string" && raw.to ? raw.to : "all",
    subject,
    body: String(raw.body || "").slice(0, 1000),
    gifts: Array.isArray(raw.gifts)
      ? raw.gifts.map(normalizeGift).filter(Boolean).slice(0, 10)
      : [],
    at: Number(raw.at) || 0,
    // 期限。過ぎた手紙は届かない。0 なら期限なし
    until: Number(raw.until) || 0,
  };
}

/** 自分に届いている手紙か */
export function isFor(letter, myId, now) {
  if (!letter) return false;
  if (letter.until && letter.until < (now == null ? Date.now() : now))
    return false;
  return letter.to === "all" || letter.to === myId;
}

/** 手紙を読む。読めなくても遊びは止めないので、黙って空を返す */
export async function readLetters() {
  try {
    const res = await withTimeout(
      fetch(
        `${DB_URL}/letters.json?orderBy=%22at%22&limitToLast=${LETTER_LIMIT}`,
      ),
      TIMEOUT_MS,
    );
    if (!res.ok) return { ok: false, list: [] };
    const data = await res.json();
    const list = Object.entries(data || {})
      .map(([id, row]) => normalizeLetter(id, row))
      .filter(Boolean)
      .sort((a, b) => b.at - a.at);
    return { ok: true, list };
  } catch {
    return { ok: false, list: [] };
  }
}

/* ---- 管理画面から ---- */

/** 手紙を出す */
export async function sendLetter(letter) {
  const body = {
    to: letter.to || "all",
    subject: String(letter.subject || "").slice(0, 60),
    body: String(letter.body || "").slice(0, 1000),
    gifts: (letter.gifts || []).map(normalizeGift).filter(Boolean),
    at: Date.now(),
    ...(letter.until ? { until: Number(letter.until) } : null),
  };
  if (!body.subject) throw new Error("件名を入れてください");
  const res = await withTimeout(
    fetch(`${DB_URL}/letters.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** 手紙を取り消す */
export async function deleteLetter(id) {
  const res = await withTimeout(
    fetch(`${DB_URL}/letters/${id}.json`, { method: "DELETE" }),
    TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
