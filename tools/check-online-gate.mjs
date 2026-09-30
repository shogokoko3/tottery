/** ランダムマッチの入口の条件(ストーリーのフェーズ1をクリアで開く。2026-09-30 本人の指示)を検査する */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const { ONLINE_GATE_PHASE, onlineGate, onlineGateLabel } = await import("../src/game/online-gate.js");
const { STORY_AXES } = await import("../src/game/phase.js");
const { loadProfile } = await import("../src/game/profile.js");
let ok = 0; const fails = [];
const is = (label, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) { ok++; console.log(`  ok   ${label}`); } else { fails.push(label); console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); } };
const fresh = loadProfile();
const withStory = (p1, extra = {}) => ({ ...fresh, phase: 1, story: { 1: p1, 2: [], 3: [] }, ...extra });
is("条件はフェーズ1のストーリー", ONLINE_GATE_PHASE, 1);
is("新しい人はフェーズ1で閉じている", [fresh.phase, onlineGate(fresh).ok], [1, false]);
is("残りは6ステージ", onlineGate(fresh).remaining, 6);
is("次は 2・3", onlineGate(fresh).next, "23");
is("一言", onlineGateLabel(onlineGate(fresh)), "ストーリー フェーズ1のクリアで開きます（あと6ステージ）");
const five = withStory(STORY_AXES.slice(0, 5));
is("5ステージでは閉じている(あと1)", [onlineGate(five).ok, onlineGate(five).remaining], [false, 1]);
is("次は J・Q・K", onlineGate(five).next, "jqk");
const gaps = withStory(["23", "45", "89", "10", "jqk"]);
is("順不同でも6ステージ全部が要る(6・7 が無ければ閉じる)", [onlineGate(gaps).ok, onlineGate(gaps).next], [false, "67"]);
const all = withStory([...STORY_AXES]);
is("6ステージで開く(昇格の前でも)", onlineGate(all).ok, true);
is("開いたら一言は無い", onlineGateLabel(onlineGate(all)), null);
is("フェーズ2 以上は開いている", [onlineGate({ ...fresh, phase: 2 }).ok, onlineGate({ ...fresh, phase: 3 }).ok], [true, true]);
is("フェーズ2・3 のクリアは条件にしない", onlineGate(withStory([], { story: { 1: [], 2: [...STORY_AXES], 3: [...STORY_AXES] } })).ok, false);
is("チュートリアルを全部終えても開かない(ストーリーで開く)", onlineGate({ ...fresh, cleared: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }).ok, false);
is("壊れた記録でも落ちない", onlineGate({ phase: 1, story: { 1: ["zz", 3] } }).ok, false);
console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) process.exit(1);
