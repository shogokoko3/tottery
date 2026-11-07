import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";

// 実際の振動モジュールを、ネイティブ呼出しだけ記録する環境で実行する。
const bundle = await build({
  bundle: true, write: false, format: "iife", globalName: "hapticTest",
  stdin: {
    resolveDir: process.cwd(),
    contents: `export * from './src/game/haptics.js';
      export * from './src/game/haptic-settings.js';
      export * from './src/game/capture-sequence.js';`,
  },
  plugins: [{ name: "record-native-haptics", setup(b) {
    b.onResolve({ filter: /^@capacitor\/haptics$/ }, () => ({ path: "haptics", namespace: "record" }));
    b.onLoad({ filter: /.*/, namespace: "record" }, () => ({ contents: `
      export const ImpactStyle = { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' };
      export const NotificationType = { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' };
      export const Haptics = {
        impact: options => globalThis.record('impact', options.style),
        notification: options => globalThis.record('notification', options.type),
      };`, loader: "js" }));
  }}],
});

function environment({ saved = null, storageFails = false, nativeFails = false } = {}) {
  let time = 0, seq = 0;
  const calls = [], timers = new Map(), events = new Map(), values = new Map();
  if (saved !== null) values.set("tottery.haptics.v1", saved);
  const listen = (type, fn) => {
    if (!events.has(type)) events.set(type, []);
    events.get(type).push(fn);
  };
  const context = vm.createContext({
    Date: { now: () => time },
    localStorage: {
      getItem(key) { if (storageFails) throw Error("unavailable"); return values.get(key) ?? null; },
      setItem(key, value) { if (storageFails) throw Error("unavailable"); values.set(key, value); },
    },
    document: { hidden: false, addEventListener: listen },
    addEventListener: listen,
    setTimeout(fn, ms) { timers.set(++seq, { at: time + ms, fn }); return seq; },
    clearTimeout(id) { timers.delete(id); },
    record(kind, value) {
      if (nativeFails) return Promise.reject(Error("unsupported"));
      calls.push({ at: time, kind, value });
      return Promise.resolve();
    },
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  const tick = (ms) => {
    const end = time + ms;
    while (true) {
      const next = [...timers].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]); time = next[1].at; next[1].fn();
    }
    time = end;
  };
  return { api: context.hapticTest, calls, tick, values, timers, context,
    emit: (type, event = {}) => events.get(type)?.forEach(fn => fn(event)),
  };
}

let passed = 0;
function check(label, run) { run(); passed++; console.log(`  ok ${label}`); }

