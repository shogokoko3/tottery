// Actual GameCore, initialized with a local midgame position. No online match.
import fs from 'node:fs';
import { build } from 'esbuild';
const fieldFiles = Object.fromEntries(fs.readdirSync('fields').filter(f=>f.endsWith('.png')).map(f=>[f.split('.')[0],f]));
const result = await build({
  bundle:true, write:false, format:'esm', jsx:'automatic',
  loader:{'.css':'text','.webp':'dataurl','.png':'dataurl'},
  define:{__AUDIO_FILES__:'{}',__STORY_COMIC_FILES__:'{}',__FIELD_FILES__:JSON.stringify(fieldFiles)},
  plugins:[{name:'local-game-preview',setup(b){
    b.onLoad({filter:/src\/net\/auth\.js$/},()=>({loader:'js',contents:`export const API_KEY='',OPERATOR_UID='operator'; export async function ensureAuth(){return {uid:'preview',idToken:'preview'}};export function myUid(){return 'preview'};export function isVerified(){return false};export async function linkAppleIdentity(){return {ok:false}};export function useOperatorSlot(){};export async function authedFetch(){throw Error('local preview: network disabled')}`}));
    b.onLoad({filter:/src\/net\/ranking\.js$/},()=>({loader:'js',contents:`export async function readRanks(){return {ok:true,list:[]}};export async function readWorldGames(){return 0};export async function publishRank(){};export async function deleteRank(){}`}));
    b.onLoad({filter:/src\/net\/players\.js$/},()=>({loader:'js',contents:`export async function publishPlayer(){};export async function registerPlayer(){return {profile:{},sync:Promise.resolve({ok:false})}};export async function dropOldRows(){};export async function syncPlayer(){return false;}`}));
    b.onLoad({filter:/src\/ui\/fields\/backdrop\.jsx$/},()=>({loader:'jsx',contents:fs.readFileSync('src/ui/fields/backdrop.jsx','utf8').replace('const files = typeof __FIELD_FILES__ === "undefined" ? {} : __FIELD_FILES__;','const files = typeof __FIELD_FILES__ === "undefined" ? {} : __FIELD_FILES__;\nconst teaDesign = new URLSearchParams(location.search).get("teaDesign");\nconst teaComparisons = {before:"../reports/alice-tea-corner-fix/before.png",edge:"../reports/alice-tea-center-party/edge-party.png",oval:"../reports/alice-tea-square-party/oval-party.png"};\nif(teaComparisons[teaDesign])files["alice-tea"]=teaComparisons[teaDesign];')}));
    b.onLoad({filter:/src\/ui\/game\.jsx$/},()=>{
      let contents = fs.readFileSync('src/ui/game.jsx','utf8');
      if(!contents.includes('(0, useState)(initialState)'))throw Error('GameCore initializer changed');
      contents = 'import {AliceAreaPreviewToolbar} from "../../tools/alice-area-preview-toolbar.jsx";\nimport {aliceAreaGameFixture} from "../../tools/alice-area-game-fixture.mjs";\n'+contents.replace('(0, useState)(initialState)','(0, useState)(() => aliceAreaGameFixture(new URLSearchParams(location.search).get("area"), {corners:new URLSearchParams(location.search).get("corners")==="1"}))');
      contents = contents.replace('<div className={`play-wrap${Pl ? " has-shuffle-bar" : ""}`}>', '<div className={`play-wrap${Pl ? " has-shuffle-bar" : ""}`}><AliceAreaPreviewToolbar/>');
      return {loader:'jsx',contents};
    });
  }}],
  stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
    import React from 'react';import{createRoot}from'react-dom/client';
    import{GameCore}from'./src/ui/game.jsx';import{SeatsProvider}from'./src/ui/names.jsx';
    import{previewLoadout}from'./tools/alice-area-game-fixture.mjs';
    const active=new URLSearchParams(location.search).get('area')||'alice-tea';
    function App(){return <SeatsProvider value={{names:['あなた','相手'],skins:[previewLoadout(active),{}],backs:[null,null],frames:[null,null]}}><GameCore boardSize={9} onExit={()=>location.reload()}/></SeatsProvider>};
    createRoot(document.getElementById('root')).render(<App/>);
  `},
});
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>アリスのエリア — 対局プレビュー</title><style>body{margin:0;background:#081120;color:#eee}.preview-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;background:#10203a;border:1px solid #a98a4544;border-radius:8px;font:12px system-ui}.preview-toolbar select,.preview-toolbar button{color:#eee;background:#1b3050;border:1px solid #a98a45;border-radius:6px;padding:7px}.preview-toolbar span{color:#bec8d5}.preview-toolbar{margin-bottom:8px;grid-column:2}@media(orientation:landscape) and (min-width:900px){.play-wrap>.board-outer{grid-row:1 / span 9}}</style></head><body><div id="root"></div><script type="module">${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
fs.writeFileSync('alice-area-game-preview.html',html);
console.log('alice-area-game-preview.html ready');
