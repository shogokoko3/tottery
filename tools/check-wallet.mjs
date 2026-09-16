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
import { ticketsPrice, etherFor } from "../src/iap/catalog.js";
import { verifyAppleTransaction } from "../src/server/applejws.js";
import { APPLE_ROOT_G3_PEM } from "../src/server/apple-root-g3.js";
import { BUNDLE_ID, PRODUCTS, GEM_PACKS, GEM_CONSUME_ORDER, FREE_GEM_EVENT_MAX, FREE_GEM_DAILY_MAX, ADS_PER_DAY, BATTLEPASS_ENTITLEMENT, BATTLEPASS_GEMS, BATTLEPASS_WEEK_TICKET_MAX, BATTLEPASS_TICKETS_PER_CYCLE, FIRST_PURCHASE_SKIN } from "../src/iap/catalog.js";

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
import { CAMPAIGNS, campaignOf } from "../src/game/campaigns.js";
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

console.log("記念配布(campaigns.js)");
{
  const c = CAMPAIGNS[0];
  is("台帳にリリース記念(50枚)がある", [c.id, c.tickets], ["release-2026-09", 50]);
  const t0 = c.from + 1000;
  await throws("知らない配布は断る", () => w.campaign("CAMP1", "nope", t0), /ありません/);
  await throws("期間前は断る", () => w.campaign("CAMP1", c.id, c.from - 1), /期間外/);
  const got = w.campaign("CAMP1", c.id, t0);
  is("受け取ると台帳の枚数だけ増える(端末は枚数を送らない)", [got.applied, got.tickets, got.tickets_granted], [true, 50, 50]);
  is("同じ uid は二度受け取れない", [w.campaign("CAMP1", c.id, t0 + 1).applied, w.summary("CAMP1").tickets], [false, 50]);
  is("別の uid も受け取れる(出来事 id は uid ごと)", w.campaign("CAMP2", c.id, t0).tickets, 50);
  is("記念配布は earn の1日上限に数えない", w.credit("CAMP1", "camp1-earn", 10, "earn", t0).applied, true);
  const row = sql("SELECT kind, ref FROM wallet_ledger WHERE id=?", `campaign:${c.id}:CAMP1`)[0];
  is("kind は campaign で記録される", [row.kind, row.ref], ["campaign", c.id]);
  is("campaignOf は id で引ける", campaignOf(c.id).tickets, 50);
  const pre = campaignOf("prerelease-2026-09");
  is("リリース前限定は300枚・期限つき", [pre.tickets, pre.until > pre.from, pre.prerelease], [300, true, true]);
  is("期限内は受け取れる(50枚とは別に)", w.campaign("CAMP1", pre.id, pre.from + 1000).tickets, 360);
  await throws("期限を過ぎたら断る", () => w.campaign("CAMP3", pre.id, pre.until), /期間外/);
}

console.log("\n無償ジェム(端末の申告)");
is("無償ジェムを足せる", pick(w.earnGems("A", "g1", 50, T)).free, 50);
is("同じ id は二度効かない", w.earnGems("A", "g1", 50, T).applied, false);
await throws("1回の上限を超えない", () => w.earnGems("A", "g2", FREE_GEM_EVENT_MAX + 1, T), /枚数/);
// 1日の上限まで貯める(上限・1回上限の値に依存しないように計算する)
let earned = 50, k = 0;
while (earned + FREE_GEM_EVENT_MAX <= FREE_GEM_DAILY_MAX) { w.earnGems("A", `gg${k++}`, FREE_GEM_EVENT_MAX, T); earned += FREE_GEM_EVENT_MAX; }
if (earned < FREE_GEM_DAILY_MAX) { w.earnGems("A", "gedge", FREE_GEM_DAILY_MAX - earned, T); earned = FREE_GEM_DAILY_MAX; }
const EARNED_FREE = earned; // = FREE_GEM_DAILY_MAX
is("1日の上限まで貯まった", pick(w.summary("A")).free, EARNED_FREE);
await throws("1日の上限を超えない", () => w.earnGems("A", "gover", 1, T), /これ以上/);
await throws("端末の申告で有償ジェムは増やせない", () => w.apply("A", "g5", { gemsPaid: 10 }, "earn", null, T), /枚数/);
is("有償は 0 のまま", pick(w.summary("A")).paid, 0);

