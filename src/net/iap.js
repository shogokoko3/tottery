/**
 * アプリ内課金(iOS の StoreKit 2)。
 *
 * 流れ: 商品の一覧と値段は StoreKit から取る → 買う → 返ってきた署名つきの取引(JWS)を
 * Worker に送り、検証と財布への反映をサーバーで行う → 通った残高を端末の写しへ。
 * サーバーに届く前にアプリが落ちても、取引の署名は端末に控えてあり、次に開いたとき
 * 送り直す(サーバーは取引 ID で冪等なので二重にならない)。
 * Web では何もしない(課金は iOS だけ)。
 */
import { Capacitor } from "@capacitor/core";
import { ensureAuth } from "./auth.js";
import { seasonApiBase } from "./season.js";
import { updateCollection } from "../skins/store.js";
import { PRODUCTS, PRODUCT_IDS, SHOP_ENABLED, productOf } from "../iap/catalog.js";

const PENDING_KEY = "tottery.iap.pending.v1";
let plugin = null;

async function store() {
  if (plugin) return plugin;
  if (!Capacitor.isNativePlatform()) return null;
  const m = await import("@capgo/native-purchases");
  plugin = m.NativePurchases;
  return plugin;
}

/** 店を出せるか(iOS で、旗が立っていて、StoreKit が使える) */
export async function shopAvailable() {
  if (!SHOP_ENABLED) return false;
  const p = await store();
  if (!p) return false;
  try { return !!(await p.isBillingSupported()).isBillingSupported; } catch { return false; }
}

/** 商品の一覧(表示価格は StoreKit のもの) */
export async function loadProducts() {
  const p = await store();
  if (!p) return [];
  const { products } = await p.getProducts({ productIdentifiers: PRODUCT_IDS, productType: "inapp" });
  return PRODUCTS.map((c) => {
    const s = products.find((x) => x.identifier === c.id);
    return s ? { ...c, price: s.priceString, title: s.title || c.name } : null;
  }).filter(Boolean);
}

function readPending() {
  try { const v = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function writePending(list) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch { /* 次回 getPurchases で拾える */ }
}

async function verifyOnServer(jws) {
  const auth = await ensureAuth();
  if (!auth) throw new Error("通信を確認して、もう一度お試しください。");
  const res = await fetch(`${seasonApiBase()}/api/iap/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.idToken}` },
    body: JSON.stringify({ jws }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || "購入を確認できませんでした。"); e.status = res.status; throw e; }
  await updateCollection((s) => {
    const next = {
      ...s,
      tickets: Number.isSafeInteger(data.tickets) ? data.tickets : s.tickets,
      gems: Number.isSafeInteger(data.gems) ? data.gems : s.gems || 0,
      gemsPaid: Number.isSafeInteger(data.gemsPaid) ? data.gemsPaid : s.gemsPaid || 0,
      gemsFree: Number.isSafeInteger(data.gemsFree) ? data.gemsFree : s.gemsFree || 0,
      entitlements: Array.isArray(data.entitlements) ? data.entitlements : s.entitlements || [],
    };
    // 初課金特典のスキン(サーバーが初回と判定したときだけ・一度きり)。2倍ジェムはサーバーで反映済み
    if (data.firstPurchase && data.firstSkin && !(next.owned || {})[data.firstSkin])
      next.owned = { ...(next.owned || {}), [data.firstSkin]: 1 };
    return next;
  });
  return data;
}

/**
 * 控えてある取引を送り直す。通ったものと、二度と通らないもの(400)は控えから消す。
 * 初課金特典が確定したら、その情報を返す(呼ぶ側が知らせに使う)
 */
export async function flushPurchases() {
  let list = readPending();
  let firstPurchase = null;
  for (const ev of [...list]) {
    try {
      const data = await verifyOnServer(ev.jws);
      if (data && data.firstPurchase) firstPurchase = { skin: data.firstSkin || null };
      list = list.filter((x) => x.jws !== ev.jws); writePending(list);
    } catch (e) {
      if (e.status === 400) { list = list.filter((x) => x.jws !== ev.jws); writePending(list); }
      else break;
    }
  }
  return { firstPurchase };
}

/** 買う。ユーザーが取り消したら null。通れば財布の反映結果 */
export async function buy(productId) {
  const p = await store();
  if (!p) throw new Error("この端末では購入できません。");
  const c = productOf(productId);
  if (!c) throw new Error("知らない商品です。");
  let tx;
  try {
    tx = await p.purchaseProduct({ productIdentifier: productId, productType: "inapp", isConsumable: c.kind !== "entitlement" });
  } catch (e) {
    if (/cancel/i.test(String(e && e.message))) return null;
    throw new Error("購入を完了できませんでした。");
  }
  if (!tx || !tx.jwsRepresentation) throw new Error("購入の記録を受け取れませんでした。");
  // 先に控えてから送る。送る途中で落ちても、次に開いたとき送り直せる
  writePending([...readPending(), { jws: tx.jwsRepresentation, at: Date.now() }]);
  const { firstPurchase } = await flushPurchases();
  return readPending().some((x) => x.jws === tx.jwsRepresentation)
    ? { pending: true, firstPurchase }
    : { pending: false, firstPurchase };
}

/** 購入を復元する(買い切りの権利。機種変更や再インストールのあと) */
export async function restore() {
  const p = await store();
  if (!p) return { restored: 0 };
  try { await p.restorePurchases(); } catch { /* 復元に失敗しても getPurchases で拾えることがある */ }
  const { purchases } = await p.getPurchases({ productType: "inapp" });
  let n = 0;
  for (const tx of purchases || []) {
    if (!tx.jwsRepresentation) continue;
    try { await verifyOnServer(tx.jwsRepresentation); n++; } catch { /* 二重や返金は無視 */ }
  }
  return { restored: n };
}
