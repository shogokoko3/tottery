import assert from "node:assert/strict";
import { canPatch } from "./check-rules.mjs";
import {
  profileRecord,
  profilePatch,
  reconciliationPlan,
} from "../src/net/profile-record.js";
import {
  publishProfile,
  retryProfileSync,
  profileSyncPending,
} from "../src/net/profile-sync.js";
import { readRanks } from "../src/net/ranking.js";

const mem = new Map([
  [
    "tottery.auth.v1",
    JSON.stringify({ uid: "sync-user", refreshToken: "fixture-refresh" }),
  ],
]);
globalThis.localStorage = {
  getItem: (k) => mem.get(k) || null,
  setItem: (k, v) => mem.set(k, v),
  removeItem: (k) => mem.delete(k),
};
const profile = {
  id: "sync-user",
  name: "old",
  plays: 7,
  wins: 4,
  rated: 5,
  rating: 1560,
};
let db = { players: {}, ranks: {}, bans: {} },
  writes = [],
  fail = false;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes("securetoken"))
    return Response.json({
      user_id: profile.id,
      id_token: "fixture-token",
      refresh_token: "fixture-refresh",
      expires_in: "3600",
    });
  const path = new URL(url).pathname
    .replace(/^\//, "")
    .replace(/\.json$/, "")
    .replace(/\/$/, "");
  if (init.method === "PATCH") {
    assert.equal(path, "", "one root multi-path update");
    const patch = JSON.parse(init.body);
    writes.push(patch);
    if (fail) return Response.json({ error: "unavailable" }, { status: 503 });
    if (!canPatch(db, [], { uid: profile.id }, patch))
      return Response.json({ error: "denied" }, { status: 403 });
    for (const [key, value] of Object.entries(patch)) {
      const [tree, id] = key.split("/");
      db[tree][id] = value;
    }
    return Response.json(patch);
  }
  const value = path
    .split("/")
    .filter(Boolean)
    .reduce((v, k) => v?.[k], db);
  return Response.json(value || null);
};
assert.equal((await publishProfile(profile, { since: 1000 })).ok, true);
assert.equal(writes.length, 1);
assert.equal(db.players[profile.id].since, 1000);
assert.deepEqual(
  db.ranks[profile.id],
  profileRecord(profile, db.players[profile.id].at),
);

const before = structuredClone(db);
fail = true;
assert.equal(
  (
    await publishProfile({
      ...profile,
      name: "renamed",
      icon: "crown",
      title: "first",
      plays: 8,
      wins: 5,
    })
  ).ok,
  false,
);
assert.deepEqual(db, before, "a failed update changes neither copy");
assert.equal(profileSyncPending(), true, "HTTP failure retains retry data");
fail = false;
assert.equal((await retryProfileSync()).ok, true);
assert.equal(profileSyncPending(), false);
assert.equal(db.players[profile.id].name, "renamed");
assert.equal(db.ranks[profile.id].icon, "crown");
assert.equal(db.ranks[profile.id].title, "first");
assert.equal(
  db.players[profile.id].since,
  1000,
  "ordinary updates preserve registration date",
);

await Promise.all([
  publishProfile({ ...profile, name: "first" }),
  publishProfile({ ...profile, name: "last" }),
]);
assert.equal(
  db.players[profile.id].name,
  "last",
  "rapid edits retain request order",
);
assert.equal(db.ranks[profile.id].name, "last");
assert.equal(canPatch(db, [], { uid: "intruder" }, writes.at(-1)), false);
assert.equal(canPatch(db, [], null, writes.at(-1)), false);
assert.equal(
  canPatch(
    { ...db, bans: { [profile.id]: { at: 1 } } },
    [],
    { uid: profile.id },
    writes.at(-1),
  ),
  false,
);
const unranked = profileRecord({ ...profile, rated: 0 });
assert.equal(
  Object.hasOwn(
    profilePatch(profile.id, unranked, null, null),
    `ranks/${profile.id}`,
  ),
  false,
);

db.ranks = {
  qualified: profileRecord({ ...profile, name: "qualified", rating: 1200 }),
};
for (let i = 0; i < 55; i++)
  db.ranks[`unranked${i}`] = profileRecord({ ...profile, rated: 0 });
assert.deepEqual(
  (await readRanks(50)).list.map((r) => r.id),
  ["qualified"],
  "unranked rows cannot displace eligible players in the top 50",
);

const old = profileRecord(profile, 100),
  newer = profileRecord({ ...profile, name: "renamed", plays: 10 }, 200);