console.log("\nジェムの購入(おまけは無償)と使う順");
const PACK = GEM_PACKS[1]; // 600円のパック。おまけ(free)は catalog から取る(数字が変わっても壊れない)
const tx = { transactionId: "1000000123", productId: PACK.id, environment: "Production", purchaseDate: T };
// 初課金特典: uid "A" は初めての有料購入なので、購入ジェムを2倍(2倍分は無償)＋スキンのフラグ
const FIRST_BONUS = PACK.paid;
is("初課金は購入ジェム2倍(おまけは無償)＋スキンのフラグ", (() => { const r = w.purchase("A", tx, T); return { paid: r.gemsPaid, free: r.gemsFree, first: r.firstPurchase, skin: r.firstSkin }; })(), { paid: PACK.paid, free: EARNED_FREE + PACK.free + FIRST_BONUS, first: true, skin: FIRST_PURCHASE_SKIN });
is("同じ取引を送り直しても二重に加算されない", w.purchase("A", tx, T).duplicate, true);
is("同じ取引を別の uid で出しても渡らない(世界で一度)", w.purchase("B", tx, T).gems, 0);
await throws("知らない商品は拒む", () => w.purchase("A", { ...tx, transactionId: "1", productId: "x" }, T), /知らない商品/);
const beforeT = w.balance("A");
// 10枚=1,200ジェム(TICKET_BUNDLE。2026-09-16 本人の決め)は無償から先に減り、足りない分を有償から
const exPrice = ticketsPrice(10);
is("10枚まとめ売りは 1,200", exPrice, 1200);
is("1枚は 150、11枚は 1,350", [ticketsPrice(1), ticketsPrice(11)], [150, 1350]);
const freeBefore = EARNED_FREE + PACK.free + FIRST_BONUS;
const freeAfterEx = Math.max(0, freeBefore - exPrice);
const paidAfterEx = PACK.paid - Math.max(0, exPrice - freeBefore);
is("両替は無償から先に減る", pick(w.exchange("A", "x-1", 10, T)), { tickets: beforeT + 10, gems: paidAfterEx + freeAfterEx, paid: paidAfterEx, free: freeAfterEx });
is("同じ両替は二度効かない", w.exchange("A", "x-1", 10, T).applied, false);
// バトルパスは**有償ジェムだけ**で買う(無償・おまけでは買えない。2026-09-13 本人の決め)
// A は有償600・無償が多いが、有償が1500に足りないので買えない
await throws("有償が足りないとバトルパスは買えない(無償では不可)", () => w.buyPass("A", "p-1", T), /有償ジェム/);
is("買えなかったのでAの残高は動かない", pick(w.summary("A")), { tickets: beforeT + 10, gems: paidAfterEx + freeAfterEx, paid: paidAfterEx, free: freeAfterEx });
is("使う順(両替など)は無償→有償", GEM_CONSUME_ORDER, ["free", "paid"]);
{
  // 有償が足りる uid: 有償だけが 1500 減り、無償は動かない
  const big = GEM_PACKS[5]; // 10000円: paid=10000, free=3000
  const pp = w.purchase("P", { transactionId: "bigP", productId: big.id, environment: "Production", purchaseDate: T }, T);
  const beforePaid = pp.gemsPaid, beforeFree = pp.gemsFree; // 初回2倍: paid=10000, free=3000+10000
  const bought = w.buyPass("P", "pp", T);
  is("有償だけでバトルパスを買える(有償1500減・無償は不変)", { paid: bought.gemsPaid, free: bought.gemsFree, ent: bought.entitlements }, { paid: beforePaid - BATTLEPASS_GEMS, free: beforeFree, ent: [BATTLEPASS_ENTITLEMENT] });
  is("既に持っていれば減らさない", w.buyPass("P", "pp2", T).gemsPaid, beforePaid - BATTLEPASS_GEMS);
}
await throws("合計が足りなければ両替は失敗し", () => w.exchange("E", "ex", 100, T), /ジェムが足りません/);
{
  // 未使用残高は有償だけ(専用DBで確定した数で確かめる)。1500パックを初回購入→有償でパス購入
  const D = new DatabaseSync(":memory:");
  const uw = new Wallet((q, ...a) => D.prepare(q).all(...a));
  const pk = GEM_PACKS[2]; // 1500円: paid=1500, free=230
  uw.purchase("U", { transactionId: "u1", productId: pk.id, environment: "Production", purchaseDate: T }, T); // 初回2倍: paid=1500, free=230+1500
  uw.buyPass("U", "up", T); // 有償1500減 → paid=0
  const u = uw.unused();
  is("未使用残高は有償だけを数える(無償は別枠)", { unused: u.unusedGems, free: u.unusedFreeGems, issued: u.issuedGems, used: u.usedGems, over: u.over }, { unused: 0, free: pk.free + pk.paid, issued: pk.paid, used: pk.paid, over: false });
}

