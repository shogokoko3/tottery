import assert from "node:assert/strict";
import {
  missionPeriods,
  recordMissionLogin,
  recordMissionGame,
  periodicMissionRows,
  claimPeriodicMission,
} from "../src/game/periodic-missions.js";
import { normalize, pull, craft } from "../src/skins/collection.js";
import { loadProfile, touchDay, recordGame } from "../src/game/profile.js";
import {
  updateCollection,
  getCollection,
  COLLECTION_KEY,
} from "../src/skins/store.js";
import { listMissions, claimableCount } from "../src/game/missions.js";
const time = (text) => Date.parse(text + "+09:00");
const monday = time("2026-09-07T05:00:00");
assert.equal(missionPeriods(monday - 1).day, "2026-09-06");
assert.equal(missionPeriods(monday - 1).week, "2026-08-31");
assert.equal(missionPeriods(monday).day, "2026-09-07");
assert.equal(missionPeriods(monday).week, "2026-09-07");
assert.equal(missionPeriods(monday).nextDay, monday + 86400000);
assert.equal(missionPeriods(monday).nextWeek, monday + 7 * 86400000);
assert.equal(missionPeriods(time("2027-01-01T04:59:59")).day, "2026-12-31");
assert.equal(missionPeriods(time("2028-03-01T04:59:59")).day, "2028-02-29");

let profile = { missionProgress: recordMissionLogin(null, monday) };
profile.missionProgress = recordMissionLogin(
  profile.missionProgress,
  monday + 3000,
);
assert.equal(
  profile.missionProgress.loginDays.length,
  1,
  "same-day reopen is one login",
);
for (let day = 1; day < 5; day++)
  profile.missionProgress = recordMissionLogin(
    profile.missionProgress,
    monday + day * 86400000,
  );
let rows = periodicMissionRows(profile, normalize(null), monday + 4 * 86400000);
assert.equal(rows.length, 10);
assert.equal(rows.filter((m) => m.category === "daily").length, 4);
assert.equal(rows.filter((m) => m.category === "weekly").length, 6);
assert.equal(
  rows.find((m) => m.category === "weekly" && m.key === "login").now,
  5,
);
assert.equal(
  rows.find((m) => m.category === "weekly" && m.key === "login").segments,
  true,
);
let progress = recordMissionLogin(null, monday);
const event = {
  online: true,
  won: true,
  matchId: "room-created:0",
  ranks: ["K", "10", "4", "2"],
};
for (const ignored of [
  { ...event, online: false },
  { ...event, tutorial: true },
]) {
  assert.equal(
    recordMissionGame(progress, ignored, monday).wins,
    0,
    "offline/tutorial excluded",
  );
}
progress = recordMissionGame(
  progress,
  { ...event, won: null, matchId: "draw" },
  monday,
);
progress = recordMissionGame(
  progress,
  { ...event, won: false, matchId: "loss" },
  monday,
);
assert.equal(progress.gameDays.length, 1);
assert.equal(progress.wins, 0);
assert.equal(progress.ranks.length, 0);
progress = recordMissionGame(progress, event, monday);
assert.equal(progress.wins, 1);
assert.deepEqual(progress.ranks, ["K", "10", "4", "2"]);
assert.equal(
  recordMissionGame(progress, event, monday + 1).wins,
  1,
  "same match is idempotent",
);
assert.equal(
  recordMissionGame(progress, event, monday + 86400000).gameDays.length,
  1,
  "replay tomorrow is not a new match",
);
for (let n = 1; n < 7; n++)
  progress = recordMissionGame(
    progress,
    { ...event, matchId: `round:${n}` },
    monday,
  );
