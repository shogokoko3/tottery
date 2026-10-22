// Actual GameCore with an isolated, midgame fixture. All clicks run its real dispatch/reducer.
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const report=path.resolve(process.env.RELEASE_REPORT||'reports/wonderland-area-controls-20261011');
fs.mkdirSync(report,{recursive:true});
const bundle=await build({bundle:true,write:false,jsx:'automatic',format:'iife',loader:{'.css':'text','.png':'dataurl','.webp':'dataurl'},define:{__AUDIO_FILES__:'{}',__STORY_COMIC_FILES__:'{}',__FIELD_FILES__:'{}'},plugins:[
 {name:'isolated-match',setup(b){
  b.onLoad({filter:/src\/net\/auth\.js$/},()=>({loader:'js',contents:`export const API_KEY='',OPERATOR_UID='operator';export async function ensureAuth(){return {uid:'preview',idToken:'preview'}};export function myUid(){return 'preview'};export function isVerified(){return false};export async function linkAppleIdentity(){return {ok:false}};export function useOperatorSlot(){};export async function authedFetch(){throw Error('local preview: network disabled')}`}));
  b.onLoad({filter:/src\/net\/ranking\.js$/},()=>({loader:'js',contents:`export async function readRanks(){return {ok:true,list:[]}};export async function readWorldGames(){return 0};export async function publishRank(){};export async function deleteRank(){}`}));
  b.onLoad({filter:/src\/net\/players\.js$/},()=>({loader:'js',contents:`export async function publishPlayer(){};export async function registerPlayer(){return {profile:{},sync:Promise.resolve({ok:false})}};export async function dropOldRows(){};export async function syncPlayer(){return false}`}));
  // Keep the opponent still while testing its turn. UI, rules and action enrichment are unchanged.
  b.onLoad({filter:/src\/game\/cpu-informed\.js$/},()=>({loader:'js',contents:`export function cpuInformedAction(){return null}`}));
  b.onLoad({filter:/src\/ui\/game\.jsx$/},args=>{
   let code=fs.readFileSync(args.path,'utf8');
   assert.ok(code.includes('(0, useState)(initialState)'));
   code='import {areaControlsFixture} from "../../tools/check-alice-area-controls-fixture.mjs";\n'+code.replace('(0, useState)(initialState)','(0, useState)(areaControlsFixture)');
   code=code.replace('  // 場面に合った曲へ。','  window.aliceTest={state:a,send:y,viewer:P};\n  // 場面に合った曲へ。');
   return {loader:'jsx',contents:code,resolveDir:path.dirname(args.path)};
  });
 }}],stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
  import {createRoot} from 'react-dom/client';
  import {GameCore} from './src/ui/game.jsx';
  import {SeatsProvider} from './src/ui/names.jsx';
  import {areaControlsFixture} from './tools/check-alice-area-controls-fixture.mjs';
  const s=areaControlsFixture();
  const cpu=new URLSearchParams(location.search).get('seat')!=='1';
  createRoot(document.getElementById('root')).render(<SeatsProvider value={{names:['あなた','相手'],skins:s.areaLoadouts,backs:[null,null],frames:[null,null]}}><GameCore boardSize={9} cpu={cpu} onExit={()=>{}}/></SeatsProvider>);
`}});
const bootstrap=`
 const memory=new Map();
 Object.defineProperty(window,'localStorage',{value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}});
 localStorage.setItem('tottery.audio.v1',JSON.stringify({muted:true}));
 localStorage.setItem('tottery.account.v1',JSON.stringify({phase:3}));
 const localFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);return url.origin===location.origin?localFetch(input,init):Promise.resolve(new Response('{}',{headers:{'Content-Type':'application/json'}}));};