console.log("\n初課金特典は初回だけ(2回目には付かない)");
{
  const D = new DatabaseSync(":memory:");
  const w2 = new Wallet((q, ...a) => D.prepare(q).all(...a));
  const b = GEM_PACKS[0]; // 120円
  const p1 = w2.purchase("F", { transactionId: "f1", productId: b.id, environment: "Production", purchaseDate: T }, T);
  is("初回は2倍(おまけ無償)＋フラグ", { paid: p1.gemsPaid, free: p1.gemsFree, first: p1.firstPurchase }, { paid: b.paid, free: b.free + b.paid, first: true });
  // 戻り値は残高なので、2回目は差分で見る(特典が付かない=無償が増えないこと)
  const before2 = w2.summary("F");
  const p2 = w2.purchase("F", { transactionId: "f2", productId: b.id, environment: "Production", purchaseDate: T }, T);
  is("2回目は等倍・特典なし", { dPaid: p2.gemsPaid - before2.gemsPaid, dFree: p2.gemsFree - before2.gemsFree, first: p2.firstPurchase, skin: p2.firstSkin }, { dPaid: b.paid, dFree: b.free, first: false, skin: null });
}

console.log("\nバトルパスのマス報酬(所持者だけ・週72枚・週で戻る)");
{
  const D = new DatabaseSync(":memory:");
  const w2 = new Wallet((q, ...a) => D.prepare(q).all(...a));
  await throws("持っていないと受け取れない", () => w2.passReward("Z", "bp:pass:1:0-1", T), /バトルパス/);
  w2.purchase("Z", { transactionId: "z1", productId: GEM_PACKS[5].id, environment: "Production", purchaseDate: T }, T);
  w2.buyPass("Z", "pz", T);
  const before = w2.balance("Z");
  is("マス報酬はチケット1枚", w2.passReward("Z", "bp:pass:1:0-1", T).tickets, before + 1);
  is("同じマスは二度効かない", w2.passReward("Z", "bp:pass:1:0-1", T).applied, false);
  let n = 1;
  while (n < BATTLEPASS_WEEK_TICKET_MAX) { w2.passReward("Z", `bp:pass:9:c${n}`, T); n++; }
  is("週の上限(72枚=3周)まで受け取れる", w2.passTicketsThisWeek("Z", T), BATTLEPASS_WEEK_TICKET_MAX);
  await throws("週の上限を超えない", () => w2.passReward("Z", "bp:pass:9:over", T), /上限/);
  const nextWeek = T + 7 * 24 * 3600 * 1000;
  is("翌週はまた受け取れる", w2.passReward("Z", "bp:pass:10:0-1", nextWeek).applied, true);
}

