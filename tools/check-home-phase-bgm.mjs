import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import vm from "node:vm";
import { build } from "esbuild";
import { HOME_PHASE_TRACK, SCREEN_TRACK, TRACKS, trackForScene } from "../src/audio/tracks.js";

for (const phase of [1, 2, 3]) {
  const id=HOME_PHASE_TRACK[phase], track=TRACKS[id];
  for (const [screen,base] of Object.entries(SCREEN_TRACK)) {
    if (screen==="game") continue;
    assert.equal(trackForScene({screen,storyPhase:phase}),base==="title"?id:base);
  }
  assert.equal(trackForScene({screen:"game",phase:"play",storyPhase:phase}),"battle");
  assert.equal(trackForScene({screen:"game",phase:"play",endgame:true,storyPhase:phase}),"endgame");
  assert.equal(trackForScene({screen:"game",phase:"gameover",result:"lose",storyPhase:phase}),"lose");
  assert.ok(track.loopStart>0 && track.loopEnd<track.duration-.2);
  assert.ok(track.loopEnd-track.loopStart>70);
}
for (const storyPhase of [undefined,null,0,4,-1,"2",NaN])
  assert.equal(trackForScene({screen:"menu",storyPhase}),"title");
assert.equal(new Set(Object.values(HOME_PHASE_TRACK)).size,3);
const choices=JSON.parse(fs.readFileSync("docs/home-phase-bgm-choices.json","utf8"));
const overrides=JSON.parse(fs.readFileSync("docs/audio-source-overrides.json","utf8"));
const sha=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
for (const phase of [1,2,3]) {
  const choice=choices.phases[phase],id=HOME_PHASE_TRACK[phase],track=TRACKS[id];
  assert.equal(choice.status,"approved");
  assert.equal(choice.implementationStatus,"implemented");
  assert.equal(sha(choice.selectedMaster),choice.sourceSha256,"採用音源の原本を保持");
  assert.equal(sha(choice.asset),choice.assetSha256);
  assert.equal(sha(choice.asset),overrides[id].sha256);
  assert.equal(sha(overrides[id].source),sha(choice.asset),"同梱音源はループ原本と一致");
  assert.equal(track.sourceSha256,sha(choice.asset));
  assert.equal(track.loopStart,choice.loopStart);
  assert.equal(track.loopEnd,choice.loopEnd);
}

// Exercise the actual screen hook with in-memory profile and playback adapters:
// promotion, remote storage, resume, unrelated profile updates and cleanup.
const noopExports=["armAudioUnlock","audioSettings","connectFilmSound","duckMusic","playSound","playAreaSound","setBgmVolume","setMuted","setSeVolume","stopMusic","unlockAudio","playResultTrack","setVolumeScale"];
const result=await build({
  stdin:{contents:'export {useScreenBgm} from "./src/audio/index.js";',resolveDir:process.cwd()},
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
    b.onLoad({filter:/src\/game\/profile\.js$/},()=>({contents:`
      export const PROFILE_CHANGED="tottery:profile";
      export const loadProfile=()=>globalThis.profile;
    `}));
    b.onLoad({filter:/src\/audio\/player\.js$/},()=>({contents:
      noopExports.map(name=>"export const "+name+"=()=>{};").join("\n")+
      'export const playTrack=id=>globalThis.requests.push(id);'
    }));
  }}]
});
const windowEvents=new Map(),documentEvents=new Map();
const surface=events=>({
  addEventListener(name,callback){if(!events.has(name))events.set(name,new Set());events.get(name).add(callback);},
  removeEventListener(name,callback){events.get(name)?.delete(callback);}
});
const env={profile:{phase:1},requests:[],window:surface(windowEvents),document:surface(documentEvents)};
vm.runInNewContext(result.outputFiles[0].text,env);
let screen="home";
const render=()=>env.ScreenAudio.useScreenBgm(screen);
render();
const cleanup=env.subscription.subscribe(render);
const emit=(events,name)=>{for(const callback of events.get(name)||[])callback();};
assert.deepEqual([...env.requests],["title"]);
screen="menu";render();
assert.equal(env.requests.length,1,"ホームからメニューへ移動しても再スタートしない");
env.profile.phase=2;emit(windowEvents,"tottery:profile");
assert.equal(env.requests.at(-1),"homePhase2","昇格で次の曲へ");
const count=env.requests.length;
env.profile.name="new name";env.profile.previewPhase=1;emit(windowEvents,"tottery:profile");
assert.equal(env.requests.length,count,"名前・過去話プレビューはホーム曲を再開しない");
env.profile.phase=3;emit(windowEvents,"storage");
assert.equal(env.requests.at(-1),"homePhase3","同期データのフェーズへ追従");
env.profile.phase=2;emit(documentEvents,"visibilitychange");
assert.equal(env.requests.at(-1),"homePhase2","復帰時に現在フェーズを再確認");
const beforeGame=env.requests.length;
screen="game";render();env.profile.phase=3;emit(windowEvents,"focus");
assert.equal(env.requests.length,beforeGame,"対局中はゲーム側の曲を上書きしない");
screen="menu";render();assert.equal(env.requests.at(-1),"homePhase3");
cleanup();
assert.ok([...windowEvents.values(),...documentEvents.values()].every(set=>set.size===0),"購読を解除する");
console.log("Home phase BGM: 3 approved sources, scene routing, promotion/sync/resume subscriptions and unchanged-menu continuity PASS");
