/**
 * App Store Connect API で、アプリ内課金(ジェムのパック)の審査用スクリーンショットを登録する。
 *
 *   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_PATH=…/AuthKey_XXXX.p8 \
 *   node tools/asc-iap-screenshots.mjs <画像のフォルダ> [--dry-run] [--force]
 *   node tools/asc-iap-screenshots.mjs --status        (状態を見るだけ)
 *
 * Node 22 で動かす(.node-version)。画像は iPhone の画面サイズ(1242×2208 など)でないと
 * IMAGE_INCORRECT_DIMENSIONS で弾かれる(1024×1024 の正方形は不可。2026-09-14 に踏んだ)。
 *
 * 画像のフォルダには gem-pack-<円>.png(例 gem-pack-0120.png / gem-pack-120.png)を置く。
 * 商品 ID(com.shogokoko.tottery.gems.<円>)の円の部分で対応づける。
 * すでにスクリーンショットがある商品は飛ばす(--force で消して入れ直す)。
 * 鍵(.p8)はこの Mac の外に出さない。トークンは20分で切れる短いもの。
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
// 古い node では WebCrypto がグローバルに無い(jose が要る)
if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;
import { SignJWT, importPKCS8 } from "jose";
import { PRODUCTS } from "../src/iap/catalog.js";
import { APP_STORE_ID } from "../src/server/app-version.js";

const API = "https://api.appstoreconnect.apple.com/v1";
const statusOnly = process.argv.includes("--status");
const dir = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
if (!dir && !statusOnly) throw new Error("画像のフォルダを指定してください");
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH)
  throw new Error("ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH を環境変数で渡してください");

const key = await importPKCS8(fs.readFileSync(ASC_KEY_PATH, "utf8"), "ES256");
async function token() {
  return new SignJWT({ aud: "appstoreconnect-v1" })
    .setProtectedHeader({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" })
    .setIssuer(ASC_ISSUER_ID)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key);
}
async function api(method, url, body) {
  const res = await fetch(url.startsWith("http") ? url : `${API}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

/** フォルダの画像を円→パスの表にする */
function pictures() {
  const map = {};
  for (const name of fs.readdirSync(dir)) {
    const m = name.match(/gem-pack-0*(\d+)\.(png|jpg|jpeg)$/i);
    if (m) map[Number(m[1])] = path.join(dir, name);
  }
  return map;
}

// 商品の一覧(この API は v2 の一覧。製品IDと状態が読める)
const list = await api("GET", `/apps/${APP_STORE_ID}/inAppPurchasesV2?limit=200&fields[inAppPurchases]=productId,name,state,inAppPurchaseType`);
const iaps = list.data.map((d) => ({ id: d.id, productId: d.attributes.productId, name: d.attributes.name, state: d.attributes.state }));
console.log("App Store Connect の商品:");
for (const i of iaps) console.log(`  ${i.productId}  ${i.state}  (${i.name})`);
// 商品そのものの口は /v2/inAppPurchases/<id>/…(一覧だけ /v1/apps/<app>/inAppPurchasesV2)
const V2 = "https://api.appstoreconnect.apple.com/v2/inAppPurchases";
if (statusOnly) {
  for (const i of iaps) {
    let shot = "なし";
    try { shot = (await api("GET", `${V2}/${i.id}/appStoreReviewScreenshot`)).data?.attributes?.assetDeliveryState?.state || "?"; } catch (e) { if (!/404/.test(e.message)) throw e; }
    const loc = await api("GET", `${V2}/${i.id}/inAppPurchaseLocalizations?fields[inAppPurchaseLocalizations]=locale,state`);
    console.log(`  ${i.productId}: 状態 ${i.state} / スクリーンショット ${shot} / 表示名 ${loc.data.map((l) => `${l.attributes.locale}:${l.attributes.state}`).join(",") || "なし"}`);
  }
  process.exit(0);
}
const pics = pictures();
console.log(`画像: ${Object.keys(pics).length} 枚 (${Object.keys(pics).sort((a, b) => a - b).join(", ")} 円)`);

const missing = PRODUCTS.filter((p) => !iaps.some((i) => i.productId === p.id));
if (missing.length) console.log(`! catalog.js にあるが App Store Connect に無い: ${missing.map((p) => p.id).join(", ")}`);

for (const p of PRODUCTS) {
  const iap = iaps.find((i) => i.productId === p.id);
  if (!iap) continue;
  const file = pics[p.paid];
  if (!file) { console.log(`- ${p.id}: 画像が無い(gem-pack-${p.paid}.png)。飛ばす`); continue; }
  // いまのスクリーンショット
  let current = null;
  try {
    const r = await api("GET", `${V2}/${iap.id}/appStoreReviewScreenshot`);
    current = r.data;
  } catch (e) {
    if (!/404/.test(e.message)) throw e;
  }
  if (current && !force) {
    console.log(`= ${p.id}: すでにスクリーンショットあり(${current.attributes?.fileName || current.id}、${current.attributes?.assetDeliveryState?.state || "?"})。飛ばす`);
    continue;
  }
  if (dryRun) { console.log(`~ ${p.id}: ${path.basename(file)} を登録する(dry-run)`); continue; }
  if (current && force) {
    await api("DELETE", `/inAppPurchaseAppStoreReviewScreenshots/${current.id}`);
    console.log(`  ${p.id}: 古いスクリーンショットを消した`);
  }
  const bytes = fs.readFileSync(file);
  const created = await api("POST", "/inAppPurchaseAppStoreReviewScreenshots", {
    data: {
      type: "inAppPurchaseAppStoreReviewScreenshots",
      attributes: { fileName: path.basename(file), fileSize: bytes.length },
      relationships: { inAppPurchaseV2: { data: { type: "inAppPurchases", id: iap.id } } },
    },
  });
  const shot = created.data;
  for (const op of shot.attributes.uploadOperations) {
    const chunk = bytes.subarray(op.offset, op.offset + op.length);
    const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: chunk });
    if (!res.ok) throw new Error(`アップロードに失敗 ${res.status}: ${await res.text()}`);
  }
  const md5 = crypto.createHash("md5").update(bytes).digest("hex");
  await api("PATCH", `/inAppPurchaseAppStoreReviewScreenshots/${shot.id}`, {
    data: { type: "inAppPurchaseAppStoreReviewScreenshots", id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  });
  console.log(`+ ${p.id}: ${path.basename(file)} を登録した(${bytes.length} bytes)`);
}

// 登録後の状態
const after = await api("GET", `/apps/${APP_STORE_ID}/inAppPurchasesV2?limit=200&fields[inAppPurchases]=productId,state`);
console.log("登録後の状態:");
for (const d of after.data) console.log(`  ${d.attributes.productId}  ${d.attributes.state}`);
