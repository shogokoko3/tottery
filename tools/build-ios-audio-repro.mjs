// Diagnostic HTML for the production iOS bridge/player. Run after ios:sync.
// Use a separately signed Debug app, launched with --audio-repro.
import fs from 'node:fs';
import {build} from 'esbuild';
const publicDir='ios/App/App/public';
const files=fs.readdirSync(publicDir+'/audio'),map={};
for(const file of fs.readdirSync('assets/audio'))if(/\.(m4a|wav)$/.test(file)){const base=file.slice(0,file.lastIndexOf('.')),ext=file.slice(file.lastIndexOf('.'));const match=files.find(x=>x.startsWith(base+'.')&&x.endsWith(ext));if(match)map[file]=match;}
const source=`
import * as Player from './src/audio/player.js';
import {nativeAudioBridge,nativeHomeMusicAvailable} from './src/audio/native-home-music.js';
history.replaceState(null,'','?test=1');
Player.armAudioUnlock();
let started=false;
function start(id='homeDefault') {Player.setBgmVolume(.25);Player.playTrack(id);Player.unlockAudio();started=true;}
window.addEventListener('tottery-audio-state',e=>console.log('AUDIO_REPRO_JS_EVENT',e.detail || e.status));
document.addEventListener('visibilitychange',()=>console.log('AUDIO_REPRO_VISIBILITY',document.hidden));
window.addEventListener('focus',()=>console.log('AUDIO_REPRO_FOCUS'));
setTimeout(()=>start(),1500);
setInterval(async()=>{try{const state=await nativeAudioBridge().state({id:Player.currentTrack()==='battle'?'battle':'homeDefault'});const value={at:Date.now(),hidden:document.hidden,current:Player.currentTrack(),native:nativeHomeMusicAvailable(),state};console.log('AUDIO_REPRO_STATE',JSON.stringify(value));document.querySelector('pre').textContent=JSON.stringify(value,null,2);}catch(e){console.log('AUDIO_REPRO_ERROR',String(e));}},1000);
document.querySelector('#home').onclick=()=>start();document.querySelector('#battle').onclick=()=>start('battle');document.querySelector('#stop').onclick=()=>Player.stopMusic();
`;
const result=await build({stdin:{contents:source,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',define:{__AUDIO_FILES__:JSON.stringify(map)}});
fs.writeFileSync(publicDir+'/audio-repro.html','<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><body style="background:#18242d;color:#fff;font:18px sans-serif;padding:36px 12px"><h1>音声復帰の検証</h1><p>製品版の保存データは変更しません。</p><button id="home">標準ホーム</button> <button id="battle">対局</button> <button id="stop">停止</button><pre style="font-size:13px;white-space:pre-wrap"></pre><script>'+result.outputFiles[0].text+'</script></body></html>');
console.log('Harness bundled using production audio/player and '+Object.keys(map).length+' exact bundled assets');