console.log("\n広告リワード(1日 ADS_PER_DAY 回・チケット1枚)");
{
  const D = new DatabaseSync(":memory:");
  const q = (x, ...a) => D.prepare(x).all(...a);
  const aw = new Wallet(q);
  const T0 = 1_800_000_000_000;
  let left = ADS_PER_DAY;
  for (let i = 0; i < ADS_PER_DAY; i++) {
    const r = aw.adReward("Z", `ad${i}`, T0);
    left--;
    is(`広告${i + 1}回目でチケット+1・残り${left}`, [r.tickets, r.adsLeftToday], [i + 1, left]);
  }
  await throws("1日の上限を超えて配られない", () => aw.adReward("Z", "adX", T0), /使い切りました/);
  is("同じ id は二度効かない(残り回数も減らない)", aw.adReward("Z", "ad0", T0).applied, false);
  is("翌日はまた見られる", aw.adReward("Z", "ad-next", T0 + 86_400_000).adsLeftToday, ADS_PER_DAY - 1);
  is("要約は now 無しだと残り回数を入れない(いつの今日か決まらない)", "adsLeftToday" in aw.summary("Z"), false);
  is("要約は now 有りだと残り回数を入れる", Number.isSafeInteger(aw.summary("Z", T0).adsLeftToday), true);
}

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

console.log("\n運営ツール(手動付与・購入履歴・ガチャ履歴)");
{
  const D = new DatabaseSync(":memory:");
  const w2 = new Wallet((q, ...a) => D.prepare(q).all(...a));
  // 手動付与: チケット+無償ジェム。有償は動かさない
  const r = w2.adminGrant("U", { tickets: 5, gemsFree: 30 }, "g1", T);
  is("手動付与(チケット・無償ジェム、有償は0)", { t: r.tickets, gems: r.gems, paid: r.gemsPaid, free: r.gemsFree }, { t: 5, gems: 30, paid: 0, free: 30 });
  is("同じidの付与は二度効かない", w2.adminGrant("U", { tickets: 5, gemsFree: 30 }, "g1", T).applied, false);
  await throws("0の付与は拒む", () => w2.adminGrant("U", { tickets: 0, gemsFree: 0 }, "g2", T), /付与する数/);
  await throws("uid無しは拒む", () => w2.adminGrant("", { tickets: 1 }, "g3", T), /uid/);
  // 購入履歴
  w2.purchase("U", { transactionId: "h1", productId: GEM_PACKS[0].id, environment: "Sandbox", purchaseDate: T }, T);
  const ph = w2.purchaseHistory("U").purchases;
  is("購入履歴にその取引が出る", [ph.length, ph[0].transactionId, ph[0].productId], [1, "h1", GEM_PACKS[0].id]);
  is("全体の購入履歴も読める", w2.purchaseHistory().purchases.length >= 1, true);
  // ガチャ履歴
  is("ガチャ結果を記録できる", w2.logGacha("U", [{ id: "elf-male", isNew: true }, { id: "zombie-male", isNew: false }], T).logged, 2);
  const g = w2.gachaHistory("U").gacha;
  is("ガチャ履歴が新しい順で読める", [g.length, g.some((x) => x.skinId === "elf-male" && x.isNew === 1)], [2, true]);
  is("空の記録は0件", w2.logGacha("U", [], T).logged, 0);
  is("uid無しの全体ガチャ履歴も読める", w2.gachaHistory().gacha.length >= 2, true);
}

// 店の診断: uid ごとに最新の1件。長い値は切り詰め、消去で消える
{
  const D = new DatabaseSync(":memory:");
  const dw = new Wallet((q, ...a) => D.prepare(q).all(...a));
  dw.logDiag("u1", { build: 202609151314, storefront: "JPN", count: 0, error: "x".repeat(500), ms: 1200 }, 1000);
  dw.logDiag("u1", { build: 202609151314, storefront: "JPN", count: 6, ms: 900 }, 2000);
  dw.logDiag("u2", { build: "bad", storefront: 5, count: -1, error: null, ms: 1.5 }, 3000);
  const rows = dw.diagList().diag;
  assert.equal(rows.length, 2, "uid ごとに1件");
  assert.equal(rows[0].uid, "u2", "新しい順");
  assert.deepEqual([rows[0].build, rows[0].storefront, rows[0].count, rows[0].error, rows[0].ms], [null, "", null, "", null], "形が違う値は空");
  assert.equal(rows[1].count, 6, "最新で上書き");
  assert.equal(rows[1].error, "", "成功のときは error が空");
  dw.forget("u1");
  assert.equal(dw.diagList().diag.length, 1, "消去で消える");
  console.log("店の診断: uid ごとに最新1件・切り詰め・消去 OK");
}

