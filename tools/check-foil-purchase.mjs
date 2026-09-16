import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Wallet } from "../src/server/wallet.js";
import { ALL_SKINS, foilId } from "../src/skins/catalog.js";
import { productOf } from "../src/skins/foil-shop.js";
import { normalize } from "../src/skins/collection.js";

// 本番のDurable Objectと同じく、1要求の全書込みを1トランザクションにする。
const db = new DatabaseSync(":memory:");
let failFoilInsert = false;
const sql = (query, ...args) => {
  if (failFoilInsert && query.startsWith("INSERT OR IGNORE INTO foil_purchases"))
    throw new Error("test: foil storage failed");
  return db.prepare(query).all(...args);
};
const atomic = (fn) => {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};
const wallet = new Wallet(sql);
const now = Date.UTC(2026, 8, 16);
const sync = (uid, ids) => atomic(() => wallet.syncCollection(uid, ids, now));
const buy = (uid, product, skins) => atomic(() => wallet.buyFoil(uid, product, skins, now));
const fund = (uid, paid = 20000, free = 12000) => atomic(() =>
  wallet.apply(uid, `fund:${uid}`, { gemsPaid: paid, gemsFree: free }, "purchase", "fixture", now),
);
const balances = (uid) => {
  const s = wallet.summary(uid);
  return [s.gemsPaid, s.gemsFree];
};
const secret = productOf("foil-a");
const secretId = foilId("genie-magician");
const prerequisites = ALL_SKINS.filter((skin) => !skin.secret).map((skin) => skin.id);
assert.equal(prerequisites.length, 32);

// ID一覧だけを受け付ける。complete=trueだけの申告、未知ID、重複、不正型、過大入力は拒否。
fund("validate");
sync("validate", ["zombie-male"]);
for (const bad of [
  undefined, null, true, "zombie-male", { complete: true },
  { owned: { "zombie-male": 1 }, complete: true },
  ["unknown"], ["zombie-male", "zombie-male"], [null], [3],
  [{ id: "zombie-male" }], new Array(1),
  Array(ALL_SKINS.length + 1).fill("zombie-male"),
]) {
  assert.throws(() => sync("validate", bad), /一覧が正しくありません/);
  assert.deepEqual(wallet.collectionOf("validate").owned, { "zombie-male": 1 });
}
assert.equal(wallet.summary("validate").secretFoilEligible, false);
const untouched = balances("validate");
assert.throws(() => wallet.checkFoilOwnership("validate", secret, secret.skins), /購入条件/);
if (!secret.pending)
  assert.throws(() => atomic(() => wallet.buyFoil("validate", secret.id, secret.skins, now, { complete: true })), /購入条件/);
assert.deepEqual(balances("validate"), untouched);

// 同期からシークレット所持は付与しない。別uidの全収集記録も使わない。
sync("pretend", [secretId]);
assert.deepEqual(wallet.collectionOf("pretend").owned, {});
assert.deepEqual(wallet.summary("pretend").purchasedFoils, []);
fund("complete");
fund("other");
assert.throws(() => wallet.checkFoilOwnership("complete", secret, secret.skins), /購入条件/, "未同期は拒否");
for (const missing of prerequisites) {
  sync("complete", prerequisites.filter((id) => id !== missing));
  assert.equal(wallet.summary("complete").secretFoilEligible, false, `${missing}が必要`);
  assert.throws(() => wallet.checkFoilOwnership("complete", secret, secret.skins), /購入条件/);
  if (!secret.pending) assert.throws(() => buy("complete", secret.id, secret.skins), /購入条件/);
  assert.deepEqual(balances("complete"), [20000, 12000]);
}
assert.equal(sync("complete", prerequisites).secretFoilEligible, true);
assert.doesNotThrow(() => wallet.checkFoilOwnership("complete", secret, secret.skins));
assert.equal(wallet.summary("other").secretFoilEligible, false);
assert.throws(() => wallet.checkFoilOwnership("other", secret, secret.skins), /購入条件/);
if (!secret.pending) assert.throws(() => buy("other", secret.id, secret.skins), /購入条件/);

