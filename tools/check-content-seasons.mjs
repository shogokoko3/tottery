/**
 * コンテンツのシーズン(src/game/content-seasons.js)。2026-10-15 本人の指示:
 *  - 開始日時を過ぎたシーズンのガチャ(召喚)とバトルパスが開く。まだのシーズンは画面に出さない(隠す)
 *  - バトルパスはシーズンごとに買い切り(各 1,500 ジェム)。前のシーズン(魔術師)のパスも買えて進められる
 *  - 進めるパスは1つだけ(battlepass-store.js の active)。本人が選んで切り替える
 *  - アリスのパスの報酬は通常の A。フォイルの A は魔術師と同じく、そのシリーズのフォイルを全部そろえた人にだけ案内
 *  - サーバー(src/server/wallet.js)も同じ表から gachaSeries と権利の名前を決める
 *  - アリスの本番の開始日は未定。TestFlight で全部を確かめるため、いまは過去の日時にして解放してある
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  CONTENT_SEASONS,
  DEFAULT_SEASON,
  contentSeason,
  seasonOfSeries,
  seasonOfEntitlement,
  isSeasonOpen,
  openSeasons,
  openSeries,
  isSeriesOpen,
  latestOpenSeason,
  PASS_ENTITLEMENTS,
  passTicketId,
  passSeasonOfTicketId,
} from "../src/game/content-seasons.js";
import { rewardSkin, rewardIdOf, normalize } from "../src/game/battlepass.js";
import { SERIES, ALL_SKINS, byId, foilId } from "../src/skins/catalog.js";
import { ownsAllButSecret, foilOffers, skinVisibleInCollection } from "../src/skins/foil-shop.js";
import { Wallet } from "../src/server/wallet.js";
import { BATTLEPASS_GEMS } from "../src/iap/catalog.js";

const ALICE = contentSeason("alice");
const HEROES = contentSeason("heroes");
assert.ok(ALICE && HEROES, "魔術師とアリスの2シーズン");
const BEFORE = ALICE.start - 1;
const AFTER = ALICE.start;

console.log("表(開始日時で開く・まだのものは出さない)");
assert.equal(DEFAULT_SEASON, "heroes");
assert.deepEqual(openSeasons(BEFORE).map((s) => s.id), ["heroes"], "アリスの開始前は魔術師だけ");
assert.deepEqual(openSeasons(AFTER).map((s) => s.id), ["heroes", "alice"], "開始日時ちょうどで開く");
assert.deepEqual(openSeries(AFTER), ["heroes", "alice"]);
assert.equal(latestOpenSeason(BEFORE).id, "heroes");
assert.equal(latestOpenSeason(AFTER).id, "alice");
assert.equal(isSeriesOpen("alice", BEFORE), false);
assert.equal(isSeriesOpen("alice", AFTER), true);
assert.equal(isSeasonOpen("nope", AFTER), false);
assert.equal(isSeasonOpen("alice"), true, "いまは解放してある(TestFlight で全部を確かめるため。2026-10-15 本人)");
assert.equal(seasonOfSeries("alice").entitlement, "battlepass-alice");
assert.equal(seasonOfEntitlement("battlepass").id, "heroes");
assert.deepEqual(PASS_ENTITLEMENTS, ["battlepass", "battlepass-alice"]);
assert.equal(ALICE.passName, "アリスのバトルパス");
for (const s of CONTENT_SEASONS) {
  const item = SERIES.find((x) => x.id === s.series);
  assert.ok(item, `${s.id} のシリーズが SERIES にある`);
  assert.equal(item.battlepassSkin, s.passReward, `${s.id} の報酬は SERIES と同じ`);
  assert.equal(item.name, s.name, `${s.id} の名前は SERIES と同じ`);
  assert.ok(byId(s.passReward), `${s.passReward} が図鑑にある`);
}
assert.equal(byId("alice-A-alice").acquisition, "battlepass", "アリスのパスの報酬は通常の A");

console.log("マス報酬の出来事 id(魔術師は配布済みのビルドと同じ形)");
assert.equal(passTicketId("heroes", 1, "0-1"), "bp:pass:1:0-1");
assert.equal(passTicketId("alice", 2, "0-1"), "bp:pass:alice:2:0-1");
assert.equal(passSeasonOfTicketId("bp:pass:1:0-1"), "heroes");
assert.equal(passSeasonOfTicketId("bp:pass:alice:2:0-1"), "alice");
assert.equal(passSeasonOfTicketId("earn:x"), null);
assert.equal(passSeasonOfTicketId(null), null);

console.log("報酬(シーズンごと)");
assert.equal(rewardSkin().id, "genie-magician");
assert.equal(rewardSkin("alice").id, "alice-A-alice");
assert.equal(rewardIdOf("alice"), "alice-A-alice");
assert.equal(rewardIdOf("nope"), "genie-magician");
assert.equal(normalize(null, "alice-A-alice").rewardId, "alice-A-alice");
assert.equal(
  normalize({ rewardId: "genie-magician", claimed: true }, "alice-A-alice").claimed,
  false,
  "別のパスの受取済みは引き継がない",
);

console.log("端末の保存(シーズンごとの盤・進めるパスは1つ)");
{
  const mem = new Map();
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    },
  });
  const store = await import("../src/game/battlepass-store.js");
  assert.equal(store.passKeyOf("heroes"), "tottery.battlepass.v1", "魔術師の鍵は従来のまま");
  assert.equal(store.passKeyOf("alice"), "tottery.battlepass.alice.v1");
  assert.equal(store.getActivePassId(), "heroes", "保存が無ければ魔術師を進める");
  const a = store.updatePass((s) => ({ ...s, cycle: 3 }), "alice");
  assert.equal(a.cycle, 3);
  assert.equal(store.getPass("alice").cycle, 3);
  assert.notEqual(store.getPass("heroes").cycle, 3, "別のシーズンの盤は動かない");
  assert.equal(store.getPass("alice").rewardId, "alice-A-alice");
  assert.equal(store.getPass().rewardId, "genie-magician");
  assert.equal(store.setActivePassId("alice"), "alice");
  assert.equal(mem.get(store.ACTIVE_KEY), "alice", "進めるパスは保存する");
  assert.equal(store.getActivePassId(), "alice");
  assert.equal(store.setActivePassId("nope"), "heroes", "知らない名前は魔術師に戻す");
  if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
  else delete globalThis.localStorage;
}

console.log("フォイルの A(そのシリーズのフォイルを全部そろえた人にだけ)");
{
  const allOf = (series) =>
    Object.fromEntries(ALL_SKINS.filter((s) => s.series === series).map((s) => [s.id, 1]));
  const aliceAll = allOf("alice");
  delete aliceAll[foilId("alice-A-alice")];
  const heroesAll = allOf("heroes");
  delete heroesAll[foilId("genie-magician")];
  assert.equal(ownsAllButSecret({ owned: aliceAll }, "alice"), true);
  assert.equal(ownsAllButSecret({ owned: aliceAll }, "heroes"), false, "アリスをそろえても魔術師の条件は別");
  assert.equal(ownsAllButSecret({ owned: heroesAll }, "alice"), false);
  const secret = byId(foilId("alice-A-alice"));
  assert.equal(secret.secret, true, "アリスの A のフォイルは秘密の札");
  assert.deepEqual(
    foilOffers({ owned: aliceAll })
      .filter((o) => o.product.id === "foil-alice-a")
      .map((o) => [o.price, o.skins]),
    [[2000, ["alice-A-alice"]]],
    "そろえたら有償 2,000 で案内",
  );
  assert.ok(
    !foilOffers({ owned: heroesAll }).some((o) => o.product.id === "foil-alice-a"),
    "魔術師をそろえてもアリスの A は出ない",
  );
  assert.ok(!JSON.stringify(foilOffers({ owned: {} })).includes("alice-A-alice"), "そろえるまでアリスの A の存在を出さない");
  assert.equal(skinVisibleInCollection({ owned: {} }, secret), false);
  assert.equal(skinVisibleInCollection({ owned: aliceAll }, secret), true);
}

console.log("サーバー(財布): シーズンごとの購入・マス報酬・運営のクリア・召喚");
{
  const db = new DatabaseSync(":memory:");
  const w = new Wallet((q, ...a) => db.prepare(q).all(...a));
  const T = ALICE.start + 86_400_000;
  const EARLY = ALICE.start - 86_400_000;
  assert.deepEqual(w.summary("U", EARLY).gachaSeries, ["heroes"], "開始前はガチャも魔術師だけ");
  assert.deepEqual(w.summary("U", T).gachaSeries, ["heroes", "alice"]);
  w.adminGrant("U", { gemsFree: 4000 }, "g1", T);
  assert.throws(() => w.buyPass("U", "p0", EARLY, "alice"), /まだ始まっていません/, "開始前は買えない");
  assert.throws(() => w.buyPass("U", "p0", T, "nope"), /ありません/);
  const b = w.buyPass("U", "p1", T, "alice");
  assert.deepEqual(b.entitlements, ["battlepass-alice"]);
  assert.equal(b.gemsFree, 4000 - BATTLEPASS_GEMS, "値段は魔術師と同じ 1,500");
  assert.equal(w.buyPass("U", "p1b", T, "alice").applied, false, "同じシーズンは二度買わない");
  const h = w.buyPass("U", "p2", T);
  assert.deepEqual([...h.entitlements].sort(), ["battlepass", "battlepass-alice"], "前のシーズン(魔術師)のパスも買える");
  assert.equal(h.gemsFree, 4000 - BATTLEPASS_GEMS * 2);

  // マス報酬は、その出来事 id のシーズンの権利で決まる
  const db2 = new DatabaseSync(":memory:");
  const w2 = new Wallet((q, ...a) => db2.prepare(q).all(...a));
  w2.adminGrant("V", { gemsFree: 2000 }, "g", T);
  w2.buyPass("V", "pv", T, "alice");
  assert.throws(() => w2.passReward("V", "bp:pass:1:0-1", T), /バトルパス/, "魔術師のパスが無ければ魔術師のマスは受け取れない");
  assert.equal(w2.passReward("V", "bp:pass:alice:1:0-1", T).applied, true);
  assert.equal(w2.passReward("V", "bp:pass:alice:1:0-1", T).applied, false, "同じマスは二度効かない");
  assert.equal(w2.balance("V"), 1);

  // 運営のクリア(シーズンごと)
  const r = w.adminPassComplete("W", T, "alice");
  assert.equal(r.passCompleteBySeason.alice, T);
  assert.ok(!r.passComplete, "魔術師の印は付かない");
  assert.deepEqual(r.entitlements, ["battlepass-alice"]);
  const r2 = w.adminPassComplete("W", T + 1);
  assert.equal(r2.passComplete, T + 1);
  assert.deepEqual([...r2.entitlements].sort(), ["battlepass", "battlepass-alice"]);
  assert.throws(() => w.adminPassComplete("W", T, "nope"), /ありません/);
  w.forget("W");
  assert.deepEqual(w.summary("W", T).passCompleteBySeason, {}, "忘れると印も消える");

  // 召喚は始まったシリーズだけ
  w.credit("U", "t1", 10, "migrate", T);
  assert.throws(() => w.pull("U", "pl0", 1, EARLY, "alice"), /まだ始まっていません/);
  assert.doesNotThrow(() => w.pull("U", "pl1", 1, T, "alice"));
}

console.log("配線");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
assert.match(src("src/server/worker.js"), /w\.buyPass\([^)]*args\.season/, "worker は season を財布へ渡す");
assert.match(src("src/server/worker.js"), /adminPassComplete\([^)]*season/, "運営のクリアも season を渡す");
assert.match(src("src/net/wallet.js"), /buyPassWithGems\(id, season/, "端末は season を送る");
assert.match(src("src/admin/session.js"), /completeBattlePass\(uid, season/);
assert.match(src("src/admin/admin.jsx"), /completeBattlePass\(uid, bpSeason\)/, "運営画面でシーズンを選ぶ");
assert.match(src("src/ui/battlepass.jsx"), /openSeasons\(\)/, "パス画面は開いているシーズンのタブ");
assert.match(src("src/ui/battlepass.jsx"), /setActivePassId\(season\)/, "「このバトルパスを進める」");
assert.match(src("src/ui/battlepass.jsx"), /rewardSkin\(season\)/);
assert.match(src("src/ui/battlepass-track.jsx"), /getActivePassId\(\)/, "対局では進めるパスだけ数える");
assert.match(src("src/ui/battlepass-track.jsx"), /passTicketId\(/);
assert.match(src("src/ui/buy.js"), /buyPassWithGems\(newEventId\("pass"\), season\)/);
assert.match(src("src/ui/shop.jsx"), /passSeasons\.map\(/, "ショップはシーズンごとに解放欄");
const skins = src("src/ui/skins.jsx");
assert.match(skins, /SERIES\.filter\(\(item\) => isSeriesOpen\(item\.id\)\)/, "始まっていないシリーズは出さない");
assert.match(skins, /const series = pickedSeries \|\| latestOpenSeason\(\)\.series;/, "計算用のシリーズはいちばん新しいシーズンで埋める");
assert.ok(!skins.includes("バトルパスは準備中") && !skins.includes("アリス用バトルパス"), "アリスの「準備中」は残さない");
assert.match(skins, /o\.product\.secret && o\.skins\.includes\(baseSkinId\(selected\.id\)\)/, "秘密の購入は選んだ札のもの");
console.log("ok: content seasons");