// フォイルの直接購入: 有償ジェムだけで払う。無償が多くても触らない。同じ札は二度買えない(applied:false)
{
  const D = new DatabaseSync(":memory:");
  const fw = new Wallet((q, ...a) => D.prepare(q).all(...a));
  fw.purchase("F", { transactionId: "t-foil", productId: "com.shogokoko.tottery.gems.3000", environment: "Sandbox", purchaseDate: 1 }, 10);
  fw.earnGems("F", "e1", 10, 20);
  const before = fw.summary("F");
  let msg = "";
  try { fw.buyFoil("F", "foil-jq-angel", ["angel-j", "angel-q"], 30); } catch (e) { msg = e.message; }
  is("有償が足りなければ無償があっても失敗", /有償ジェムが足りません/.test(msg), true);
  const one = fw.buyFoil("F", "foil-jq-angel", ["angel-q"], 40);
  is("片方だけなら按分(2,500)", one.price, 2500);
  const after = fw.summary("F");
  is("有償から引く", before.gemsPaid - after.gemsPaid, 2500);
  is("無償は触らない", after.gemsFree, before.gemsFree);
  is("同じ札は二度買えない", fw.buyFoil("F", "foil-jq-angel", ["angel-q"], 50).applied, false);
  try { fw.buyFoil("F", "foil-a", ["genie-magician"], 60); } catch (e) { msg = e.message; }
  is("pending の商品は売らない", /その商品はありません/.test(msg), true);
  try { fw.buyFoil("F", "foil-10", ["angel-k"], 70); } catch (e) { msg = e.message; }
  is("商品外の札は断る", /正しくありません/.test(msg), true);
}

// 無償ジェムをエーテルに(10 → 20)。**無償だけ**で払い、有償は溶かさない。10 の倍数だけ
{
  const D = new DatabaseSync(":memory:");
  const ew = new Wallet((q, ...a) => D.prepare(q).all(...a));
  ew.purchase("G", { transactionId: "t-eth", productId: "com.shogokoko.tottery.gems.600", environment: "Sandbox", purchaseDate: 1 }, 10);
  const b = ew.summary("G"); // 有償600・無償(初回2倍600+おまけ60)
  const r = ew.buyEther("G", "eth-1", 100, 20);
  is("100 無償ジェム → 200 エーテル", r.ether, 200);
  is("無償だけ減る", [r.gemsFree, r.gemsPaid], [b.gemsFree - 100, b.gemsPaid]);
  is("同じ id は二度効かず ether 0", ew.buyEther("G", "eth-1", 100, 30).ether, 0);
  let msg = "";
  try { ew.buyEther("G", "eth-2", 15, 40); } catch (e) { msg = e.message; }
  is("10 の倍数でなければ断る", /正しくありません/.test(msg), true);
  try { ew.buyEther("G", "eth-3", 10000, 50); } catch (e) { msg = e.message; }
  is("1,000 を超える量は断る", /正しくありません/.test(msg), true);
  try { ew.buyEther("G", "eth-4", 1000, 60); } catch (e) { msg = e.message; }
  is("無償が足りなければ有償があっても失敗", /無償ジェムが足りません/.test(msg), true);
  is("catalog の換算", [etherFor(10), etherFor(50), etherFor(1000), etherFor(1010), etherFor(7)], [20, 100, 2000, null, null]);
}

console.log(`\n${ok} 件 ok / ${fails.length} 件 NG`);
process.exit(fails.length ? 1 : 0);
