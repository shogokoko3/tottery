/**
 * レート戦のシーズンを決まった日時の表にした(2026-11-11 本人の指示)ことを確かめる。
 *   シーズン1 … 2026-11-16 09:00 〜 12-31 23:59(日本時間)
 *   シーズン2 … 2027-01-01 09:00 〜 02-28 23:59
 *   シーズンの外はレート戦を閉じる(入口を閉じ、台帳は記録しない)
 *   1/1 9:00 に新ガチャ「ワンダーランド・ゲート」(アリス)を開く
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  RATED_SEASONS,
  seasonAt,
  nextSeason,
  shownSeason,
  seasonName,
  seasonTitle,
  validSeason,
  seasonRewards,
  seasonOfRewardId,
} from "../src/game/season.js";
import { Ledger } from "../src/server/ledger.js";
import { contentSeason, isSeasonOpen } from "../src/game/content-seasons.js";
import { ratedSeasonGate, ratedSeasonLabel } from "../src/game/online-gate.js";

const J = (s) => Date.parse(`${s}+09:00`);
const ids = (n) => seasonAt(n)?.id ?? null;

// 表
assert.deepEqual(
  RATED_SEASONS.map((s) => [s.id, s.start, s.end]),
  [
    ["S1", J("2026-11-16T09:00:00"), J("2027-01-01T00:00:00")],
    ["S2", J("2027-01-01T09:00:00"), J("2027-03-01T00:00:00")],
  ],
);
// 境目
assert.equal(ids(J("2026-11-11T12:00:00")), null, "いまはシーズンの外");
assert.equal(ids(J("2026-11-16T08:59:59")), null);
assert.equal(ids(J("2026-11-16T09:00:00")), "S1", "11/16 9:00 から");
assert.equal(ids(J("2026-12-31T23:59:59")), "S1", "12/31 23:59 まで");
assert.equal(ids(J("2027-01-01T00:00:00")), null, "1/1 0:00〜9:00 は外");
assert.equal(ids(J("2027-01-01T08:59:59")), null);
assert.equal(ids(J("2027-01-01T09:00:00")), "S2", "1/1 9:00 から");
assert.equal(ids(J("2027-02-28T23:59:59")), "S2", "2/28 23:59 まで");
assert.equal(ids(J("2027-03-01T00:00:00")), null);
assert.equal(nextSeason(J("2027-01-01T03:00:00")).id, "S2");
assert.equal(shownSeason(J("2026-11-11T12:00:00")).id, "S1", "始まる前はシーズン1を見せる");
assert.equal(shownSeason(J("2027-01-01T03:00:00")).id, "S1", "合間は終わったばかりのもの");
// 名前・称号・報酬 id
assert.equal(seasonName("S1"), "シーズン1");
assert.equal(seasonName("S2"), "シーズン2");
assert.equal(seasonName("2026-10"), "2026年10月", "古い月間シーズンの名前はそのまま");
assert.equal(seasonTitle("season:S1:first").name, "シーズン1 覇者");
assert.equal(seasonTitle("season:2026-10:king").name, "2026年10月 王の証", "古い称号も読める");
assert.ok(validSeason("S1") && validSeason("2026-10") && !validSeason("S0") && !validSeason("x"));
assert.equal(seasonOfRewardId("S1:participation"), "S1");
assert.equal(seasonOfRewardId("2026-10:king"), "2026-10");
assert.equal(seasonRewards("S1").find((r) => r.key === "first").name, "シーズン1の称号「覇者」");

// 台帳(本物の表で)
{
  const db = new DatabaseSync(":memory:");
  const l = new Ledger((q, ...a) => db.prepare(q).all(...a));
  const bot = (n, now) => l.recordBot("u", { id: `g${n}`, winner: 0, name: "ゆう", icon: "spade" }, now);
  const before = J("2026-11-12T12:00:00");
  assert.deepEqual(bot(0, before), { recorded: false, reason: "closed" }, "始まる前は記録しない");
  const s0 = l.summary("u", before);
  assert.equal(s0.open, false);
  assert.equal(s0.season.id, "S1");
  assert.equal(s0.next.id, "S1");
  assert.equal(s0.player, null);
  // シーズン1
  const t1 = J("2026-11-20T12:00:00");
  for (let i = 1; i <= 10; i++) assert.equal(bot(i, t1 + i).recorded, true);
  const s1 = l.summary("u", t1 + 20);
  assert.equal(s1.open, true);
  assert.equal(s1.next, null);
  assert.equal(s1.season.id, "S1");
  assert.equal(s1.player.rated, 10);
  const r1 = s1.player.rating;
  // 合間: 記録しない・シーズン1を見せる・次はシーズン2
  const gap = J("2027-01-01T03:00:00");
  assert.equal(bot(11, gap).reason, "closed");
  const sg = l.summary("u", gap);
  assert.equal(sg.open, false);
  assert.equal(sg.season.id, "S1");
  assert.equal(sg.next.id, "S2");
  assert.equal(sg.player.rated, 10, "合間の対局は数えない");
  assert.equal(sg.history[0]?.id, "S1", "終わったシーズンが戦績に残る");
  // 終わったシーズンの報酬が受け取れる
  const claimed = l.claim("u", "S1:participation", gap);
  assert.ok(claimed.claims.some((c) => c.id === "S1:participation"));
  // 人との対局もシーズンの外は記録しない
  l.record({ id: "m-gap", host: "u", guest: "v", winner: 0, names: ["a", "b"], icons: ["spade", "heart"] }, gap);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM matches WHERE id='m-gap'").get().n, 0);
  // シーズン2: 持ち点はシーズン1から続く(古い月間の行があっても、始まりの時刻で前を決める)
  db.prepare("INSERT INTO seasons VALUES ('2026-10', ?, ?)").run(J("2026-10-01T05:00:00"), J("2026-11-01T05:00:00"));
  db.prepare("INSERT INTO players (season, uid, name, icon, wr, rated, wins, draws, highest, best, streak) VALUES ('2026-10','u','ゆう','spade',0.5,1,0,0,0,null,0)").run();
  db.prepare("INSERT INTO elo_ratings VALUES ('2026-10','u',1234)").run();
  const t2 = J("2027-01-01T09:00:00");
  assert.equal(l.playerRow("u", "S2").rating, r1, "シーズン1の持ち点を引き継ぐ");
  assert.equal(bot(12, t2).recorded, true, "1/1 9:00 から記録する");
  const s2 = l.summary("u", t2 + 1);
  assert.equal(s2.season.id, "S2");
  assert.equal(s2.player.rated, 1, "対局数は数え直す");
  // シーズン2のあと(次は未定)
  const after = l.summary("u", J("2027-03-01T00:00:00"));
  assert.equal(after.open, false);
  assert.equal(after.season.id, "S2");
  assert.equal(after.next, null);
}

// ランダムマッチの入口
assert.equal(ratedSeasonGate(J("2026-11-12T12:00:00")).open, false);
assert.equal(ratedSeasonLabel(ratedSeasonGate(J("2026-11-12T12:00:00"))), "シーズン1は 11/16 9:00 から");
assert.equal(ratedSeasonLabel(ratedSeasonGate(J("2027-01-01T03:00:00"))), "シーズン2は 1/1 9:00 から");
assert.equal(ratedSeasonGate(J("2026-12-01T12:00:00")).open, true);
assert.equal(ratedSeasonLabel(ratedSeasonGate(J("2027-03-02T00:00:00"))), "次のシーズンをお待ちください");
const screens = readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
// シーズンの外も対戦はできる。レートが動かないだけ(2026-11-12 本人の指示「レート対戦ができないだけにしておいてください」)
assert.ok(/const locked = !gate\.ok;/.test(screens), "入口はシーズンで閉じない");
assert.ok(/onClick=\{!gate\.ok \? onStory \|\| onTutorial : onOnline\}/.test(screens), "シーズンの外も押せばマッチへ");
assert.ok(!/if \(!ratedSeasonGate\(\)\.open\) return backToMatching\(\);/.test(screens), "連戦もシーズンの外で止めない");
assert.ok(screens.includes('L("世界中のプレイヤーと対戦。レートは動きません（{when}）", { when: ratedSeasonLabel(season) })'), "入口にレートが動かないことを出す");
assert.ok(/ranked=\{o === "online" && rankedPhase\(phaseOf\(loadProfile\(\)\)\) && ratedSeasonGate\(\)\.open\}/.test(screens), "盤選びの「ランキングに載ります」もシーズンの中だけ");
const game = readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/const seasonOpen = useRef\(ratedSeasonGate\(\)\.open\)\.current;/.test(game), "対局の始めにシーズンを見る");
assert.ok(/rankedPhase\(matchPhase\) && seasonOpen, \);/.test(game), "シーズンの外は対戦前のレートを読まない");
assert.ok(/const ranked = [^;]*rankedPhase\(matchPhase\) && seasonOpen;/.test(game), "シーズンの外は持ち点を動かさない");
assert.ok(/!rankedPhase\(matchPhase\) \|\| !seasonOpen, bot,/.test(game), "シーズンの外は台帳へ送らない");

// ワンダーランド(アリス)のガチャは 1/1 9:00 に開く
assert.equal(contentSeason("alice").name, "ワンダーランド・ゲート");
assert.equal(contentSeason("alice").start, J("2027-01-01T09:00:00"));
assert.equal(isSeasonOpen("alice", J("2027-01-01T08:59:59")), false);
assert.equal(isSeasonOpen("alice", J("2027-01-01T09:00:00")), true);

console.log("レート戦のシーズン(シーズン1・2・外は閉じる)とワンダーランドの開始: OK");
