/**
 * サーバー側の財布と、Apple の取引の署名検証を確かめる。
 *
 * 財布: 出来事 id で冪等、減算は残高を超えない、購入は取引 ID で冪等(チケットは
 * 世界で一度、買い切りの権利は復元した uid にも渡す)、引き継ぎは一度きりで上限つき、
 * 遊んで貯める分は1回/1日の上限。
 * 署名: 合成した3段の証明書チェーンで本物と同じ手順(ES256 の JWS + x5c)を回し、
 * 通るべきものが通り、改ざん・別アプリ・別の根・返金済みが弾かれることを見る。
 * 通信はしない。
 */
// @peculiar/x509 (tsyringe) はどの入口でも reflect-metadata を最初に要求する
import "reflect-metadata";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { X509CertificateGenerator, X509Certificate } from "@peculiar/x509";
import { CompactSign } from "jose";
import { Wallet, MIGRATE_TICKETS_MAX, EARN_DAILY_MAX } from "../src/server/wallet.js";
import { verifyAppleTransaction } from "../src/server/applejws.js";
import { APPLE_ROOT_G3_PEM } from "../src/server/apple-root-g3.js";
import { BUNDLE_ID, PRODUCTS, GEM_PACKS, GEM_CONSUME_ORDER, FREE_GEM_EVENT_MAX, BATTLEPASS_ENTITLEMENT } from "../src/iap/catalog.js";

let ok = 0; const fails = [];
const is = (label, got, want) => {
  try { assert.deepEqual(got, want); ok++; console.log(`  ok   ${label}`); }
  catch { fails.push(label); console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); }
};
const throws = async (label, fn, re) => {
  try { await fn(); fails.push(label); console.log(`  NG   ${label}  投げなかった`); }
  catch (e) { if (re.test(e.message)) { ok++; console.log(`  ok   ${label}`); } else { fails.push(label); console.log(`  NG   ${label}  ${e.message}`); } }
};

console.log("財布");
const db = new DatabaseSync(":memory:");
const sql = (q, ...a) => db.prepare(q).all(...a);
const w = new Wallet(sql);
const T = 1_800_000_000_000;
const pick = (s) => ({ tickets: s.tickets, gems: s.gems, paid: s.gemsPaid, free: s.gemsFree });
is("最初は 0", pick(w.summary("A")), { tickets: 0, gems: 0, paid: 0, free: 0 });
is("チケットの加算", w.credit("A", "e1", 5, "migrate", T).tickets, 5);
is("同じ id の加算は二度効かない", w.credit("A", "e1", 5, "migrate", T).applied, false);
is("減算", w.debit("A", "d1", 3, "pull", T).tickets, 2);
is("同じ id の減算も二度効かない", w.debit("A", "d1", 3, "pull", T).applied, false);
await throws("残高を超える減算は失敗し", () => w.debit("A", "d2", 10, "pull", T), /足りません/);
is("失敗した減算で残高は動かない", w.balance("A"), 2);
await throws("他人の出来事 id は使えない", () => w.credit("B", "e1", 5, "migrate", T), /他の人/);
await throws("遊んで貯める分は1回の上限を超えない", () => w.credit("A", "x1", 11, "earn", T), /枚数/);
for (let i = 0; i < 3; i++) w.credit("A", `earn${i}`, 10, "earn", T);
await throws("遊んで貯める分は1日の上限を超えない", () => w.credit("A", "earn9", 1, "earn", T), /これ以上/);
is("翌日はまた受け取れる", w.credit("A", "earn10", 1, "earn", T + 86_400_000).applied, true);
is("1日の上限は定数どおり", EARN_DAILY_MAX, 30);

console.log("\n無償ジェム(端末の申告)");
is("無償ジェムを足せる", pick(w.earnGems("A", "g1", 50, T)).free, 50);
is("同じ id は二度効かない", w.earnGems("A", "g1", 50, T).applied, false);
await throws("1回の上限を超えない", () => w.earnGems("A", "g2", FREE_GEM_EVENT_MAX + 1, T), /枚数/);
for (let i = 0; i < 2; i++) w.earnGems("A", `g3${i}`, 100, T);
await throws("1日の上限を超えない", () => w.earnGems("A", "g4", 100, T), /これ以上/);
await throws("端末の申告で有償ジェムは増やせない", () => w.apply("A", "g5", { gemsPaid: 10 }, "earn", null, T), /枚数/);
is("有償は 0 のまま", pick(w.summary("A")).paid, 0);

