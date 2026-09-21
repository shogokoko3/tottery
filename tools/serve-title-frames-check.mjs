// Local design catalogue and actual online/account components. No live accounts.
import { build } from "esbuild";
import http from "node:http";

const result = await build({
  bundle: true,
  jsx: "automatic",
  write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  plugins: [
    {
      name: "local-title-preview",
      setup(b) {
        b.onLoad({ filter: /src\/net\/players\.js$/ }, () => ({
          loader: "js",
          contents: `export async function publishPlayer(){};export async function registerPlayer(){return {profile:{},sync:Promise.resolve({ok:false})}};export async function dropOldRows(){};export async function syncPlayer(){return false;}`,
        }));
      },
    },
  ],
  stdin: {
    resolveDir: process.cwd(),
    loader: "jsx",
    contents: `
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {TitleFrame} from './src/ui/title-frame.jsx';
import {TitlePickModal,AccountCard} from './src/ui/account.jsx';
import {ClockBar} from './src/ui/game.jsx';
import {MatchupBar} from './src/ui/dice.jsx';
import {SeatsProvider} from './src/ui/names.jsx';
import {TITLES} from './src/game/titles.js';
import {seasonTitle} from './src/game/season.js';
import {loadProfile} from './src/game/profile.js';
import styles from './src/styles.css';
import royal from './src/ui/royal-theme.css';
import frames from './src/ui/title-frame.css';
const season=['first','three','ten','king'].map(x=>seasonTitle('season:2026-09:'+x));
const all=[...TITLES,...season];
function seed(owned){
 localStorage.setItem('tottery.account.v1',JSON.stringify({id:'local-title-preview',name:'蒼月の旅人',title:owned?'gacha-freeze-10':'novice',titles:owned?all.map(t=>t.id):[],ratingVersion:2}));
}
seed(true);
function App(){
 const [page,setPage]=useState('gallery'),[picker,setPicker]=useState(false),[profile,setProfile]=useState(loadProfile),[foe,setFoe]=useState('foil-demon-k');
 const sections=[['布陣の証',TITLES.filter(t=>['fortress','twin-wings','heir-hunt','elimination','kamikaze','royal-road'].includes(t.id))],['召喚の軌跡',TITLES.filter(t=>t.family)],['煌めく英雄',TITLES.filter(t=>t.id.startsWith('foil-'))],['戦いの勲章',TITLES.filter(t=>!t.foil&&!t.family)],['月間の栄誉',season]];
 return <div className="tottery-root title-fixture"><style>{styles+royal+frames+\`
 body{margin:0;background:#081120}.title-fixture{padding:28px 18px 60px;min-height:100vh}.title-fixture main{max-width:1040px;margin:auto}.title-fixture header{padding:20px 0 26px;border-bottom:1px solid #ae905344}.title-fixture header small{color:#c7ac72;letter-spacing:.3em;font:10px system-ui}.title-fixture h1{font-size:28px;letter-spacing:.18em;margin:12px 0}.title-fixture header p{color:#b7bfd0;font-size:12px;line-height:1.8}.title-fixture nav{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}.title-fixture nav button,.title-fixture select{color:#eaddbe;border:1px solid #ac915866;border-radius:7px;background:#152237;padding:10px 14px}.title-fixture h2{font-size:15px;letter-spacing:.15em;margin:32px 0 20px;color:#dbc698}.title-fixture-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:14px}.title-fixture-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:124px;padding:18px 12px;background:radial-gradient(ellipse at 50% 0,#30406044,transparent 85%),#0c1728;border:1px solid #58667e44;border-radius:6px}.title-fixture-tile>small{color:#93a1b6;font-size:10px;margin-top:10px}.title-fixture-tile .title-frame{width:100%}.title-fixture-battle{max-width:470px;margin:24px auto}.title-fixture-hero{display:flex;justify-content:center;gap:24px;flex-wrap:wrap;margin:30px 0}.title-fixture-account{max-width:470px;margin:20px auto}.title-fixture label{font-size:12px;display:flex;flex-direction:column;gap:8px}.title-fixture select{max-width:100%;width:100%}\`}</style>
 <main><header><small>TOTTERY / TITLE COLLECTION</small><h1>その称号に、風格を。</h1><p>積み重ねた戦いも、めぐり逢った奇跡も。<br/>あなたの物語を、対戦相手の記憶に刻む。</p></header>
 <nav><button onClick={()=>setPage('gallery')}>フレーム一覧</button><button onClick={()=>setPage('battle')}>対戦表示</button><button onClick={()=>setPicker(true)}>称号を選ぶ</button><button onClick={()=>{seed(false);setProfile(loadProfile());setPicker(true);}}>未取得の表示</button><button onClick={()=>{seed(true);setProfile(loadProfile());setPage('account');}}>実プロフィール</button></nav>
 {page==='gallery'?<><div className="title-fixture-hero"><TitleFrame id="gacha-freeze-10" size="showcase"/><TitleFrame id="foil-demon-k" size="showcase"/></div>{sections.map(([name,titles])=><section key={name}><h2>{name}</h2><div className="title-fixture-grid">{titles.map(t=><article className="title-fixture-tile" key={t.id}><TitleFrame id={t.id}/><small>{t.family?'段階 '+t.tier:t.id.startsWith('season:')?'シーズンの栄誉':t.foil?'専用称号':'対戦・実績称号'}</small></article>)}</div></section>)}</>:
 page==='battle'?<section className="title-fixture-battle"><label>対戦相手の称号<select value={foe} onChange={e=>setFoe(e.target.value)}>{all.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label><h2>対戦開始</h2><SeatsProvider value={{names:['蒼月の旅人','紅蓮の騎士王'],titles:[profile.title,foe],icons:['',''],frames:[null,null]}}><MatchupBar viewer={0}/><h2>対戦中</h2><ClockBar clocks={[154000,187000]} currentTurn={0} viewer={0} ruleVersion={2} extensionUses={[1,2]}/></SeatsProvider><button className="btn" onClick={()=>setPicker(true)}>自分の称号を変更</button></section>:
 <section className="title-fixture-account"><AccountCard profile={profile} onEditTitle={()=>setPicker(true)} onEditName={()=>{}} onEditIcon={()=>{}}/></section>}
 {picker&&<TitlePickModal onClose={()=>setPicker(false)} onSaved={setProfile}/>}</main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
  },
});
if (process.argv.includes("--build-only")) {
  console.log("Title frame preview compiled");
  process.exit(0);
}
const bootstrap = `const memory=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}});window.fetch=async()=>new Response('{}',{headers:{'Content-Type':'application/json'}});localStorage.setItem('tottery.skins.v1',JSON.stringify({motion:'off',owned:{}}));`;
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>トッタリー — 称号フレーム</title><body><div id="root"></div><script>${bootstrap}</script><script>${result.outputFiles[0].text}</script></body></html>`;
http
  .createServer((req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
  })
  .listen(4263, "127.0.0.1", () =>
    console.log("Title frames: http://127.0.0.1:4263"),
  );
