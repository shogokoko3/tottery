import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Ledger } from "../src/server/ledger.js";
import { nextRating, displayRating } from "../src/game/rating.js";
import { readMatchRatings } from "../src/net/match-rating.js";

const db = new DatabaseSync(":memory:");
const sql = (q, ...args) => db.prepare(q).all(...args);
sql(
  "CREATE TABLE players (season TEXT, uid TEXT, name TEXT, icon TEXT, wr REAL, rated INTEGER, wins INTEGER, draws INTEGER, highest INTEGER, best INTEGER, PRIMARY KEY(season, uid))",
);
sql(
  "INSERT INTO players VALUES ('2026-09','host','赤','spade',0.6,50,30,0,3,2)",
);
sql(
  "INSERT INTO players VALUES ('2026-09','guest','青','heart',0.4,50,20,0,1,4)",
);
const ledger = new Ledger(sql),
  now = Date.parse("2026-09-08T09:00:00Z");
const before = ledger.list("2026-09");
assert.equal(before.find((p) => p.uid === "host").rating, displayRating(0.6));
assert.equal(before.find((p) => p.uid === "host").highest, 3);
const match = {
  id: "elo-match",
  host: "host",
  guest: "guest",
  winner: 0,
  names: ["赤", "青"],
  icons: ["spade", "heart"],
};
ledger.record(match, now);
const after = ledger.list("2026-09");
const a = after.find((p) => p.uid === "host"),
  b = after.find((p) => p.uid === "guest");
assert.equal(
  a.rating,
  nextRating(displayRating(0.6), displayRating(0.4), true).rating,
);
assert.equal(
  a.rating + b.rating,
  before.reduce((n, p) => n + p.rating, 0),
);
assert.equal(a.rated, 51);
assert.equal(a.wins, 31);
assert.equal(b.rated, 51);
assert.equal(b.wins, 20);
ledger.record(match, now + 1);
assert.deepEqual(ledger.list("2026-09"), after);
// Worker再起動で移行を繰り返しても、Eloの結果へ旧点数を上書きしない。
const reopened = new Ledger(sql);
assert.deepEqual(reopened.list("2026-09"), after);
reopened.record({ ...match, id: "elo-draw", winner: null }, now + 2);
assert.equal(
  reopened.list("2026-09").reduce((n, p) => n + p.rating, 0),
  a.rating + b.rating,
);
assert.equal(reopened.summary("host", now + 3).player.highest, 3);

const cache = new Map();
globalThis.sessionStorage = {
  getItem: (k) => cache.get(k) ?? null,
  setItem: (k, v) => cache.set(k, v),
};
let records = { host: { rating: 1500 }, guest: { rating: 1700 } },
  requests = 0;
const fetcher = async (url) => {
  requests++;
  const uid = new URL(url).pathname.split("/").at(-1).replace(".json", "");
  return Response.json(records[uid] || null);
};
const host = {
  code: "ELOTEST",
  createdAt: now,
  myPlayerIndex: 0,
  foeUid: "guest",
  ratings: [4000, 4000],
};
const guest = { ...host, myPlayerIndex: 1, foeUid: "host" };
assert.deepEqual(
  await readMatchRatings(host, 0, { uid: "host", fetcher }),
  [1500, 1700],
);
// 同じ対戦への復帰では開始時の点数を使い、再戦では更新済み点数を読み直す。
records = { host: { rating: 1524 }, guest: { rating: 1676 } };
assert.deepEqual(
  await readMatchRatings(host, 0, { uid: "host", fetcher }),
  [1500, 1700],
);
assert.equal(requests, 2);
assert.deepEqual(
  await readMatchRatings(host, 1, { uid: "host", fetcher }),
  [1524, 1676],
);
cache.clear();
assert.deepEqual(
  await readMatchRatings(guest, 1, { uid: "guest", fetcher }),
  [1524, 1676],
);
cache.clear();
records = {};
assert.deepEqual(
  await readMatchRatings(host, 2, { uid: "host", fetcher }),
  [1500, 1500],
);
await assert.rejects(
  readMatchRatings(host, 3, {
    uid: "host",
    fetcher: async () => new Response("offline", { status: 503 }),
  }),
);
assert.notEqual(
  JSON.parse(cache.get("tottery.match-ratings.v2")).key,
  JSON.stringify([host.code, now, 3, ["host", "guest"]]),
);
console.log(
  "Elo integration: legacy SQLite migration, pair result, deduplication, restart, retained rewards, saved opponent ratings, reload/rematch and offline handling: OK",
);
