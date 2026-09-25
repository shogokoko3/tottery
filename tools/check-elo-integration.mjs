import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Ledger } from "../src/server/ledger.js";
import { nextRating, displayRating, winStreakBonus } from "../src/game/rating.js";
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

// 対局数条件の廃止は今季の既存プレイヤーにも適用し、到達報酬を受け取れる。
const ranksDb = new DatabaseSync(":memory:"),
  ranksSql = (q, ...args) => ranksDb.prepare(q).all(...args),
  ranksLedger = new Ledger(ranksSql);
for (const [season, uid, rating, highest] of [
  ["2026-09", "short-general", 1650, 2],
  ["2026-09", "short-king", 1750, 3],
  ["2026-09", "former-king", 1400, 4],
  ["2026-08", "closed-season", 1750, 2],
]) {
  ranksSql(
    "INSERT INTO players VALUES (?,?,?,NULL,0.5,2,1,0,?,NULL,0)",
    season,
    uid,
    uid,
    highest,
  );
  ranksSql("INSERT INTO elo_ratings VALUES (?,?,?)", season, uid, rating);
}
assert.equal(ranksLedger.summary("short-general", now).player.highest, 3);
assert.equal(ranksLedger.summary("short-king", now).player.highest, 4);
assert.equal(ranksLedger.summary("former-king", now).player.highest, 4);
assert.equal(ranksLedger.list("2026-08")[0].highest, 2);
assert(
  ranksLedger
    .claim("short-general", "2026-09:general", now)
    .owned.frames.includes("gold-laurel"),
);
assert(
  ranksLedger
    .claim("short-king", "2026-09:king", now)
    .owned.titles.includes("season:2026-09:king"),
);
console.log(
  "レートのみの段位: 今季の既存記録・少ない対戦数での到達報酬・過去の達成保持: OK",
);

// 連勝ボーナス(2026-09-25 本人の指示): 勝ち続けるとレートに上乗せ、負けたらリセット
{
  const sdb = new DatabaseSync(":memory:"),
    ssql = (q, ...a) => sdb.prepare(q).all(...a),
    sled = new Ledger(ssql);
  const sNow = Date.parse("2026-09-10T09:00:00Z");
  const season = sled.current(sNow).id;
  const mk = (id, winner) => ({
    id,
    host: "P",
    guest: "Q",
    winner, // 0=P の勝ち
    names: ["P", "Q"],
    icons: ["", ""],
    fingerprint: id,
  });
  const rowP = () => sled.playerRow("P", season);
  const rowQ = () => sled.playerRow("Q", season);
  // 1勝目: 連勝1、ボーナスなし(winStreakBonus(1)=0)
  sled.record(mk("s1", 0), sNow);
  assert.equal(rowP().streak, 1, "1勝で連勝1");
  assert.equal(rowQ().streak, 0, "負けた側は連勝0");
  // 2勝目: 連勝2 → 通常の Elo + winStreakBonus(2)=+1
  let pBefore = rowP().rating,
    qBefore = rowQ().rating;
  const base2 = nextRating(pBefore, qBefore, true).rating;
  sled.record(mk("s2", 0), sNow + 1);
  assert.equal(rowP().streak, 2, "2連勝");
  assert.equal(winStreakBonus(2), 1);
  assert.equal(rowP().rating, base2 + 1, "2連勝でボーナス +1 が乗る");
  // さらに勝って連勝3、負けたら連勝0に戻る
  sled.record(mk("s3", 0), sNow + 2);
  assert.equal(rowP().streak, 3, "3連勝");
  sled.record(mk("s4", 1), sNow + 3); // Q の勝ち → P は負け
  assert.equal(rowP().streak, 0, "負けで連勝リセット");
  assert.equal(rowQ().streak, 1, "勝った側は連勝1");
  // 引き分けも連勝を止める
  sled.record(mk("s5", 0), sNow + 4);
  assert.equal(rowP().streak, 1);
  sled.record(mk("s6", null), sNow + 5); // 引き分け
  assert.equal(rowP().streak, 0, "引き分けも連勝を止める");
  // summary にも連勝が出る(マッチング画面の表示に使う)
  assert.equal(typeof sled.summary("P", sNow).player.streak, "number", "summary に連勝が出る");
  // Bot 戦でも連勝は積む
  const bdb = new DatabaseSync(":memory:"),
    bsql = (q, ...a) => bdb.prepare(q).all(...a),
    bled = new Ledger(bsql);
  bled.recordBot("B", { id: "b1", winner: 0, name: "た", icon: "" }, sNow, 2000);
  bled.recordBot("B", { id: "b2", winner: 0, name: "た", icon: "" }, sNow + 1, 2000);
  const bs = bled.recordBot("B", { id: "b3", winner: 0, name: "た", icon: "" }, sNow + 2, 2000);
  assert.equal(bs.streak, 3, "Bot 戦でも連勝を積む");
}
console.log("連勝ボーナス: 勝ちで積む・負けと引き分けでリセット・レートに上乗せ・Bot 戦でも積む: OK");
