/**
 * 機種変更の引き継ぎ(2026-09-17、本人の指示)。
 *
 * 端末の記録(プロフィールと持ち物)を JSON 1本にまとめ、Apple で本人確認した口座の
 * uid ごとに Worker へ預ける。新しい端末で同じ Apple ID でサインインすると、
 * その控えを受け取って端末に書き戻す。
 *
 * 決まり:
 *  - 預けるのは **本人確認済み(Apple)** のときだけ。匿名の口座は端末が変わると辿れないので意味がない
 *  - 残高(ジェム・チケット)と買い切りの権利の**正はサーバーの台帳**。控えから戻したあとに
 *    syncWallet() で上書きするので、控えを書き換えても増えない
 *  - サーバーは中身を見ない(大きさだけ見る)。端末の申告なので、持ち点やスキンは
 *    元からこのゲームの作りと同じ「端末の申告」の域を出ない
 */
import { ensureAuth, isVerified } from "./auth.js";
import { seasonApiBase } from "./season.js";
import { loadProfile, restoreProfile } from "../game/profile.js";
import { getCollection, updateCollection } from "../skins/store.js";
import { syncWallet } from "./wallet.js";

/** 控えの大きさの上限(文字数)。src/server/wallet.js の BACKUP_MAX と同じ値にする */
export const BACKUP_MAX = 40000;
/** 控えの版。中身の作りを変えたら上げる(古い控えは読まない) */
export const BACKUP_VERSION = 1;
const LAST_KEY = "tottery.backup.last.v1";
/** 預け直しの間隔。押すたびに送らない */
export const BACKUP_INTERVAL_MS = 60000;

async function request(op, body = {}) {
  const auth = await ensureAuth();
  if (!auth) throw new Error("通信を確認して、もう一度お試しください。");
  let res;
  try {
    res = await fetch(`${seasonApiBase()}/api/wallet/${op}`, {
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
    throw new Error("引き継ぎの控えを読めませんでした。");
  }
  if (!res.ok) throw new Error(data.error || "引き継ぎの控えを読めませんでした。");
  return data;
}

/** いまの端末の記録を1本の文字列に。大きすぎれば null */
export function exportLocalData() {
  const blob = JSON.stringify({
    v: BACKUP_VERSION,
    at: Date.now(),
    profile: loadProfile(),
    collection: getCollection(),
  });
  return blob.length <= BACKUP_MAX ? blob : null;
}

/** 受け取った控えを端末に書き戻す。戻せたら true */
export async function importLocalData(blob, uid) {
  let data;
  try {
    data = JSON.parse(blob);
  } catch {
    return false;
  }
  if (!data || data.v !== BACKUP_VERSION || !data.profile) return false;
  restoreProfile(data.profile, uid);
  if (data.collection && typeof data.collection === "object")
    await updateCollection(() => data.collection);
  return true;
}

/** いま預けてあるか(最後に預けた時刻)。無ければ at は null */
export async function backupStatus() {
  const { blob, at } = await request("backup-load");
  return { has: typeof blob === "string" && blob.length > 0, at: at || null };
}

/** いまの記録を預ける。本人確認していなければ何もしない */
export async function backupNow() {
  if (!isVerified()) return { ok: false, reason: "unverified" };
  const blob = exportLocalData();
  if (!blob) return { ok: false, reason: "too-big" };
  await request("backup-save", { blob });
  try {
    localStorage.setItem(LAST_KEY, String(Date.now()));
  } catch {
    /* 控えは預けられたので、次に多めに送るだけ */
  }
  return { ok: true };
}

/** 前に預けてから間が空いていれば預け直す。失敗しても黙って進む(遊びは止めない) */
export async function backupIfDue() {
  if (!isVerified()) return false;
  let last = 0;
  try {
    last = Number(localStorage.getItem(LAST_KEY)) || 0;
  } catch {
    last = 0;
  }
  if (Date.now() - last < BACKUP_INTERVAL_MS) return false;
  try {
    await backupNow();
    return true;
  } catch {
    return false;
  }
}

/**
 * 預けた控えをこの端末に戻す。
 * 戻したあとに財布を取り直して、残高と権利をサーバーの台帳に合わせる。
 *   { restored: true }  … 戻した(呼んだ側が画面を読み込み直す)
 *   { restored: false } … 控えが無い(この口座では初めて)
 */
export async function restoreFromServer() {
  const auth = await ensureAuth();
  const { blob } = await request("backup-load");
  if (typeof blob !== "string" || !blob) return { restored: false };
  const ok = await importLocalData(blob, auth && auth.uid);
  if (!ok) return { restored: false, broken: true };
  try {
    await syncWallet();
  } catch {
    /* 残高は次に店を開いたときに取り直される */
  }
  return { restored: true };
}