`;
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ワンダーランドのエリア発動</title><body style="margin:0;background:#081120"><div id="root"></div><script>${bootstrap}</script><script>${bundle.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
fs.writeFileSync(path.join(report,'preview.html'),html);
const mime = { ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/") { res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"}); res.end(html); return; }
  const file = path.resolve("assets", "." + decodeURIComponent(url.pathname));
  if (!file.startsWith(path.resolve("assets") + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {"Content-Type":mime[path.extname(file)] || "application/octet-stream"}); fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const port = await new Promise(r => { const s=net.createServer(); s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>r(p));}); });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "mastery-series-chrome-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "about:blank"], {stdio:"ignore"});
let ws;
const cleanup = () => { ws?.close(); chrome.kill("SIGKILL"); server.close(); fs.rmSync(profile,{recursive:true,force:true}); };
const guard = setTimeout(() => { cleanup(); process.exit(2); }, 180000);
const delay = ms => new Promise(r=>setTimeout(r,ms));
try {
  let target;
  for(let i=0;i<75&&!target;i++){try{target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!target)await delay(200);}
  assert.ok(target); ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let id=0,loaded; const pending=new Map(),errors=[];
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(new Error(JSON.stringify(m.error))):p?.resolve(m.result);}else if(m.method==='Page.loadEventFired'){loaded?.();loaded=null;}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const seq=++id;pending.set(seq,{resolve,reject});ws.send(JSON.stringify({id:seq,method,params}));});
  const js=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=predicate=>js(`new Promise((resolve,reject)=>{const end=Date.now()+15000;function tick(){if(${predicate})resolve(true);else if(Date.now()>end)reject(new Error('Timed out'));else setTimeout(tick,50);}tick();})`);
  const navigate=async url=>{const complete=new Promise(r=>{loaded=r;});await send('Page.navigate',{url});await complete;await wait(`document.querySelector('.board-grid')&&window.aliceTest?.state.phase==='play'`);};
  const screenshot=async name=>{await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))`);const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(report,name),Buffer.from(s.data,'base64'));};


  await send('Page.enable');await send('Runtime.enable');
  const checked=[];
  const click=async selector=>{await js(`document.querySelector(${JSON.stringify(selector)}).click()`);await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))`);};
  const cell=async (row,col)=>{const index=await js(`window.aliceTest.viewer===1?${8-row}*9+${8-col}:${row}*9+${col}`);await js(`(()=>{const cell=[...document.querySelectorAll('.board-grid>.cell')][${index}];(cell.querySelector('.piece-slot')||cell).click()})()`);await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))`);};
  const piece=async id=>{const p=await js(`window.aliceTest.state.pieces[${JSON.stringify(id)}]`);await cell(p.row,p.col);};
  const launch=async theme=>{await navigate(base+'/?area='+theme);await wait(`!document.querySelector('.formation-honor')&&document.querySelector('.alice-area-bar')`);};
  const start=async()=>{await wait(`document.querySelector('.alice-area-bar button[aria-label$="を発動"]')&&!document.querySelector('.alice-area-bar button[aria-label$="を発動"]').disabled`);await click('.alice-area-bar button[aria-label$="を発動"]');};
  const confirm=()=>click('.alice-area-picking .btn-primary');
  const fit=async label=>{
   assert.equal(await js(`(()=>{const r=document.querySelector('.board-grid').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=-1&&r.right<=innerWidth+1;})()`),true,label+' board fits');
   assert.equal(await js(`document.documentElement.scrollWidth<=innerWidth`),true,label+' horizontal overflow');
   assert.equal(await js(`document.querySelector('.alice-area-bar').getBoundingClientRect().bottom<innerHeight`),true,label+' controls visible');
   assert.equal(await js(`scrollY`),0,label+' no scrolling');
  };
  for(const [width,height] of [[390,844],[320,568]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
   for(const theme of ['alice-caucus','alice-quadrille','alice-maze','alice-tea','alice-illusion','alice-croquet']){
    await launch(theme);await fit(theme+' '+width);
    const before=await js(`structuredClone(window.aliceTest.state)`);
    if(theme==='alice-maze'){
     assert.equal(await js(`document.querySelector('.alice-area-bar button[aria-label$="を発動"]')===null`),true);
     assert.equal(await js(`[...document.querySelectorAll('.clock-time')].every(e=>e.textContent.includes('？？？'))`),true);
     assert.equal(await js(`document.querySelector('.alice-area-bar').textContent.includes('自動')`),true);
    }else{
     if(width===390)await screenshot(theme+'-button.png');
     await start();
     if(theme==='alice-quadrille'){
      await piece('own-0');assert.equal(await js(`document.querySelector('.alice-area-instruction').textContent.includes('味方1体')`),true,'king excluded');
      await piece('own-1');await piece('foe-0');
      assert.equal(await js(`document.querySelector('.alice-area-picking .btn-primary').disabled`),false);
      await fit(theme+' picking '+width);if(width===390)await screenshot(theme+'-picking.png');await confirm();
     }else if(theme==='alice-illusion'){
      await piece('own-0');await click('.alice-area-picking .btn:last-child');
      assert.equal(await js(`window.aliceTest.state.aliceUsed?.[0]?.field`),undefined,'cancel does not spend');
      await start();await piece('own-0');await piece('own-1');await fit(theme+' picking '+width);if(width===390)await screenshot(theme+'-picking.png');await confirm();
     }else if(theme==='alice-croquet'){
      await piece('own-1');await cell(0,0);await fit(theme+' aiming '+width);
      assert.equal(await js(`document.querySelectorAll('.alice-area-aim').length`),1);
      assert.equal(await js(`document.querySelectorAll('.alice-area-landing').length`),2,'corner landing preview');
      if(width===390)await screenshot(theme+'-picking.png');await confirm();
     }
     await wait(`window.aliceTest.state.aliceUsed?.[0]?.field===8`);
     const after=await js(`structuredClone(window.aliceTest.state)`);
     assert.equal(after.currentTurn,0,'field keeps turn');
     assert.equal(await js(`document.querySelector('.alice-area-bar button[aria-label$="を発動"]').disabled`),true,'spent field disabled');
     if(theme==='alice-caucus')assert.deepEqual([after.pieces['own-0'].row,after.pieces['own-0'].col],[1,4]);
     if(theme==='alice-quadrille')assert.equal(after.pieces['foe-0'].movementRank,'2');
     if(theme==='alice-tea')assert.equal(Object.values(after.pieces).filter(p=>p.alive).length,18);
     if(theme==='alice-illusion'){assert.equal(after.pieces['own-0'].row,before.pieces['own-1'].row);assert.equal(after.pieces['own-1'].row,before.pieces['own-0'].row);}
     if(theme==='alice-croquet')assert.ok([[0,0],[1,0],[0,1]].some(([r,c])=>after.pieces['own-1'].row===r&&after.pieces['own-1'].col===c));
     await fit(theme+' after '+width);
    }
    checked.push({width,height,theme});
   }
  }
  // Targets accepted by the specification, and non-disclosure of a concealed ace's rank.
  for(const target of ['ace','cup']){
   await navigate(base+'/?area=alice-quadrille&target='+target);await start();await piece('own-1');await piece('foe-1');await confirm();
   await wait(`window.aliceTest.state.aliceUsed?.[0]?.field===8`);
   assert.equal(await js(`window.aliceTest.state.pieces['foe-1'].movementRank`),'2');
  }
  await navigate(base+'/?area=alice-tea&full=1');
  assert.equal(await js(`document.querySelector('.alice-area-bar button[aria-label$="を発動"]').disabled`),true,'18+ pieces');
  await navigate(base+'/?area=alice-croquet&far=1');
  assert.equal(await js(`document.querySelector('.alice-area-bar button[aria-label$="を発動"]').disabled`),true,'no nearby soldier');
  await navigate(base+'/?area=alice-illusion&normal=1');assert.equal(await js(`document.querySelector('.alice-area-bar')===null`),true,'normal has no field');
  await navigate(base+'/?area=alice-caucus&turn=1');assert.equal(await js(`document.querySelector('.alice-area-bar button[aria-label$="を発動"]').disabled`),true,'opponent turn');
  await navigate(base+'/?area=alice-quadrille&seat=1');await start();await piece('own-1');await piece('foe-0');await confirm();await wait(`window.aliceTest.state.aliceUsed?.[1]?.field===8`);
  // Existing manual fields retain their original controls and dispatch path.
  for(const theme of ['sea','sky','palace']){
   await navigate(base+'/?area='+theme);await wait(`document.querySelector('.area-bar .btn-primary')&&!document.querySelector('.area-bar .btn-primary').disabled`);
   await click('.area-bar .btn-primary');
   if(theme!=='sea'){await piece('own-1');await click('.area-bar-picking>.btn-primary');}
   await wait(`window.aliceTest.state.lastArea?.type===${JSON.stringify(theme)}`);
  }
  assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync(path.join(report,'browser-check.json'),JSON.stringify({checked,realGameCore:true,allFiveManualFieldsFired:true,automaticMazeVerified:true,kingAceCupTargetsVerified:true,secondPlayerVerified:true,normalAndDisabledStatesVerified:true,legacySeaSkyPalaceVerified:true,boardFitsWithoutScroll:true,consoleErrors:errors,verifiedAt:new Date().toISOString()},null,2)+'\n');
  console.log('Actual GameCore: five manual fields, automatic maze, board selection/confirmation/cancel, per-turn limit, king/A/cup targets, both players, legacy sea/sky/palace, 390/320px board fit: OK');
} finally {clearTimeout(guard);cleanup();}
