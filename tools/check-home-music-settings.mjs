import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";
import { setPhaseHome } from "../src/skins/home-themes.js";

const settingsBundle=await build({entryPoints:["src/audio/home-music-settings.js"],bundle:true,write:false,format:"iife",globalName:"MusicSettings"});
function environment({saved=null,unavailable=false}={}) {
  const values=new Map([["tottery.audio.v1",'{"bgm":0.3,"se":0.7,"muted":true}']]),events=new Map();
  if(saved!==null)values.set("tottery.home-music.v1",saved);
  const context={window:{addEventListener:(name,fn)=>events.set(name,fn)},localStorage:{
    getItem(key){if(unavailable)throw Error("unavailable");return values.get(key)??null;},
    setItem(key,value){if(unavailable)throw Error("unavailable");values.set(key,value);}
  }};
  vm.runInNewContext(settingsBundle.outputFiles[0].text,context);
  return {api:context.MusicSettings,values,emit:event=>events.get("storage")(event)};
}
for(const saved of [null,"broken","null",'{"choice":"battle"}', '{"choice":{}}'])
  assert.equal(environment({saved}).api.homeMusicChoice(),"auto");
const e=environment();let changes=0;
const stop=e.api.subscribeHomeMusic(()=>changes++);
for(const id of ["homeDefault","title","homePhase2","homePhase3","auto"]) {
  assert.equal(e.api.setHomeMusicChoice(id),id);
  assert.equal(environment({saved:e.values.get(e.api.HOME_MUSIC_KEY)}).api.homeMusicChoice(),id,"再起動後も選択を復元");
}
assert.equal(changes,5);
assert.equal(e.values.get("tottery.audio.v1"),'{"bgm":0.3,"se":0.7,"muted":true}',"音量・消音を変更しない");
e.values.set(e.api.HOME_MUSIC_KEY,'{"choice":"homePhase3"}');e.emit({key:e.api.HOME_MUSIC_KEY});
assert.equal(e.api.homeMusicChoice(),"homePhase3");
e.values.delete(e.api.HOME_MUSIC_KEY);e.emit({key:null});assert.equal(e.api.homeMusicChoice(),"auto");
const before=changes;e.emit({key:"unrelated"});assert.equal(changes,before);
stop();e.api.setHomeMusicChoice("title");assert.equal(changes,before);
const failed=environment({unavailable:true});assert.equal(failed.api.homeMusicChoice(),"auto");
failed.api.setHomeMusicChoice("homePhase2");assert.equal(failed.api.homeMusicChoice(),"homePhase2","保存不能でも現在のセッションで使える");

const uiBundle=await build({
  stdin:{contents:'export {HomeMusicSettings} from "./src/ui/home-music-settings.jsx";export {homeMusicChoice,HOME_MUSIC_KEY} from "./src/audio/home-music-settings.js";',resolveDir:process.cwd()},
  bundle:true,write:false,format:"iife",globalName:"MusicUI",jsx:"automatic",loader:{".css":"text"},
  plugins:[{name:"music-ui-boundaries",setup(b){
    const mocks={
      react:'export const useSyncExternalStore=(_,snapshot)=>snapshot();',
      'react/jsx-runtime':'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;',
      '../skins/store.js':'export const useCollection=()=>globalThis.collection;',
      './mission-profile.js':'export const useMissionProfile=()=>[globalThis.profile];',
    };
    b.onResolve({filter:/.*/},args=>mocks[args.path]?{path:args.path,namespace:"mock"}:undefined);
    b.onLoad({filter:/.*/,namespace:"mock"},args=>({contents:mocks[args.path]}));
  }}]
});
const values=new Map(),ui={profile:{phase:1},collection:{},window:{addEventListener(){}},localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
vm.runInNewContext(uiBundle.outputFiles[0].text,ui);
const render=()=>ui.MusicUI.HomeMusicSettings();
const nodes=(node,out=[])=>{if(Array.isArray(node))node.forEach(n=>nodes(n,out));else if(node&&typeof node==="object"){out.push(node);nodes(node.props?.children,out);}return out;};
const text=node=>Array.isArray(node)?node.map(text).join(""):node&&typeof node==="object"?text(node.props?.children):typeof node==="string"?node:"";
const select=()=>nodes(render()).find(n=>n.type==="select");
assert.equal(select().props.value,"auto");
assert.equal(nodes(render()).filter(n=>n.type==="option").length,5,"全フェーズで同じ4曲とおまかせを選べる");
assert.match(text(render()),/風と土の道/);
ui.collection=setPhaseHome({},1,"phase-1");assert.match(text(render()),/おまかせの選曲：標準のホームBGM/);
select().props.onChange({target:{value:"homePhase3"}});
assert.equal(select().props.value,"homePhase3");
assert.match(text(render()),/背景やストーリーが変わっても/);
ui.profile.phase=2;ui.collection={};assert.equal(select().props.value,"homePhase3");
assert.match(text(render()),/選択中：手を重ねた朝/);
select().props.onChange({target:{value:"auto"}});assert.match(text(render()),/おまかせの選曲：息をつく場所/);
assert.equal(JSON.parse(values.get(ui.MusicUI.HOME_MUSIC_KEY)).choice,"auto");
console.log("Home music settings: migration/corruption, persistence, storage failure/events, preserved volume/mute, UI choices and background defaults PASS");
