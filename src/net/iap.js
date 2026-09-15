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
import { APP_BUILD } from "./app-version.js";

/** 画面に出すビルド番号(Web は "(Web)") */
export const APP_BUILD_LABEL = APP_BUILD ? String(APP_BUILD) : "(Web)";
export { APP_BUILD };
import { updateCollection } from "../skins/store.js";
import {
  PRODUCTS,
  PRODUCT_IDS,
  SHOP_ENABLED,
  productOf,
} from "../iap/catalog.js";

const PENDING_KEY = "tottery.iap.pending.v1";
let plugin = null;

/**
 * 使うメソッドだけを持つ薄い包み。
 * Capacitor のプラグインは Proxy で、どんな名前でもメソッドを返す(`then` も)。async 関数から
 * そのまま return / await すると thenable と見なされて `then()` がネイティブ呼び出しになり、
 * 永遠に戻らない(2026-09-15 に踏んだ。店が「読み込んでいます…」から進まなかった原因。
 * 12秒の打ち切りより前で止まっていたので打ち切りも効かなかった)。
 * 包みには then が無いので、そのまま返してよい
 */
const METHODS = [
  "getProducts",
  "getStorefront",
  "purchaseProduct",
  "restorePurchases",
  "getPurchases",
];
function wrap(proxy) {
  const o = {};
  for (const m of METHODS) o[m] = (options) => proxy[m](options);
  return o;
}

async function store() {
  if (plugin) return plugin;
  if (!Capacitor.isNativePlatform()) return null;
  const m = await import("@capgo/native-purchases");
  plugin = wrap(m.NativePurchases);
  return plugin;
}

/**
 * 店の入口を出すか。iOS ネイティブで旗が立っていれば出す。
 * 以前は StoreKit の isBillingSupported() も見ていたが、有料App契約の反映直後などに
 * false/不安定になり、入口(「ジェムを買う」)が丸ごと消えてしまった。入口の判定は
 * 確実な「iOSネイティブか」だけにして、実際に買えない・商品が無いときは店の中で
 * 「商品を取れませんでした」やエラーで知らせる(loadProducts / buy が扱う)。
 */
export async function shopAvailable() {
  return SHOP_ENABLED && Capacitor.isNativePlatform();
}

/** StoreKit の応答をいつまで待つか。商品が未整備・圏外だと返ってこないことがあり、画面が「読み込み中」で止まる */
export const PRODUCTS_TIMEOUT_MS = 12000;
function withTimeout(promise, ms, why) {
  return Promise.race([
    promise,
    new Promise((_r, reject) => setTimeout(() => reject(new Error(why)), ms)),
  ]);
}

// いまどこまで進んだか(店の読み込み中の行と診断に出す)。console にも残す(Xcode で読める)
let loadStage = "未着手";
export const currentLoadStage = () => loadStage;
function stage(s) {
  loadStage = s;
  try {
    console.log(`[iap] ${s}`);
  } catch {
    /* 無視 */
  }
}

/**
 * 店の切り分け用の情報。商品が並ばないとき、画面の下に小さく出す(本人がスクリーンショットで
 * 知らせてくれる。2026-09-15)。ビルド番号・App Store のストアの国・商品の問い合わせにかかった秒数。
 * ストアの国が取れて商品が 0 件なら App Store Connect 側(反映待ち・契約)、国も取れなければ端末側。
 */
export async function storeDiagnostics(elapsedMs = null) {
  const out = { build: APP_BUILD, storefront: "", elapsedMs };
  try {
    const p = await store();
    if (!p) return out;
    const r = await withTimeout(p.getStorefront(), 6000, "storefront timeout");
    out.storefront = (r && r.countryCode) || "(不明)";
  } catch {
    out.storefront = "(取れない)";
  }
  return out;
}

/**
 * 店の診断をサーバーに控える(本人の端末の結果を、運営が /api/admin/diag で読むため)。
 * 失敗しても何もしない。Web では送らない
 */
export async function reportDiag(d) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const auth = await ensureAuth();
    if (!auth) return;
    await fetch(`${seasonApiBase()}/api/iap/diag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.idToken}`,
      },
      body: JSON.stringify({ diag: d }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* 診断は送れなくてよい */
  }
}

