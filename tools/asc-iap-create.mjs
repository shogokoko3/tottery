/**
 * App Store Connect API で、ジェムのパック(消耗型)を1つ作る。
 *
 *   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_PATH=…/AuthKey_XXXX.p8 \
 *   node tools/asc-iap-create.mjs <円> [--dry-run]
 *
 * 作るもの: 商品(CONSUMABLE、productId は catalog の GEM_PACKS から)、日本語の表示名・説明、
 * 価格(基準地域 JPN で <円> の価格帯)、販売地域(すべて、新しい地域も)。
 * 審査用スクリーンショットは tools/asc-iap-screenshots.mjs で入れる。
 * 既に同じ productId があれば作らず、足りない設定だけ足す。Node 22 で動かす。
 */
import fs from "node:fs";
import crypto from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;
import { SignJWT, importPKCS8 } from "jose";
import { GEM_PACKS } from "../src/iap/catalog.js";
import { APP_STORE_ID } from "../src/server/app-version.js";

const yen = Number(process.argv.find((a, i) => i >= 2 && /^\d+$/.test(a)));
const dryRun = process.argv.includes("--dry-run");
const pack = GEM_PACKS.find((p) => p.paid === yen);
if (!pack) throw new Error(`catalog に ${yen} 円のパックが無い`);
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH) throw new Error("ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH を環境変数で");
const key = await importPKCS8(fs.readFileSync(ASC_KEY_PATH, "utf8"), "ES256");
const token = () => new SignJWT({ aud: "appstoreconnect-v1" }).setProtectedHeader({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" }).setIssuer(ASC_ISSUER_ID).setIssuedAt().setExpirationTime("15m").sign(key);
const BASE = "https://api.appstoreconnect.apple.com";
async function api(method, url, body) {
  const res = await fetch(url.startsWith("http") ? url : `${BASE}${url}`, {
    method, headers: { Authorization: `Bearer ${await token()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data).slice(0, 600)}`);
  return data;
}

// 1) 商品
const list = await api("GET", `/v1/apps/${APP_STORE_ID}/inAppPurchasesV2?limit=200&fields[inAppPurchases]=productId,state`);
let iap = list.data.find((d) => d.attributes.productId === pack.id);
if (iap) console.log(`= ${pack.id} は既にある(${iap.attributes.state})`);
else if (dryRun) { console.log(`~ ${pack.id} を作る(dry-run)`); process.exit(0); }
else {
  const created = await api("POST", "/v2/inAppPurchases", {
    data: {
      type: "inAppPurchases",
      attributes: { name: pack.name, productId: pack.id, inAppPurchaseType: "CONSUMABLE", reviewNote: "ゲーム内通貨「ジェム」のパック。1ジェム=1円。ガチャチケットやスキンの購入に使う。" },
      relationships: { app: { data: { type: "apps", id: APP_STORE_ID } } },
    },
  });
  iap = created.data;
  console.log(`+ 商品を作った: ${pack.id} (${iap.id})`);
}
const V2 = `${BASE}/v2/inAppPurchases/${iap.id}`;

// 2) 日本語の表示名・説明
const locs = await api("GET", `${V2}/inAppPurchaseLocalizations`);
if (!locs.data.some((l) => l.attributes.locale === "ja")) {
  if (!dryRun) await api("POST", "/v1/inAppPurchaseLocalizations", {
    data: { type: "inAppPurchaseLocalizations", attributes: { locale: "ja", name: pack.name, description: `ジェム ${pack.paid} 個${pack.free ? `＋おまけ ${pack.free} 個` : ""}。ガチャチケットやスキンに使えます。` },
      relationships: { inAppPurchaseV2: { data: { type: "inAppPurchases", id: iap.id } } } },
  });
  console.log("+ ja の表示名・説明");
} else console.log("= ja の表示名はある");

// 3) 価格: JPN の価格帯から <円> を探す
const sched = await api("GET", `${V2}/iapPriceSchedule?include=manualPrices`).catch(() => null);
if (sched && sched.data) console.log("= 価格表はある");
else {
  let points = [], next = `${V2}/pricePoints?filter[territory]=JPN&limit=200&fields[inAppPurchasePricePoints]=customerPrice,proceeds`;
  while (next) { const r = await api("GET", next); points.push(...r.data); next = r.links?.next || null; }
  const pt = points.find((p) => Number(p.attributes.customerPrice) === yen);
  if (!pt) throw new Error(`JPN に ${yen} 円の価格帯が無い(候補: ${points.slice(0, 12).map((p) => p.attributes.customerPrice).join(",")}…)`);
  if (!dryRun) await api("POST", "/v1/inAppPurchasePriceSchedules", {
    data: {
      type: "inAppPurchasePriceSchedules",
      relationships: {
        inAppPurchase: { data: { type: "inAppPurchases", id: iap.id } },
        baseTerritory: { data: { type: "territories", id: "JPN" } },
        manualPrices: { data: [{ type: "inAppPurchasePrices", id: "${price1}" }] },
      },
    },
    included: [{ type: "inAppPurchasePrices", id: "${price1}", attributes: { startDate: null },
      relationships: { inAppPurchasePricePoint: { data: { type: "inAppPurchasePricePoints", id: pt.id } } } }],
  });
  console.log(`+ 価格 ¥${yen}(基準 JPN)`);
}

// 4) 販売地域: すべて
const avail = await api("GET", `${V2}/inAppPurchaseAvailability`).catch(() => null);
if (avail && avail.data) console.log("= 販売地域はある");
else {
  let terr = [], next = `/v1/territories?limit=200`;
  while (next) { const r = await api("GET", next); terr.push(...r.data.map((t) => t.id)); next = r.links?.next || null; }
  if (!dryRun) await api("POST", "/v1/inAppPurchaseAvailabilities", {
    data: { type: "inAppPurchaseAvailabilities", attributes: { availableInNewTerritories: true },
      relationships: { inAppPurchase: { data: { type: "inAppPurchases", id: iap.id } }, availableTerritories: { data: terr.map((id) => ({ type: "territories", id })) } } },
  });
  console.log(`+ 販売地域 ${terr.length}`);
}
const after = await api("GET", `${V2}?fields[inAppPurchases]=productId,state`);
console.log(`状態: ${after.data.attributes.productId} ${after.data.attributes.state}(スクリーンショットは tools/asc-iap-screenshots.mjs で)`);
