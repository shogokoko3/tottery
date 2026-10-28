import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import vm from "node:vm";
import { build } from "esbuild";
import { HOME_PHASE_TRACK, SCREEN_TRACK, TRACKS, trackForScene } from "../src/audio/tracks.js";
import { DEFAULT_HOME_MUSIC, HOME_MUSIC_CHOICES } from "../src/audio/home-music-options.js";
import { homeMusicForProfile } from "../src/audio/home-music.js";
import { setPhaseHome } from "../src/skins/home-themes.js";
import { STORY_HOME_THEMES } from "../src/skins/home-story-themes.js";

for (const phase of [1, 2, 3]) {
  const profile={phase}, id=HOME_PHASE_TRACK[phase], track=TRACKS[id];
  assert.equal(homeMusicForProfile({},profile),id,"ストーリー連動背景は対応するフェーズの曲");
  const normal=setPhaseHome({},phase,`phase-${phase}`);
  assert.equal(homeMusicForProfile(normal,profile),DEFAULT_HOME_MUSIC,"通常背景は進行フェーズで曲を決めない");
  for (const theme of STORY_HOME_THEMES) {
    const story=setPhaseHome({},phase,theme.id);
    assert.equal(homeMusicForProfile(story,profile),HOME_PHASE_TRACK[theme.phase],"固定した話の背景のフェーズを使う");
    for (const choice of HOME_MUSIC_CHOICES.filter(c=>c.id!=="auto")) {
      assert.equal(homeMusicForProfile(story,profile,choice.id),choice.id,"本人の選曲が背景より優先");
      assert.equal(homeMusicForProfile(normal,profile,choice.id),choice.id);
    }
  }
  for(const homeTrack of [DEFAULT_HOME_MUSIC,...Object.values(HOME_PHASE_TRACK)])for(const [screen,base] of Object.entries(SCREEN_TRACK)) {
    if(screen==="game")continue;
    assert.equal(trackForScene({screen,homeTrack}),base==="title"?homeTrack:base);
  }
  assert.equal(trackForScene({screen:"game",phase:"play",homeTrack:id}),"battle");
  assert.equal(trackForScene({screen:"game",phase:"play",endgame:true,homeTrack:id}),"endgame");
  assert.equal(trackForScene({screen:"game",phase:"gameover",result:"lose",homeTrack:id}),"lose");
  assert.ok(track.loopStart>0 && track.loopEnd<track.duration-.2);
  assert.ok(track.loopEnd-track.loopStart>70);
}
for(const value of [undefined,null,"battle","auto",{},4])
  assert.equal(trackForScene({screen:"menu",homeTrack:value}),DEFAULT_HOME_MUSIC);
const choices=JSON.parse(fs.readFileSync("docs/home-phase-bgm-choices.json","utf8"));
const overrides=JSON.parse(fs.readFileSync("docs/audio-source-overrides.json","utf8"));
const sha=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
for(const phase of [1,2,3]) {
  const choice=choices.phases[phase],id=HOME_PHASE_TRACK[phase],track=TRACKS[id];
  assert.equal(choice.status,"approved");assert.equal(choice.implementationStatus,"implemented");
  assert.equal(sha(choice.selectedMaster),choice.sourceSha256,"採用音源の原本を保持");
  assert.equal(sha(choice.asset),choice.assetSha256);
  assert.equal(sha(choice.asset),overrides[id].sha256);
  assert.equal(sha(overrides[id].source),sha(choice.asset));
  assert.equal(track.sourceSha256,sha(choice.asset));
  assert.equal(track.loopStart,choice.loopStart);assert.equal(track.loopEnd,choice.loopEnd);
}
assert.equal(sha("assets/audio/homeDefault.m4a"),sha(overrides.homeDefault.source),"選択した標準ホーム原本を無変換で同梱する");
assert.equal(sha("assets/audio/homeDefault.m4a"),overrides.homeDefault.sha256);
assert.equal(sha("assets/audio/masters/home-soft-loop-20261023.m4a"),"52b83ca12190fbbd87e5906490bfa08eaa80e756a6206ba8a526bf04de685f95","以前採用したループ原本も保持する");
assert.equal(sha("assets/audio/masters/home-soft-approved-20261023.m4a"),"b29f7ff460df47c7cb5f88381866c9ab38910708877e3715956128cf188cdbc7","元の採用曲を保持する");
assert.equal(TRACKS.homeDefault.sourceSha256,sha("assets/audio/homeDefault.m4a"));
assert.equal(TRACKS.homeDefault.gain,1,"標準ホーム曲は試聴原本のレベルを保ち、本人のBGM音量で調整する");