/** 商品の一覧(表示価格は StoreKit のもの)。時間切れ・失敗は投げる(呼ぶ側が知らせる) */
export async function loadProducts() {
  stage("プラグイン読み込み");
  const p = await store();
  if (!p) return [];
  stage("商品の問い合わせ");
  const started = Date.now();
  let products;
  try {
    ({ products } = await withTimeout(
      p.getProducts({ productIdentifiers: PRODUCT_IDS, productType: "inapp" }),
      PRODUCTS_TIMEOUT_MS,
      "App Store から商品の一覧が返ってきませんでした。",
    ));
  } catch (e) {
    stage("問い合わせに失敗");
    if (e) e.elapsedMs = Date.now() - started;
    throw e;
  }
  stage(`応答あり(${products.length}件)`);
  const found = PRODUCTS.map((c) => {
    const s = products.find((x) => x.identifier === c.id);
    return s ? { ...c, price: s.priceString, title: s.title || c.name } : null;
  }).filter(Boolean);
  // 1つも返らないのは、App Store Connect 側の商品がまだ配信に乗っていない(提出準備完了の直後など)か、
  // 商品 ID の不一致。件数を文言に入れて、切り分けの手がかりにする
  if (!found.length) {
    const e = new Error(
      `App Store が商品を返しませんでした(${products.length}件受信、対象 ${PRODUCT_IDS.length}件)。商品の反映待ちの可能性があります。`,
    );
    e.elapsedMs = Date.now() - started;
    throw e;
  }
  return found;
}

function readPending() {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writePending(list) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* 次回 getPurchases で拾える */
  }
}

async function verifyOnServer(jws) {
  const auth = await ensureAuth();
  if (!auth) throw new Error("通信を確認して、もう一度お試しください。");
  const res = await fetch(`${seasonApiBase()}/api/iap/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.idToken}`,
    },
    body: JSON.stringify({ jws }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || "購入を確認できませんでした。");
    e.status = res.status;
    throw e;
  }
  await updateCollection((s) => {
    const next = {
      ...s,
      tickets: Number.isSafeInteger(data.tickets) ? data.tickets : s.tickets,
      gems: Number.isSafeInteger(data.gems) ? data.gems : s.gems || 0,
      gemsPaid: Number.isSafeInteger(data.gemsPaid)
        ? data.gemsPaid
        : s.gemsPaid || 0,
      gemsFree: Number.isSafeInteger(data.gemsFree)
        ? data.gemsFree
        : s.gemsFree || 0,
      entitlements: Array.isArray(data.entitlements)
        ? data.entitlements
        : s.entitlements || [],
    };
    // 初課金特典のスキン(サーバーが初回と判定したときだけ・一度きり)。2倍ジェムはサーバーで反映済み
    if (
      data.firstPurchase &&
      data.firstSkin &&
      !(next.owned || {})[data.firstSkin]
    )
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
  let lastError = "";
  for (const ev of [...list]) {
    try {
      const data = await verifyOnServer(ev.jws);
      if (data && data.firstPurchase)
        firstPurchase = { skin: data.firstSkin || null };
      list = list.filter((x) => x.jws !== ev.jws);
      writePending(list);
    } catch (e) {
      if (e.status === 400) {
        list = list.filter((x) => x.jws !== ev.jws);
        writePending(list);
      } else {
        // 理由を控えに残す(店の知らせと診断に出す。2026-09-15 の 413 のような切り分けのため)
        lastError = `${e.status ? `${e.status} ` : ""}${(e && e.message) || ""}`;
        list = list.map((x) =>
          x.jws === ev.jws ? { ...x, err: lastError } : x,
        );
        writePending(list);
        break;
      }
    }
  }
  return { firstPurchase, lastError };
}

/** 買う。ユーザーが取り消したら null。通れば財布の反映結果 */
export async function buy(productId) {
  const p = await store();
  if (!p) throw new Error("この端末では購入できません。");
  const c = productOf(productId);
  if (!c) throw new Error("知らない商品です。");
  let tx;
  try {
    tx = await p.purchaseProduct({
      productIdentifier: productId,
      productType: "inapp",
      isConsumable: c.kind !== "entitlement",
    });
  } catch (e) {
    if (/cancel/i.test(String(e && e.message))) return null;
    throw new Error("購入を完了できませんでした。");
  }
  if (!tx || !tx.jwsRepresentation)
    throw new Error("購入の記録を受け取れませんでした。");
  // 先に控えてから送る。送る途中で落ちても、次に開いたとき送り直せる
  writePending([
    ...readPending(),
    { jws: tx.jwsRepresentation, at: Date.now() },
  ]);
  const { firstPurchase, lastError } = await flushPurchases();
  return readPending().some((x) => x.jws === tx.jwsRepresentation)
    ? { pending: true, firstPurchase, reason: lastError }
    : { pending: false, firstPurchase };
}

/** 購入を復元する(買い切りの権利。機種変更や再インストールのあと) */
export async function restore() {
  const p = await store();
  if (!p) return { restored: 0 };
  try {
    await p.restorePurchases();
  } catch {
    /* 復元に失敗しても getPurchases で拾えることがある */
  }
  const { purchases } = await p.getPurchases({ productType: "inapp" });
  let n = 0;
  for (const tx of purchases || []) {
    if (!tx.jwsRepresentation) continue;
    try {
      await verifyOnServer(tx.jwsRepresentation);
      n++;
    } catch {
      /* 二重や返金は無視 */
    }
  }
  return { restored: n };
}
