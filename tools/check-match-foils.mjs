/**
 * 対局ごとに、実際に効いたフォイルを記録する(第3段階。2026-09-18)。
 *
 * 盤面エリアはフォイルの王で立つのに、対局では所持が誰にも検証されていない。
 * この段階では**何も拒まない**。あとで「持っていたはずの札か」を照らすための材料を残すだけ。
 *
 * あわせて、サーバーの再生も端末と同じ決め直し(setupFromRoom)を通すことを見る。
 * ここがずれると、サーバーの再生だけが実際の対局と違う盤になる。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Ledger } from "../src/server/ledger.js";

const D = new DatabaseSync(":memory:");
const l = new Ledger((q, ...a) => D.prepare(q).all(...a));
const T = 1_800_000_000_000;
const rows = () =>
  D.prepare("SELECT id, seat, uid, skinId FROM match_foils ORDER BY seat, skinId")
    .all()
    .map((r) => ({ id: r.id, seat: r.seat, uid: r.uid, skinId: r.skinId }));
const match = (id, foils) => ({
  id, host: "A", guest: "B", winner: 0,
  names: ["a", "b"], icons: [null, null], foils,
});

l.record(match("R:1:0", [["angel-k:foil"], ["pirate-male:foil", "viking-female:foil"]]), T);
assert.deepEqual(rows(), [
  { id: "R:1:0", seat: 0, uid: "A", skinId: "angel-k:foil" },
  { id: "R:1:0", seat: 1, uid: "B", skinId: "pirate-male:foil" },
  { id: "R:1:0", seat: 1, uid: "B", skinId: "viking-female:foil" },
], "席ごとに、効いたフォイルと uid を残す");

// 同じ対局を二度記録しても増えない(matches の冪等に乗る)
l.record(match("R:1:0", [["angel-k:foil"], []]), T);
assert.equal(rows().length, 3, "同じ対局は二度記録しない");

// 記録を消す(5.1.1(v))と、本人の目印だけ外れる。対局の記録そのものは残す(相手の成績の根拠)
l.forget("A");
assert.deepEqual(rows().map((r) => r.uid), ["forgotten", "B", "B"], "本人の目印だけ外す");
assert.equal(rows().length, 3, "記録は消さない(matches と同じ扱い)");

// foils を持たない形でも落ちない(古い呼び出し・エリア無しの対局)
l.record(match("R:2:0", undefined), T);
l.record(match("R:3:0", [[], []]), T);
assert.equal(rows().filter((r) => r.id !== "R:1:0").length, 0, "エリアが立たない対局は何も残らない");

// 配線: サーバーの再生も端末と同じ決め直しを通す
const vm = fs.readFileSync("src/server/verify-match.js", "utf8");
assert.match(vm, /setupFromRoom\(\s*act,/, "再生も部屋の申告から決め直す");
assert.match(vm, /sanitizeLoadout\(room\.hostSkins\), sanitizeLoadout\(room\.guestSkins\)/, "材料は部屋の申告");
assert.match(vm, /ranked: true/, "持ち点に数える対局として扱う");
assert.match(vm, /foils: \[0, 1\]\.map/, "席ごとに効いたフォイルを返す");
assert.match(vm, /\.endsWith\(":foil"\)/, "フォイルだけを残す(通常のスキンは記録しない)");
const led = fs.readFileSync("src/server/ledger.js", "utf8");
assert.match(led, /CREATE TABLE IF NOT EXISTS match_foils/);
assert.match(led, /INSERT OR IGNORE INTO match_foils/);
assert.match(led, /UPDATE match_foils SET uid=\? WHERE uid=\?/, "削除の求めでは目印だけ外す");
// この段階では誰も止めない(所持の台帳をまだ見ない)
assert.ok(!/skin_first_seen|collection_skins/.test(vm), "所持の台帳はまだ見ない(記録するだけ)");
// 同じ手順の対局を二度記録しない(部屋の round を書き換えても効かない)
{
  const D2 = new DatabaseSync(":memory:");
  const l2 = new Ledger((q, ...a) => D2.prepare(q).all(...a));
  const m = (id, fp) => ({
    id, fingerprint: fp, host: "A", guest: "B", winner: 0,
    names: ["a", "b"], icons: [null, null], foils: [[], []],
  });
  const rated = () => D2.prepare("SELECT rated FROM players WHERE uid='A'").all()[0]?.rated ?? 0;
  l2.record(m("R:1:0", "fp1"), T);
  assert.equal(rated(), 1, "1局目は数える");
  l2.record(m("R:1:1", "fp1"), T);
  assert.equal(rated(), 1, "round を書き換えて同じ手順を送っても数えない");
  l2.record(m("R:1:2", "fp2"), T);
  assert.equal(rated(), 2, "正当な再戦(手順が違う)は数える");
  assert.deepEqual(
    D2.prepare("SELECT id FROM matches ORDER BY id").all().map((r) => r.id),
    ["R:1:0", "R:1:2"],
    "記録も1つだけ増える",
  );
  // 指紋を持たない古い呼び出しでも落ちない
  l2.record(m("R:9:0", undefined), T);
  assert.equal(rated(), 3, "指紋が無ければ今までどおり");
}
const vm2 = fs.readFileSync("src/server/verify-match.js", "utf8");
assert.match(vm2, /fingerprint: fingerprint\(seen\)/, "実際に適用した手から指紋を作る");
const led2 = fs.readFileSync("src/server/ledger.js", "utf8");
assert.match(led2, /SELECT id FROM matches WHERE fp=\? AND host=\? AND guest=\?/, "同じ手順は二度記録しない");
assert.match(led2, /INSERT INTO matches \(id, season, host, guest, winner, finished, fp\)/, "列を名指しで入れる");

console.log("対局ごとの装備の記録(第3段階): 席ごと・冪等・削除で目印だけ外す・エリア無しは残さない・再生も決め直す: OK");