if (secret.pending) {
  assert.throws(() => buy("complete", secret.id, secret.skins), /その商品はありません/);
  assert.deepEqual(balances("complete"), [20000, 12000]);
} else {
  const bought = buy("complete", secret.id, secret.skins);
  assert.equal(bought.applied, true);
  assert.equal(bought.price, 2000);
  assert.deepEqual(balances("complete"), [18000, 12000]);
  assert.deepEqual(bought.purchasedFoils, [secretId]);
  sync("complete", []);
  const again = buy("complete", secret.id, secret.skins);
  assert.equal(again.applied, false, "所持条件が変わっても同一支払要求は復元");
  assert.deepEqual(again.purchasedFoils, [secretId]);
  assert.deepEqual(balances("complete"), [18000, 12000]);
}

// 既所持の購入・重複を含むセットは、通常品でも減算せず拒否する。
fund("partial");
sync("partial", ["zombie-male:foil"]);
assert.throws(() => buy("partial", "foil-2-3", ["zombie-male"]), /すでに持っています/);
assert.throws(() => buy("partial", "foil-2-3", ["zombie-male", "zombie-female"]), /すでに持っています/);
assert.deepEqual(balances("partial"), [20000, 12000]);
const half = buy("partial", "foil-2-3", ["zombie-female"]);
assert.equal(half.price, 750);
assert.equal(half.applied, true);
assert.deepEqual(half.purchasedFoils, ["zombie-female:foil"]);
assert.deepEqual(balances("partial"), [19250, 12000]);
sync("partial", []);
assert.equal(buy("partial", "foil-2-3", ["zombie-female"]).applied, false);
assert.throws(() => buy("partial", "foil-2-3", ["zombie-male", "zombie-female"]), /すでに持っています/);
assert.deepEqual(balances("partial"), [19250, 12000]);

fund("bundle", 1500, 10000);
const bundle = buy("bundle", "foil-2-3", ["zombie-male", "zombie-female"]);
assert.deepEqual(bundle.purchasedFoils, ["zombie-female:foil", "zombie-male:foil"]);
assert.deepEqual(balances("bundle"), [0, 10000]);
const retried = buy("bundle", "foil-2-3", ["zombie-female", "zombie-male"]);
assert.equal(retried.applied, false, "並びが違っても同じ要求・残高0でも復元");
assert.deepEqual(retried.purchasedFoils, bundle.purchasedFoils);
assert.equal(sql("SELECT COUNT(*) AS n FROM wallet_ledger WHERE uid=? AND kind='foil'", "bundle")[0].n, 1);
const reloaded = new Wallet(sql);
assert.deepEqual(reloaded.summary("bundle").purchasedFoils, bundle.purchasedFoils, "プロセスや端末を失っても復元");
assert.deepEqual(reloaded.summary("other").purchasedFoils, []);
fund("free-only", 1, 20000);
assert.throws(() => buy("free-only", "foil-2-3", ["zombie-male"]), /有償ジェムが足りません/);
assert.deepEqual(balances("free-only"), [1, 20000]);
assert.deepEqual(wallet.summary("free-only").purchasedFoils, []);

// 付与保存の失敗が減算後に起きても、本番と同じトランザクションで全体を戻す。
fund("failure");
failFoilInsert = true;
assert.throws(() => buy("failure", "foil-10", ["dragon-knight"]), /foil storage failed/);
failFoilInsert = false;
assert.deepEqual(balances("failure"), [20000, 12000]);
assert.deepEqual(wallet.summary("failure").purchasedFoils, []);
assert.equal(sql("SELECT COUNT(*) AS n FROM wallet_ledger WHERE uid=? AND kind='foil'", "failure")[0].n, 0);
assert.equal(buy("failure", "foil-10", ["dragon-knight"]).applied, true);

