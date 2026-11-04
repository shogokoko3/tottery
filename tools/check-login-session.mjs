/** ログイン処理の見張り。開いたとき・復帰したとき・日本時間0時をまたいだときに問い合わせ直すこと */
import assert from "node:assert/strict";
import fs from "node:fs";
import { loginDay } from "../src/game/login-bonus.js";
import { watchLoginDay, nextLoginDayAt, LOGIN_RECHECK, LOGIN_RETRY } from "../src/game/login-session.js";

const at = (s) => Date.parse(s);
const flush = () => new Promise((r) => setTimeout(r, 0));

assert.equal(nextLoginDayAt(at("2026-11-04T23:59:59+09:00")), at("2026-11-05T00:00:00+09:00"));
assert.equal(nextLoginDayAt(at("2026-11-05T00:00:00+09:00")), at("2026-11-06T00:00:00+09:00"), "0時ちょうどは次の日の0時を待つ");
assert.equal(loginDay(nextLoginDayAt(at("2026-11-04T12:00:00+09:00"))), "2026-11-05", "報酬の日付と同じ境目");

/** skew: 端末の時計 - サーバーの時計 */
function app(start, { skew = 0 } = {}) {
  let clock = at(start) + skew, next = 0, fail = false, open = false;
  const timers = new Map(), events = new Map(), checks = [];
  const target = {
    hidden: false,
    addEventListener(name, fn) { events.set(name, fn); },
    removeEventListener(name, fn) { if (events.get(name) === fn) events.delete(name); },
  };
  const watch = watchLoginDay((force) => {
    if (open && !force) return null;
    checks.push(loginDay(clock - skew));
    return fail ? Promise.reject(new Error("offline")) : Promise.resolve(clock - skew);
  }, {
    now: () => clock, page: target, host: target,
    later: (fn, delay) => { const id = ++next; timers.set(id, { fn, delay }); return id; },
    cancel: (id) => timers.delete(id),
  });
  return {
    watch, target, timers, events, checks,
    set fail(v) { fail = v; },
    set open(v) { open = v; },
    /** サーバーの時刻で進める */
    time(s) { clock = at(s) + skew; },
    shift(ms) { clock += ms; },
    async tick() { const t = [...timers.values()][0]; timers.clear(); t?.fn(); await flush(); },
    wait() { return [...timers.values()][0]?.delay; },
  };
}

// 開いたときにログイン処理をする
const a = app("2026-11-04T23:58:00+09:00");
await flush();
assert.deepEqual(a.checks, ["2026-11-04"], "起動で1回");
assert.ok(a.wait() <= 60000, "1分おきより長く寝ない");
a.time("2026-11-04T23:59:30+09:00"); await a.tick();
assert.equal(a.checks.length, 1, "0時前は問い合わせない");
a.events.get("focus")(); a.events.get("pageshow")(); await flush();
assert.equal(a.checks.length, 1, "前に出ただけでは問い合わせない");
a.time("2026-11-05T00:00:00+09:00"); await a.tick();
assert.deepEqual(a.checks, ["2026-11-04", "2026-11-05"], "開いたまま0時をまたぐと翌日のログイン");
a.watch.stop();
assert.equal(a.events.size, 0);

// 端末の時計が5分進んでいても、サーバーの0時で切り替える
const ahead = app("2026-11-04T23:57:00+09:00", { skew: 5 * 60 * 1000 });
await flush();
ahead.time("2026-11-04T23:59:00+09:00"); await ahead.tick();
assert.equal(ahead.checks.length, 1, "端末の時計で0時を過ぎても、サーバーの0時までは待つ");
ahead.time("2026-11-05T00:00:01+09:00"); await ahead.tick();
assert.deepEqual(ahead.checks, ["2026-11-04", "2026-11-05"]);
ahead.watch.stop();

// 端末の時計が遅れていても、サーバーの0時で切り替える
const behind = app("2026-11-04T23:57:00+09:00", { skew: -10 * 60 * 1000 });
await flush();
behind.time("2026-11-05T00:00:01+09:00"); await behind.tick();
assert.deepEqual(behind.checks, ["2026-11-04", "2026-11-05"], "端末ではまだ23:50でも翌日として問い合わせる");
behind.watch.stop();

