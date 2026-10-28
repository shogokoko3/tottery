import assert from "node:assert/strict";
import fs from "node:fs";
import { build } from "esbuild";
import vm from "node:vm";
import { NativeHomeMusicVoice } from "../src/audio/native-home-music.js";
import { TRACKS } from "../src/audio/tracks.js";

let clock = 0, nativePosition = 0, paused = true;
const calls = [];
const bridge = Object.fromEntries(["prepare", "play", "pause", "setMix", "state", "release"].map(name => [name, async options => {
  calls.push([name, options]);
  if (name === "play") { nativePosition = options.position ?? nativePosition; paused = false; }
  if (name === "pause") paused = true;
  return { position: nativePosition, paused };
}]));
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const track = TRACKS.homeDefault;
const voice = new NativeHomeMusicVoice(track, "audio/homeDefault.52b83ca1.m4a", { bridge, now: () => clock });
voice.mix({ track: 0, master: .6, duck: 1 });
await voice.play();
assert.equal(calls.find(c => c[0] === "prepare")[1].file, "homeDefault.52b83ca1.m4a");
assert.equal(calls.find(c => c[0] === "prepare")[1].loopEnd, track.loopEnd);
clock = 56;
assert.equal(voice.currentTime, 56);
nativePosition = 55.997;
voice.pause(); await flush();
assert.equal(voice.currentTime, 55.997, "Native render position replaces the UI estimate");
voice.pause(); await flush();
clock += 80;
assert.equal(voice.currentTime, 55.997, "Duplicate background notifications retain the first position");
await voice.play();
assert.deepEqual(calls.filter(c => c[0] === "play").at(-1)[1], { id: 'homeDefault' }, "Resume uses the native retained position");
assert.equal(voice.currentTime, 55.997);
voice.fadeTrack(1, 700); voice.mix({ master: .4, durationMs: 80 }); voice.mix({ duck: .35, durationMs: 80 }); await flush();
assert.ok(calls.some(c => c[0] === "setMix" && c[1].master === .4));
assert.ok(calls.some(c => c[0] === "setMix" && c[1].duck === .35));
// A native pause can arrive before the web visibility notification.
nativePosition = 64.02; paused = true;
await voice.refreshState();
assert.equal(voice.paused, true); assert.equal(voice.currentTime, 64.02);
voice.currentTime = 20; await voice.play();
assert.deepEqual(calls.filter(c => c[0] === "play").at(-1)[1], { id: "homeDefault", position: 20 });

let resolvePreparation;
const delayed = new NativeHomeMusicVoice(track, "audio/homeDefault.m4a", { now: () => clock, bridge: {
  ...bridge, prepare: () => new Promise(resolve => { resolvePreparation = resolve; }),
} });
const starting = delayed.play();
const cancelled = assert.rejects(starting, /cancelled/);
await flush(); delayed.pause(); resolvePreparation({ position: 0, paused: true });
await cancelled; await flush(); assert.equal(delayed.paused, true);

