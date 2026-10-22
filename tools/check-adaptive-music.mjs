import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {build} from 'esbuild';
import {TRACKS} from '../src/audio/tracks.js';
import {MusicVoice,harmonyAt,endgameBoundary} from '../src/audio/music-voice.js';
import {TONAL_ASSETS,tonalSound} from '../src/audio/tonal-cues.js';
assert.equal(TONAL_ASSETS.length,108);
for(const tone of TONAL_ASSETS)assert.ok(fs.existsSync(`assets/audio/${tone.file}`));
for(const track of Object.values(TRACKS)) {
 assert.ok(track.loopStart>=0 && track.loopEnd-track.loopStart>=16*track.beatSeconds, '少なくとも4小節のループ本体を保持');
 if(track.playbackMode==='full-track-loop') {
  assert.equal(track.loopStart,0,'採用したフル版は先頭から繰り返す');
  assert.equal(track.loopEnd,track.duration,'採用したフル版の最後まで再生');
 } else assert.ok(track.loopStart>0,'導入つきの曲はループ本体を分ける');
 assert.ok(track.harmony.length>10);
}
let clock=100000,serial=0;
const timers=new Map(),sources=[],media=[],contexts=[],listeners={},windowListeners={};
const flush=async()=>{for(let i=0;i<200;i++)await Promise.resolve();};
const later=(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:clock+ms});return id;};
function advance(ms){clock+=ms;for(const [id,t] of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}}
const parameter=()=>({value:0,ramps:[],cancelScheduledValues(){this.ramps=[];},setValueAtTime(value,when){this.value=value;this.ramps.push({value,when});},linearRampToValueAtTime(value,when){this.ramps.push({value,when});}});
const node=()=>({gain:parameter(),connect(){return this;},disconnect(){}});
class Audio {constructor(url){Object.assign(this,{url,currentTime:0,paused:true});media.push(this);}setAttribute(){}addEventListener(){}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
class AudioContext {
 state='running';destination={};
 constructor(){contexts.push(this);this.events={};}
 get currentTime(){return clock/1000;}
 addEventListener(name,fn){this.events[name]=fn;}
 createGain(){return node();}createMediaElementSource(){return node();}
 createBiquadFilter(){return {...node(),frequency:{value:0},Q:{value:0}};}
 createBuffer(){return {};}
 createBufferSource(){const s={...node(),playbackRate:{value:1},start(when=0,offset=0){this.when=when;this.offset=offset;},stop(){this.stopped=true;this.onended?.();}};sources.push(s);return s;}
 decodeAudioData(raw){const tag=new TextDecoder().decode(raw),track=Object.values(TRACKS).find(t=>tag.endsWith('/'+t.file));return Promise.resolve({tag,duration:track?.loopEnd || 1.63});}
 suspend(){this.state='suspended';return Promise.resolve();}resume(){this.state='running';return Promise.resolve();}
}
const fetch=async url=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url).buffer});
const bundle=await build({entryPoints:['src/audio/player.js'],bundle:true,write:false,format:'iife',globalName:'Player',plugins:[{name:'profile',setup(b){b.onLoad({filter:/src\/game\/profile\.js$/},()=>({contents:'export const isTestPlay=()=>true;'}));}}]});
const window={AudioContext,addEventListener:(k,fn)=>windowListeners[k]=fn};
const document={hidden:false,addEventListener:(k,fn)=>listeners[k]=fn,removeEventListener(){}};
const env={window,document,Audio,fetch,setTimeout:later,clearTimeout:id=>timers.delete(id),TextDecoder,console,Date:class extends Date{static now(){return clock;}}};
vm.runInNewContext(bundle.outputFiles[0].text,env);
const p=env.Player;
p.armAudioUnlock();p.playTrack('battle');p.unlockAudio();await flush();
assert.equal(p.currentTrack(),'battle');
const battle=sources.find(s=>s.buffer?.tag?.endsWith('/battle.m4a'));
assert.equal(battle.loopStart,TRACKS.battle.loopStart,'導入をループ範囲から除外');
assert.equal(battle.loopEnd,TRACKS.battle.loopEnd);assert.equal(battle.offset,0,'最初は導入から');
p.playTrack('endgame');await flush();
const incoming=sources.find(s=>s.buffer?.tag?.endsWith('/endgame.m4a'));
assert.ok(incoming.when>contexts[0].currentTime);
assert.ok(incoming.when-contexts[0].currentTime<=2.8);
assert.equal(p.currentTrack(),'battle','境界前は通常曲を維持');
advance((incoming.when-contexts[0].currentTime)*1000+1);await flush();
assert.equal(p.currentTrack(),'endgame');
const wanted=tonalSound('forge',window.__bgm.harmony());
p.playSound('forge');await flush();
assert.ok(sources.at(-1).buffer.tag.endsWith('/'+wanted.file),'現在の和音の報酬音を選ぶ');
assert.equal(sources.at(-1).playbackRate.value,1,'高音化する再生速度変更をしない');
p.playTrack('battle',{restart:true});await flush();p.playTrack('endgame');await flush();
const cancelled=sources.filter(s=>s.buffer?.tag?.endsWith('/endgame.m4a')).at(-1);
p.playResultTrack('win');await flush();assert.equal(cancelled.stopped,true,'勝敗で終盤予約を取消');
advance(6000);await flush();assert.equal(p.currentTrack(),'win');
advance(1400);document.hidden=true;listeners.visibilitychange();await flush();
document.hidden=false;listeners.visibilitychange();await flush();
assert.ok(sources.filter(s=>s.buffer?.tag?.endsWith('/resultWin.m4a')).at(-1).offset>1,'結果画面も中断復帰で導入を再演奏しない');
p.playTrack('battle',{restart:true});await flush();p.playTrack('endgame');await flush();
document.hidden=true;listeners.visibilitychange();
assert.ok(sources.filter(s=>s.buffer?.tag?.endsWith('.m4a')).every(s=>s.stopped),'背景で予約中の音源も停止');
advance(5000);await flush();assert.equal(p.currentTrack(),null);
document.hidden=false;listeners.visibilitychange();await flush();assert.equal(p.currentTrack(),'endgame');
// Actual buffer-backed home music must resume at its saved position even
// when native inactive, visibility and context interruption overlap.
p.playTrack('title',{restart:true});await flush();advance(42345);
windowListeners['tottery-audio-state']({status:'inactive'});
windowListeners['tottery-audio-state']({status:'inactive'});
document.hidden=true;listeners.visibilitychange();
contexts[0].state='interrupted';contexts[0].events.statechange();
advance(30000);await flush();
assert.ok(sources.filter(s=>s.buffer?.tag?.endsWith('.m4a')).every(s=>s.stopped),'背景では全BGMソースを停止');
document.hidden=false;listeners.visibilitychange();await flush();
assert.equal(p.currentTrack(),null,'ネイティブ停止の解除を待つ');
windowListeners['tottery-audio-state']({status:'active'});await flush();
assert.equal(p.currentTrack(),'title');
const resumedHome=sources.filter(s=>s.buffer?.tag?.endsWith('/title.m4a')).at(-1);
assert.ok(Math.abs(resumedHome.offset-42.345)<.001,'ホームBGMは背景に移動した位置から再開');
assert.equal(sources.filter(s=>s.buffer?.tag?.endsWith('.m4a')&&!s.stopped).length,1,'復帰時のBGMは一本だけ');
p.setMuted(true);assert.equal(p.currentTrack(),null);p.stopMusic();
// Check several cycles directly, without advancing hundreds of timer callbacks.
const realFetch=globalThis.fetch;globalThis.fetch=fetch;
try {
 const c=new AudioContext(),track=TRACKS.title,voice=new MusicVoice(c,track,'audio/title.m4a',node(),new Audio('audio/title.m4a'));
 await voice.play();const began=c.currentTime;
 clock+=(track.loopEnd+2)*1000;
 assert.ok(Math.abs(voice.currentTime-track.loopStart-2)<.001,'2周目は指定したループ開始位置に戻る');
 const pos=voice.currentTime;voice.pause();clock+=3000;await voice.play();
 assert.ok(Math.abs(voice.currentTime-pos)<.001,'中断復帰で位置を保つ');
 voice.pause();
}finally{globalThis.fetch=realFetch;}
console.log('Adaptive music: intro once, loop range, audio-clock transition, key-matched soft rewards, cancellation, background and resume PASS');