// 更新前の支払台帳だけがある状態を復元。申告ログや不正な参照は購入扱いにしない。
const oldPayment = (uid, product, skins, gems, ref = `${product}:${skins.join(",")}`) => {
  const id = `foil:${uid}:${product}:${[...skins].sort().join("+")}`;
  sql("INSERT INTO wallet_ledger (id, uid, tickets, gems, kind, ref, at, gems_free) VALUES (?,?,?,?,?,?,?,?)",
    id, uid, 0, -gems, "foil", ref, now, 0);
};
oldPayment("legacy", "foil-2-3", ["zombie-male", "zombie-female"], 1500);
oldPayment("legacy", "foil-10", ["dragon-knight"], 0);
oldPayment("legacy", "unknown", ["angel-k"], 5000);
oldPayment("legacy", "foil-jq-angel", ["angel-j", "angel-j"], 5000);
assert.deepEqual(wallet.summary("legacy").purchasedFoils, ["zombie-female:foil", "zombie-male:foil"]);
assert.equal(buy("legacy", "foil-2-3", ["zombie-female", "zombie-male"]).applied, false);
oldPayment("legacy-secret", "foil-a", ["genie-magician"], 2000);
assert.deepEqual(wallet.summary("legacy-secret").purchasedFoils, [secretId]);
assert.equal(wallet.summary("legacy-secret").secretFoilEligible, false);
assert.equal(buy("legacy-secret", "foil-a", ["genie-magician"]).applied, false, "非公開でも支払済みの再送は復元");
assert.deepEqual(wallet.summary("other").purchasedFoils, []);

sync("legacy", ["genie-magician"]);
atomic(() => wallet.forget("legacy"));
assert.deepEqual(wallet.summary("legacy").purchasedFoils, []);
assert.deepEqual(wallet.collectionOf("legacy").owned, {});
assert.equal(wallet.summary("legacy").secretFoilEligible, false);
for (const table of ["collection_skins", "foil_purchases"])
  assert.equal(sql(`SELECT COUNT(*) AS n FROM ${table} WHERE uid=?`, "legacy")[0].n, 0);
assert.deepEqual(wallet.summary("bundle").purchasedFoils, bundle.purchasedFoils, "忘却は本人だけ");

