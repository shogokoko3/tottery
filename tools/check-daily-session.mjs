import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { build } from "esbuild";
import { watchDailySession, canRefreshDailySession } from "../src/game/daily-session.js";

function session(at) {
  let clock = Date.parse(at), next = 0;
  const timers = new Map(), events = new Map(), updates = [];
  const target = {
    hidden: false,
    addEventListener(name, fn) { events.set(name, fn); },
    removeEventListener(name, fn) { if (events.get(name) === fn) events.delete(name); },
  };
  const stop = watchDailySession(day => updates.push(day), {
    now: () => clock, page: target, host: target,
    later: (fn, delay) => { const id = ++next; timers.set(id, { fn, delay }); return id; },
    cancel: id => timers.delete(id),
  });
  return { target, timers, events, updates, stop,
    time(at) { clock = Date.parse(at); },
    tick() { [...timers.values()][0]?.fn(); },
  };
}
const day = session("2026-10-30T04:59:59+09:00");
assert.deepEqual(day.updates, []);
day.time("2026-10-30T05:00:00+09:00"); day.tick();
assert.deepEqual(day.updates, ["2026-10-30"]);
day.events.get("focus")(); day.events.get("pageshow")();
assert.equal(day.updates.length, 1, "One update even if all foreground events arrive");
assert.equal(day.timers.size, 0); day.stop();
assert.equal(day.events.size, 0);
const hidden = session("2026-10-29T23:59:59+09:00");
hidden.time("2026-10-30T00:00:01+09:00"); hidden.tick();
assert.equal(hidden.updates.length, 0, "Midnight is not the 05:00 data update");
hidden.target.hidden = true;
hidden.time("2026-11-02T08:00:00+09:00"); hidden.tick();
assert.equal(hidden.updates.length, 0, "No navigation while suspended");
hidden.target.hidden = false;
hidden.events.get("tottery-audio-state")({ status: "active" });
assert.deepEqual(hidden.updates, ["2026-11-02"], "Several suspended days result in one login");
hidden.stop();
const back = session("2026-10-30T10:00:00+09:00");
back.time("2026-10-29T10:00:00+09:00"); back.tick();
assert.equal(back.updates.length, 0, "Moving the device clock backwards does not reset the session");
back.stop(); back.tick(); assert.equal(back.timers.size, 0);
for (const screen of ["game", "skins", "shop", "battlepass", "room", "nearby", "online"])
  assert.equal(canRefreshDailySession(screen), false, `Finish ${screen} first`);
assert.equal(canRefreshDailySession("menu"), true);
assert.equal(canRefreshDailySession("home"), true);
assert.equal(canRefreshDailySession("home", "name"), false);

// Real auth module with controlled network responses. Never contact Firebase.
const bundled = await build({ entryPoints: ["src/net/auth.js"], bundle: true, write: false, format: "iife", globalName: "Auth" });
const store = new Map([["tottery.auth.v1", JSON.stringify({ uid: "same-player", refreshToken: "fixture-refresh" })]]);
const requests = [];
let fail = false, release;
const sandbox = {
  console, Date, URL, encodeURIComponent, atob,
  setTimeout() { return 0; },
  localStorage: { getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,v), removeItem: k => store.delete(k) },
  fetch: async (url, options) => {
    requests.push({ url, body: options.body });
    assert.ok(url.includes("securetoken.googleapis.com"), "Never create a replacement account during re-login");
    if (release) await new Promise(resolve => { release.resolve = resolve; });
    return fail
      ? { ok: false, status: 400, json: async () => ({ error: { message: "INVALID_REFRESH_TOKEN" } }) }
      : { ok: true, json: async () => ({ user_id: "same-player", refresh_token: "fixture-refresh", id_token: `fixture-id-${requests.length}`, expires_in: 3600 }) };
  },
};
vm.runInNewContext(bundled.outputFiles[0].text, sandbox);
const auth = sandbox.Auth;
assert.equal((await auth.ensureAuth()).uid, "same-player");
await auth.ensureAuth(); assert.equal(requests.length, 1, "Ordinary requests retain valid token cache");
release = {};
const first = auth.ensureAuth({ forceRefresh: true });
const second = auth.ensureAuth({ forceRefresh: true });
await Promise.resolve(); release.resolve(); release = null;
assert.equal((await first).uid, "same-player"); await second;
assert.equal(requests.length, 2, "Double taps share one forced refresh");
fail = true;
assert.equal(await auth.ensureAuth({ forceRefresh: true }), null, "A failed login cannot silently reuse the old token");
assert.equal(auth.myUid(), "same-player");
assert.equal(JSON.parse(store.get("tottery.auth.v1")).refreshToken, "fixture-refresh");
fail = false;
assert.equal((await auth.ensureAuth({ forceRefresh: true })).uid, "same-player", "Manual retry bypasses network backoff");
store.delete("tottery.auth.v1");
assert.equal(await auth.ensureAuth({ forceRefresh: true }), null, "Missing credentials cannot create a new identity");
store.set("tottery.auth.v1", JSON.stringify({ uid: "same-player", refreshToken: "fixture-refresh" }));
assert.equal((await auth.ensureAuth({ forceRefresh: true })).uid, "same-player", "Restoring a credential can retry after a missing-credential check");
const ui = fs.readFileSync("src/ui/screens.jsx", "utf8");
assert.ok(ui.includes("watchDailySession(setDailyUpdate)"));
assert.ok(ui.includes("<TotteryScreens key={session}"), "Re-login remounts screen/data subscriptions at title");
console.log("Daily session: JST 05:00 boundary, background/multi-day return, safe deferral, one update, same-account forced login, failure/retry and credential retention PASS");
