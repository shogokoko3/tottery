/** Local-only UI fixture: actual foil missions, acquisition reducers and title picker. */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";

const repo = process.cwd();
const port = Number(process.env.FOIL_MISSIONS_CHECK_PORT || 4223);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid FOIL_MISSIONS_CHECK_PORT");

const result = await build({
  bundle: true,
  jsx: "automatic",
  write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  plugins: [{
    name: "foil-missions-local-profile",
    setup(builder) {
      // The real title picker calls publishPlayer. Keep that boundary local;
      // the actual picker, profile, title and collection implementations stay intact.
      builder.onLoad({ filter: /src\/net\/players\.js$/ }, () => ({
        contents: `export async function publishPlayer(profile) {
          window.__foilMissionsFixture.publications.push({title:profile.title,name:profile.name});
          return {ok:true};
        }
        export async function dropOldRows(){return;}
        export async function syncPlayer(){return false;}`,
        loader: "js",
      }));
      builder.onLoad({ filter: /src\/net\/letters\.js$/ }, () => ({
        contents: "export async function readLetters(){return {ok:true,list:[]};} export function isFor(){return false;}",
        loader: "js",
      }));
    },
  }],
  stdin: {
    resolveDir: repo,
    loader: "jsx",
    contents: `
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MissionsScreen} from './src/ui/missions.jsx';
import {MenuScreen,GameShell} from './src/ui/screens.jsx';
import {AccountCard,TitlePickModal} from './src/ui/account.jsx';
import {FoilArtwork} from './src/ui/foil-artwork.jsx';
import {loadProfile,dayKey,touchDay,recordGame} from './src/game/profile.js';
import {missionPeriods} from './src/game/periodic-missions.js';
import {titleOf,ownedTitles} from './src/game/titles.js';
import {useCollection,getCollection,updateCollection,COLLECTION_KEY} from './src/skins/store.js';
import {normalize,grantSkin,pull,craft,claimFoilMilestone,FOIL_MILESTONE} from './src/skins/collection.js';
import {POOL,byId,foilId,rate} from './src/skins/catalog.js';
import styles from './src/styles.css';
import skinStyles from './src/skins/styles.css';

const PROFILE_KEY='tottery.account.v1';
function empty(){return normalize({ether:10000,motion:'off'});}
function profileSeed(){
 localStorage.removeItem(PROFILE_KEY);
 localStorage.removeItem('tottery.profile.v1');
 localStorage.setItem(PROFILE_KEY,JSON.stringify({...loadProfile(),id:'local-foil-missions',name:'確認プレイヤー',bonusDay:dayKey()}));
}
function drawSample(id){
 let left=0;
 for(const skin of POOL){const width=rate(skin)/100;if(skin.id===id)return left+width/2;left+=width;}
 throw new Error('対象の通常スキンがありません');
}
function App(){
 const collection=useCollection();
 const [profile,setProfile]=useState(loadProfile);
 const [selected,setSelected]=useState('elf-male');
 const [page,setPage]=useState('missions');
 const [revision,setRevision]=useState(0);
 const [picker,setPicker]=useState(false);
 const [narrow,setNarrow]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('空の所持から開始。各シナリオは称号・ミッション受取記録も初期化します。');
 useEffect(()=>{
  const refresh=()=>setProfile(loadProfile());
  window.addEventListener('foil-missions-memory-change',refresh);
  window.__foilMissionsFixture.inspect=()=>({collection:getCollection(),profile:loadProfile(),title:titleOf(loadProfile()),ownedTitles:ownedTitles(loadProfile()).map(t=>t.id)});
  return()=>window.removeEventListener('foil-missions-memory-change',refresh);
 },[]);
 async function scenario(kind){
  if(busy)return;
  setBusy(true);setPicker(false);
  try{
   profileSeed();
   await updateCollection(()=>{
    let next=empty();
    if(kind==='normal')for(const skin of POOL)next=grantSkin(next,skin.id);
    if(kind==='one')next=grantSkin(next,foilId(selected));
    if(kind==='all')for(const skin of POOL)next=grantSkin(next,foilId(skin.id));
    if(kind==='gacha'){
     const values=[drawSample(selected),.005];let index=0;
     next=pull(next,1,()=>values[index++]);
    }
    if(kind==='craft')next=craft(next,selected,()=>.005);
    if(kind==='milestone'){
     for(let i=0;i<FOIL_MILESTONE;i++)next=grantSkin(next,selected);
     next=claimFoilMilestone(next,selected);
    }
    return next;
   });
   setProfile(loadProfile());setPage('missions');setRevision(n=>n+1);
   const names={empty:'空の所持',normal:'通常15種のみ（フォイルなし）',one:'選択したフォイル1種を付与',all:'全15種のフォイルを付与',gacha:'実ガチャ：キャラ抽選＋独立1%判定でフォイル獲得',craft:'実錬成：エーテル消費＋独立1%判定でフォイル獲得',milestone:'実付与を100回→通算100回報酬を受取'};
   setMessage(names[kind]+'。ミッションの受け取りは実画面から確認してください。');
  }catch(error){setMessage(error?.message||String(error));}
  finally{setBusy(false);}
 }
 function remount(){
  setPicker(false);
  window.dispatchEvent(new StorageEvent('storage',{key:COLLECTION_KEY,newValue:localStorage.getItem(COLLECTION_KEY)}));
  setProfile(loadProfile());setRevision(n=>n+1);
  setMessage('メモリに保存した所持・受取記録・称号を読み直し、実画面を再マウントしました。');
 }
 const ownedFoils=POOL.filter(skin=>collection.owned[foilId(skin.id)]>0);
 const sample=byId(collection.owned[foilId(selected)]?foilId(selected):selected);
 async function periodicScenario(kind){
  profileSeed(); await updateCollection(()=>empty());
  const end=Date.now(), weekStart=missionPeriods(end).nextWeek-7*86400000;
  if(kind==='daily'){
   touchDay(end);recordGame(true,{online:true,matchId:'fixture-daily:'+end,adoptedRanks:['K','10','4','2'],at:end});
   await updateCollection(s=>pull(s,1,()=>.5));
  }else{
   const count=kind==='five'?5:3;
   for(let n=0;n<count-1;n++)touchDay(weekStart+n*86400000);
   touchDay(end);
   for(let n=0;n<(kind==='five'?5:2);n++)recordGame(true,{online:true,matchId:'fixture-week:'+end+':'+n,adoptedRanks:['K','10','4','2'],at:end});
  }
  setPage('missions');setRevision(n=>n+1);
 }
 if(${process.argv.includes("--layout")}) return <GameShell onHome={()=>setPage('home')} setShowRules={()=>{}}>
  {page==='missions'?<MissionsScreen key={revision} onBack={()=>setPage('home')}/>:
   <section className="setup-wrap"><h2>ホーム（確認用）</h2>
    <p>仮データでミッション画面を確認できます。</p>
    <button className="btn" onClick={()=>setPage('missions')}>ミッションを開く</button>
    <button className="btn" onClick={()=>scenario('all')}>全15フォイルで受取を確認</button>
    {${process.argv.includes("--periodic")}&&<>
     <button className="btn" onClick={()=>periodicScenario('daily')}>デイリー3件を達成</button>
     <button className="btn" onClick={()=>periodicScenario('partial')}>週間3日・2勝</button>
     <button className="btn" onClick={()=>periodicScenario('five')}>週間5日・5勝</button>
     <button className="btn" onClick={()=>{window.__missionTime=missionPeriods().nextDay;setPage('missions');setRevision(n=>n+1);}}>翌朝5時へ</button>
     <button className="btn" onClick={()=>{window.__missionTime=missionPeriods().nextWeek;setPage('missions');setRevision(n=>n+1);}}>月曜5時へ</button>
    </>}
   </section>}
 </GameShell>;
 return <div className="tottery-root foil-missions-fixture">
  <style>{styles+skinStyles}</style>
  <style>{'.foil-missions-fixture:has(.missions-screen){height:auto;min-height:100vh}.foil-missions-stage:has(.missions-screen){height:85dvh}.foil-missions-stage{position:relative;width:100%;margin:0 auto}.foil-missions-stage.is-narrow{width:390px;max-width:100%;border-inline:1px dashed #687693}.foil-missions-stage.is-narrow .modal-panel{max-width:362px}.foil-missions-stage .home-wrap{padding:20px}'}</style>
  <style>{'.foil-missions-tools{padding:14px;background:#10192a;color:#e5eaf3;border-bottom:1px solid #a18a5c;font:13px/1.6 system-ui}.foil-missions-tools h1{font-size:17px;margin:0 0 4px}.foil-missions-tools p{margin:4px 0}.foil-missions-tools nav{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.foil-missions-tools button,.foil-missions-tools select{font:inherit;border:1px solid #768096;color:#edf1fb;background:#24334b;border-radius:5px;padding:6px 9px}.foil-missions-tools button:disabled{opacity:.5}.foil-missions-tools button[aria-pressed=true]{border-color:#edd299;color:#edd299}.foil-missions-tools select{max-width:100%}.foil-missions-fixture-summary{display:flex;gap:12px;align-items:center;margin-top:12px}.foil-missions-fixture-art{width:48px;height:64px;flex:none;border-radius:5px;overflow:hidden}.foil-missions-fixture-art>img{width:100%;height:100%;object-fit:cover}.foil-missions-tools output{display:block;overflow-wrap:anywhere}.foil-missions-tools details{margin-top:8px}.foil-missions-tools pre{max-height:180px;overflow:auto;white-space:pre-wrap;font:11px/1.5 monospace}.foil-missions-account{max-width:580px;margin:auto;padding:20px}.foil-missions-account h2{margin-top:0}.foil-missions-title-status{margin:14px 0;padding:12px;background:#152236;border:1px solid #64728a;border-radius:6px;overflow-wrap:anywhere}.foil-missions-fixture .setup-wrap{padding-top:24px}'}</style>
  <header className="foil-missions-tools">
   <h1>フォイル獲得ミッション・称号の実UI確認</h1>
   <p>このページ内のメモリ保存だけを使用します。ページ自体を再読み込みすると初期化されます。</p>
   <label>確認キャラクター <select aria-label="確認キャラクター" value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}>{POOL.map(skin=><option key={skin.id} value={skin.id}>{skin.rank} · {skin.name}</option>)}</select></label>
   <nav aria-label="所持シナリオ">
    <button disabled={busy} onClick={()=>scenario('empty')}>空の所持</button>
    <button disabled={busy} onClick={()=>scenario('normal')}>全通常のみ</button>
    <button disabled={busy} onClick={()=>scenario('one')}>フォイル1種</button>
    <button disabled={busy} onClick={()=>scenario('all')}>全15フォイル</button>
    <button disabled={busy} onClick={()=>scenario('gacha')}>ガチャ1%獲得</button>
    <button disabled={busy} onClick={()=>scenario('craft')}>錬成1%獲得</button>
    <button disabled={busy} onClick={()=>scenario('milestone')}>通算100報酬</button>
   </nav>
   <nav aria-label="画面切り替え">
    <button aria-pressed={page==='home'} onClick={()=>{setProfile(loadProfile());setPage('home');}}>実ホーム通知</button>
    <button aria-pressed={page==='missions'} onClick={()=>{setPage('missions');setRevision(n=>n+1);}}>実ミッション画面</button>
    <button aria-pressed={page==='account'} onClick={()=>{setProfile(loadProfile());setPage('account');}}>実プロフィール・称号</button>
    <button disabled={busy} onClick={remount}>画面再マウント（保存を再読込）</button>
    <button aria-pressed={narrow} onClick={()=>setNarrow(value=>!value)}>内容幅390px {narrow?'ON':'OFF'}</button>
   </nav>
   <p role="status" data-testid="scenario-status">{message}</p>
   <div className="foil-missions-fixture-summary">
    <div className="foil-missions-fixture-art"><FoilArtwork skin={sample} alt={sample.name} animated={false}/></div>
    <div><output data-testid="foil-summary">フォイル {ownedFoils.length} / {POOL.length}種 · 通常 {POOL.filter(skin=>collection.owned[skin.id]>0).length}種 · 受取済ミッション {profile.missions.length}件 · 称号 {profile.titles.length}件</output><output data-testid="active-title">選択称号：{titleOf(profile).name} ({titleOf(profile).id})</output></div>
   </div>
   <details><summary>実保存の確認（所持・受取・称号）</summary><pre data-testid="fixture-state">{JSON.stringify({collection,profile,localPublications:window.__foilMissionsFixture.publications},null,2)}</pre></details>
  </header>
  <main className={'foil-missions-stage '+(narrow?'is-narrow':'')} data-content-width={narrow?'390':'auto'}>
  {page==='home'?<MenuScreen key={'home-'+revision} onMissions={()=>{setPage('missions');setRevision(n=>n+1);}} onPlay={()=>setMessage('このページはミッションと称号の確認専用です。')} onTutorial={()=>setMessage('このページはミッションと称号の確認専用です。')} onSkins={()=>setMessage('獲得経路は上部のシナリオボタンで確認できます。')} onBattlePass={()=>setMessage('このページはミッションと称号の確認専用です。')} onRanking={()=>setMessage('通信せずに確認しています。')} onLetters={()=>setMessage('お知らせはローカル空応答です。')}/>:
   page==='missions'?<MissionsScreen key={'missions-'+revision} onBack={()=>{setProfile(loadProfile());setPage('home');}}/>:
   <section className="foil-missions-account" key={'account-'+revision}><h2>プロフィールと称号</h2>
    <AccountCard profile={profile} onEditTitle={()=>setPicker(true)} onEditName={()=>setMessage('この確認ページでは称号の選択を確認します。')} onEditIcon={()=>setMessage('この確認ページでは称号の選択を確認します。')}/>
    <button className="btn btn-primary btn-wide" onClick={()=>setPicker(true)}>称号を選ぶ</button>
    <p className="foil-missions-title-status">使用できる称号：{ownedTitles(profile).map(title=>title.name).join('、')}</p>
   </section>}
  {picker&&<TitlePickModal key={'picker-'+revision} onClose={()=>{setPicker(false);setProfile(loadProfile());}} onSaved={setProfile}/>}
  </main>
 </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
  },
});

if (process.argv.includes("--build-only")) {
  console.log("Foil missions UI fixture compiled:", result.outputFiles[0].contents.length, "bytes");
  process.exit(0);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-foil-missions-check-"));
const bootstrap = `
${process.argv.includes("--periodic") ? "window.__missionTime=Date.parse('2026-09-11T12:00:00+09:00');Date.now=()=>window.__missionTime;" : ""}
const memory=new Map();
const changed=()=>window.dispatchEvent(new Event('foil-missions-memory-change'));
Object.defineProperty(window,'localStorage',{value:{
 getItem:key=>memory.get(String(key))??null,
 setItem:(key,value)=>{memory.set(String(key),String(value));changed();},
 removeItem:key=>{memory.delete(String(key));changed();},
 clear:()=>{memory.clear();changed();},
 key:index=>Array.from(memory.keys())[index]??null,
 get length(){return memory.size;}
}});
localStorage.setItem('tottery.skins.v1',JSON.stringify({ether:10000,owned:{},motion:'off'}));
const today=new Date();const pad=n=>String(n).padStart(2,'0');
localStorage.setItem('tottery.account.v1',JSON.stringify({id:'local-foil-missions',name:'確認プレイヤー',xp:0,missions:[],titles:[],bonusDay:today.getFullYear()+'-'+pad(today.getMonth()+1)+'-'+pad(today.getDate())}));
localStorage.setItem('tottery.audio.v1',JSON.stringify({muted:true}));
window.__foilMissionsFixture={publications:[]};
const localFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{
 const value=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 const url=new URL(value,location.href);
 if(url.origin===location.origin)return localFetch(input,init);
 return Promise.resolve(new Response('{}',{headers:{'Content-Type':'application/json'}}));
};
history.replaceState(null,'',location.pathname+'?test=1');
`;
fs.writeFileSync(path.join(root, "index.html"), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>フォイルミッション実UI確認</title><body style="margin:0"><div id="root"></div><script>${bootstrap}</script><script>${result.outputFiles[0].text}</script></body></html>`);
fs.symlinkSync(path.join(repo, "assets/skins"), path.join(root, "skins"));
const types = { ".html": "text/html; charset=utf-8", ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".mp4": "video/mp4" };
const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
  catch { response.writeHead(400).end(); return; }
  const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end("not found"); return; }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(data);
  });
});
function cleanup() {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exit(0);
}
process.once("SIGINT", cleanup);
process.once("SIGTERM", cleanup);
server.listen(port, "127.0.0.1", () => console.log("Foil missions check ready: http://127.0.0.1:" + port));
