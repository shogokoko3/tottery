/**
 * アプリ側の課金・財布の口を確かめる(通信は偽物)。
 *  - 商品の目録が矛盾していない
 *  - 遊んで貯める分の控え: 同じ id は一度だけ、通信の失敗は残し、二度と通らないものは捨てる
 *  - 購入の控え: 通ったら消す、400(二度と通らない)も消す、通信の失敗は残す
 */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
globalThis.location = { protocol: "http:", origin: "http://localhost", href: "http://localhost/" };
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
Object.defineProperty(globalThis, 'navigator', { value: { locks: undefined }, configurable: true });
// サインインは偽物(合言葉があるように見せる)
store["tottery.auth.v1"] = JSON.stringify({ refreshToken: "r", uid: "uidT" });
const calls = [];
let mode = "ok";
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("securetoken")) return { ok: true, status: 200, json: async () => ({ id_token: "t", user_id: "uidT", expires_in: 3600, refresh_token: "r" }) };
  calls.push({ url: u, body: init && init.body ? JSON.parse(init.body) : null });
  if (mode === "net") throw new Error("offline");
  if (mode === "reject") return { ok: false, status: 400, json: async () => ({ error: "今日はこれ以上受け取れません。" }) };
  if (mode === "server") return { ok: false, status: 500, json: async () => ({ error: "x" }) };
  return { ok: true, status: 200, json: async () => ({ tickets: 42, entitlements: [] }) };
};
const { PRODUCTS, PRODUCT_IDS, GEM_PACKS, GEM_PER_TICKET, BATTLEPASS_GEMS, BATTLEPASS_ENTITLEMENT, productOf } = await import("../src/iap/catalog.js");
const { earnTickets, flushPending, syncWallet } = await import("../src/net/wallet.js");
const { flushPurchases } = await import("../src/net/iap.js");
const { getCollection } = await import("../src/skins/store.js");

let ok = 0; const fails = [];
const is = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { ok++; console.log(`  ok   ${label}`); }
  else { fails.push(label); console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); }
};
const pending = () => JSON.parse(store["tottery.wallet.pending.v1"] || "[]").map((x) => x.id);

console.log("商品の目録");
is("商品 id は重複しない", new Set(PRODUCT_IDS).size, PRODUCTS.length);
is("売るのはジェムのパックだけ", PRODUCTS.every((p) => p.kind === "gems" && Number.isSafeInteger(p.gems) && p.gems > 0), true);
is("パックは目録の GEM_PACKS と同じ", PRODUCTS.map((p) => p.id), GEM_PACKS.map((p) => p.id));
is("ジェムの値付けは正の整数", Number.isSafeInteger(GEM_PER_TICKET) && GEM_PER_TICKET > 0 && Number.isSafeInteger(BATTLEPASS_GEMS) && BATTLEPASS_GEMS > 0, true);
is("バトルパスは App Store の商品ではない(ジェムで買う)", productOf(BATTLEPASS_ENTITLEMENT), null);

console.log("\n遊んで貯める分の控え");
mode = "net";
await earnTickets("login:1", 3);
is("圏外なら控えに残る", pending(), ["login:1"]);
await earnTickets("login:1", 3);
is("同じ id は二重に控えない", pending(), ["login:1"]);
mode = "ok"; calls.length = 0;
await flushPending();
is("通じたら送って控えから消す", pending(), []);
is("送った中身は id と枚数", calls[0].body, { id: "login:1", n: 3 });
is("サーバーの残高を端末の写しへ", getCollection().tickets, 42);
mode = "reject";
await earnTickets("login:2", 3);
is("二度と通らないもの(上限)は捨てる", pending(), []);
mode = "server";
await earnTickets("login:3", 3);
is("サーバーの一時的な失敗は残す", pending(), ["login:3"]);

console.log("\n購入の控え");
store["tottery.iap.pending.v1"] = JSON.stringify([{ jws: "A", at: 1 }, { jws: "B", at: 2 }]);
mode = "ok"; calls.length = 0;
await flushPurchases();
is("通った取引は控えから消える", JSON.parse(store["tottery.iap.pending.v1"]), []);
is("検証の口へ送っている", calls.map((c) => c.url.endsWith("/api/iap/verify")), [true, true]);
store["tottery.iap.pending.v1"] = JSON.stringify([{ jws: "C", at: 1 }]);
mode = "reject"; await flushPurchases();
is("400(二度と通らない)は捨てる", JSON.parse(store["tottery.iap.pending.v1"]), []);
store["tottery.iap.pending.v1"] = JSON.stringify([{ jws: "D", at: 1 }]);
mode = "net"; await flushPurchases();
is("通信の失敗は残す(次に開いたとき送り直す)", JSON.parse(store["tottery.iap.pending.v1"]).map((x) => x.jws), ["D"]);
mode = "ok";
is("syncWallet は残高を返す", (await syncWallet()).tickets, 42);

console.log(`\n${ok} 件 ok / ${fails.length} 件 NG`);
process.exit(fails.length ? 1 : 0);
