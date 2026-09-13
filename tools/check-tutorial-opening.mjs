/**
 * 第1話「盤が並んだところから始めて、動きで王を見抜き、討つ」の検査。
 *   1. openingState が対局開始まで進め、あなたの王 4♠ が c1、5♠ が c2 に居る
 *   2. 5♠ で取る → 相手の王 2♦ が c5→c2 へ3マス動く(王でなければ届かない) → 4♠ で討って勝ち
 *   3. 勝利画面(GameView)に相手の王の正体「2♦」と「相手の王を討て。」が出る
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
import { TUTORIALS, openingState, foeAction, currentStepIndex } from "../src/game/tutorial.js";

const ep1 = TUTORIALS[0];
assert.equal(ep1.id, 1);
assert.ok(ep1.opening, "第1話は盤が並んだところから始める");
let s = openingState(ep1, GAME_RULE_VERSION);
assert.equal(s.phase, "play");
assert.equal(s.currentTurn, 0, "あなたが先手");
const at = (id) => [s.pieces[id].row, s.pieces[id].col];
assert.deepEqual(at("t2"), [4, 2], "4♠ は c1");
assert.deepEqual(at("t3"), [3, 2], "5♠ は c2");
assert.equal(s.players[0].kingId, "t2", "王は 4♠");
assert.equal(s.players[1].kingId, "t6", "相手の王は 2♦");
assert.equal(currentStepIndex(ep1, s, 0), 0, "案内は最初の一手から");
assert.equal(ep1.steps.filter((x) => x.need).length, 2, "必須の操作は2つだけ");

const legal = (st, owner, p) =>
  getLegalMoves(p, st.board, st.boardSize, st.players[owner].armyRankCounts, kingRankOf(st, owner));
const move = (st, id, row, col) => {
  const p = st.pieces[id];
  const hit = legal(st, p.owner, p).find((m) => m.row === row && m.col === col);
  assert.ok(hit, `${id} が (${row},${col}) へ動ける`);
  return reducer(st, { type: "MOVE_PIECE", pieceId: id, row, col, captures: hit.captures });
};
const flow = (st) => {
  for (let g = 0; g < 10; g++) {
    if (st.captureReveal) st = reducer(st, { type: "DISMISS_CAPTURE" });
    else if (st.interstitial) st = reducer(st, { type: "DISMISS_INTERSTITIAL" });
    else break;
  }
  return st;
};
// 1手目: 5♠ で a4 の駒を取る
s = flow(move(s, "t3", 1, 0));
assert.equal(s.pieces.t9.alive, false, "5♦ を取った");
// 相手: 王が c5 → c2 へ3マス。王でなければ届かない
assert.equal(s.currentTurn, 1);
const king = s.pieces.t6;
const kingReach = legal(s, 1, king).some((m) => m.row === 3 && m.col === 2);
const plainReach = legal(s, 1, { ...king, isKing: false }).some((m) => m.row === 3 && m.col === 2);
assert.equal(kingReach, true, "王の 2♦ は3マス動ける");
assert.equal(plainReach, false, "王でない 2 は3マス動けない(「3マスは王だけ」が成り立つ)");
const foe = foeAction(s, ep1, 0, (p) => legal(s, 1, p));
assert.deepEqual([foe.type, foe.pieceId, foe.row, foe.col], ["MOVE_PIECE", "t6", 3, 2]);
s = flow(reducer(s, foe));
assert.deepEqual(at("t6"), [3, 2], "相手の王が c2 に来た");
// 案内: 王の駒を光らせる説明 → 討つ手
const idx = currentStepIndex(ep1, s, 1);
assert.ok(ep1.steps[idx].focus.pieces.includes("t6"), "説明は相手の王を光らせる");
// 2手目: 4♠ で王を討つ
s = flow(move(s, "t2", 3, 2));
assert.equal(s.phase, "gameover");
assert.equal(s.winner, 0, "あなたの勝ち");
assert.equal(s.pieces.t6.alive, false);

// 勝利画面
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-ep1-"));
try {
  const outfile = path.join(dir, "view.cjs");
  await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "jsx",
      contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {GameView} from './src/ui/game.jsx';import {SeatsProvider} from './src/ui/names.jsx';
export const render=(state, tutorial)=>renderToStaticMarkup(<SeatsProvider value={{names:["しんき","CPU"],icons:[null,null],titles:[null,null],skins:[{},{}]}}><GameView state={state} size={5} viewer={0} youAre={0} dispatch={()=>{}} onExit={()=>{}} tutorial={tutorial} nextTutorial={null} onNextTutorial={null} onTutorialList={()=>{}} rating={null} rematch={null} seasonResult={{active:false}} /></SeatsProvider>);`,
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
  // 画面の部品は読み込み時にブラウザの窓を触る。描くだけなので、空の窓を置く
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
  const { render } = createRequire(import.meta.url)(outfile);
  const html = render(s, ep1);
  assert.match(html, /チュートリアルクリア/);
  assert.match(html, /相手の王は/);
  assert.match(html, /2♦/);
  assert.match(html, /相手の王を討て。/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("第1話: 盤が並んだところから2手で王を討つ・3マスは王だけ・勝利画面に正体と「相手の王を討て。」 OK");
