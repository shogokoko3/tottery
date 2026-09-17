/**
 * ガチャの抽選をサーバーが行う(第4段階。2026-09-18)。
 *
 * 盤面エリアはフォイルの王で立つのに、対局では所持が検証されていない。
 * 端末が引いて事後に申告する形では、サーバーは「何を引いたか」を知らないので検証の正にならない。
 * チケットの消費と抽選を1つの要求にして、正規に手に入れた札の台帳を作る。
 *
 * 配布済み・審査中のビルドは今までどおり debit を使うので、**debit は残す**。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Wallet } from "../src/server/wallet.js";
import { byId } from "../src/skins/catalog.js";
import { normalize, applyPull, pull, drawOne } from "../src/skins/collection.js";

const T = 1_800_000_000_000;
const fresh = (tickets) => {
  const D = new DatabaseSync(":memory:");
  const w = new Wallet((q, ...a) => D.prepare(q).all(...a));
  if (tickets) w.credit("A", "seed", tickets, "migrate", T);
  return { D, w };
};

// 引ける。札はすべて既知で、チケットがその枚数だけ減る
{
  const { D, w } = fresh(20);
  const r = w.pull("A", "e-1", 10, T);
  assert.equal(r.skins.length, 10);
  assert.ok(r.skins.every((id) => !!byId(id)), "知らない札は出さない");
  assert.equal(r.tickets, 10, "10枚ぶん減る");
  assert.equal(D.prepare("SELECT COUNT(*) n FROM gacha_log WHERE uid='A'").all()[0].n, 10, "履歴に残る");
  assert.ok(
    D.prepare("SELECT COUNT(DISTINCT skinId) n FROM skin_first_seen WHERE uid='A'").all()[0].n > 0,
    "正規に手に入れた札として記録する",
  );
  // 送り直しても同じ札。チケットも減らない
  const again = w.pull("A", "e-1", 10, T);
  assert.deepEqual(again.skins, r.skins, "同じ出来事 id には同じ札");
  assert.equal(again.tickets, 10, "送り直しでチケットは減らない");
  assert.equal(D.prepare("SELECT COUNT(*) n FROM gacha_log WHERE uid='A'").all()[0].n, 10, "履歴も増えない");
  // 他人の出来事 id は使えない
  assert.throws(() => w.pull("B", "e-1", 10, T), /他の人の抽選/);
}

// 足りなければ、札も配らずチケットも減らさない
{
  const { D, w } = fresh(5);
  assert.throws(() => w.pull("A", "e-1", 10, T), /足りません/);
  assert.equal(w.summary("A").tickets, 5, "減らさない");
  assert.equal(D.prepare("SELECT COUNT(*) n FROM gacha_draws").all()[0].n, 0, "札も配らない");
}

// 半端な枚数は断る
{
  const { w } = fresh(50);
  for (const n of [0, 2, 3, 11, -1, 1.5, "10"])
    assert.throws(() => w.pull("A", `e-${n}`, n, T), /1回または10回/);
  assert.equal(w.pull("A", "e-ok", 1, T).skins.length, 1, "1回も引ける");
}

// 記録を消す(5.1.1(v))と、抽選の記録も消える
{
  const { D, w } = fresh(20);
  w.pull("A", "e-1", 10, T);
  w.forget("A");
  assert.equal(D.prepare("SELECT COUNT(*) n FROM gacha_draws WHERE uid='A'").all()[0].n, 0);
  assert.equal(D.prepare("SELECT COUNT(*) n FROM skin_first_seen WHERE uid='A'").all()[0].n, 0);
}

// 端末: 受け取った結果を所持に入れるだけの道
{
  const s = normalize({ tickets: 20 });
  let seed = 5;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  const ids = Array.from({ length: 10 }, () => drawOne(rnd));
  const a = applyPull(s, ids, { free: true });
  assert.equal(a.pending.results.length, 10);
  assert.equal(a.tickets, 20, "サーバーで減らしているので端末では減らさない");
  assert.equal(a.draws, 10, "引いた回数は数える(ミッション用)");
  assert.deepEqual(a.pending.results.map((r) => r.id), ids, "返ってきた順のまま");
  assert.equal(a.pending.results[0].isNew, !normalize(s).owned[ids[0]], "NEW かどうかは端末が決める");
  for (const bad of [null, ["bogus"], ids.slice(0, 3), []])
    assert.throws(() => applyPull(s, bad, { free: true }));
  // 端末で引く道(pull)は今までどおり残す
  assert.equal(pull(s, 10, rnd, { free: false }).tickets, 10, "端末で引くとチケットが減る");
}

// 配線
const server = fs.readFileSync("src/server/wallet.js", "utf8");
assert.match(server, /CREATE TABLE IF NOT EXISTS gacha_draws/);
assert.match(server, /crypto\.getRandomValues/, "抽選は差し替えられない乱数で");
assert.match(server, /INSERT OR IGNORE INTO skin_first_seen \(uid, skinId, at, source\)/, "出どころつきで記録する");
const worker = fs.readFileSync("src/server/worker.js", "utf8");
assert.match(worker, /wop === "pull" && eventId\(body\.id\) && \(body\.n === 1 \|\| body\.n === 10\)/, "口の形を確かめる");
assert.match(worker, /op === "wallet-debit"/, "配布済みのビルドが使う debit は残す");
const net = fs.readFileSync("src/net/wallet.js", "utf8");
assert.match(net, /export async function pullFromServer/);
assert.match(net, /data\.skins\.length === n/, "枚数が合わない返事は使わない");
const ui = fs.readFileSync("src/ui/skins.jsx", "utf8");
assert.match(ui, /drawn = await pullFromServer\(eventId, amount\)/, "まずサーバーに引いてもらう");
assert.match(ui, /if \(!drawn\) await debitTickets\(eventId, amount \* PULL_COST\)/, "古いサーバーなら今までの道");
assert.match(ui, /drawn \? applyPull\(s, drawn, \{ free: true \}\) : pull\(s, amount, undefined, \{ free: true \}\)/);
console.log("サーバーが引く(第4段階): 冪等・不足で無副作用・半端を断る・削除で消える・端末は入れるだけ・古い道も残す: OK");
