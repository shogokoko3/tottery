// Exercise the actual mastery screen and persistence functions in a separate
// browser profile. The fixture never connects to an account or purchases cards.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const report = path.resolve("reports/wonderland-mastery-20261011");
fs.mkdirSync(report, { recursive: true });
const bundle = await build({
  bundle: true, write: false, jsx: "automatic", format: "iife",
  loader: { ".css": "text", ".png": "dataurl", ".webp": "dataurl" },
  define: { __AUDIO_FILES__: "{}", __STORY_COMIC_FILES__: "{}", __FIELD_FILES__: "{}" },
  stdin: { resolveDir: process.cwd(), loader: "jsx", contents: `
    import {createRoot} from 'react-dom/client';
    import {CardMasteryScreen} from './src/ui/card-mastery.jsx';
    import {recordMastery,loadProfile} from './src/game/profile.js';
    import {baseSkinId} from './src/skins/catalog.js';
    import css from './src/styles.css';
    import skins from './src/skins/styles.css';
    import frames from './src/ui/title-frame.css';
    document.head.append(Object.assign(document.createElement('style'),{textContent:css+skins+frames}));
    window.masteryFixture={loadProfile,record:(skin,tally)=>recordMastery({[baseSkinId(skin)]:tally})};
    createRoot(document.getElementById('root')).render(<main className="tottery-root"><CardMasteryScreen onBack={()=>{}}/></main>);
  ` },
});
const bootstrap = `
  const memory=new Map();
  Object.defineProperty(window,'localStorage',{value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}});
  const q=new URLSearchParams(location.search);
  const owned=q.has('empty')?{}:{...(q.has('aliceOnly')?{}:{'elf-male':1}),'alice-A-alice':1,'alice-4-hatter:foil':1,'alice-10-cheshire-cat':1,'alice-10-cheshire-cat:foil':1};
  localStorage.setItem('tottery.skins.v1',JSON.stringify({owned,motion:'off'}));
  localStorage.setItem('tottery.account.v1',JSON.stringify({mastery:{'elf-male':12,'alice-A-alice':5,'alice-4-hatter':79,'alice-10-cheshire-cat':31}}));
  window.fetch=async()=>new Response('{}',{headers:{'Content-Type':'application/json'}});
`;
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>シリーズ別の熟練度</title><body style="margin:0;background:#081120"><div id="root"></div><script>${bootstrap}</script><script>${bundle.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
fs.writeFileSync(path.join(report, "preview.html"), html);
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
const guard = setTimeout(() => { cleanup(); process.exit(2); }, 120000);
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
  const navigate=async url=>{const complete=new Promise(r=>{loaded=r;});await send('Page.navigate',{url});await complete;await wait(`document.querySelector('.card-mastery-pick-list')`);};
  const screenshot=async name=>{await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))`);const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(report,name),Buffer.from(s.data,'base64'));};
  const count=()=>js(`document.querySelectorAll('.card-mastery-row').length`);
  const summary=()=>js(`document.querySelector('.card-mastery-summary').textContent.replace(/\\s+/g,' ')`);
  // シリーズ選択の画面で選ぶ(一覧を出していれば右上の「シリーズ選択へ」で戻ってから。2026-10-16 本人の指示の流れ)
  const select=async index=>{if(await js(`!!document.querySelector('.card-mastery-back')`)){await js(`document.querySelector('.card-mastery-back').click()`);await wait(`document.querySelector('.card-mastery-pick-list')`);}await js(`document.querySelectorAll('.card-mastery-pick .gacha-pick-go')[${index}].click()`);await wait(`document.querySelector('.card-mastery-list')`);};
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await navigate(base+'/');
  assert.equal(await js(`document.querySelectorAll('.card-mastery-pick').length`),2);
  await select(0); assert.equal(await count(),17); assert.match(await summary(),/合計 12点/);
  await screenshot('legend-mobile.png');
  await select(1); assert.equal(await count(),13); assert.match(await summary(),/解放したスキン 3\/13/); assert.match(await summary(),/合計 115点/);
  assert.deepEqual(await js(`[...document.querySelectorAll('.card-mastery-rank')].map(e=>e.textContent)`),['A','2','3','4','5','6','7','8','9','10','J','Q','K']);
  assert.equal(await js(`document.querySelector('.card-mastery-all').textContent.includes('十七英雄の主')`),false);
  await wait(`[...document.images].every(i=>i.complete&&i.naturalWidth>0)`);
  assert.equal(await js(`document.documentElement.scrollWidth<=innerWidth`),true);
  await screenshot('wonderland-mobile.png');
  await js(`window.masteryFixture.record('alice-4-hatter:foil',{pieces:1})`);
  await wait(`document.querySelector('.card-mastery-list').textContent.includes('永遠の茶会の主')`);
  await js(`window.masteryFixture.record('alice-10-cheshire-cat',{king:true,pieces:2,moves:2,captures:1})`);
  await js(`window.masteryFixture.record('alice-10-cheshire-cat:foil',{moves:1})`);
  await wait(`document.querySelector('.card-mastery-summary').textContent.includes('127')`);
  assert.equal(await js(`window.masteryFixture.loadProfile().mastery['alice-10-cheshire-cat']`),42);
  assert.equal(await js(`window.masteryFixture.loadProfile().mastery['alice-10-cheshire-cat:foil']`),undefined);
  await select(0); assert.equal(await count(),17); assert.match(await summary(),/合計 12点/);
  await navigate(base+'/?aliceOnly=1'); await select(1); assert.equal(await count(),13);
  assert.equal(await js(`document.querySelector('.card-mastery-series-name').textContent`),'ワンダーランド');
  await navigate(base+'/?empty=1'); await select(1); assert.equal(await count(),13);
  assert.equal(await js(`document.querySelectorAll('.card-mastery-row.is-locked').length`),13);
  assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync(path.join(report,'browser-check.json'),JSON.stringify({viewport:{width:390,height:844},seriesRows:{heroes:17,alice:13},seriesTotalsVerified:true,foilSharedMasteryVerified:true,titleUnlockVerified:true,aliceOnlyDefaultVerified:true,emptyLocksVerified:true,horizontalOverflow:false,consoleErrors:errors,verifiedAt:new Date().toISOString()},null,2)+'\n');
  console.log('シリーズ別の13/17行・所持数・合計点・通常/フォイルの共通加算・称号・ワンダーランドのみ所持・未所持・スマホ表示: OK');
} finally { clearTimeout(guard); cleanup(); }
