/**
 * 運営がテストプレイヤーのシーズン記録をまとめて消す口(/api/admin/season-forget、2026-09-23 本人の指示)。
 *   1. 台帳: 指した uid だけ消え、ほかの人と対局の記録は残る(本人の「自分の記録を消す」と同じ手順)
 *   2. Worker の配線: 運営だけが通り、uids は形を見て 200 件まで
 *   3. 消す道具(tools/remove-test-players.mjs)は登録時刻で見分け、候補が多すぎれば止まる
 *   4. ランキングの行に称号の額縁を出す(2026-09-23 本人の指示)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Ledger } from "../src/server/ledger.js";

const db = new DatabaseSync(":memory:");
const sql = (q, ...args) => db.prepare(q).all(...args);
const ledger = new Ledger(sql);
const now = Date.parse("2026-09-08T09:00:00Z");
const match = (id, host, guest) => ({
  id, host, guest, winner: 0, names: ["赤", "青"], icons: ["spade", "heart"],
});
// テスト2人と実際の人1人。実際の人はテストの片方と対局している
ledger.record(match("m1", "test-a", "test-b"), now);
ledger.record(match("m2", "real-1", "test-a"), now + 1);
assert.equal(ledger.list("2026-09").length, 3, "3人が載る");

// 1. 台帳
for (const uid of ["test-a", "test-b"]) ledger.forget(uid);
const left = ledger.list("2026-09");
assert.deepEqual(left.map((p) => p.uid), ["real-1"], "指した uid だけ消え、実際の人は残る");
assert.equal(sql("SELECT COUNT(*) AS n FROM matches")[0].n, 2, "対局の記録は残す(相手の成績の根拠)");
assert.equal(sql("SELECT COUNT(*) AS n FROM matches WHERE host='test-a' OR guest='test-a'")[0].n, 0, "消した人の目印は外れる");
assert.equal(left[0].rated, 1, "実際の人の対局数は変わらない");

// 2. Worker の配線
const worker = readFileSync(new URL("../src/server/worker.js", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/const adminForget = url\.pathname === "\/api\/admin\/season-forget";/.test(worker), "口がある");
assert.ok(/!adminForget &&/.test(worker), "知らない道の 404 から外してある");
assert.ok(/\|\| adminPass \|\| adminForget\) && uid !== OPERATOR_UID/.test(worker), "運営だけが通る");
assert.ok(/\.slice\(0, 200\)/.test(worker), "uids は 200 件まで");
assert.ok(/if \(op === "admin-forget" && uid === OPERATOR_UID\)/.test(worker), "台帳側でも運営の uid を見る");
assert.ok(/l\.forget\(target\)/.test(worker), "本人の forget と同じ手順");
assert.ok(!/wallet\.forget\(target\)/.test(worker), "財布は触らない");

// 3. 道具
const tool = readFileSync(new URL("../tools/remove-test-players.mjs", import.meta.url), "utf8");
assert.ok(/Date\.UTC\(2026, 8, 8, 8, 50, 0\)/.test(tool) && /Date\.UTC\(2026, 8, 8, 9, 0, 0\)/.test(tool), "2026-09-08 17:50〜18:00 JST で見分ける");
assert.ok(/targets\.length > 120/.test(tool), "候補が多すぎれば止まる");
assert.ok(/--dry/.test(tool) && /yes\/no/.test(tool), "下見と確認がある");
assert.ok(/d\.localId !== OPERATOR_UID/.test(tool), "運営以外は断る");
assert.ok(/api\/admin\/season-forget/.test(tool), "台帳も消す");

// 4. ランキングの行の称号
const season = readFileSync(new URL("../src/ui/season.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/identities\[row\.uid\]\?\.title && \( <TitleFrame id=\{identities\[row\.uid\]\.title\} size="compact" className="rank-title" \/> \)/.test(season), "行に称号の額縁を出す(通算の表の title から)");
const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
assert.ok(/\.rank-title \{/.test(css) && /\.rank-name-text \{/.test(css), "行の CSS がある");

// 5. 起動時の一度きりの片付け(2026-09-23)。テストの100 uid だけ消え、実際の人は残り、二度目は走らない
{
  const { TEST_PLAYERS_2026_09_08 } = await import("../src/server/test-players-2026-09-08.js");
  assert.equal(TEST_PLAYERS_2026_09_08.length, 100, "100人ぶん");
  assert.equal(new Set(TEST_PLAYERS_2026_09_08).size, 100, "重なりなし");
  for (const u of TEST_PLAYERS_2026_09_08) assert.match(u, /^[\w-]{28}$/, "Firebase の uid の形");
  const db2 = new DatabaseSync(":memory:");
  const sql2 = (q, ...args) => db2.prepare(q).all(...args);
  const [t1, t2] = TEST_PLAYERS_2026_09_08;
  const l2 = new Ledger(sql2); // 表を作る(この時点で片付けは走るが、まだ誰もいない)
  l2.record(match("t1", t1, t2), now);
  l2.record(match("t2", "real-9", t1), now + 1);
  sql2("DELETE FROM cleanups"); // まだ片付けていない状態にして、配信後の初回起動を真似る
  const l3 = new Ledger(sql2);
  assert.deepEqual(l3.list("2026-09").map((p) => p.uid), ["real-9"], "起動時にテストの uid だけ消える");
  assert.equal(sql2("SELECT COUNT(*) AS n FROM cleanups WHERE id='test-players-2026-09-08'")[0].n, 1, "済んだ印が残る");
  l3.record(match("t3", "real-9", "real-10"), now + 2);
  new Ledger(sql2);
  assert.equal(l3.list("2026-09").length, 2, "二度目の起動では何も消えない");
}

console.log("運営のまとめて忘れる口・消す道具・ランキングの称号・起動時の一度きりの片付け OK");