// Exercise the real player with no usable HTML/Web Audio renderer on iOS.
let webAllocations = 0, nativeActive = true, nativeWanted = null;
const nativeCalls = [], events = {}, voices = new Map(), effectListeners = new Map();
const state = id => { if (!voices.has(id)) voices.set(id, { position: 0, paused: true, levels: {} }); return voices.get(id); };
const nativeBridge = {};
for (const method of ['prepare','play','pause','state','setMix','release','transition','prepareEffect','playEffect','stopEffect','setEffectsVolume','resumeAudio']) {
  nativeBridge[method] = async options => {
    nativeCalls.push([method, options]);
    const v = state(options.id || 'homeDefault');
    if (method === 'play') { assert.ok(nativeActive); v.position = options.position ?? v.position; v.paused = false; nativeWanted = options.id; }
    if (method === 'pause' && (!options.keepIntent || !nativeActive)) { v.paused = true; if (!options.keepIntent && nativeWanted === options.id) nativeWanted = null; }
    if (method === 'setMix') Object.assign(v.levels, options);
    if (method === 'transition') { state(options.to).paused = false; nativeWanted = options.to; return { delay: .7, fadeMs: 700, position: 0, paused: false }; }
    if (method === 'prepareEffect') return { duration: options.key.startsWith('movie:') ? 6 : .3, cueGain: 2 };
    if (method === 'playEffect') return { played: nativeActive, duration: .3 };
    if (method === 'stopEffect' && options.token) effectListeners.get('effectEnded')?.({ token: options.token });
    if (method === 'resumeAudio' && nativeActive && nativeWanted) state(nativeWanted).paused = false;
    return { position: v.position, paused: v.paused };
  };
}
nativeBridge.addListener = (name, fn) => { effectListeners.set(name, fn); return Promise.resolve({ remove() {} }); };
class Audio { constructor() { webAllocations++; throw Error('iOS must not create HTML audio'); } }
class AudioContext { constructor() { webAllocations++; throw Error('iOS must not create Web Audio'); } }
const result = await build({ entryPoints: ['src/audio/player.js'], bundle: true, write: false, format: 'iife', globalName: 'Player', plugins: [{ name: 'native-adapters', setup(b) {
  b.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: 'bridge', namespace: 'native-test' }));
  b.onLoad({ filter: /.*/, namespace: 'native-test' }, () => ({ contents: 'export const Capacitor={getPlatform:()=>"ios",isPluginAvailable:()=>true};export const registerPlugin=()=>globalThis.nativeBridge;' }));
  b.onLoad({ filter: /src\/game\/profile\.js$/ }, () => ({ contents: 'export const isTestPlay=()=>false;' }));
} }] });
const timers = new Map(); let timerId = 0;
const document = { hidden: false, addEventListener: (name, fn) => { events[name] = fn; } };
class TestDate extends Date { static now() { return clock * 1000; } }
clock = 100;
const sandbox = { Audio, URL, Date: TestDate, document, window: { AudioContext, location: { href: 'capacitor://localhost/' }, addEventListener: (name, fn) => { events[name] = fn; } }, performance: { now: () => clock * 1000 }, nativeBridge,
  fetch: () => { throw Error('Native playback must read bundled files through iOS'); }, console,
  setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id) };
vm.runInNewContext(result.outputFiles[0].text, sandbox);
const player = sandbox.Player;
const settle = async () => { await flush(); await flush(); await flush(); };
const runTimers = ms => { for (const [id,t] of [...timers]) if (t.ms === ms) { timers.delete(id); t.fn(); } };
player.armAudioUnlock(); player.playTrack('homeDefault'); player.unlockAudio(); await settle();
assert.equal(player.currentTrack(), 'homeDefault');
assert.equal(webAllocations, 0);
assert.ok(nativeCalls.some(([m,o]) => m === 'prepare' && o.file === 'homeDefault.m4a'));
assert.ok(nativeCalls.filter(([m]) => m === 'prepareEffect').length >= 60, 'Base and synthesized SE preload through the native decoder');
player.setBgmVolume(.32); player.setSeVolume(.4); await settle();
assert.ok(nativeCalls.some(([m,o])=>m==='setMix' && o.master===.32));
assert.ok(nativeCalls.some(([m,o])=>m==='setEffectsVolume' && o.volume===.4));
const unduck=player.duckMusic(1000); await settle();
assert.ok(nativeCalls.some(([m,o])=>m==='setMix' && o.duck===.35));
unduck(); await settle();
assert.ok(nativeCalls.some(([m,o])=>m==='setMix' && o.duck===1));
for (const id of Object.keys(TRACKS)) {
  player.playTrack(id); await settle(); if (id === 'endgame') { clock += .7; runTimers(700); } runTimers(780); await settle();
  assert.equal(player.currentTrack(),id,`${id} uses native playback`);
  assert.ok(nativeCalls.some(([m,o])=>(m==='play' && o.id===TRACKS[id].file.replace(/\.m4a$/,'')) || (m==='transition' && o.to===id)));
}
assert.equal(webAllocations,0,'All nineteen music choices bypass the web renderer');
player.playTrack('battle');await settle();
player.playTrack('endgame');await settle();
assert.equal(player.currentTrack(),'battle','Outgoing music continues until the authored boundary');
const transition=nativeCalls.find(([m])=>m==='transition')[1];
assert.equal(transition.from,'battle');assert.equal(transition.to,'endgame');assert.ok(transition.exits.length);
clock+=.7;runTimers(700);await settle();assert.equal(player.currentTrack(),'endgame');
// Background pause/foreground resume retain the native render position.
state('endgame').position=56.013;nativeActive=false;for(const v of voices.values())v.paused=true;
document.hidden=true;events.visibilitychange();await settle();
assert.equal(player.currentTrack(),null);
nativeActive=true;state(nativeWanted).paused=false;document.hidden=false;events.visibilitychange();await settle();
assert.equal(player.currentTrack(),'endgame');assert.equal(state('endgame').position,56.013);
// Foreground resumes natively before any web callback. A late web pause keeps intent.
const independent=new NativeHomeMusicVoice(TRACKS.endgame,'audio/endgame.m4a',{bridge:nativeBridge,now:()=>clock});
await independent.play();state('endgame').position=64.027;
nativeActive=false;state('endgame').paused=true;
nativeActive=true;state('endgame').paused=false;
independent.pause({lifecycle:true});await settle();
assert.equal(state('endgame').paused,false,'Late background request cannot re-pause native foreground playback');
assert.equal(independent.paused,false);assert.equal(independent.currentTime,64.027);
clock+=1;player.playSound('time10');await settle();
assert.ok(nativeCalls.some(([m,o])=>m==='playEffect' && o.key==='time10' && o.priority===3));
clock+=1;player.playSound('reveal_ssr',{harmony:{root:4,mode:'minor'},rate:2});await settle();
assert.ok(nativeCalls.some(([m,o])=>m==='playEffect' && o.key==='bloom-3-4-minor' && o.rate===1),'Rewards retain the harmonic variant without rate shifting');
const capture=player.createCaptureSound();capture.play('loss-hit');await settle();
assert.ok(nativeCalls.some(([m,o])=>m==='playEffect' && o.key==='capture:loss-hit'));
capture.stop();player.playAreaSound('birth');await settle();
assert.ok(nativeCalls.some(([m,o])=>m==='playEffect' && o.key==='area:birth'));
const filmEvents={};
const video={src:'capacitor://localhost/skins/videos/alice.mp4',currentTime:1.25,playbackRate:2.5,paused:true,ended:false,muted:false,
 addEventListener:(n,f)=>filmEvents[n]=f,removeEventListener:n=>delete filmEvents[n]};
