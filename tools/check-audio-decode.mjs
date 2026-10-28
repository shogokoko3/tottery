import assert from "node:assert/strict";
import vm from "node:vm";
import {build} from "esbuild";
import {TRACKS} from "../src/audio/tracks.js";
import { decodeAudio, prioritizeDecode } from "../src/audio/decode-queue.js";

const calls = [], pending = [];
let active = 0, maximum = 0;
const context = { decodeAudioData(raw) {
  calls.push(raw); active++; maximum=Math.max(maximum,active);
  return new Promise((resolve,reject)=>pending.push({
    resolve(value){active--;resolve(value);},
    reject(error){active--;reject(error);},
  }));
} };
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const first=decodeAudio(context,"first preload");
const preload=decodeAudio(context,"waiting preload");
const cue=decodeAudio(context,"requested SE",1);
const music=decodeAudio(context,"requested BGM",2);
await flush();
assert.deepEqual(calls,["first preload"]);
pending.shift().resolve("first buffer");assert.equal(await first,"first buffer");await flush();
assert.deepEqual(calls,["first preload","requested BGM"]);
pending.shift().resolve("music buffer");assert.equal(await music,"music buffer");await flush();
assert.equal(calls.at(-1),"requested SE");
pending.shift().resolve("SE buffer");await cue;await flush();
assert.equal(calls.at(-1),"waiting preload");
pending.shift().resolve("preload buffer");await preload;await flush();
assert.equal(maximum,1,"BGMとSEを同時にデコードしない");

const broken=decodeAudio(context,"broken");
const observed=assert.rejects(broken,/bad audio/);
const after=decodeAudio(context,"after error");await flush();
pending.shift().reject(new Error("bad audio"));await observed;await flush();
assert.equal(calls.at(-1),"after error","失敗しても次の音源を読み込む");
pending.shift().resolve("recovered");assert.equal(await after,"recovered");await flush();

const syncFailure=decodeAudio({decodeAudioData(){throw new Error("sync failure");}},new ArrayBuffer(0));
await assert.rejects(syncFailure,/sync failure/);

// Slow music loading must not swallow a cue because of the 180 ms retry limit.
const longMusic=decodeAudio(context,"long music",2);await flush();
const queuedCue=decodeAudio(context,"preloading cue",0,"cue-file");
const background=decodeAudio(context,"background preload");
prioritizeDecode(context,"cue-file",3);await flush();
assert.equal(calls.at(-1),"preloading cue","操作したSEはBGMのデコード完了を待たない");
assert.equal(active,2,"待機中のBGMに対して緊急SE一本だけを許可");
const firstUrgent=pending.splice(1,1)[0];firstUrgent.resolve("cue ready");await queuedCue;await flush();
assert.equal(active,1,"先読みSEはBGMと並列に戻さない");
pending.shift().resolve("music ready");await longMusic;await flush();
pending.shift().resolve("background ready");await background;await flush();
assert.equal(maximum,2,"緊急SEを含めても同時デコードは二本まで");

// Exercise the production loader too: four speculative reads waiting for a
// long BGM decode must not occupy all file-read slots and swallow a new SE.
let finishMusic;
const sounded=[],requested=[];
const graph=()=>({gain:{value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}},connect(){return this;},disconnect(){}});
class Audio {paused=true;currentTime=0;constructor(){}setAttribute(){}addEventListener(){}pause(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}}
class AudioContext {
 state="running";currentTime=0;destination={};
 createGain(){return graph();}createMediaElementSource(){return graph();}createBuffer(){return {};}
 createBufferSource(){return {...graph(),playbackRate:{value:1},start(){sounded.push(this.buffer?.tag);},stop(){}};}
 decodeAudioData(raw){
  if(raw.url.endsWith('/title.m4a'))return new Promise(resolve=>{finishMusic=()=>resolve({tag:raw.url,duration:TRACKS.title.loopEnd+1});});
  return Promise.resolve({tag:raw.url,duration:1});
 }
}
const bundle=await build({entryPoints:['src/audio/player.js'],bundle:true,write:false,format:'iife',globalName:'Player',plugins:[{name:'isolate-profile',setup(b){b.onLoad({filter:/src\/game\/profile\.js$/},()=>({contents:'export const isTestPlay=()=>false;'}));}}]});
const sandbox={window:{AudioContext},Audio,fetch:async url=>{requested.push(url);return {ok:true,arrayBuffer:async()=>({url})};},setTimeout:()=>1,clearTimeout(){},console};
vm.runInNewContext(bundle.outputFiles[0].text,sandbox);
sandbox.Player.playTrack('title');sandbox.Player.unlockAudio();await flush();await flush();
assert.ok(finishMusic,'実際のBGMローダーがデコード待ちになる');
sandbox.Player.playSound('earth');await flush();await flush();await flush();
assert.ok(requested.includes('audio/se-earth.m4a'),'待機中の先読みが新しいSEの読み込みを塞がない');
assert.ok(sounded.includes('audio/se-earth.m4a'),'BGMのデコード完了前でも要求したSEを鳴らす');
finishMusic();await flush();await flush();
sandbox.Player.setMuted(true);sandbox.Player.stopMusic();
console.log("Audio decode: bounded concurrency, priority, urgent SE during music, failure recovery PASS");