const repair = reconciliationPlan(
  { [profile.id]: { ...newer, since: 50 } },
  { [profile.id]: old },
);
assert.equal(repair.length, 1);
assert.deepEqual(repair[0].after, newer);
assert.equal(
  reconciliationPlan(
    { [profile.id]: { ...newer, since: 50 } },
    { [profile.id]: newer },
  ).length,
  0,
);
assert.equal(
  reconciliationPlan({ [profile.id]: { ...newer, since: 50 } }, {}).length,
  1,
  "missing eligible rank is restored",
);
assert.equal(
  reconciliationPlan({ [profile.id]: { ...newer, rated: 0, since: 50 } }, {})
    .length,
  0,
);
/* ---- 登録の順序: サインインが済み、鍵が uid にそろってから載せる ---- */
// 名前を保存した直後に載せると、起動時の匿名サインインがまだなら端末製の
// 鍵(p…)で送って 401 になり、登録した直後に「保存できていません」が出る。
// ここでは Firebase の代わりがルールどおりに弾く(鍵が uid でなければ 401)。
const { signOut } = await import("../src/net/auth.js");
const { registerPlayer } = await import("../src/net/players.js");
const { loadProfile } = await import("../src/game/profile.js");
const { canRead } = await import("./check-rules.mjs");
const notices = [];
globalThis.window = { dispatchEvent: (e) => notices.push(e.detail) };
const tokens = { "fixture-token": "sync-user", "fresh-token": "fresh-uid" };
let requests = [],
  signUpFails = false;
db = { players: {}, ranks: {}, bans: {} };
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.hostname === "identitytoolkit.googleapis.com") {
    // 遅いサインイン。「はじめる」のほうが先に押される状況を作る
    await new Promise((r) => setTimeout(r, 30));
    if (signUpFails)
      return Response.json({ error: { message: "unavailable" } }, { status: 503 });
    return Response.json({
      localId: "fresh-uid",
      idToken: "fresh-token",
      refreshToken: "fresh-refresh",
      expiresIn: "3600",
    });
  }
  if (u.hostname === "securetoken.googleapis.com")
    return Response.json({
      user_id: "fresh-uid",
      id_token: "fresh-token",
      refresh_token: "fresh-refresh",
      expires_in: "3600",
    });
  const uid = tokens[u.searchParams.get("auth")];
  const auth = uid ? { uid } : null;
  const path = u.pathname
    .replace(/^\//, "")
    .replace(/\.json$/, "")
    .split("/")
    .filter(Boolean);
  requests.push({ method: init.method || "GET", path: path.join("/"), auth: !!auth });
  if (init.method === "PATCH") {
    const patch = JSON.parse(init.body);
    if (!canPatch(db, [], auth, patch))
      return Response.json({ error: "Permission denied" }, { status: 401 });
    for (const [key, value] of Object.entries(patch)) {
      const [tree, id] = key.split("/");
      db[tree][id] = value;
    }
    return Response.json(patch);
  }
  if (!canRead(db, path, auth))
    return Response.json({ error: "Permission denied" }, { status: 401 });
  return Response.json(path.reduce((v, k) => v?.[k], db) ?? null);
};

// はじめて開いた端末: 控えも名前も無い
signOut();
mem.delete("tottery.account.v1");
const reg = await registerPlayer("しんじん");
assert.equal(
  reg.profile.id,
  "fresh-uid",
  "registration waits for sign-in and keys the profile by the Firebase uid",
);
assert.equal(loadProfile().id, "fresh-uid");
assert.equal((await reg.sync).ok, true, "the first publish succeeds");
assert.ok(requests.length > 0, "the registration is sent");
assert.ok(
  requests.every(
    (r) => r.auth && /^(players|ranks)\/fresh-uid$|^$/.test(r.path),
  ),
  `every request is signed in and keyed by the uid: ${JSON.stringify(requests)}`,
);
assert.equal(db.players["fresh-uid"].name, "しんじん");
assert.equal(typeof db.players["fresh-uid"].since, "number");
assert.equal(notices.includes("failed"), false, "no failed toast on registration");
assert.equal(profileSyncPending(), false);

// 鍵が自分の uid と違う行(付け替え前の p… など)は、送っても必ず弾かれる。
// 送らず、失敗の通知も出さない
requests = [];
notices.length = 0;
assert.equal(
  (await publishProfile({ ...profile, id: "p0stale00000000", name: "stale" })).ok,
  false,
);
assert.equal(requests.length, 0, "a row keyed by a stale id is never sent");
assert.equal(notices.includes("failed"), false);

// サインインできない(圏外): 名前は端末に残すが、鍵の無い送信はしない。
// 起動時の同期が通信の戻ったあとに拾う
signOut();
mem.delete("tottery.account.v1");
signUpFails = true;
requests = [];
notices.length = 0;
const off = await registerPlayer("けんがい");
assert.equal(off.profile.name, "けんがい", "the name is kept locally");
assert.equal((await off.sync).ok, false);
assert.equal(requests.length, 0, "nothing is sent without a sign-in");
assert.equal(notices.includes("failed"), false, "no failed toast when offline at registration");

console.log(
  "PASS: atomic profile/rank writes, denied and failed requests, persistent retry, ordered edits, registration date, ranked eligibility, idempotent historical repair, and registration after sign-in keyed by uid",
);
process.exit(0);