// 実net/wallet.jsを実行する。認証と端末保存だけ差替え、通信は上の実Walletへ接続する。
// 外部への通信は行わず、応答消失・端末保存失敗・端末消失後の購入復元を確かめる。
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/net/wallet.js", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  logLevel: "silent",
  plugins: [{
    name: "wallet-test-boundaries",
    setup(builder) {
      builder.onResolve({ filter: /(?:auth|season|store)\.js$/ }, (args) => {
        if (!args.importer.endsWith("/src/net/wallet.js")) return;
        if (["./auth.js", "./season.js", "../skins/store.js"].includes(args.path))
          return { path: args.path, namespace: "wallet-test" };
      });
      builder.onLoad({ filter: /.*/, namespace: "wallet-test" }, (args) => ({
        loader: "js",
        contents: args.path === "./auth.js"
          ? 'export async function ensureAuth(){return {uid:"client",idToken:"test-token"};}'
          : args.path === "./season.js"
            ? 'export const seasonApiBase=()=>"https://foil-purchase.test";'
            : `export const getCollection=()=>globalThis.__foilPurchaseStore.state;
               export async function updateCollection(change){
                 const store=globalThis.__foilPurchaseStore;
                 if(store.failNextWrite){store.failNextWrite=false;throw new Error("端末へ保存できませんでした。");}
                 store.state=store.normalize(change(store.state));return store.state;
               }`,
      }));
    },
  }],
});
const previousFetch = globalThis.fetch;
const previousStorage = globalThis.localStorage;
const previousBridge = globalThis.__foilPurchaseStore;
const bridge = { state: normalize(null), normalize, failNextWrite: false };
const requests = [];
let loseResponse = false;
let failAfterPurchase = false;
const memory = new Map();
fund("client");
try {
  globalThis.__foilPurchaseStore = bridge;
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://foil-purchase.test", "外部通信は禁止");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    const op = parsed.pathname.split("/").at(-1);
    const body = JSON.parse(options.body);
    requests.push({ op, body });
    let data;
    try {
      data = atomic(() => {
        if (op === "collection") return wallet.syncCollection("client", body.ownedIds, now);
        if (op === "foil") return wallet.buyFoil("client", body.product, body.skins, now);
        if (op === "summary") return wallet.summary("client", now);
        throw new Error(`Unexpected test operation: ${op}`);
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    if (op === "foil" && loseResponse) {
      loseResponse = false;
      throw new Error("test: response lost after commit");
    }
    if (op === "foil" && failAfterPurchase) {
      failAfterPurchase = false;
      bridge.failNextWrite = true;
    }
    return new Response(JSON.stringify(data), { status: 200 });
  };
  const client = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
  await client.buyFoil("foil-2-3", ["zombie-male"]);
  assert.deepEqual(requests.map((r) => r.op), ["collection", "foil"], "購入直前に所持を同期");
  assert.deepEqual(requests[0].body, { ownedIds: [] });
  assert.equal(bridge.state.owned["zombie-male:foil"], 1);
  assert.equal(bridge.state.gemsPaid, 19250);
  await client.buyFoil("foil-2-3", ["zombie-male"]);
  assert.equal(bridge.state.owned["zombie-male:foil"], 1, "再送で同じ札を足さない");
  assert.equal(bridge.state.acquired["zombie-male"], 1, "再送で通算も増やさない");
  bridge.state = normalize({ owned: { "elf-male": 3 } });
  await client.syncWallet();
  assert.equal(bridge.state.owned["zombie-male:foil"], 1, "端末消失後もsummaryで復元");
  assert.equal(bridge.state.owned["elf-male"], 3, "端末の他の札は保持");
  loseResponse = true;
  await assert.rejects(client.buyFoil("foil-4-5", ["pirate-male"]), /通信を確認/);
  assert.equal(bridge.state.owned["pirate-male:foil"], undefined);
  assert.ok(wallet.summary("client").purchasedFoils.includes("pirate-male:foil"));
  await client.buyFoil("foil-4-5", ["pirate-male"]);
  assert.equal(bridge.state.owned["pirate-male:foil"], 1);
  failAfterPurchase = true;
  await assert.rejects(client.buyFoil("foil-4-5", ["pirate-female"]), /保存できません/);
  assert.equal(bridge.state.owned["pirate-female:foil"], undefined);
  await client.syncWallet();
  assert.equal(bridge.state.owned["pirate-female:foil"], 1);
  assert.deepEqual(balances("client"), [17750, 12000]);
  assert.equal(bridge.state.gemsPaid, 17750);
  if (!secret.pending) {
    await assert.rejects(client.buyFoil("foil-a", ["genie-magician"]), /購入条件/);
    assert.deepEqual(balances("client"), [17750, 12000]);
    bridge.state = normalize({ ...bridge.state, owned: Object.fromEntries(prerequisites.map((id) => [id, 1])) });
    await client.buyFoil("foil-a", ["genie-magician"]);
    assert.equal(bridge.state.owned[secretId], 1);
    bridge.state = normalize(null);
    await client.buyFoil("foil-a", ["genie-magician"]);
    assert.equal(bridge.state.owned[secretId], 1, "所持一覧が消えても支払済みAを再送で復元");
    assert.deepEqual(balances("client"), [15750, 12000]);
  }
} finally {
  globalThis.fetch = previousFetch;
  if (previousStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previousStorage;
  if (previousBridge === undefined) delete globalThis.__foilPurchaseStore;
  else globalThis.__foilPurchaseStore = previousBridge;
}

db.close();
console.log("フォイル購入: 所持一覧同期・全32枚照合・有償限定・既所持拒否・永続付与・再送復元・途中失敗の巻戻し・旧購入復元・忘却 OK");
console.log("フォイル購入の通信: 実client→所持同期→実Wallet→mirror付与・同一要求再送・応答消失・保存失敗・端末消失後の復元 OK");
