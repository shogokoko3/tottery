// 実際の player.js に、再生開始を手動で遅らせる音声端末を接続する。
// node tools/check-bgm-playback.mjs
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
const media=[], timers=new Map(); let clock=0,serial=0;
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
function advance(ms){clock+=ms;for(const [id,t] of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}}
class Audio {
  constructor(url){this.url=url;this.paused=true;this.currentTime=0;this.requests=[];media.push(this);}
  setAttribute(){}
  play(){return new Promise((resolve,reject)=>this.requests.push({resolve:()=>{this.paused=false;resolve();},reject}));}
  pause(){this.paused=true;}
  start(){this.requests.shift().resolve();}
  fail(){this.requests.shift().reject(new Error('playback denied'));}
}
function node(){return {gain:{value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}},connect(){return this;},start(){},disconnect(){}};}
class AudioContext {
  state='running';currentTime=0;destination={};
  createGain(){return node();}createMediaElementSource(){return node();}createBufferSource(){return node();}createBuffer(){return {};}
}
const output=await build({entryPoints:['src/audio/player.js'],bundle:true,write:false,format:'iife',globalName:'Bgm',plugins:[{name:'isolate-profile',setup(b){b.onLoad({filter:/src\/game\/profile\.js$/},()=>({contents:'export const isTestPlay=()=>false;'}));}}]});
const env={Audio,window:{AudioContext},fetch:()=>Promise.reject(new Error('SE not required')),setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:clock+ms});return id;},clearTimeout:id=>timers.delete(id)};
vm.runInNewContext(output.outputFiles[0].text,env);
const bgm=env.Bgm,find=id=>media.find(m=>m.url.endsWith(`/${id}.m4a`));
bgm.playTrack('title');bgm.unlockAudio();find('title').start();await flush();
assert.equal(bgm.currentTrack(),'title');
bgm.playTrack('setup');advance(2500);
assert.equal(find('title').paused,false,'読み込み中も前の曲を鳴らす');
assert.equal(bgm.currentTrack(),'title');
find('setup').start();await flush();
assert.equal(bgm.currentTrack(),'setup');assert.equal(find('title').paused,false,'再生開始後にクロスフェード');
advance(800);assert.equal(find('title').paused,true);
// 未開始の要求の重複と、素早い画面変更。
bgm.playTrack('battle');bgm.playTrack('battle');assert.equal(find('battle').requests.length,1);
bgm.playTrack('endgame');find('battle').fail();await flush();
assert.equal(bgm.currentTrack(),'setup','古い要求の失敗で現在の曲を止めない');
find('endgame').start();await flush();advance(800);assert.equal(bgm.currentTrack(),'endgame');
// 読み込み中に元の画面へ戻る。
bgm.playTrack('title');bgm.playTrack('endgame');find('title').fail();await flush();
assert.equal(find('endgame').paused,false);assert.equal(bgm.currentTrack(),'endgame');
// 失敗した曲も次の要求で再試行できる。
bgm.playTrack('win');find('win').fail();await flush();assert.equal(bgm.currentTrack(),'endgame');
bgm.playTrack('win');find('win').start();await flush();assert.equal(bgm.currentTrack(),'win');
// ミュート中に遅れた再生完了が届いても復帰させない。
bgm.playTrack('setup');bgm.setMuted(true);find('setup').requests.shift().resolve();await flush();
assert.equal(bgm.currentTrack(),null);advance(800);assert.equal(find('win').paused,true);
bgm.setMuted(false);find('setup').start();await flush();assert.equal(bgm.currentTrack(),'setup');
// フェードアウト中に同じ曲へ戻る場合、古い停止タイマーを取消す。
bgm.playTrack('title');find('title').start();await flush();
bgm.playTrack('setup');find('setup').start();await flush();advance(800);
assert.equal(find('setup').paused,false);assert.equal(find('title').paused,true);
bgm.stopMusic();advance(800);assert.equal(find('setup').paused,true);
console.log('BGM再生: 読込遅延・開始後のフェード・重複要求・連続切替・失敗後再試行・消音・停止タイマーを確認');