console.log("\nジェムの購入(おまけは無償)と使う順");
const tx = { transactionId: "1000000123", productId: GEM_PACKS[1].id, environment: "Production", purchaseDate: T };
is("600円のパックで 有償600 + 無償120", (() => { const r = w.purchase("A", tx, T); return { paid: r.gemsPaid, free: r.gemsFree }; })(), { paid: 600, free: 250 + 120 });
is("同じ取引を送り直しても二重に加算されない", w.purchase("A", tx, T).duplicate, true);
is("同じ取引を別の uid で出しても渡らない(世界で一度)", w.purchase("B", tx, T).gems, 0);
await throws("知らない商品は拒む", () => w.purchase("A", { ...tx, transactionId: "1", productId: "x" }, T), /知らない商品/);
const beforeT = w.balance("A");
// 無償370・有償600。10枚=100ジェムは無償から
is("両替は無償から先に減る", pick(w.exchange("A", "x-1", 10, T)), { tickets: beforeT + 10, gems: 870, paid: 600, free: 270 });
is("同じ両替は二度効かない", w.exchange("A", "x-1", 10, T).applied, false);
// バトルパス600: 無償270を使い切り、残り330は有償から(1つの出来事)
is("無償で足りない分は有償から、1つの出来事で", (() => { const r = w.buyPass("A", "p-1", T); return { ...pick(r), ent: r.entitlements }; })(), { tickets: beforeT + 10, gems: 270, paid: 270, free: 0, ent: [BATTLEPASS_ENTITLEMENT] });
is("既に持っていれば減らさない", w.buyPass("A", "p-2", T).gems, 270);
await throws("合計が足りなければ両替は失敗し", () => w.exchange("A", "x-2", 100, T), /ジェムが足りません/);
is("失敗した両替でどちらも動かない", pick(w.summary("A")), { tickets: beforeT + 10, gems: 270, paid: 270, free: 0 });
is("使う順は無償→有償", GEM_CONSUME_ORDER, ["free", "paid"]);
is("未使用残高は有償だけを数える(無償は別枠)", (() => { const u = w.unused(); return { unused: u.unusedGems, free: u.unusedFreeGems, issued: u.issuedGems, used: u.usedGems, over: u.over }; })(), { unused: 270, free: 0, issued: 600, used: 330, over: false });

console.log("\n端末からの引き継ぎと旧表の移行");
is("一度だけ引き継ぐ", pick(w.migrate("C", 40, T)).tickets, 40);
is("二度目は何もしない", w.migrate("C", 40, T).applied, false);
is("上限を超える申告は上限で止める", w.migrate("D", 99999, T).migrated, MIGRATE_TICKETS_MAX);
const db2 = new DatabaseSync(":memory:");
const sql2 = (q, ...a) => db2.prepare(q).all(...a);
sql2("CREATE TABLE wallets (uid TEXT PRIMARY KEY, tickets INTEGER NOT NULL, updated INTEGER)");
sql2("CREATE TABLE wallet_events (id TEXT PRIMARY KEY, uid TEXT, delta INTEGER, kind TEXT, ref TEXT, at INTEGER)");
sql2("INSERT INTO wallets VALUES ('old', 7, 1)"); sql2("INSERT INTO wallet_events VALUES ('e-old','old',7,'migrate',NULL,1)");
const w2 = new Wallet(sql2);
is("旧表の残高と出来事を引き継ぎ、gems/gems_free 列が足される", pick(w2.summary("old")), { tickets: 7, gems: 0, paid: 0, free: 0 });
is("引き継いだ出来事 id は二度効かない", w2.credit("old", "e-old", 7, "migrate", T).applied, false);
// ジェム(有償のみ)の版の表(gems あり・gems_free なし)からも
const db3 = new DatabaseSync(":memory:");
const sql3 = (q, ...a) => db3.prepare(q).all(...a);
sql3("CREATE TABLE wallets (uid TEXT PRIMARY KEY, tickets INTEGER NOT NULL, updated INTEGER, gems INTEGER NOT NULL DEFAULT 0)");
sql3("CREATE TABLE wallet_ledger (id TEXT PRIMARY KEY, uid TEXT, tickets INTEGER NOT NULL, gems INTEGER NOT NULL, kind TEXT, ref TEXT, at INTEGER)");
sql3("INSERT INTO wallets VALUES ('mid', 0, 1, 300)");
const w3 = new Wallet(sql3);
is("有償だけの版からは gems_free 列を足して引き継ぐ", pick(w3.summary("mid")), { tickets: 0, gems: 300, paid: 300, free: 0 });
is("消すと財布は空になる", (w.forget("A"), pick(w.summary("A"))), { tickets: 0, gems: 0, paid: 0, free: 0 });
is("消しても購入の記録は残る(uid は伏せる)", sql("SELECT uid FROM purchases WHERE transactionId=?", "1000000123")[0].uid, "");

