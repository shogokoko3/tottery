import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {build} from 'esbuild';
import {TRACKS,trackForScene,isEndgame,audioUrl} from '../src/audio/tracks.js';
import {SOUNDS,importantCueGain} from '../src/audio/sounds.js';

assert.equal(trackForScene({screen:'cards'}),'collection');
assert.equal(trackForScene({screen:'shop'}),'shop');
assert.equal(trackForScene({screen:'tsume'}),'puzzle');
assert.equal(trackForScene({screen:'story'}),'story');
assert.equal(trackForScene({screen:'game',phase:'play',tutorial:true,endgame:true}),'tutorial');
for(const result of ['win','lose','draw']) {
 assert.equal(trackForScene({screen:'game',phase:'gameover',result}),result);
 assert.equal(TRACKS[result].loop,true,'結果画面は無音にならない');
}
const pieces=Object.fromEntries(Array.from({length:10},(_,i)=>[i,{alive:true,isKing:i===0}]));
assert.equal(isEndgame({pieces,clocksHidden:true},[1000,2000]),false,'非公開時計でBGMを変えない');
assert.equal(isEndgame({pieces,clocksHidden:false},[1000,2000]),true);
for(const x of [...Object.values(TRACKS),...Object.values(SOUNDS)]) {
 assert.ok(!/https?:|blob:/.test(audioUrl(x.file)),'アプリ同梱相対URL');
 assert.ok(fs.existsSync(`assets/audio/${x.file}`),x.file);
}
const windowListeners={},contexts=[];
const listeners={},media=[],requested=[],sources=[],gains=[],filters=[];
const timers=new Map();let time=0,serial=0;
const later=(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:time+ms});return id;};
const advance=ms=>{time+=ms;for(const [id,t] of [...timers])if(t.at<=time){timers.delete(id);t.fn();}};
const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
const quiet=Float32Array.from({length:4410},(_,i)=>.005*Math.sin(i*.07));
const correction=importantCueGain({length:quiet.length,sampleRate:44100,numberOfChannels:1,getChannelData:()=>quiet});
assert.equal(correction,12,'静かな重要音は補正上限まで引き上げる');
const loud=Float32Array.from([.9,-.9]);
assert.ok(importantCueGain({length:2,sampleRate:44100,numberOfChannels:1,getChannelData:()=>loud})*.9<=.400001,'ピーク上限を超えない');
let runningFetch=0,maxFetch=0;
const document={hidden:false,addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){}};
class Audio {constructor(url){this.url=url;this.paused=true;this.volume=0;media.push(this);}setAttribute(){}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
const gain=()=>({gain:{value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}},connect(){return this;},disconnect(){}});
class AudioContext {
 state='running';currentTime=0;destination={};
 constructor(){contexts.push(this);this.events={};}
 addEventListener(name,fn){this.events[name]=fn;}
 createGain(){const g=gain();gains.push(g);return g;}
 createBiquadFilter(){const f={...gain(),frequency:{value:0},Q:{value:0}};filters.push(f);return f;}
 createMediaElementSource(){return gain();}
 createBuffer(){return {};}
 createBufferSource(){const n={...gain(),playbackRate:{value:1},start(){},stop(){this.stopped=true;this.onended?.();}};sources.push(n);return n;}
 decodeAudioData(){return Promise.resolve({duration:1});}
 suspend(){this.state='suspended';return Promise.resolve();}
 resume(){this.state='running';return Promise.resolve();}
}
const bundle=await build({entryPoints:['src/audio/player.js'],bundle:true,write:false,format:'iife',globalName:'Player',plugins:[{name:'isolate-profile',setup(b){b.onLoad({filter:/src\/game\/profile\.js$/},()=>({contents:'export const isTestPlay=()=>false;'}));}}]});
const sandbox={window:{AudioContext,addEventListener:(name,fn)=>windowListeners[name]=fn},document,Audio,setTimeout:later,clearTimeout:id=>timers.delete(id),console,fetch:async url=>{requested.push(url);const se=url.includes("se-");if(se){runningFetch++;maxFetch=Math.max(maxFetch,runningFetch);}await Promise.resolve();if(se)runningFetch--;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}};
vm.runInNewContext(bundle.outputFiles[0].text,sandbox);
const p=sandbox.Player;
p.armAudioUnlock();p.playTrack('title');p.unlockAudio();
for(let i=0;i<300;i++)await Promise.resolve();
assert.ok(requested.length>=Object.keys(SOUNDS).length);
assert.ok(maxFetch<=4,'効果音の読込は最大4件');
assert.equal(p.currentTrack(),'title');
assert.equal(filters.length,2,'SEに高音抑制を設ける');
assert.equal(filters[0].type,'highshelf');assert.equal(filters[0].gain.value,-6);
assert.equal(filters[1].frequency.value,3200);assert.equal(filters[1].Q.value,.5,'鋭い共鳴を作らない');
const initial=sources.length;
p.playSound('tap');assert.equal(sources.length,initial+1);
p.playSound('tap');assert.equal(sources.length,initial+1,'連打を間引く');
p.setMuted(true);assert.equal(sources.at(-1).stopped,true,'消音時にSEを止める');
p.playSound('capture');assert.equal(sources.length,initial+1,'消音中は再生しない');
p.setMuted(false);await Promise.resolve();await Promise.resolve();
p.playSound('capture');const count=sources.length;
document.hidden=true;listeners.visibilitychange();
assert.ok(media.every(x=>x.paused),'背景でBGMを止める');
p.playSound('win');assert.equal(sources.length,count,'背景でSEを鳴らさない');
document.hidden=false;listeners.visibilitychange();
for(let i=0;i<100;i++)await Promise.resolve();
assert.equal(p.currentTrack(),'title','アプリ復帰で現在の曲を再開');
// Saturated ordinary voices cannot swallow a time warning.
for(const id of ['earth','sea','forest','ice','thaw','sky','palace','hell'])p.playSound(id);
const beforeWarning=sources.length;
p.playSound('time10');
assert.equal(sources.length,beforeWarning+1,'8音再生中でも時間警告を優先');
const beforeTap=sources.length;p.playSound('back');
assert.equal(sources.length,beforeTap,'重要音の直後は汎用操作音を重ねない');
p.playResultTrack('win');
assert.equal(p.currentTrack(),null,'決着音の間は結果BGMを始めない');
assert.ok(sources.slice(-9,-1).some(x=>x.stopped),'決着音は先行SEを整理する');
advance(1179);await flush();assert.equal(p.currentTrack(),null);
advance(1);await flush();assert.equal(p.currentTrack(),'win','決着音終了＋余韻後に結果曲');
const result=media.find(x=>x.url.endsWith('/resultWin.m4a'));
result.currentTime=42;
p.playTrack('title');await flush();p.playTrack('win');await flush();
assert.equal(result.currentTime,0,'結果曲は再訪しても冒頭から');
p.playResultTrack('lose');p.playTrack('title');await flush();advance(2000);await flush();
assert.equal(p.currentTrack(),'title','画面を離れたら遅延結果曲を取り消す');
// Simulate iOS interruption without visibilitychange.
p.playTrack('battle');await flush();
const context=contexts[0],battle=media.find(x=>x.url.endsWith('/battle.m4a'));
battle.currentTime=24;
context.state='interrupted';context.events.statechange();
windowListeners['tottery-audio-state']({status:'interrupted'});
assert.equal(p.currentTrack(),null);assert.equal(battle.paused,true);
listeners.pointerdown();await flush();
assert.equal(context.state,'interrupted','通話中にタップしても復帰しない');
windowListeners['tottery-audio-state']({status:'ended'});await flush();
assert.equal(context.state,'running');assert.equal(p.currentTrack(),'battle');
assert.equal(battle.currentTime,24,'中断前の位置を維持');
// OS may decline automatic resumption; allow next explicit user action.
windowListeners['tottery-audio-state']({status:'interrupted'});
context.state='suspended';
windowListeners['tottery-audio-state']({status:'manual'});
windowListeners.focus();await flush();assert.equal(p.currentTrack(),null);
listeners.pointerdown();await flush();assert.equal(p.currentTrack(),'battle');
// Focus recovers a paused media element even if AudioContext already runs.
battle.pause();windowListeners.focus();await flush();assert.equal(battle.paused,false);
windowListeners['tottery-audio-state']({status:'inactive'});
windowListeners['tottery-audio-state']({status:'ended'});await flush();
assert.equal(p.currentTrack(),null,'ネイティブ非アクティブ中は再開しない');
windowListeners['tottery-audio-state']({status:'active'});await flush();
assert.equal(p.currentTrack(),'battle');
// Native inactive, page hidden and context interrupted can all report the
// same pause. Result music must retain its position despite restart-on-entry.
p.playTrack('win');await flush();result.currentTime=37.25;
windowListeners['tottery-audio-state']({status:'inactive'});
document.hidden=true;listeners.visibilitychange();
context.state='interrupted';context.events.statechange();
windowListeners['tottery-audio-state']({status:'inactive'});
assert.equal(result.paused,true);
document.hidden=false;listeners.visibilitychange();await flush();
assert.equal(p.currentTrack(),null,'ネイティブの停止解除前には鳴らさない');
windowListeners['tottery-audio-state']({status:'active'});await flush();
assert.equal(p.currentTrack(),'win');
assert.equal(result.currentTime,37.25,'停止通知が重なっても結果BGMを途中から再開');
// A scene change during suspension should still start the next result anew.
windowListeners['tottery-audio-state']({status:'inactive'});
p.playTrack('title');
windowListeners['tottery-audio-state']({status:'active'});await flush();
p.playTrack('win');await flush();
assert.equal(result.currentTime,0,'別の画面へ移った後の結果BGMは通常どおり冒頭から');
// A rejected automatic resume must remain retryable on the next gesture.
const resume=context.resume.bind(context);
context.state='suspended';context.resume=()=>Promise.reject(new Error('gesture required'));
windowListeners.focus();await flush();
assert.equal(context.state,'suspended');
context.resume=resume;listeners.pointerdown();await flush();assert.equal(context.state,'running');
p.setMuted(true);context.state='suspended';windowListeners.focus();await flush();
assert.equal(context.state,'suspended','消音設定を復帰で上書きしない');
p.stopMusic();
console.log('アプリ内音声: 同梱素材・画面選曲・隠し時計・結果ループ・読込制限・連打・消音・背景停止/復帰 OK');
