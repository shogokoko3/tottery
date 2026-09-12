// Local-only fixture: actual home, daily challenge, rewards and persistence.
import { build } from "esbuild";
import fs from "node:fs";
import http from "node:http";
const repo = process.cwd(),
  port = Number(process.env.TSUME_CHECK_PORT || 4255);
const result = await build({
  bundle: true,
  jsx: "automatic",
  write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  plugins: [
    {
      name: "local-only",
      setup(b) {
        b.onLoad({ filter: /src\/net\/players\.js$/ }, () => ({
          contents:
            "export async function publishPlayer(){};export async function registerPlayer(){return {profile:{},sync:Promise.resolve({ok:false})}} export async function dropOldRows(){} export async function syncPlayer(){return false;}",
          loader: "js",
        }));
        b.onLoad({ filter: /src\/net\/letters\.js$/ }, () => ({
          contents:
            "export async function readLetters(){return {ok:true,list:[]};} export function isFor(){return false;}",
          loader: "js",
        }));
      },
    },
  ],
  stdin: {
    resolveDir: repo,
    loader: "jsx",
    contents: `
import {useState,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {MenuScreen,GameShell} from './src/ui/screens.jsx';
import {TsumeScreen} from './src/ui/tsume.jsx';
import {loadProfile,dayKey} from './src/game/profile.js';
import {useCollection} from './src/skins/store.js';
import {dailyTsume} from './src/game/tsume-daily.js';
import {TSUME_QUESTIONS} from './src/game/tsume.js';
if(!localStorage.getItem('tottery.account.v1'))localStorage.setItem('tottery.account.v1',JSON.stringify({...loadProfile(),id:'tsume-local-check',name:'確認プレイヤー',bonusDay:dayKey()}));
const first=Date.parse('2026-09-08T06:00:00+09:00');
const days=Array.from({length:365},(_,i)=>first+i*86400000);
function App(){
 const [page,setPage]=useState('menu'),[rules,setRules]=useState(false),[clock,setClock]=useState({at:first,base:Date.now()});
 const now=useCallback(()=>clock.at+Date.now()-clock.base,[clock]);
 const collection=useCollection();
 const home=()=>setPage('menu');
 return <><aside className="qa-toolbar"><label>検証する問題 <select aria-label="検証する問題" value={dailyTsume(clock.at).questionId} onChange={e=>setClock({at:days.find(at=>dailyTsume(at).questionId===Number(e.target.value)),base:Date.now()})}>{TSUME_QUESTIONS.map(q=><option key={q.id} value={q.id}>{q.id} {q.title}</option>)}</select></label><button onClick={()=>setClock({at:dailyTsume(now()).nextDay-1000,base:Date.now()})}>朝5時の1秒前へ</button><output aria-label="検証用の所持数">エーテル {collection.ether} / チケット {collection.tickets}</output></aside><GameShell showRules={rules} setShowRules={setRules} onHome={home} onBack={page==='tsume'?home:undefined}>{page==='menu'?<MenuScreen now={now} onTsume={()=>setPage('tsume')} onPlay={()=>{}} onTutorial={()=>{}} onMissions={()=>{}} onBattlePass={()=>{}} onSkins={()=>{}} onLetters={()=>{}} onRanking={()=>{}}/>:<TsumeScreen onBack={home} now={now}/>}</GameShell></>;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
  },
});
const template = fs.readFileSync("index.template.html", "utf8");
const html = template
  .replace("__BUNDLE__", () => result.outputFiles[0].text)
  .replace(
    "</head>",
    "<style>.qa-toolbar{height:92px;padding:5px 8px;box-sizing:border-box;font:12px system-ui;color:#eee;display:flex;flex-direction:column;gap:4px}.qa-toolbar select{max-width:250px;font-size:12px}.tottery-root:has(.tsume-screen){height:calc(100dvh - 92px)}</style></head>",
  );
http
  .createServer((req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
  })
  .listen(port, "127.0.0.1", () => console.log("http://127.0.0.1:" + port));