const noopExports=["armAudioUnlock","audioSettings","connectFilmSound","duckMusic","playSound","playAreaSound","playAuxiliarySound","setBgmVolume","setMuted","setSeVolume","stopMusic","unlockAudio","playResultTrack","setVolumeScale"];
const result=await build({
  stdin:{contents:'export {useScreenBgm} from "./src/audio/index.js";export {setHomeMusicChoice,homeMusicChoice,HOME_MUSIC_KEY} from "./src/audio/home-music-settings.js";',resolveDir:process.cwd()},
  bundle:true,write:false,format:"iife",globalName:"ScreenAudio",
  plugins:[{name:"screen-audio-adapters",setup(b){
    b.onResolve({filter:/^react$/},()=>({path:"react-hooks",namespace:"test"}));
    b.onLoad({filter:/.*/,namespace:"test"},()=>({contents:`
      export const useRef=value=>({current:value});
      export const useSyncExternalStore=(subscribe,snapshot)=>{
        globalThis.subscription={subscribe,snapshot};return snapshot();
      };
      export const useEffect=(run,deps)=>{
        if(!globalThis.dependencies || deps.some((value,i)=>value!==globalThis.dependencies[i])) {
          globalThis.dependencies=deps;run();
        }
      };
    `}));
    b.onLoad({filter:/src\/game\/profile\.js$/},()=>({contents:'export const PROFILE_CHANGED="tottery:profile";export const loadProfile=()=>globalThis.profile;'}));
    b.onLoad({filter:/src\/skins\/store\.js$/},()=>({contents:'export const getCollection=()=>globalThis.collection;export const subscribeCollection=fn=>{globalThis.collectionListeners.add(fn);return ()=>globalThis.collectionListeners.delete(fn);};'}));
    b.onLoad({filter:/src\/audio\/player\.js$/},()=>({contents:noopExports.map(name=>"export const "+name+"=()=>{};").join("\n")+'export const playTrack=id=>globalThis.requests.push(id);'}));
  }}]
});
const windowEvents=new Map(),documentEvents=new Map(),saved=new Map();
const surface=events=>({
  addEventListener(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},
  removeEventListener(name,fn){events.get(name)?.delete(fn);}
});
const env={profile:{phase:1},collection:{},collectionListeners:new Set(),requests:[],window:surface(windowEvents),document:surface(documentEvents),localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}};
vm.runInNewContext(result.outputFiles[0].text,env);
const api=env.ScreenAudio;
const initialWindowListeners=[...windowEvents.values()].reduce((n,set)=>n+set.size,0);
let screen="home";
const render=()=>api.useScreenBgm(screen);
render();const cleanup=env.subscription.subscribe(render);
const emit=(events,name,event)=>{for(const fn of events.get(name)||[])fn(event);};
const collectionChanged=()=>{for(const fn of env.collectionListeners)fn();};
assert.deepEqual([...env.requests],["title"]);
screen="menu";render();assert.equal(env.requests.length,1,"ホームとメニューで同じ曲を再開しない");
env.collection=setPhaseHome({},1,"phase-1");collectionChanged();
assert.equal(env.requests.at(-1),"homeDefault","背景の適用で通常のホーム曲へ");
env.profile.phase=2;emit(windowEvents,"tottery:profile");
assert.equal(env.requests.at(-1),"homePhase2","ストーリー背景では進行に追従");
api.setHomeMusicChoice("title");assert.equal(env.requests.at(-1),"title");
assert.equal(JSON.parse(saved.get(api.HOME_MUSIC_KEY)).choice,"title");
let count=env.requests.length;
env.profile.phase=3;emit(windowEvents,"tottery:profile");
env.collection=setPhaseHome({},3,"phase-2-story-45");collectionChanged();
assert.equal(env.requests.length,count,"手動曲は昇格や背景変更に引っ張られない");
api.setHomeMusicChoice("auto");assert.equal(env.requests.at(-1),"homePhase2","固定した過去の話の背景に対応する曲");
count=env.requests.length;env.profile.name="new name";env.profile.previewPhase=1;emit(windowEvents,"tottery:profile");
assert.equal(env.requests.length,count,"無関係なプロフィール変更では再開しない");
env.collection=setPhaseHome({},3,"phase-3");collectionChanged();
assert.equal(env.requests.at(-1),"homeDefault");
saved.set(api.HOME_MUSIC_KEY,JSON.stringify({choice:"homePhase3"}));emit(windowEvents,"storage",{key:api.HOME_MUSIC_KEY});
assert.equal(env.requests.at(-1),"homePhase3","別タブで選んだ曲に追従");
count=env.requests.length;emit(windowEvents,"focus");emit(documentEvents,"visibilitychange");
assert.equal(env.requests.length,count,"同じ曲の復帰通知では先頭へ戻さない");
screen="game";render();count=env.requests.length;api.setHomeMusicChoice("homePhase2");
assert.equal(env.requests.length,count,"対局中はホーム曲へ切り替えない");
screen="menu";render();assert.equal(env.requests.at(-1),"homePhase2");
cleanup();count=env.requests.length;api.setHomeMusicChoice("title");collectionChanged();
assert.equal(env.requests.length,count,"購読解除後に再生要求しない");
assert.equal(env.collectionListeners.size,0);
assert.equal([...windowEvents.values()].reduce((n,set)=>n+set.size,0),initialWindowListeners);
assert.ok([...documentEvents.values()].every(set=>set.size===0));
console.log("Home BGM: 4 approved tracks, actual story/ordinary backgrounds, manual override, persistence/storage, scene continuity and cleanup PASS");
