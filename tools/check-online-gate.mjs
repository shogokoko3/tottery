/** ランダムマッチの入口の条件(第8話まで)を検査する */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const { ONLINE_GATE_EPISODES, onlineGate, onlineGateLabel } = await import("../src/game/online-gate.js");
const { TUTORIALS } = await import("../src/game/tutorial.js");
const { loadProfile } = await import("../src/game/profile.js");
let ok = 0; const fails = [];
const is = (label, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) { ok++; console.log(`  ok   ${label}`); } else { fails.push(label); console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); } };
const fresh = loadProfile();
is("第8話まで", ONLINE_GATE_EPISODES, 8);
is("最初は閉じている", onlineGate(fresh).ok, false);
is("残りは8話", onlineGate(fresh).remaining, 8);
is("次は第1話", onlineGate(fresh).next?.id, 1);
is("一言", onlineGateLabel(onlineGate(fresh)), "チュートリアル 第8話まで（あと8話）");
const seven = { ...fresh, cleared: TUTORIALS.slice(0, 7).map((t) => t.id) };
is("7話では閉じている(あと1話)", onlineGate(seven).remaining, 1);
is("次は第8話", onlineGate(seven).next?.id, 8);
const eight = { ...fresh, cleared: TUTORIALS.slice(0, 8).map((t) => t.id) };
is("8話で開く", onlineGate(eight).ok, true);
is("開いたら一言は無い", onlineGateLabel(onlineGate(eight)), null);
const gaps = { ...fresh, cleared: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12] };
is("順不同でも8話までが全部要る(第4話が無ければ閉じる)", onlineGate(gaps).ok, false);
is("第9話以降は条件にしない", onlineGate({ ...fresh, cleared: [1, 2, 3, 4, 5, 6, 7, 8] }).ok, true);
console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) process.exit(1);