check("初期ON、OFF保存の復元、壊れた保存でも起動", () => {
  assert.equal(environment().api.hapticsEnabled(), true);
  assert.equal(environment({ saved: '{"enabled":false}' }).api.hapticsEnabled(), false);
  assert.equal(environment({ saved: "broken" }).api.hapticsEnabled(), true);
});
check("設定の変更・通知・保存・再起動後の復元", () => {
  const e = environment(); let changes = 0;
  const off = e.api.subscribeHaptics(() => changes++);
  e.api.setHapticsEnabled(false);
  assert.equal(changes, 1);
  const saved = e.values.get("tottery.haptics.v1");
  assert.equal(environment({ saved }).api.hapticsEnabled(), false);
  off(); e.api.setHapticsEnabled(true); assert.equal(changes, 1);
});
check("保存が拒否されても、その場でOFFが効く", () => {
  const e = environment({ storageFails: true });
  e.api.setHapticsEnabled(false);
  e.api.vibrateCapture({ king: true }); e.api.vibrateMatchFound();
  e.tick(1000); assert.equal(e.calls.length, 0);
});
check("OFFは新旧すべてのパターンを抑止", () => {
  const e = environment(); e.api.setHapticsEnabled(false);
  for (const pattern of Object.keys(e.api.PATTERNS)) assert.equal(e.api.vibrate(pattern), false);
  e.tick(1000); assert.equal(e.calls.length, 0);
});
check("SSRとフォイルはLight→100ms後にHeavy、SRはMediumを1回", () => {
  for (const name of ["raritySSR", "foil"]) {
    const e = environment(); e.api.vibrate(name); e.tick(99);
    assert.deepEqual(e.calls.map(c => c.value), ["LIGHT"]);
    e.tick(1); assert.deepEqual(e.calls.map(c => c.value), ["LIGHT", "HEAVY"]);
  }
  const e = environment(); e.api.vibrate("raritySR"); e.tick(1000);
  assert.deepEqual(e.calls.map(c => c.value), ["MEDIUM"]);
});
check("門タッチ・開放・破砕の強さ", () => {
  const e = environment();
  ["gateTouch", "gateOpen", "captureBreak"].forEach(p => e.api.vibrate(p));
  assert.deepEqual(e.calls.map(c => c.value), ["LIGHT", "MEDIUM", "MEDIUM"]);
});
check("OFF直後にONへ戻しても、古い連続振動は再開しない", () => {
  for (const pattern of ["raritySSR", "captureMany"]) {
    const e = environment(); e.api.vibrate(pattern);
    e.api.setHapticsEnabled(false); e.api.setHapticsEnabled(true); e.tick(1000);
    assert.equal(e.calls.length, 1); assert.equal(e.timers.size, 0);
  }
});
check("演出の終了・バックグラウンド移行で残りを中止", () => {
  const e = environment(); const cancel = e.api.playHaptic("foil"); cancel(); e.tick(1000);
  assert.equal(e.calls.length, 1);
  e.api.vibrate("foil"); e.context.document.hidden = true; e.emit("visibilitychange");
  e.context.document.hidden = false; e.tick(1000); assert.equal(e.calls.length, 2);
  e.context.document.hidden = true; assert.equal(e.api.vibrateMatchFound(), false);
});
check("10連の同時昇格をまとめ、SSRをSRより優先", () => {
  const e = environment();
  for (let i = 0; i < 10; i++) e.api.vibrate("raritySR");
  assert.equal(e.calls.length, 1);
  e.api.vibrate("raritySSR"); e.api.vibrate("raritySR"); e.api.vibrate("raritySSR"); e.tick(100);
  assert.deepEqual(e.calls.map(c => c.value), ["MEDIUM", "LIGHT", "HEAVY"]);
});
check("別タブのOFFと保存削除が反映される", () => {
  const e = environment(); e.api.vibrate("foil");
  e.values.set("tottery.haptics.v1", '{"enabled":false}');
  e.emit("storage", { key: "tottery.haptics.v1" }); e.tick(1000);
  assert.equal(e.api.hapticsEnabled(), false); assert.equal(e.calls.length, 1);
  e.values.clear(); e.emit("storage", { key: null }); assert.equal(e.api.hapticsEnabled(), true);
});
check("まとめ取りは枚数分、最後はMedium、王と損失は専用演出に任せる", () => {
  const e = environment(), a = e.api;
  for (let total = 2; total <= 12; total++) {
    const patterns = Array.from({ length: total }, (_, index) => a.captureRevealPattern({ index, total })).filter(Boolean);
    assert.equal(patterns.length, total);
    assert.equal(patterns.at(-1).style, "MEDIUM");
  }
  assert.equal(a.captureRevealPattern({ index: 0, total: 1 }), null);
  assert.equal(a.captureRevealPattern({ index: 0, total: 3, king: true }), null);
  assert.equal(a.captureRevealPattern({ index: 0, total: 3, mine: false }), null);
});
check("王は公開の220ms後まで専用振動を選ばない", () => {
  const { api: a } = environment();
  const q = a.captureTiming(null, 1), cards = [{ isKing: true }];
  assert.equal(a.captureFrame(q.reveal - 1, q, cards).king, false);
  assert.equal(a.captureFrame(q.reveal + 219, q, cards).royal, false);
  assert.equal(a.captureFrame(q.reveal + 220, q, cards).royal, true);
  assert.equal(a.capturePattern({ king: true }).type, "SUCCESS");
  assert.equal(a.capturePattern({ king: true, mine: false }).type, "ERROR");
});
check("非対応端末・不明なパターンでも進行を妨げない", () => {
  const e = environment({ nativeFails: true });
  assert.doesNotThrow(() => { e.api.vibrate("foil"); e.tick(1000); });
  assert.equal(e.api.vibrate("unknown"), false);
  assert.equal(e.api.vibrate({}), false);
});
await Promise.resolve();
console.log(`振動の保存・抑止・同期・タイミング: ${passed}項目 OK`);