assert.equal(progress.wins, 5);
assert.equal(
  recordMissionGame(progress, event, monday + 7 * 86400000).wins,
  0,
  "old match after weekly reset stays ignored",
);
profile = { missionProgress: progress };
let collection = normalize(null);
rows = periodicMissionRows(profile, collection, monday);
assert.equal(
  rows.find((m) => m.key === "all").now,
  2,
  "daily all excludes itself and needs gacha",
);
const originalNow = Date.now;
Date.now = () => monday;
try {
  assert.throws(() => pull(collection, 2));
  assert.equal(collection.missionDrawDay, null);
  assert.throws(() => pull(collection, 1, () => NaN));
  collection = pull(collection, 10, () => 0.5);
  assert.equal(collection.missionDrawDay, "2026-09-07");
  assert.equal(
    periodicMissionRows(profile, collection, monday).find(
      (m) => m.key === "gacha",
    ).now,
    1,
  );
  assert.equal(
    periodicMissionRows(profile, collection, monday).find(
      (m) => m.key === "all",
    ).done,
    true,
  );
  assert.equal(
    craft(normalize({ ether: 10000 }), "elf-male", () => 0.5).missionDrawDay,
    null,
    "craft is not gacha",
  );
  rows = periodicMissionRows(profile, collection, monday);
  for (const row of rows.filter((m) => m.category === "daily"))
    collection = claimPeriodicMission(collection, profile, row.id, monday);
  assert.equal(collection.tickets, 3);
  assert.equal(collection.ether, 40);
  const again = claimPeriodicMission(
    collection,
    profile,
    rows.find((m) => m.key === "all").id,
    monday,
  );
  assert.deepEqual(again, collection);
  assert.deepEqual(
    normalize(JSON.parse(JSON.stringify(collection))),
    collection,
  );
  const tomorrow = periodicMissionRows(profile, collection, monday + 86400000);
  assert.ok(
    tomorrow
      .filter((m) => m.category === "daily")
      .every((m) => !m.done && !m.claimed),
  );
  assert.equal(
    tomorrow.find((m) => m.key === "wins").now,
    5,
    "weekly wins survive daily reset",
  );
  assert.throws(
    () =>
      claimPeriodicMission(collection, profile, rows[0].id, monday + 86400000),
    /更新/,
  );
  assert.ok(
    periodicMissionRows(profile, collection, monday + 7 * 86400000).every(
      (m) => !m.done && !m.claimed,
    ),
  );
  assert.throws(
    () => claimPeriodicMission(normalize(null), {}, rows[0].id, monday),
    /条件/,
  );

  const memory = new Map();
  let fail = false;
  globalThis.localStorage = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => {
      if (fail && k === COLLECTION_KEY) throw Error("quota");
      memory.set(k, String(v));
    },
  };
  let live = touchDay(monday);
  assert.equal(touchDay(monday + 1000).missionProgress.loginDays.length, 1);
  recordGame(true, { online: false, matchId: "cpu", at: monday });
  assert.equal(loadProfile().missionProgress.wins, 0);
  recordGame(true, {
    online: true,
    tutorial: true,
    matchId: "tutorial",
    adoptedRanks: ["K"],
    at: monday,
  });
  assert.equal(loadProfile().missionProgress.wins, 0);
  recordGame(true, {
    online: true,
    matchId: "actual-room:0",
    adoptedRanks: ["K", "2"],
    at: monday,
  });
  recordGame(true, {
    online: true,
    matchId: "actual-room:0",
    adoptedRanks: ["K", "2"],
    at: monday,
  });
  live = loadProfile();
  assert.equal(live.missionProgress.wins, 1);
  assert.deepEqual(live.missionProgress.ranks, ["K", "2"]);
  const dailyLogin = periodicMissionRows(live, normalize(null), monday)[0].id;
  fail = true;
  await assert.rejects(
    updateCollection((s) => claimPeriodicMission(s, live, dailyLogin, monday)),
    /保存/,
  );
  assert.equal(
    memory.has(COLLECTION_KEY),
    false,
    "failed save grants neither currency nor receipt",
  );
  fail = false;
  await Promise.all([
    updateCollection((s) => claimPeriodicMission(s, live, dailyLogin, monday)),
    updateCollection((s) => claimPeriodicMission(s, live, dailyLogin, monday)),
  ]);
  assert.equal(getCollection().ether, 10, "concurrent claims grant once");
  assert.equal(getCollection().missionClaims.length, 1);
  assert.equal(
    listMissions(live, getCollection()).filter((m) => m.periodic).length,
    10,
  );
  assert.equal(
    claimableCount(live, getCollection()),
    listMissions(live, getCollection()).filter((m) => m.done && !m.claimed)
      .length,
  );
  assert.equal(
    periodicMissionRows(live, getCollection(), monday).filter(
      (m) => m.key.startsWith("rank-") && m.done,
    ).length,
    2,
  );
} finally {
  Date.now = originalNow;
}
console.log(
  "Periodic missions: 05:00 JST daily/Monday reset, 10 rewards, five-step progress, login dedupe, online-only/rank wins, draw/loss, gacha vs crafting, daily completion, atomic/concurrent claims, persistence and stale receipts passed.",
);
