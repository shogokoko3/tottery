// Reproduce the existing synthesized cues as bundled PCM, without live Web
// Audio on iOS. Chrome is needed only to regenerate these committed WAV files.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { AUXILIARY_SOUNDS } from "../src/audio/auxiliary-sounds.js";

const chrome = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-aux-audio-"));
const source = fs.readFileSync("src/ui/battlepass-magic.jsx", "utf8");
const chime = source.slice(source.indexOf("function chimeUrl("), source.indexOf("\nfunction phaseAt("));
const code = `
import { captureSoundOnBus } from "./src/audio/capture-sounds.js";
import { areaSoundSamples } from "./src/audio/area-sounds.js";
import { AUXILIARY_SOUNDS, CAPTURE_KINDS } from "./src/audio/auxiliary-sounds.js";
${chime}
function wav(samples, rate) {
 const bytes = new Uint8Array(44 + samples.length * 2), v = new DataView(bytes.buffer);
 const word = (at,s) => [...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
 word(0,'RIFF');v.setUint32(4,bytes.length-8,true);word(8,'WAVE');word(12,'fmt ');
 v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);
 v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,samples.length*2,true);
 samples.forEach((x,i)=>v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,x))*32767),true));
 return bytes;
}
async function save(key,bytes) {
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 await fetch('/save',{method:'POST',body:JSON.stringify({file:AUXILIARY_SOUNDS[key].file,data:btoa(binary)})});
}
async function run() {
 for (const kind of CAPTURE_KINDS) {
  const ctx=new OfflineAudioContext(1,44100,44100);
  const adapter=new Proxy(ctx,{get(target,key){if(key==='state')return 'running';const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  captureSoundOnBus(adapter,ctx.destination,()=>{}).play(kind);
  const rendered=await ctx.startRendering(),samples=rendered.getChannelData(0);
  let last=samples.length-1;while(last>0 && Math.abs(samples[last])<1e-6)last--;
  await save('capture:'+kind,wav(samples.slice(0,Math.min(samples.length,Math.max(3528,last+1323))),44100));
 }
 for(const type of ['birth','default'])await save('area:'+type,wav(areaSoundSamples(type,44100),44100));
 for(const reduced of [false,true]) {
  const url=chimeUrl(reduced),bytes=new Uint8Array(await (await fetch(url)).arrayBuffer());URL.revokeObjectURL(url);
  await save('battlepass:'+(reduced?'reduced':'full'),bytes);
 }
 await fetch('/done',{method:'POST'});
}
run().catch(error=>fetch('/error',{method:'POST',body:String(error.stack || error)}));
`;
const bundled = await build({ stdin: { contents: code, resolveDir: process.cwd(), sourcefile: "native-aux.js" }, bundle: true, write: false, format: "iife" });
const expected = new Set(Object.values(AUXILIARY_SOUNDS).map(x => x.file));
const saved = [];
let finish, fail, child;
const done = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
const server = http.createServer(async (request, response) => {
 try {
  if (request.url === "/") { response.end(`<script>${bundled.outputFiles[0].text}</script>`); return; }
  let body="";for await(const part of request){body+=part;if(body.length>5e6)throw Error('Payload too large');}
  if(request.url==='/save') {
   const {file,data}=JSON.parse(body);if(!expected.has(file))throw Error('Unexpected audio file');
   const bytes=Buffer.from(data,'base64');fs.writeFileSync('assets/audio/'+file,bytes);
   saved.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  response.end('OK');
  if(request.url==='/error')fail(Error(body));
  if(request.url==='/done'){if(saved.length!==expected.size)fail(Error('Incomplete audio render'));else finish();}
 }catch(error){response.statusCode=500;response.end(String(error));fail(error);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const timeout=setTimeout(()=>fail(Error('Audio render timed out')),60000);
try {
 child=spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--no-first-run',`--user-data-dir=${temp}`,`http://127.0.0.1:${server.address().port}/`],{stdio:'ignore'});
 child.once('error',fail);
 await done;
 fs.mkdirSync('reports/native-game-audio-20261028',{recursive:true});
 fs.writeFileSync('reports/native-game-audio-20261028/aux-assets.json',JSON.stringify({renderedFromExistingSynthesis:true,assets:saved},null,2)+'\n');
 console.log(`Existing synthesized cues rendered to ${saved.length} native PCM assets (${saved.reduce((n,x)=>n+x.bytes,0)} bytes)`);
}finally{clearTimeout(timeout);child?.kill();server.closeAllConnections();server.close();setTimeout(()=>fs.rmSync(temp,{recursive:true,force:true}),500);}