const disconnect=player.connectFilmSound(video);await settle();assert.equal(video.muted,true);
video.paused=false;filmEvents.playing();await settle();
assert.ok(nativeCalls.some(([m,o])=>m==='playEffect' && o.movie && o.offset===1.25 && o.rate===2.5),'Movie audio also uses the native engine and tracks video position');
disconnect();assert.equal(Object.keys(filmEvents).length,0);
player.setMuted(true);await settle();
assert.ok(nativeCalls.some(([m,o])=>m==='setEffectsVolume' && o.volume===0));
const before=nativeCalls.filter(([m])=>m==='playEffect').length;
clock+=1;player.playSound('tap');await settle();assert.equal(nativeCalls.filter(([m])=>m==='playEffect').length,before);
player.setMuted(false);await settle();player.stopMusic();runTimers(780);await settle();
assert.equal(webAllocations,0);
const swift=fs.readFileSync('ios/App/App/NativeHomeMusicPlugin.swift','utf8');
const scene=fs.readFileSync('ios/App/App/SceneDelegate.swift','utf8');
assert.ok(swift.includes('registerPluginInstance(gameAudio)'));
assert.ok(scene.indexOf('resumeNativeGameAudio()') < scene.indexOf('webView.setAllMediaPlaybackSuspended(false)'), 'Native foreground is independent of WebKit completion');
assert.ok(swift.includes('lifecycle.acceptsPause(keepingIntent: keepingIntent)'));
assert.ok(swift.includes('resumeWanted()'));
const native=fs.readFileSync('ios/App/App/NativeGameAudio.swift','utf8');
assert.ok(native.includes('.highShelf') && native.includes('.lowPass') && native.includes('frequency = 3200') && native.includes('gain = -6'));
assert.ok(native.includes('stretch.pitch = 0'),'Short movies preserve pitch');
for(const name of ['NativeHomeMusicEngine.swift','NativeHomeMusicPlugin.swift','NativeGameAudio.swift'])assert.ok(fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj','utf8').includes(`${name} in Sources`));
const privacy=fs.readFileSync('ios/App/App/PrivacyInfo.xcprivacy','utf8');assert.ok(privacy.includes('35F9.1'));
console.log('Native game audio: all 19 BGM, file/tonal/synth/movie SE, native-only recovery, late pause protection, transition, volume, mute, duck and zero web audio allocations PASS');
