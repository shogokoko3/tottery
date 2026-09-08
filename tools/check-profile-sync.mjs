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
console.log(
  "PASS: atomic profile/rank writes, denied and failed requests, persistent retry, ordered edits, registration date, ranked eligibility, and idempotent historical repair",
);
process.exit(0);
