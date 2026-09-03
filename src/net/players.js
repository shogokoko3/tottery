/**
 * 登録した人の台帳(players/<端末id>)。
 *
 * 名前を決めた端末は、起動のたびと名前・アイコン・称号を変えたとき、
 * 対局を終えたときに自分の記録を置き直す。管理画面はこれを一覧にする。
 * ranks(持ち点つきの成績)と違い、CPU戦だけの人も載る。
 *
 * 運営が「使用停止」にすると banned が立つ。端末は起動時にそれを見て、
 * 名前を捨てて決め直しの画面へ戻る。本人確認は無いので、同じ端末で
 * 新しい名前を決めれば別の人として登録し直せる(いまの限界)。
 * 「消す」はサーバーの記録を消すだけで、端末は次の起動でまた載る。
 */
import { DB_URL } from "./firebase.js";

const TIMEOUT_MS = 8000;

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

const url = (id) => `${DB_URL}/players/${id}.json`;

/** サーバーに置く形。名前が無い人は置かない */
export function playerRecord(profile) {
  if (!profile || !profile.id || !profile.name) return null;
  return {
    name: String(profile.name).slice(0, 10),
    icon: profile.icon || null,
    title: profile.title || null,
    plays: Number(profile.plays) || 0,
    wins: Number(profile.wins) || 0,
    rating: Number(profile.rating) || 0,
    rated: Number(profile.rated) || 0,
    at: Date.now(),
  };
}

/** 自分の記録を読む。無ければ data は null */
export async function readPlayer(id) {
  if (!id) return { ok: false, data: null };
  try {
    const res = await withTimeout(fetch(url(id)), TIMEOUT_MS);
    if (!res.ok) return { ok: false, data: null, status: res.status };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, data: null };
  }
}

/** 自分の記録を置き直す。失敗しても遊びには影響しないので黙って諦める */
export async function publishPlayer(profile, extra) {
  const record = playerRecord(profile);
  if (!record) return { ok: false };
  try {
    const res = await withTimeout(
      fetch(url(profile.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...record, ...(extra || {}) }),
      }),
      TIMEOUT_MS,
    );
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/** 起動時: 記録を確かめ、使用停止なら true を返す。そうでなければ置き直す */
export async function syncPlayer(profile) {
  const found = await readPlayer(profile.id);
  if (found.ok && found.data && found.data.banned === true) return true;
  // はじめて載るときだけ登録日を書く
  const extra = found.ok && !found.data ? { since: Date.now() } : undefined;
  await publishPlayer(profile, extra);
  return false;
}

/* ---- 管理画面から ---- */

export async function readPlayers() {
  const res = await withTimeout(fetch(`${DB_URL}/players.json`), TIMEOUT_MS);
  if (res.status === 401)
    throw new Error(
      "players は読めません。Firebase のルールに players を足して公開してください。",
    );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Object.entries(data || {}).map(([id, row]) => ({ id, ...row }));
}

export async function deletePlayer(id) {
  const res = await withTimeout(
    fetch(url(id), { method: "DELETE" }),
    TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function setBanned(id, banned) {
  const res = await withTimeout(
    fetch(url(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        banned: !!banned,
        bannedAt: banned ? Date.now() : null,
      }),
    }),
    TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
