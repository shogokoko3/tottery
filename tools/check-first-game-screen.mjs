/**
 * はじめの一局(FIRST_GAME。2026-10-01 本人の指示)の対局画面の検査。
 * 台本と盤の正しさは check-first-game が見る。ここは画面の部品と配線を見る。
 *   A. 案内の札(TutorialSheet): 行の配列を1行ずつ・picked と kingAlt の出し分け・待つ札の「つづき」・
 *      ヒントの行と 2・3・5 の動きの図・まちがいの一言の2行・飛ばす/中断を出さない
 *   B. 王を選ぶ画面(KingStep): 見出しを出さない・「配置に戻る」を出さない・相手の伏せ札5枚
 *   C. 結果画面(GameView): ステージクリア・両者の王・あなたの王の一行(王5通り × 4♦/5♥)・結びの行・
 *      締めの一行・「門へ進む」・下の釦はストーリーの形
 *   D. 配線(game.jsx・screens.jsx): フェーズ・関門・相手の待ち・記録・中断・席の名前
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { reducer } from "../src/game/reducer.js";
import { getLegalMoves, kingRankOf } from "../src/game/board.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { FIRST_GAME, TUTORIALS, foeAction, openingState, stepLines, textLines } from "../src/game/tutorial.js";

let fail = 0;
function ok(label, cond, extra) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) fail++;
}
const count = (html, re) => (html.match(re) || []).length;

const tut = FIRST_GAME;
const legal = (a, p) =>
  getLegalMoves(p, a.board, a.boardSize, a.players[p.owner].armyRankCounts, kingRankOf(a, p.owner));
const moveOf = (a, id, row, col) => {
  const hit = legal(a, a.pieces[id]).find((m) => m.row === row && m.col === col);
  assert.ok(hit, `${id} が (${row},${col}) へ動ける`);
  return { type: "MOVE_PIECE", pieceId: id, row, col, captures: hit.captures };
};
const settle = (a) => {
  for (let g = 0; g < 10 && a.interstitial; g++) a = reducer(a, { type: "DISMISS_INTERSTITIAL" });
  return a;
};
/** 王を選んで確定し、1手目まで(あなたの番) */
function started(king) {
  let s = openingState(tut, GAME_RULE_VERSION);
  s = reducer(s, { type: "SETUP_PICK_KING", player: 0, cardId: king });
  s = reducer(s, { type: "SETUP_CONFIRM", player: 0 });
  return settle(s);
}
/** 1手目のあと、相手の番(待つ札の場面) */
function held(king) {
  let s = started(king);
  s = settle(reducer(s, moveOf(s, "t0", 1, 2)));
  return settle(reducer(s, { type: "DISMISS_CAPTURE" }));
}
/** 討ち終えた局面(撃破の札は閉じたあと) */
function finished(king, finisher) {
  let s = held(king);
  s = settle(reducer(s, foeAction(s, tut, 0, (p) => legal(s, p))));
  s = settle(reducer(s, moveOf(s, finisher, 2, 4)));
  return reducer(s, { type: "DISMISS_CAPTURE" });
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-first-game-"));
let R;
try {
  const outfile = path.join(dir, "view.cjs");
  await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "jsx",
      contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {GameView} from './src/ui/game.jsx';import {SeatsProvider} from './src/ui/names.jsx';
import {TutorialSheet} from './src/ui/tutorial.jsx';import {KingStep} from './src/ui/setup.jsx';
const seats={names:["あなた","二と三の王"],icons:[null,null],titles:[null,null],skins:[{},{}]};
const wrap=(el)=>renderToStaticMarkup(<SeatsProvider value={seats}>{el}</SeatsProvider>);
export const renderSheet=(props)=>wrap(<TutorialSheet index={1} total={6} onNext={()=>{}} {...props} />);
export const renderKing=(state, props)=>wrap(<KingStep state={state} player={state.players[0]} pIdx={0} size={5} dispatch={()=>{}} remainingMs={null} limitMs={1} {...props} />);
export const renderView=(state, tutorial, extra)=>wrap(<GameView state={state} size={5} viewer={0} youAre={0} dispatch={()=>{}} onExit={()=>{}} onHome={()=>{}} tutorial={tutorial} nextTutorial={null} onNextTutorial={null} onTutorialList={()=>{}} rating={null} rematch={null} seasonResult={{active:false}} {...extra} />);`,
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    outfile,
    logLevel: "silent",
    define: { __FIELD_FILES__: "{}", __BUILD_VERSION__: '"check"' },
    loader: { ".css": "text", ".png": "dataurl", ".jpg": "dataurl", ".webp": "dataurl", ".mp4": "dataurl", ".mp3": "dataurl", ".svg": "dataurl" },
  });
  // 画面の部品は読み込み時にブラウザの窓を触る。描くだけなので、空の窓を置く(check-tutorial-opening と同じ)
  const noop = () => {};
  Object.assign(globalThis, {
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
    requestAnimationFrame: (f) => setTimeout(f, 0),
    cancelAnimationFrame: clearTimeout,
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 2,
    scrollTo: noop,
    location: { protocol: "http:", hostname: "localhost", host: "localhost", href: "http://localhost/", search: "", origin: "http://localhost", pathname: "/" },
    document: {
      addEventListener: noop,
      removeEventListener: noop,
      visibilityState: "visible",
      hidden: false,
      body: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop },
      documentElement: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, setAttribute: noop, getAttribute: () => null },
      createElement: () => ({ style: {}, setAttribute: noop, getAttribute: () => null, appendChild: noop, remove: noop, getContext: () => null, classList: { add: noop, remove: noop } }),
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      head: { appendChild: noop },
      fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
    },
  });
  globalThis.window = globalThis;
  if (typeof globalThis.Image === "undefined") globalThis.Image = class { set src(_) {} };
  if (typeof globalThis.Audio === "undefined") globalThis.Audio = class { play() {} pause() {} };
  R = createRequire(import.meta.url)(outfile);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
const { renderSheet, renderKing, renderView } = R;

/* =====================================================================
   A. 案内の札
   ===================================================================== */
console.log("A. 案内の札");
{
  const rows = (html) => [...html.matchAll(/<span class="tutorial-line-row">([^<]*)<\/span>/g)].map((m) => m[1]);
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  // 1枚目(王を選ぶ): 2行を1行ずつ。飛ばす・中断は出さない(onSkip・onInterrupt を渡さない)
  const pick = renderSheet({ step: tut.steps[0], lines: stepLines(tut.steps[0], openingState(tut, GAME_RULE_VERSION)), left: 2 });
  ok("行の配列は1行ずつ出す", same(rows(pick), textLines(tut.steps[0].text)), rows(pick).join(" / "));
  ok("「あと 2 手」", /あと 2 手/.test(pick));
  ok("飛ばす・中断を渡さなければ出さない", !/この話を飛ばす|中断してやめる/.test(pick));
  // 3枚目(4♠ で取る): 4♠ を選ぶ前と後で文が変わる
  const s1 = started("t2");
  const before = renderSheet({ step: tut.steps[2], lines: stepLines(tut.steps[2], s1) });
  ok("4♠ を選ぶ前は text", same(rows(before), textLines(tut.steps[2].text)));
  const sel = reducer(s1, { type: "SELECT_PIECE", id: "t0" });
  const after = renderSheet({ step: tut.steps[2], lines: stepLines(tut.steps[2], sel) });
  ok("4♠ を選んだあとは picked", same(rows(after), textLines(tut.steps[2].picked)), rows(after).join(" / "));
  // まちがいの一言(行の配列)は2行とも出る
  const wrong = tut.steps[4].need.choose.wrong;
  const nudged = renderSheet({ step: tut.steps[4], lines: textLines(tut.steps[4].text), nudge: wrong });
  ok("まちがいの一言を2行とも出す", wrong.every((l) => nudged.includes(l)) && /tutorial-wait-lines/.test(nudged));
  ok("一言は赤い帯(tutorial-nudge)", /tutorial-wait tutorial-nudge/.test(nudged));
  // 4枚目(待つ札): 「つづき」を光らせる。戻る釦は出さない(onBack を渡さない)
  for (const king of ["t2", "t0"]) {
    const s = held(king);
    const hold = renderSheet({ step: tut.steps[3], lines: stepLines(tut.steps[3], s), nextLabel: "つづき", lit: true, front: true });
    const want = textLines(king === "t0" ? tut.steps[3].kingAlt.text : tut.steps[3].text);
    ok(`待つ札の文(王=${king === "t0" ? "4♠" : "4♦"})`, same(rows(hold), want), rows(hold).join(" / "));
    ok(`待つ札の釦は「つづき」で、▼ で光る(王=${king})`, /class="btn btn-primary tutorial-next guide-target"[^>]*>つづき/.test(hold) && !/>次へ/.test(hold));
    ok(`待つ札に「戻る」を出さない(王=${king})`, !/前の説明に戻る/.test(hold));
  }
  // 5枚目(自分で考える1手): ヒントは開く前は釦だけ、開くと2行と 2・3・5 の図
  const choose = tut.steps[4];
  const closed = renderSheet({ step: choose, lines: textLines(choose.text), onHint: () => {} });
  ok("ヒントを開く前は釦だけ", /ヒントを見る/.test(closed) && !/move-guide/.test(closed) && !/ヒント: /.test(closed));
  ok("自分で考える1手の印", /自分で考える1手/.test(closed));
  const open = renderSheet({ step: choose, lines: textLines(choose.text), hint: choose.need.choose.hint, hintGuide: choose.need.choose.hintGuide });
  ok("ヒントの1行目", open.includes(`ヒント: ${choose.need.choose.hint[0]}`));
  ok("ヒントの2行目", open.includes(choose.need.choose.hint[1]));
  ok("動きの図は 2・3・5 の3行", /move-guide/.test(open) && count(open, /class="move-hint-row ?"/g) === 3, `${count(open, /class="move-hint-row ?"/g)} 行`);
  ok("図に ✗○ を付けない(動きから分かるのは数字まで)", !/✗|○/.test(open));
  // 第1〜13話の札(文字列)はいままでどおり1つの段落
  const ep = TUTORIALS[0].steps[0];
  const old = renderSheet({ step: ep });
  ok("第1〜13話の文字列はそのまま(行に割らない)", old.includes(`<p class="tutorial-line">${ep.text}</p>`));
  ok(
    "第1〜13話は画面が stepLines を渡しても同じ描き方",
    renderSheet({ step: ep, lines: stepLines(ep, openingState(TUTORIALS[0], GAME_RULE_VERSION)) }) === old,
  );
  ok("第1〜13話の「次へ」は光らせない", /class="btn btn-primary tutorial-next "/.test(old) && />次へ/.test(old));
  const epHint = TUTORIALS.find((t) => t.steps.some((x) => x.need && x.need.choose));
  const epChoose = epHint.steps.find((x) => x.need && x.need.choose);
  const epOpen = renderSheet({ step: epChoose, hint: epChoose.need.choose.hint });
  ok("第1〜13話のヒント(文字列)は1行のまま", epOpen.includes(`<p class="tutorial-hint-text">ヒント: ${epChoose.need.choose.hint}</p>`));
}

/* =====================================================================
   B. 王を選ぶ画面
   ===================================================================== */
console.log("\nB. 王を選ぶ画面");
{
  const s = openingState(tut, GAME_RULE_VERSION);
  const quiet = renderKing(s, { terse: true, quiet: true, lockPlacement: true, showFoe: true });
  ok("見出し「王にするカードを決めてね」を出さない", !/王にするカードを決めてね/.test(quiet));
  ok("「配置に戻る」を出さない", !/配置に戻る/.test(quiet));
  ok("「布陣を確定」はある", /布陣を確定/.test(quiet));
  ok("相手の並び(確定済み)を伏せ札5枚で描く", count(quiet, /mini-piece mini-piece-foe/g) === 5, `${count(quiet, /mini-piece mini-piece-foe/g)} 枚`);
  ok("帯(setup-head)と残り時間の場所は残す", /<div class="setup-head">/.test(quiet));
  const plain = renderKing(s, { terse: true });
  ok("ふつうの王選びは見出しと「配置に戻る」を出す", /王にするカードを決めてね/.test(plain) && /配置に戻る/.test(plain));
  ok("ふつうの王選びは相手の並びを描かない", !/mini-piece-foe/.test(plain));
}

/* =====================================================================
   C. 結果画面
   ===================================================================== */
console.log("\nC. 結果画面");
{
  const story = { axis: "23", phase: 1, size: 5, king: "3", title: "二と三の王", fresh: true, next: { axis: "45", title: "四と五の王" }, allCleared: false, ready: true };
  const endLines = textLines(tut.steps.find((x) => x.end).text);
  for (const king of ["t0", "t1", "t2", "t3", "t4"])
    for (const by of ["t2", "t1"]) {
      const s = finished(king, by);
      const label = `王=${king}・${by === "t2" ? "4♦" : "5♥"} で討つ`;
      const html = renderView(s, tut, { story, onGate: () => {} });
      const struck = king === by;
      ok(`${label}: あなたの王の一行は「${struck ? "自ら討った" : "伏せたまま"}」`, html.includes(struck ? tut.kingNote.struck : tut.kingNote.hidden) && !html.includes(struck ? tut.kingNote.hidden : tut.kingNote.struck));
      ok(`${label}: 相手の王は 3♦`, /相手の王は <b>3♦<\/b> でした/.test(html));
    }
  const s = finished("t3", "t2");
  // 次のステージへの受け口(onNextStory)も渡したうえで、門へ進むが勝つことを見る
  const gate = renderView(s, tut, { story, onGate: () => {}, onNextStory: () => {} });
  ok("見出しは「ステージクリア!」", /ステージクリア!/.test(gate) && !/チュートリアルクリア/.test(gate));
  ok("両者の王を並べる(tutorial-reveal-pair)", /tutorial-reveal-pair/.test(gate) && count(gate, /class="tutorial-reveal[ "]/g) === 2);
  ok("本文は結びの札の行", endLines.every((l) => gate.includes(`<span class="tutorial-line-row">${l}</span>`)));
  const tagParts = [...gate.matchAll(/<span class="tutorial-tagline-part">([^<]*)<\/span>/g)].map((m) => m[1]);
  ok("締めは台本の一行(「相手の王を討て。」ではない)", tagParts.join("") === tut.tagline && !/相手の王を討て。/.test(gate));
  ok("締めの一行は文ごとに折り返す(「一手に、読みを。」「一枚に、野望を。」)", tagParts.length === 2 && tagParts.every((x) => x.endsWith("。")), tagParts.join(" / "));
  ok("勝ち名乗りの飾りの札は出さない(両者の王と重なる。門へ進むまで1画面に)", !/king-card win-card/.test(gate));
  ok("「二と三の王をクリア」とチケット10枚", /二と三の王をクリア/.test(gate) && /ガチャチケット 10枚を受け取りました/.test(gate));
  ok("光る「門へ進む」を1つだけ", count(gate, /門へ進む/g) === 1 && /result-gate/.test(gate));
  ok(
    "「門へ進む」は送る中身の外(2×2 の釦の上に、いつも見える)",
    gate.indexOf('class="gameover-body"') < gate.indexOf('class="gameover-gate"') &&
      gate.indexOf('class="gameover-gate"') < gate.indexOf('class="gameover-grid"') &&
      gate.indexOf("門へ進む") > gate.indexOf('class="gameover-gate"'),
  );
  ok("門へ進むときは「次のステージへ」を出さない", !/次のステージへ/.test(gate) && !/次は「四と五の王」/.test(gate));
  ok("チュートリアルの塊(一覧へ・次は第N話)を出さない", !/チュートリアル一覧へ/.test(gate) && !/約\d分/.test(gate));
  ok("下の釦はストーリーの形(振り返り・ストーリーへ・ホームへ)", /go-review/.test(gate) && /go-match"[^>]*>ストーリーへ/.test(gate) && /go-home"[^>]*>[\s\S]*?ホームへ/.test(gate));
  ok("台本の一局に「もう一度遊ぶ」(NEW_GAME)を出さない", !/もう一度遊ぶ/.test(gate));
  ok("左下に「タイトルに戻る」を出さない", !/タイトルに戻る/.test(gate));
  const noGate = renderView(s, tut, { story, onNextStory: () => {} });
  ok("門が済んでいれば(onGate なし)「次のステージへ」", /次のステージへ/.test(noGate) && !/門へ進む/.test(noGate));
  const waiting = renderView(s, tut, { story: { ...story, ready: false }, onGate: () => {} });
  ok("記録が済むまでは「門へ進む」を出さない(ready)", !/門へ進む/.test(waiting));
  // 第1話はいままでどおり
  const ep1 = TUTORIALS[0];
  let e = openingState(ep1, GAME_RULE_VERSION);
  e = reducer(e, moveOf(e, "t3", 1, 0));
  e = settle(reducer(e, { type: "DISMISS_CAPTURE" }));
  e = settle(reducer(e, foeAction(e, ep1, 0, (p) => legal(e, p))));
  e = reducer(e, moveOf(e, "t2", 3, 2));
  e = reducer(e, { type: "DISMISS_CAPTURE" });
  const lesson = renderView(e, ep1, {});
  ok("第1話: チュートリアルクリア・「相手の王を討て。」・相手の王だけ", /チュートリアルクリア/.test(lesson) && /相手の王を討て。/.test(lesson) && !/tutorial-reveal-pair/.test(lesson));
  ok("第1話: 勝ち名乗りの飾りの札は残す", /king-card win-card tutorial-king-card/.test(lesson));
  ok("第1話: 左下はタイトルへ戻る・右下はホームへ", /go-home"[^>]*>タイトルに戻る/.test(lesson) && /go-again"[^>]*>[\s\S]*?ホームへ/.test(lesson));
}

/* =====================================================================
   D. 配線
   ===================================================================== */
console.log("\nD. 配線");
{
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  const screens = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  ok("フェーズは台本のもの(2か所とも ?? PHASE_MAX)", count(game, /tutorial \? \(tutorial\.phase \?\? PHASE_MAX\)/g) === 2);
  ok("関門は tutorialGate(検査と同じ決まり)", /const gate = tutorialGate\(tutorial, tutIdx, a, E\);\s*if \(gate\) \{[\s\S]{0,300}?setPendingCapture\(null\);\s*setTutNudge\(gate\.nudge\);\s*return;/.test(game));
  ok("台本の相手は holdFoe の札のあいだ指さない", /if \(!tutorial \|\| network \|\| fxBusy\) return;[\s\S]{0,300}?if \(foeHeld\(tutorial, tutIdx, a\)\) return;/.test(game));
  ok("「つづき」で走り直す(依存に tutIdx)", /\}, \[a, tutorial, network, fxBusy, tutIdx\]\);/.test(game));
  ok("札の行は stepLines(picked・kingAlt)", /lines=\{stepLines\(tutActive, a\)\}/.test(game));
  ok("ヒントの動きの図を渡す", /hintGuide=\{tutChoose && tutHint \? tutChoose\.choose\.hintGuide \|\| null : null\}/.test(game));
  ok("待つ札は「つづき」を光らせる", /nextLabel=\{tutActive\.nextLabel \|\| null\}/.test(game) && /lit=\{!!tutActive\.holdFoe\}/.test(game));
  ok("「前の説明へ」は canStepBack のときだけ", /onBack=\{canStepBack\(tutorial, tutIdx, a\) \? \(\) => setTutStep\(tutIdx - 1\) : null\}/.test(game));
  ok("待つ札の ▼ の代わりに光の筋", /tutThreat = \(\(\) => \{/.test(game) && /className="tutorial-threat"/.test(game));
  ok("ストーリーの台本は札の「この話を飛ばす」「中断」を出さない", /onSkip=\{\s*tutorial\.storyAxis\s*\? null/.test(game) && /onInterrupt=\{tutorial\.storyAxis \? null : onHome \? goHome : onExit\}/.test(game));
  ok("上のバーは「飛ばす」でなくストーリーの「中断」", /const skipMenu = tutorial && !tutorial\.storyAxis \? \(/.test(game));
  ok("王を選ぶ画面に quiet・lockPlacement・showFoe", /quiet=\{!!tutorial\?\.opening\?\.stopAt\}/.test(game) && (game.match(/lockPlacement=\{!!tutorial\?\.opening\?\.lockPlacement\}/g) || []).length === 2 && /showFoe=\{!!tutorial\?\.opening\?\.stopAt\}/.test(game));
  ok("story も受けたら story として記録(チュートリアルの xp・クリア・チケットなし)", /const asLesson = !!tutorial && !story;\s*const freshTutorial =\s*asLesson && won/.test(game) && /\.\.\.\(asLesson\s*\? \{\s*xp: won \? tutorial\.xp : 0,\s*tutorial: !0,/.test(game));
  ok("結果の「門へ進む」は呼ぶ側の onGate", /onGate=\{onGate\}/.test(game) && /onClick=\{onGate\}/.test(game));
  ok("席の名前: 相手は story.title を先に・自分は名前が無ければ「あなた」", /me \|\| \(story \? "あなた" : null\),/.test(screens) && /story\s*\? story\.title\s*: tut\s*\? null/.test(screens));
}

console.log(fail ? `\n${fail} 件の失敗` : "\nはじめの一局の画面: すべて通りました");
process.exit(fail ? 1 : 0);