// 裏に回ったまま何日も過ぎて戻った
const sleep = app("2026-11-04T22:00:00+09:00");
await flush();
sleep.target.hidden = true;
sleep.time("2026-11-07T08:00:00+09:00"); await sleep.tick();
assert.equal(sleep.checks.length, 1, "裏にいる間は問い合わせない");
sleep.target.hidden = false;
sleep.events.get("tottery-audio-state")({ status: "active" }); await flush();
assert.deepEqual(sleep.checks, ["2026-11-04", "2026-11-07"], "戻った日のログインを1回");
sleep.events.get("visibilitychange")(); sleep.events.get("focus")(); await flush();
assert.equal(sleep.checks.length, 2, "復帰の合図が重なっても1回");
sleep.watch.stop();

// 裏にいる間に端末の時計を戻された
const back = app("2026-11-04T10:00:00+09:00");
await flush();
back.shift(-2 * 60 * 60 * 1000);
back.events.get("visibilitychange")(); await flush();
assert.equal(back.checks.length, 2, "時計が戻ったら問い合わせ直す");
back.watch.stop();

// 0時の数え方が狂っても、30分ごとに確かめ直す
const drift = app("2026-11-04T10:00:00+09:00");
await flush();
drift.shift(LOGIN_RECHECK - 1); drift.events.get("focus")(); await flush();
assert.equal(drift.checks.length, 1);
drift.shift(1); drift.events.get("focus")(); await flush();
assert.equal(drift.checks.length, 2, "30分たてば問い合わせ直す");
drift.watch.stop();

// 通信に失敗したら1分後にやり直す
const off = app("2026-11-04T23:59:00+09:00");
off.fail = true;
await flush();
assert.equal(off.checks.length, 1);
off.fail = false;
off.shift(LOGIN_RETRY - 1); off.events.get("focus")(); await flush();
assert.equal(off.checks.length, 1, "すぐには叩き直さない");
off.shift(1); off.events.get("focus")(); await flush();
assert.equal(off.checks.length, 2, "1分たてばやり直す");
off.watch.stop();

// 札を出している間は問い合わせない。閉じたら0時を過ぎたぶんを確かめる
const card = app("2026-11-04T23:59:00+09:00");
await flush();
card.open = true;
card.time("2026-11-05T00:01:00+09:00"); await card.tick();
assert.equal(card.checks.length, 1, "札を出したまま0時を過ぎても中身を替えない");
assert.equal(card.wait(), 60000, "札を出している間は1分おきに見るだけ");
card.watch.check(true); await flush();
assert.equal(card.checks.length, 2, "「もう一度確認する」は札を出していても問い合わせる");
card.open = false;
card.time("2026-11-06T00:00:30+09:00");
card.watch.check(); await flush();
assert.deepEqual(card.checks, ["2026-11-04", "2026-11-05", "2026-11-06"], "閉じたところで翌日のぶん");
card.watch.stop();

// 問い合わせ中に合図が重なっても二重に送らない
{
  let release;
  const clock = at("2026-11-04T12:00:00+09:00"), events = new Map();
  let calls = 0;
  const target = { hidden: false, addEventListener: (n, f) => events.set(n, f), removeEventListener() {} };
  const w = watchLoginDay(() => { calls++; return new Promise((r) => { release = r; }); },
    { now: () => clock, page: target, host: target, later: () => 0, cancel() {} });
  w.check(true); events.get("focus")();
  assert.equal(calls, 1, "問い合わせ中は重ねない");
  release(clock); await flush(); w.stop();
}

const ui = fs.readFileSync("src/ui/loginbonus.jsx", "utf8");
assert.ok(ui.includes("watchLoginDay("), "ログインボーナスの札が見張りを使う");
assert.ok(ui.includes("return data.now"), "サーバー時刻で次の0時を数える");
console.log("Login session: 起動・復帰・日本時間0時・端末時計のずれ・数日ぶりの復帰・時計の巻き戻し・失敗時のやり直し・札の表示中 PASS");
