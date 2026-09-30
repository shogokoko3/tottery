/**
 * フェーズ(src/game/phase.js)の決まりを確かめる。設計は ストーリーとフェーズ.md
 */
import assert from "node:assert/strict";
import {
  PHASES, PHASE_MAX, DEFAULT_PHASE, PHASE_EPOCH, STORY_AXES, PROMOTION_WINS,
  normalizePhase, phaseOf, rulesForPhase, setupFlagsForPhase, normalizePhaseWins, normalizeStory,
  promotionStatus, canPromote, promote, clearAxis, addPhaseWin, stageSize, rankedPhase,
} from "../src/game/phase.js";

let ok = 0;
const fail = [];
const is = (label, got, want) => {
  try { assert.deepEqual(got, want); ok++; console.log(`  ok   ${label}`); }
  catch { fail.push(label); console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); }
};

console.log("決まりごと");
is("フェーズは 1・2・3", [...PHASES], [1, 2, 3]);
is("既定はストーリー公開で 1(既存プレイヤーも最初から)", DEFAULT_PHASE, 1);
is("フェーズの世代", PHASE_EPOCH, 1);
is("軸は 6 つ、この順", [...STORY_AXES], ["23", "45", "67", "89", "10", "jqk"]);
is("昇格に要る勝利数", PROMOTION_WINS, 5);
is("変な値は既定へ", [normalizePhase(0), normalizePhase(4), normalizePhase("2"), normalizePhase(null)], [1, 1, 1, 1]);
is("profile から読む", [phaseOf({ phase: 2 }), phaseOf({}), phaseOf(null)], [2, 1, 1]);

console.log("\nフェーズごとの対局の決まり");
is("1: 力なし・エリアなし・5×5 だけ", rulesForPhase(1), { kingPowers: false, areas: false, sizes: [5] });
is("2: 力あり・エリアなし・9×9 だけ(2026-09-30)", rulesForPhase(2), { kingPowers: true, areas: false, sizes: [9] });
is("3: 力あり・エリアあり・5×5/9×9", rulesForPhase(3), { kingPowers: true, areas: true, sizes: [5, 9] });
is("ストーリーのステージの盤: フェーズ1 は 5×5、2 からは 9×9", [stageSize(1), stageSize(2), stageSize(3), stageSize(null)], [5, 9, 9, 5]);
is("持ち点はフェーズ3だけ", [rankedPhase(1), rankedPhase(2), rankedPhase(3), rankedPhase(undefined)], [false, false, true, false]);
is("START_SETUP の旗: 1 だけ kingPowers:false、ほかは旗なし(古い記録と揃える)", [setupFlagsForPhase(1), setupFlagsForPhase(2), setupFlagsForPhase(3)], [{ kingPowers: false }, {}, {}]);

console.log("\n昇格");
{
  let p = { phase: 1 };
  is("はじめは何も無い", promotionStatus(p), { phase: 1, last: false, axesCleared: 0, axesTotal: 6, axesLeft: [...STORY_AXES], wins: 0, winsNeeded: 5, winsLeft: 5 });
  for (const a of STORY_AXES) p = clearAxis(p, a);
  p = clearAxis(p, "23");
  is("6 軸クリア(同じ軸は二度数えない)", promotionStatus(p).axesCleared, 6);
  is("勝利が足りないと昇格できない", canPromote(p), false);
  for (let i = 0; i < 4; i++) p = addPhaseWin(p);
  is("4 勝ではまだ", [promotionStatus(p).winsLeft, canPromote(p)], [1, false]);
  p = addPhaseWin(p);
  is("6 軸 + 5 勝で昇格できる", canPromote(p), true);
  const q = promote(p);
  is("昇格するとフェーズ 2", q.phase, 2);
  is("フェーズ 2 のストーリーと勝利は 0 から", promotionStatus(q), { phase: 2, last: false, axesCleared: 0, axesTotal: 6, axesLeft: [...STORY_AXES], wins: 0, winsNeeded: 5, winsLeft: 5 });
  is("フェーズ 1 の記録は残る", [normalizeStory(q.story)[1].length, normalizePhaseWins(q.phaseWins)[1]], [6, 5]);
  is("昇格できないときは promote しても変わらない", promote({ phase: 1 }), { phase: 1 });
  let r = { phase: 3 };
  for (const a of STORY_AXES) r = clearAxis(r, a);
  for (let i = 0; i < 5; i++) r = addPhaseWin(r);
  is("最後のフェーズは昇格しない", [promotionStatus(r).last, canPromote(r), promote(r).phase], [true, false, 3]);
  is("知らない軸は数えない", clearAxis({ phase: 1 }, "xx"), { phase: 1 });
}

