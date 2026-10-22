// Compile and display the production WebGL scenes, then exercise the actual
// touch-to-open reveal. The preview never purchases or changes ownership.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import {spawn} from "node:child_process";
import assert from "node:assert/strict";
const root=path.resolve(process.argv[2]||"/private/tmp/tottery-wonderland-gates-v1");
const report=path.resolve("reports/wonderland-gates-v1");
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"wonderland-chrome-"));
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript",".webp":"image/webp",".png":"image/png"};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost"),file=path.resolve(root,"."+decodeURIComponent(url.pathname==='/'?'/wonderland.html':url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const base=`http://127.0.0.1:${server.address().port}`;
const port=await new Promise(r=>{const s=net.createServer();s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>r(p));});});
const chrome=spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",["--headless=new",`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,"--no-first-run","--no-default-browser-check","--use-angle=swiftshader","--enable-unsafe-swiftshader","about:blank"],{stdio:"ignore"});
let ws;
const clean=()=>{ws?.close();chrome.kill("SIGKILL");server.close();fs.rmSync(profile,{recursive:true,force:true});};
const guard=setTimeout(()=>{clean();process.exit(2)},240000);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let target;
  for(let i=0;i<75&&!target;i++){try{target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!target)await delay(200);}
  assert.ok(target,"Chrome started");ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
  let id=0,loaded;const pending=new Map(),errors=[];
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(new Error(JSON.stringify(m.error))):p?.resolve(m.result);}else if(m.method==='Page.loadEventFired'){loaded?.();loaded=null;}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const seq=++id;pending.set(seq,{resolve,reject});ws.send(JSON.stringify({id:seq,method,params}));});
  const js=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const wait=async(predicate,timeout=20000)=>js(`new Promise((resolve,reject)=>{const end=Date.now()+${timeout};function tick(){if(${predicate})resolve(true);else if(Date.now()>end)reject(new Error('Timed out: '+${JSON.stringify(predicate)}));else setTimeout(tick,50)}tick()})`);
  const navigate=async url=>{const complete=new Promise(r=>{loaded=r});await send('Page.navigate',{url});await complete;assert.equal(await js('location.href'),url);};
  const readyGate=()=>wait(`document.querySelector('#play')?.disabled===false && document.querySelector('.summon-preview-loading')?.hidden===true && document.querySelector('canvas')?.style.visibility==='visible'`);
  const capture=async(file)=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(report,file),Buffer.from(r.data,'base64'));};
  const cases=[];
  for(const world of ['alice-caucus','alice-quadrille','alice-maze','alice-tea','alice-illusion','alice-croquet']){
    for(const gold of [false,true]){
      await navigate(`${base}/index.html?world=${world}&time=3000&gold=${gold?1:0}`);
      await readyGate();
      assert.equal(await js(`document.querySelector('#world').value`),world);
      for(const time of [3000,5500,7300]){
        await js(`(()=>{const s=document.querySelector('#time');s.value='${time}';s.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
        assert.equal(await js(`document.querySelector('#clock').textContent`),`${(time/1000).toFixed(2)}秒`);
        await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))`);
        await capture(`${world}-${gold?'gold':'bronze'}-${time}.png`);
      }
      cases.push({world,gold,rendered:true});console.log(`描画: ${world} ${gold?'金':'通常'} OK`);
    }
  }
  // A real one-card gacha must hold until touched, then reach its reveal.
  await navigate(`${base}/flow.html?series=alice&sample=alice&world=alice-tea&count=1`);
  await wait(`document.querySelector('.summon-gate-touch')`,25000);
  await capture('alice-tea-touch-hold.png');await delay(1500);
  assert.equal(await js(`!!document.querySelector('.summon-gate-touch')`),true,'Gate holds until touched');
  await js(`document.querySelector('.summon-gate-touch').click();true`);
  await wait(`!document.querySelector('.summon-intro')`,12000);
  await wait(`document.querySelector('.reveal-card')`);
  await capture('alice-tea-result.png');
  // The new shader and assets must also retain the Legend Gate path.
  await navigate(`${base}/index.html?world=heaven&time=7300&gold=1`);
  await readyGate();
  await capture('legend-gold-regression.png');
  assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync(path.join(report,'browser-check.json'),JSON.stringify({viewport:{width:390,height:844},cases,touchHoldVerified:true,revealVerified:true,legendGateVerified:true,consoleErrors:errors},null,2)+'\n');
  console.log('WebGL: 6門×通常/金、接近/開扉/内部、タップ待機→カード、既存門、コンソールエラーなし: OK');
}finally{clearTimeout(guard);clean();}
