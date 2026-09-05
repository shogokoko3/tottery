/**
 * オンライン対戦の通信層。
 * Firebase Realtime Database を REST で直接読み書きしている（SDKは載せていない）。
 * どの呼び出しも 8 秒でタイムアウトし、例外ではなく {ok, error} を返す。
 */

import { authedFetch } from "./auth.js";

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

export const readRoom = (code) => getJson(roomUrl(code));
export const writeRoom = (code, data) => sendJson(roomUrl(code), "PUT", data);
export const deleteRoom = (code) => remove(roomUrl(code));

/** 手番を1件追記する。キーの昇順がそのまま再生順になる */
export const pushAct = (code, act) => sendJson(actsUrl(code), "POST", act);

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