console.log("\n形をそろえる");
is("phaseWins の形", normalizePhaseWins({ 1: 2, 2: -1, 3: "x", 9: 5 }), { 1: 2, 2: 0, 3: 0 });
is("story の形(知らない軸・重複を落とす)", normalizeStory({ 1: ["23", "23", "zz"], 2: "x" }), { 1: ["23"], 2: [], 3: [] });


console.log("\nprofile との結びつき(recordGame)");
{
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  if (!globalThis.window) globalThis.window = globalThis;
  if (!globalThis.window.dispatchEvent) globalThis.window.dispatchEvent = () => true;
  if (!globalThis.window.addEventListener) globalThis.window.addEventListener = () => {};
  const { loadProfile, recordGame } = await import("../src/game/profile.js");
  // 保存の口は export されていないので、保存先の鍵に直接書く
  const saveProfile = (p) => mem.set("tottery.account.v1", JSON.stringify(p));
  const fresh = loadProfile();
  is("新しい profile の既定", [fresh.phase, fresh.phaseEpoch, fresh.phaseWins, fresh.story], [1, PHASE_EPOCH, { 1: 0, 2: 0, 3: 0 }, { 1: [], 2: [], 3: [] }]);
  // 公開前の端末が保存した phase:3(世代なし)は 1 へ。世代が合っていれば保存どおり
  saveProfile({ ...fresh, phase: 3, phaseEpoch: undefined });
  is("世代の無い保存(公開前)はフェーズ 1 からやり直す", [loadProfile().phase, loadProfile().phaseEpoch], [1, PHASE_EPOCH]);
  saveProfile({ ...fresh, phase: 3, phaseEpoch: PHASE_EPOCH - 1 });
  is("古い世代の保存も 1 へ", loadProfile().phase, 1);
  saveProfile({ ...fresh, phase: 2, phaseEpoch: PHASE_EPOCH, story: { 1: ["23", "45"], 2: [], 3: [] }, phaseWins: { 1: 5, 2: 0, 3: 0 } });
  is("いまの世代の保存はフェーズも記録もそのまま", [loadProfile().phase, loadProfile().story[1], loadProfile().phaseWins[1]], [2, ["23", "45"], 5]);
  saveProfile({ ...fresh, phase: 1, phaseEpoch: PHASE_EPOCH });
  saveProfile({ ...fresh, phase: 1 });
  recordGame(true, { online: true });
  is("オンラインで勝つと、そのフェーズの勝利が 1 つ", loadProfile().phaseWins, { 1: 1, 2: 0, 3: 0 });
  recordGame(false, { online: true });
  recordGame(null, { online: true });
  is("負け・引き分けは数えない", loadProfile().phaseWins[1], 1);
  recordGame(true, { online: false });
  is("手元の対局(CPU)は数えない", loadProfile().phaseWins[1], 1);
  recordGame(true, { online: true, tutorial: true, tutorialId: 1, xp: 0 });
  is("チュートリアルは数えない", loadProfile().phaseWins[1], 1);
  saveProfile({ ...loadProfile(), phase: 2 });
  recordGame(true, { online: true });
  is("フェーズ 2 の勝ちはフェーズ 2 の欄に", loadProfile().phaseWins, { 1: 1, 2: 1, 3: 0 });
  recordGame(true, { online: true, phase: 3 });
  is("上のフェーズの決まりで勝っても、自分のフェーズには数えない", loadProfile().phaseWins, { 1: 1, 2: 1, 3: 0 });
  recordGame(true, { online: true, phase: 2 });
  is("対局のフェーズが自分と同じなら数える", loadProfile().phaseWins, { 1: 1, 2: 2, 3: 0 });
  saveProfile({ ...loadProfile(), phase: 7, phaseWins: { 1: "x" }, story: { 2: ["23", "zz"] } });
  const back = loadProfile();
  is("壊れた値は読み直しでそろう", [back.phase, back.phaseWins, back.story], [1, { 1: 0, 2: 0, 3: 0 }, { 1: [], 2: ["23"], 3: [] }]);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) { console.error("NG: " + fail.join(", ")); process.exit(1); }
