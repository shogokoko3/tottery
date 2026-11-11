/**
 * TestFlight の期間に遊んだ人の記録を一度だけ全部消す(2026-11-11 本人の指示)ことを確かめる。
 *   1. 消すのは「起動時に口座の控えがあり、その口座が公開(11/11 08:47)より前に作られた」ときだけ
 *   2. 順番は「自分の記録を消す」と同じ。サーバー側が消せなければ端末の中は消さず、印も付けない
 *   3. 待たせすぎて画面を開いたあとは、端末の中を消さない
 *   4. 印があれば何もしない。新しい端末は調べずに印だけ付ける
 *   5. Worker: 公開前の口座の一覧を、起動時に一度だけ forget と同じ3つで消す。公開後の人は残る
 *   6. main.jsx: 画面を出す前に走らせる
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

function memStore(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}
globalThis.localStorage = memStore();
globalThis.sessionStorage = memStore();

const { runTestflightReset, shouldReset, RELEASE_CUTOFF, MARK } = await import(
  "../src/net/tf-reset.js"
);

assert.equal(RELEASE_CUTOFF, Date.parse("2026-11-11T08:47:00+09:00"), "公開の時刻");
assert.equal(shouldReset({ hadAccount: true, createdAt: RELEASE_CUTOFF - 1 }), true);
assert.equal(shouldReset({ hadAccount: true, createdAt: RELEASE_CUTOFF }), false, "公開後の人は消さない");
assert.equal(shouldReset({ hadAccount: false, createdAt: 1 }), false, "控えの無い端末は消さない");
assert.equal(shouldReset({ hadAccount: true, createdAt: null }), false);

function fakeDeps(over = {}) {
  const calls = [];
  const d = {
    createdAt: async () => RELEASE_CUTOFF - 86400000,
    clearProfileSync: async () => calls.push("clearProfileSync"),
    clearSeasonQueue: () => calls.push("clearSeasonQueue"),
    forgetSeason: async () => calls.push("forgetSeason"),
    deleteRank: async (id) => (calls.push(`deleteRank:${id}`), { ok: true }),
    profileId: () => "uid-1",
    forgetMe: () => calls.push("forgetMe"),
    forgetEverything: () => calls.push("forgetEverything"),
    ...over,
  };
  return { d, calls };
}
const withAccount = () =>
  memStore({ "tottery.auth.v1": '{"refreshToken":"r","uid":"uid-1"}', "tottery.skins.v1": "[]" });

// 公開前の口座: 全部消して印
{
  const storage = withAccount();
  const { d, calls } = fakeDeps();
  const r = await runTestflightReset({ storage, deps: d });
  assert.deepEqual(r, { reset: true });
  assert.deepEqual(calls, [
    "clearProfileSync",
    "clearSeasonQueue",
    "forgetSeason",
    "deleteRank:uid-1",
    "forgetMe",
    "forgetEverything",
  ], "自分の記録を消すと同じ順番");
  assert.ok(storage.getItem(MARK), "印が付く");
  // 2回目は何もしない
  const again = fakeDeps();
  assert.deepEqual(await runTestflightReset({ storage, deps: again.d }), { reset: false });
  assert.deepEqual(again.calls, [], "印があれば何もしない");
}
// 公開後の口座: 消さずに印
{
  const storage = withAccount();
  const { d, calls } = fakeDeps({ createdAt: async () => RELEASE_CUTOFF + 1000 });
  assert.deepEqual(await runTestflightReset({ storage, deps: d }), { reset: false });
  assert.deepEqual(calls, []);
  assert.ok(storage.getItem(MARK));
  assert.ok(storage.getItem("tottery.skins.v1"), "端末の記録は残る");
}
// 新しく入れた端末(控えなし): 調べずに印
{
  const storage = memStore();
  let asked = false;
  const { d } = fakeDeps({ createdAt: async () => ((asked = true), 1) });
  assert.deepEqual(await runTestflightReset({ storage, deps: d }), { reset: false });
  assert.equal(asked, false, "口座を調べない");
  assert.ok(storage.getItem(MARK));
}
// 通信できない・時刻が分からない: 印を付けず次の起動へ
for (const createdAt of [async () => null, async () => { throw new Error("offline"); }]) {
  const storage = withAccount();
  const { d, calls } = fakeDeps({ createdAt });
  assert.deepEqual(await runTestflightReset({ storage, deps: d }), { reset: false });
  assert.deepEqual(calls, []);
  assert.equal(storage.getItem(MARK), null);
}
// サーバー側が消せない: 端末の中は消さない
for (const over of [
  { forgetSeason: async () => { throw new Error("HTTP 500"); } },
  { deleteRank: async () => ({ ok: false, error: "x" }) },
]) {
  const storage = withAccount();
  const { d, calls } = fakeDeps(over);
  assert.deepEqual(await runTestflightReset({ storage, deps: d }), { reset: false });
  assert.ok(!calls.includes("forgetEverything"), "端末の中は消さない");
  assert.equal(storage.getItem(MARK), null, "印を付けない(やり直す)");
}
// 画面を先に開いたあと: 端末の中は消さない
{
  const storage = withAccount();
  const { d, calls } = fakeDeps();
  assert.deepEqual(await runTestflightReset({ storage, deps: d, stillWanted: () => false }), { reset: false });
  assert.ok(!calls.includes("forgetEverything"));
  assert.equal(storage.getItem(MARK), null);
}
// 本物の forgetEverything で、印が消し残りでなく最後に付くこと
{
  const { forgetEverything } = await import("../src/game/forget.js");
  globalThis.localStorage = withAccount();
  const { d } = fakeDeps({ forgetEverything });
  await runTestflightReset({ storage: globalThis.localStorage, deps: d });
  assert.deepEqual([...globalThis.localStorage._map.keys()], [MARK], "残るのは印だけ");
}

// 5. Worker
const { TF_PLAYERS_2026_11_11: list } = await import("../src/server/tf-players-2026-11-11.js");
const { OPERATOR_UID } = await import("../src/net/auth.js");
assert.equal(list.length, 647, "公開前の口座 647 件");
assert.equal(new Set(list).size, list.length, "重なりなし");
assert.ok(list.includes(OPERATOR_UID), "本人(運営)も含める(本人の指示)");
const worker = readFileSync(new URL("../src/server/worker.js", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(
  /cleanupOnce\("tf-players-2026-11-11", \(\) => \{ for \(const uid of TF_PLAYERS_2026_11_11\) \{ this\.wallet\.forget\(uid\); this\.friends\.forget\(uid\); this\.ledger\.forget\(uid\); \} \}\)/.test(worker),
  "一度だけ、forget と同じ3つで消す",
);
// 実際の台帳で: 一覧の人だけ消え、公開後の人は残る
{
  const { Ledger } = await import("../src/server/ledger.js");
  const { Wallet } = await import("../src/server/wallet.js");
  const { Friends } = await import("../src/server/friends.js");
  const db = new DatabaseSync(":memory:");
  const sql = (q, ...a) => db.prepare(q).all(...a);
  const ledger = new Ledger(sql), wallet = new Wallet(sql), friends = new Friends(sql);
  const tf = list[0], real = "real-after-release";
  for (const uid of [tf, real]) {
    sql("INSERT INTO wallets (uid, tickets, updated, gems, gems_free) VALUES (?,?,?,?,?)", uid, 5, 1, 100, 10);
    sql("INSERT INTO profile_backups VALUES (?,?,?)", uid, "{}", 1);
    sql("INSERT INTO friend_codes VALUES (?,?,?)", uid, uid.slice(0, 6), 1);
  }
  let runs = 0;
  const run = () =>
    ledger.cleanupOnce("tf-players-2026-11-11", () => {
      runs++;
      for (const uid of list) {
        wallet.forget(uid);
        friends.forget(uid);
        ledger.forget(uid);
      }
    });
  run();
  run();
  assert.equal(runs, 1, "二度は走らない");
  for (const t of ["wallets", "profile_backups", "friend_codes"]) {
    assert.equal(sql(`SELECT COUNT(*) n FROM ${t} WHERE uid=?`, tf)[0].n, 0, `${t}: テストの人は消える`);
    assert.equal(sql(`SELECT COUNT(*) n FROM ${t} WHERE uid=?`, real)[0].n, 1, `${t}: 公開後の人は残る`);
  }
}

// 6. main.jsx
const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/runTestflightReset\(\{ stillWanted: \(\) => resetWanted \}\)/.test(main), "起動時に走らせる");
assert.ok(main.indexOf("runTestflightReset({") < main.indexOf("createRoot("), "画面を出す前");
assert.ok(/resetWanted = false; createRoot\(/.test(main), "開いたあとは端末を消さない");

console.log("check-tf-reset: ok");
