/**
 * サーバー側の財布(チケット残高・買い切りの権利)とやり取りする。
 *
 * 残高の正はサーバー(Worker の台帳)。端末の collection.tickets は「最後に
 * 見た残高」の写しで、画面はそれを出す。
 *  - ガチャ: 先にサーバーで減らし、通ったら端末で引く(引くときは端末の枚数を減らさない)
 *  - 遊んで貯める分: 出来事 id(決まった形)で加算を頼む。圏外なら溜めて、次に通じたとき送る。
 *    同じ id は二度効かないので、やり直しで二重にならない
 *  - 引き継ぎ: 端末にあった枚数を一度だけ送る(サーバー側でも uid ごとに一度きり・上限つき)
 * 通信の口は season.js と同じ(Worker、Firebase の合言葉つき)。
 */
import { ensureAuth } from "./auth.js";
import { seasonApiBase } from "./season.js";
import { updateCollection, getCollection } from "../skins/store.js";

/** チケットをサーバーの財布で持つか。false なら今まで通り端末だけ */
export const WALLET_SERVER = true;
const PENDING_KEY = "tottery.wallet.pending.v1";
const MIGRATED_KEY = "tottery.wallet.migrated.v1";

async function walletRequest(op, body = {}) {
  const auth = await ensureAuth();
  if (!auth) throw new Error("通信を確認して、もう一度お試しください。");
  let res;
  try {
    res = await fetch(`${seasonApiBase()}/api/wallet/${op}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.idToken}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("通信を確認して、もう一度お試しください。");
  }
  let data;
  try { data = await res.json(); } catch { throw new Error("財布を読み込めませんでした。"); }
  if (!res.ok) throw new Error(data.error || "財布を読み込めませんでした。");
  return data;
}

/** サーバーの残高・権利を端末の写しへ */
async function mirror(data) {
  if (!Number.isSafeInteger(data.tickets)) return data;
  await updateCollection((s) => ({
    ...s,
    tickets: data.tickets,
    gems: Number.isSafeInteger(data.gems) ? data.gems : s.gems || 0,
    gemsPaid: Number.isSafeInteger(data.gemsPaid) ? data.gemsPaid : s.gemsPaid || 0,
    gemsFree: Number.isSafeInteger(data.gemsFree) ? data.gemsFree : s.gemsFree || 0,
    entitlements: Array.isArray(data.entitlements) ? data.entitlements : s.entitlements || [],
  }));
  return data;
}

function readPending() {
  try { const v = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function writePending(list) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch { /* 保存できなくても次で拾う */ }
}

/** 溜めていた加算を送る。送れた分だけ消す */
export async function flushPending() {
  let list = readPending();
  for (const ev of [...list]) {
    try {
      // チケットは earn、無償ジェムは earn-gems、バトルパスのマス報酬は pass-reward
      await mirror(
        ev.pass
          ? await walletRequest("pass-reward", { id: ev.id })
          : ev.gems
            ? await walletRequest("earn-gems", { id: ev.id, gems: ev.gems })
            : await walletRequest("earn", { id: ev.id, n: ev.n }),
      );
      list = list.filter((x) => x.id !== ev.id);
      writePending(list);
    } catch (e) {
      // 上限・形の誤り・パスの週上限や未所持で拒まれたものは捨てる(残しても二度と通らない)。通信の失敗は残す
      if (/これ以上|正しくありません|他の人|上限|持っていません/.test(e.message)) { list = list.filter((x) => x.id !== ev.id); writePending(list); }
      else break;
    }
  }
}

/** 残高を取り直す(溜めていた加算も先に送る) */
export async function syncWallet() {
  if (!WALLET_SERVER) return getCollection();
  await flushPending().catch(() => {});
  return mirror(await walletRequest("summary"));
}

/**
 * 遊んで貯める分を財布へ。id は「何で」「いつ」で決まる形にする
 * (例: login:2026-09-12, mission:daily-1:2026-09-12)。同じ id は二度効かない
 */
export async function earnTickets(id, n) {
  if (!WALLET_SERVER || !Number.isSafeInteger(n) || n <= 0) return;
  const list = readPending();
  if (!list.some((x) => x.id === id)) writePending([...list, { id, n, at: Date.now() }]);
  await flushPending().catch(() => {});
}

/**
 * バトルパスのマスをクリアした報酬(チケット1枚)。所持者だけ・週72枚まで(サーバーが数える)。
 * id は「周と マス」で決まる形(bp:pass:<周>:<マスid>)。同じ id は二度効かない。圏外なら控えて後で送る
 */
export async function earnPassTicket(id) {
  if (!WALLET_SERVER) return;
  const list = readPending();
  if (!list.some((x) => x.id === id)) writePending([...list, { id, pass: true, at: Date.now() }]);
  await flushPending().catch(() => {});
}

/** ガチャの前に減らす。通れば新しい残高、足りなければ投げる */
export async function debitTickets(id, n) {
  return mirror(await walletRequest("debit", { id, n }));
}

/**
 * 無償ジェムを財布へ(ミッション・手紙・バトルパスの完成など)。id は「何で」「いつ」で
 * 決まる形にする。同じ id は二度効かない。圏外なら控えて後で送る
 */
export async function earnGems(id, n) {
  if (!WALLET_SERVER || !Number.isSafeInteger(n) || n <= 0) return;
  const list = readPending();
  if (!list.some((x) => x.id === id)) writePending([...list, { id, gems: n, at: Date.now() }]);
  await flushPending().catch(() => {});
}

/** ジェムでチケットを買う(両替)。通れば新しい残高、足りなければ投げる */
export async function exchangeGems(id, tickets) {
  return mirror(await walletRequest("exchange", { id, tickets }));
}

/** ジェムでバトルパス(買い切りの権利)を買う。足りなければ投げる */
export async function buyPassWithGems(id) {
  return mirror(await walletRequest("buy-pass", { id }));
}

/** 端末にあった枚数を一度だけ引き継ぐ */
export async function migrateOnce() {
  if (!WALLET_SERVER) return null;
  try { if (localStorage.getItem(MIGRATED_KEY)) return null; } catch { /* 読めなければ送って、サーバー側の一度きりに任せる */ }
  const local = getCollection().tickets || 0;
  const data = await walletRequest("migrate", { tickets: local });
  try { localStorage.setItem(MIGRATED_KEY, "1"); } catch { /* 次回はサーバーが弾く */ }
  return mirror(data);
}

/** 出来事の id を作る(ガチャ1回ごとなど、決まった形が無いもの) */
export const newEventId = (kind) =>
  `${kind}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
