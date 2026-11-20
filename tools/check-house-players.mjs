/**
 * ランキングに混ぜる運営のプレイヤー32人(src/server/house-players.js、2026-11-20 本人の指示)。
 *   1. 32人・名前は10字まで・uid と名前が重ならない・Bot の名前と重ならない
 *   2. 同じ時刻なら何度計算しても同じ値(台帳に書かない)
 *   3. 日ごとに持ち点と局数が動く。持ち点は寄る値の近くに留まる
 *   4. 実際の人の10位(10人いなければ最下位)より必ず下
 *   5. 台帳: house:true のときだけ一覧に入り、players 表には書かない。検査の既定(false)では出ない
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Ledger } from "../src/server/ledger.js";
import { HOUSE_PLAYERS, HOUSE_EPOCH, houseStanding, houseRows } from "../src/server/house-players.js";
import { BOT_NAMES } from "../src/game/bot-match.js";
import { RATED_SEASONS } from "../src/game/season.js";

// 1
assert.equal(HOUSE_PLAYERS.length, 32);
assert.equal(new Set(HOUSE_PLAYERS.map((p) => p.uid)).size, 32, "uid が重ならない");
assert.equal(new Set(HOUSE_PLAYERS.map((p) => p.name)).size, 32, "名前が重ならない");
for (const p of HOUSE_PLAYERS) {
  assert.ok(p.name.length >= 1 && p.name.length <= 10, `${p.name} は10字まで`);
  assert.ok(!BOT_NAMES.includes(p.name), `${p.name} は Bot の名前と別`);
  assert.match(p.uid, /^[A-Za-z0-9]{28}$/);
}

const s1 = RATED_SEASONS[0];
const at = (iso) => Date.parse(iso);

// 2
const a = houseRows(s1, at("2026-11-20T06:00:00Z"), []);
const b = houseRows(s1, at("2026-11-20T06:00:00Z"), []);
assert.deepEqual(a, b, "同じ時刻なら同じ");
assert.ok(a.length >= 25, `始まって4日でほとんどが載る(${a.length}人)`);

// 3
const day4 = houseStanding(HOUSE_PLAYERS[2], s1.start, at("2026-11-20T06:00:00Z"));
const day10 = houseStanding(HOUSE_PLAYERS[2], s1.start, at("2026-11-26T06:00:00Z"));
assert.ok(day10.rated > day4.rated, "局数が増える");
let moved = 0;
for (const p of HOUSE_PLAYERS) {
  const x = houseStanding(p, s1.start, at("2026-11-20T06:00:00Z"));
  const y = houseStanding(p, s1.start, at("2026-11-23T06:00:00Z"));
  if (x.rating !== y.rating) moved++;
  for (let d = 0; d < 45; d++) {
    const r = houseStanding(p, s1.start, HOUSE_EPOCH + d * 86400000).rating;
    assert.ok(Math.abs(r - p.base) <= 160, `${p.name} は寄る値の近く(${d}日目 ${r})`);
  }
  const w = houseStanding(p, s1.start, s1.end);
  assert.ok(w.wins <= w.rated);
}
assert.ok(moved >= 20, `3日で多くの人の持ち点が動く(${moved}人)`);

// 4
const reals = Array.from({ length: 15 }, (_, i) => ({ uid: `r${i}`, rating: 1700 - i * 20, rated: 3 }));
const tenth = 1700 - 9 * 20;
for (const r of houseRows(s1, at("2026-11-28T06:00:00Z"), reals))
  assert.ok(r.rating < tenth, `${r.name} は実際の人の10位より下(${r.rating})`);
const few = [{ uid: "x", rating: 1400, rated: 1 }, { uid: "y", rating: 1600, rated: 2 }];
const capped = houseRows(s1, at("2026-11-28T06:00:00Z"), few);
for (const r of capped) assert.ok(r.rating < 1400, "10人いなければ最下位より下");
assert.equal(new Set(capped.map((r) => r.rating)).size, capped.length, "抑えた人どうしが同じ点に並ばない");

// 5
function ledgerWith(house, nowIso) {
  const db = new DatabaseSync(":memory:");
  const sql = (q, ...args) => db.prepare(q).all(...args);
  return { sql, l: new Ledger(sql, { house, clock: () => at(nowIso) }) };
}
{
  const { sql, l } = ledgerWith(true, "2026-11-20T06:00:00Z");
  const now = at("2026-11-20T06:00:00Z");
  l.recordBot("real-1", { id: "m1", winner: 0, name: "赤", icon: "spade", foeRating: 1500 }, now);
  const s = l.summary("real-1", now);
  assert.ok(s.list.length >= 26, `一覧に混ざる(${s.list.length}人)`);
  assert.equal(s.list[0].uid, "real-1", "実際の人が1人なら、その人が1位");
  assert.equal(s.list.filter((p) => p.uid === "real-1").length, 1);
  assert.equal(sql("SELECT COUNT(*) AS n FROM players")[0].n, 1, "players 表には書かない");
  assert.equal(s.list[0].place, 1);
}
{
  const { l } = ledgerWith(false, "2026-11-20T06:00:00Z");
  const now = at("2026-11-20T06:00:00Z");
  l.recordBot("real-1", { id: "m1", winner: 0, name: "赤", icon: "spade", foeRating: 1500 }, now);
  assert.equal(l.summary("real-1", now).list.length, 1, "既定では混ざらない");
}
console.log("check-house-players: OK");