console.log("\nApple の取引の署名検証(合成した鎖で本物と同じ手順)");
const gen = async (name, issuer, signingKey, curve, hash, days) => {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: curve }, true, ["sign", "verify"]);
  const cert = await X509CertificateGenerator.create({
    serialNumber: String(Math.floor(Math.random() * 1e9)),
    subject: `CN=${name}`, issuer: issuer ? issuer.subject : `CN=${name}`,
    notBefore: new Date(T - 86_400_000), notAfter: new Date(T + days * 86_400_000),
    signingAlgorithm: { name: "ECDSA", hash }, publicKey: keys.publicKey,
    signingKey: signingKey || keys.privateKey,
  });
  return { cert, keys };
};
const root = await gen("Test Root G3", null, null, "P-384", "SHA-384", 3650);
const mid = await gen("Test WWDR", root.cert, root.keys.privateKey, "P-256", "SHA-256", 1000);
const leaf = await gen("Test Receipt Signing", mid.cert, mid.keys.privateKey, "P-256", "SHA-256", 365);
const chain = [leaf.cert, mid.cert, root.cert].map((c) => c.toString("base64"));
const rootPem = root.cert.toString("pem");
const sign = async (payload, { x5c = chain, key = leaf.keys.privateKey, alg = "ES256" } = {}) =>
  new CompactSign(new TextEncoder().encode(JSON.stringify(payload))).setProtectedHeader({ alg, x5c }).sign(key);
const good = { bundleId: BUNDLE_ID, productId: PRODUCTS[0].id, transactionId: "2000000000000001", originalTransactionId: "2000000000000001", environment: "Production", type: "Consumable", purchaseDate: T, signedDate: T, quantity: 1 };
const decoded = await verifyAppleTransaction(await sign(good), { rootPem });
is("正しい取引は通り、本文が返る", decoded.transactionId, good.transactionId);
await throws("本文を1文字でも書き換えると弾く", async () => {
  const j = await sign(good); const [h, p, s] = j.split(".");
  const tampered = Buffer.from(JSON.stringify({ ...good, productId: PRODUCTS[2].id })).toString("base64url");
  return verifyAppleTransaction(`${h}.${tampered}.${s}`, { rootPem });
}, /署名が合いません/);
await throws("別のアプリの取引は弾く", () => sign({ ...good, bundleId: "com.example.other" }).then((j) => verifyAppleTransaction(j, { rootPem })), /別のアプリ/);
await throws("知らない商品は弾く", () => sign({ ...good, productId: "com.shogokoko.tottery.nope" }).then((j) => verifyAppleTransaction(j, { rootPem })), /知らない商品/);
await throws("返金済みは弾く", () => sign({ ...good, revocationDate: T + 1 }).then((j) => verifyAppleTransaction(j, { rootPem })), /返金/);
await throws("本番だけ受ける設定なら Sandbox は弾く", () => sign({ ...good, environment: "Sandbox" }).then((j) => verifyAppleTransaction(j, { rootPem, environments: ["Production"] })), /環境/);
const other = await gen("Other Root", null, null, "P-384", "SHA-384", 3650);
await throws("根が Apple(ここでは合成の根)でなければ弾く", async () => verifyAppleTransaction(await sign(good), { rootPem: other.cert.toString("pem") }), /根が/);
const forgedLeaf = await gen("Forged", mid.cert, other.keys.privateKey, "P-256", "SHA-256", 365);
await throws("根だけ本物を付けて中間の署名が偽物なら弾く(鎖の検証)", async () => {
  const x5c = [forgedLeaf.cert, mid.cert, root.cert].map((c) => c.toString("base64"));
  return verifyAppleTransaction(await sign(good, { x5c, key: forgedLeaf.keys.privateKey }), { rootPem });
}, /鎖が切れて|発行者/);
await throws("署名日時が証明書の期限の外なら弾く", () => sign({ ...good, signedDate: T + 400 * 86_400_000 }).then((j) => verifyAppleTransaction(j, { rootPem })), /期限/);
await throws("ES256 以外の署名方式は弾く", async () => {
  const rsa = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: "SHA-256" }, true, ["sign","verify"]);
  return verifyAppleTransaction(await sign(good, { alg: "RS256", key: rsa.privateKey }), { rootPem });
}, /署名方式/);
const apple = new X509Certificate(APPLE_ROOT_G3_PEM);
is("埋め込んだ Apple Root CA - G3 が読める", apple.subject.includes("Apple Root CA - G3"), true);
is("Apple の根の指紋が公開されているものと一致", Buffer.from(await apple.getThumbprint("SHA-256")).toString("hex"), "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179");

console.log(`\n${ok} 件 ok / ${fails.length} 件 NG`);
process.exit(fails.length ? 1 : 0);
