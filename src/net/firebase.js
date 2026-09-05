/**
 * オンライン対戦の通信層。
 * Firebase Realtime Database を REST で直接読み書きしている（SDKは載せていない）。
 * どの呼び出しも 8 秒でタイムアウトし、例外ではなく {ok, error} を返す。
 */

import { authedFetch, ensureAuth, myUid } from "./auth.js";

export const DB_URL =
  "https://tottery-66e0f-default-rtdb.asia-southeast1.firebasedatabase.app";
const TIMEOUT_MS = 8000;

/** ロビーの掲載が有効な時間 */
export const LOBBY_TTL = 180 * 1000;

/** 紛らわしい文字(0/O, 1/I)を除いた4桁の合言葉 */
export function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function makeClientId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const roomUrl = (code) => `${DB_URL}/rooms/${code}.json`;
const actsUrl = (code) => `${DB_URL}/rooms/${code}/acts.json`;
const lobbyUrl = (path = "") => `${DB_URL}/lobby${path}.json`;

function errorText(err) {
  if (err && err.__timeout) {
    return "通信が8秒以内に応答しませんでした(タイムアウト)。通信状況を確認し、もう一度お試しください。";
  }
  return `通信に失敗しました: ${(err && (err.message || err.toString())) || "不明なエラー"}`;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) =>
      setTimeout(() => {
        const err = new Error("timeout");
        err.__timeout = true;
        reject(err);
      }, ms),
    ),
  ]);
}

async function getJson(url) {
  try {
    const res = await withTimeout(authedFetch(url), TIMEOUT_MS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, data: await res.json(), error: null };
  } catch (err) {
    return { ok: false, data: null, error: errorText(err) };
  }
}

async function sendJson(url, method, body) {
  try {
    const res = await withTimeout(
      authedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

async function remove(url) {
  try {
    await withTimeout(authedFetch(url, { method: "DELETE" }), TIMEOUT_MS);
  } catch {
    /* 後始末なので失敗しても進める */
  }
}

/* ---------------------------- ルーム ---------------------------- */

const memberUrl = (code, uid) => `${DB_URL}/rooms/${code}/members/${uid}.json`;

/** サインインが通っていれば uid。通らなければ null */
async function whoAmI() {
  const a = await ensureAuth();
  return (a && a.uid) || myUid();
}

export const readRoom = (code) => getJson(roomUrl(code));

/**
 * 部屋を新しく作る。
 *
 * 部屋は席についた二人だけのものにしてある(ルール側で閉じている)ので、
 * 作るときに自分を席へ入れておく。createdAt は、放置された部屋を
 * あとから誰かが片付けられるようにするための日付。
 */
export async function createRoom(code, data) {
  const uid = await whoAmI();
  if (!uid) return { ok: false, error: "サインインできていません" };
  const base = data && typeof data === "object" ? data : {};
  return sendJson(roomUrl(code), "PUT", {
    ...base,
    members: { ...(base.members || {}), [uid]: true },
    createdAt: Number(base.createdAt) || Date.now(),
  });
}

/**
 * 出来ている部屋に、自分の名乗り(名前・アイコン・持ち点など)を書き足す。
 *
 * 丸ごと置き直さない。置き直すと、それまでに積んだ手番の列を
 * 消してしまううえ、ルール側でも中身の丸ごと上書きは断っている。
 */
export const updateRoom = (code, patch) =>
  sendJson(roomUrl(code), "PATCH", patch);

/**
 * 空いている席に座る。
 *
 * 部屋の中身は席についてからでないと読めないので、参加する側は
 * まずこれを呼ぶ。席が埋まっていたり、その合言葉の部屋が無ければ
 * サーバーが断る。断られたことが「満室 or 見つからない」の合図になる。
 */
export async function joinRoom(code) {
  const uid = await whoAmI();
  if (!uid) return { ok: false, error: "サインインできていません" };
  return sendJson(memberUrl(code, uid), "PUT", true);
}

/** 座った席を空ける(参加をやめたとき) */
export async function leaveRoom(code) {
  const uid = await whoAmI();
  if (uid) await remove(memberUrl(code, uid));
}

export const deleteRoom = (code) => remove(roomUrl(code));

/**
 * 手番を1件追記する。キーの昇順がそのまま再生順になる。
 * by には自分の uid を入れる。ルールがここを見て、他人になりすました
 * 手を弾く。
 */
export async function pushAct(code, act) {
  const uid = await whoAmI();
  return sendJson(actsUrl(code), "POST", uid ? { ...act, by: uid } : act);
}

/** 追記された手番を古い順に読み出す */
export async function readActs(code) {
  try {
    const res = await withTimeout(authedFetch(actsUrl(code)), TIMEOUT_MS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data) return { ok: true, list: [], error: null };
    return {
      ok: true,
      list: Object.keys(data)
        .sort()
        .map((k) => data[k]),
      error: null,
    };
  } catch (err) {
    return { ok: false, list: [], error: errorText(err) };
  }
}

/* ---------------------------- ロビー(ランダムマッチ) ---------------------------- */

export const readLobby = () => getJson(lobbyUrl());
export const readLobbyPath = (path) => getJson(lobbyUrl(path));
export const writeLobby = (path, data) => sendJson(lobbyUrl(path), "PUT", data);
export const deleteLobbyPath = (path) => remove(lobbyUrl(path));
