// ハートの J・Q・K で撃破した駒を仲間にする置き場は、K の予備札と同じ画面(ReservePlacer)・同じ決まり(自陣の空きマス)
// (2026-10-15 本人の指示)。描けること・置けるマスが自陣の空きだけなこと・K の画面が変わらないことを確かめる
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-recruit-"));
const outfile = path.join(dir, "view.cjs");
await build({
  stdin: { resolveDir: process.cwd(), loader: "jsx", contents: `
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {ReservePlacer} from './src/ui/setup.jsx';import {SeatsProvider} from './src/ui/names.jsx';import {AliceControls} from './src/ui/alice-controls.jsx';
import {initialState} from './src/game/reducer.js';import {emptyBoard} from './src/game/board.js';
import {ALICE_SKINS} from './src/skins/alice.js';import {syncAlice} from './src/game/alice-rules.js';
const loadout=Object.fromEntries(ALICE_SKINS.map(s=>[s.rank,s.id+':foil']));
export function game(rank='Q'){
  let s={...initialState(),ruleVersion:19,phase:'play',boardSize:9,board:emptyBoard(9),currentTurn:0,turnNo:0,areaLoadouts:[loadout,{}],areasEnabled:true,log:[],setupEffects:null,clocks:[300000,300000]};
  const ps=[['k',rank,0,6,4,true],['p','2',0,6,3,false],['q','3',0,7,2,false],['a','A',0,8,4,false],['ek','K',1,0,4,true],['ep','2',1,2,3,false],['ea','A',1,0,0,false]];
  for(const [id,rank,owner,row,col,isKing] of ps){const p={id,rank,owner,row,col,isKing,alive:true,revealed:false,suit:'heart',history:[]};s.pieces[id]=p;s.board[row][col]=p;}
  s.players=s.players.map((p,i)=>({...p,kingId:i?'ek':'k',armyRankCounts:{2:2,3:1,4:1,5:1,6:1,7:1,8:1,9:1,10:1,A:1,J:1,Q:1,K:1}}));
  return syncAlice(s);
}
const seats={names:["あなた","相手"],icons:[null,null],titles:[null,null],skins:[{},{}]};
export const render=(state,card)=>renderToStaticMarkup(<SeatsProvider value={seats}><ReservePlacer state={state} dispatch={()=>{}} size={9}
  placement={{owner:0,cards:[card]}} title="撃破した駒を仲間にする" hint="撃破した 2♥ を仲間にできます。自陣の空きマスをタップして置き場所を決めます。" skipLabel="仲間にしない" addsCount={false} onPlace={()=>{}} onSkip={()=>{}} /></SeatsProvider>);
export const renderWait=(state,card)=>renderToStaticMarkup(<SeatsProvider value={seats}><AliceControls state={{...state,aliceRecruit:[{owner:0,card,rank:'Q'}]}} viewer={1} myTurn={false} dispatch={()=>{}} /></SeatsProvider>);
export const renderBars=(state)=>renderToStaticMarkup(<SeatsProvider value={seats}><AliceControls state={state} viewer={0} myTurn={true} dispatch={()=>{}} /></SeatsProvider>);
export const renderK=(state)=>renderToStaticMarkup(<SeatsProvider value={seats}><ReservePlacer state={{...state,kPlacement:{owner:0,cards:[{id:'x',rank:'5',suit:'spade'}]}}} dispatch={()=>{}} size={9} /></SeatsProvider>);
`},
  bundle: true, platform: "node", format: "cjs", jsx: "automatic", outfile, logLevel: "silent",
  define: { __FIELD_FILES__: "{}", __BUILD_VERSION__: '"check"' },
  loader: { ".css": "text", ".png": "dataurl", ".jpg": "dataurl", ".webp": "dataurl", ".mp4": "dataurl", ".mp3": "dataurl", ".svg": "dataurl" },
});
const noop = () => {};
Object.assign(globalThis, {
  sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop }, addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true,
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
  requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout, innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, scrollTo: noop,
  location: { protocol: "http:", hostname: "localhost", host: "localhost", href: "http://localhost/", search: "", origin: "http://localhost", pathname: "/" },
  document: { addEventListener: noop, removeEventListener: noop, visibilityState: "visible", hidden: false,
    body: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop },
    documentElement: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, setAttribute: noop, getAttribute: () => null },
    createElement: () => ({ style: {}, setAttribute: noop, getAttribute: () => null, appendChild: noop, remove: noop, getContext: () => null, classList: { add: noop, remove: noop } }),
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, head: { appendChild: noop }, fonts: { ready: Promise.resolve(), load: () => Promise.resolve() } },
});
if (typeof globalThis.Image === "undefined") globalThis.Image = class { set src(_) {} };
if (typeof globalThis.Audio === "undefined") globalThis.Audio = class { play() {} pause() {} };
const R = createRequire(import.meta.url)(outfile);
fs.rmSync(dir, { recursive: true, force: true });
const s = R.game('Q');
const html = R.render(s, { ...s.pieces.ep, alive: false });
assert.ok(html.includes("撃破した駒を仲間にする"), "見出し");
assert.ok(html.includes("仲間にしない"), "見送る釦");
assert.ok(html.includes("自陣の空きマスをタップ"), "説明");
const open = (html.match(/mini-cell-open/g) || []).length;
// 自陣(6〜8行)の 27 マスから自分の駒 4 個を引いた 23 マスが置ける
assert.equal(open, 23, `置けるマスは自陣の空きだけ: ${open}`);
assert.ok(!html.includes("予備札を配置"), "予備札の見出しは出ない");
const k = R.renderK(s);
assert.ok(k.includes("予備札を配置") && k.includes("今回は見送る") && k.includes("Kの効果で引いた1枚"), "Kの予備札の画面はそのまま");
// 取られた側は、相手が決めているあいだ「相手の選択を待っています」の帯で待つ(2026-10-16 本人の指示)
const wait = R.renderWait(s, { ...s.pieces.ep, alive: false });
assert.ok(wait.includes("相手の選択を待っています") && wait.includes("alice-wait-bar"), "取られた側に待つ帯");
assert.ok(!wait.includes("配置する"), "取られた側に置く釦は出ない");
// 王の力の小窓は廃止し、帯で出す(2026-10-16 本人の指示)
const bars = R.renderBars(R.game('4'));
assert.ok(bars.includes("王の力 全軍バリア") && bars.includes("発動") && bars.includes("alice-king-bar"), "王の力は帯で出る");
assert.ok(!bars.includes("王の力・特殊能力"), "小窓の釦は出ない");
console.log(`仲間にする置き場の画面: 描ける。置けるマス ${open}(自陣の空きだけ)。Kの予備札の画面も変わらず、取られた側は待つ帯、王の力は帯 OK`);
