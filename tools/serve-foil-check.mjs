/** Local-only, deterministic UI check for actual gacha / crafting / equipped foil components. */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";

const repo = process.cwd();
const result = await build({
  bundle: true, jsx: "automatic", write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  stdin: { resolveDir: repo, loader: "jsx", contents: `
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SkinsScreen} from './src/ui/skins.jsx';
import {CardFace,Piece} from './src/ui/cards.jsx';
import {SeatsProvider} from './src/ui/names.jsx';
import {useCollection,updateCollection} from './src/skins/store.js';
import {normalize} from './src/skins/collection.js';
import {POOL,FOIL_SKINS,foilId} from './src/skins/catalog.js';
import styles from './src/styles.css';
import skinStyles from './src/skins/styles.css';
function App(){
 const state=useCollection(); const [mode,setMode]=useState('skins'); const [forced,setForced]=useState(true);
 async function seed(all){await updateCollection(()=>normalize({ether:10000,motion:'full',owned:all?Object.fromEntries([...POOL,...FOIL_SKINS].map(s=>[s.id,3])):{'elf-male':2},equipped:all?{'3':foilId('zombie-female'),'6':foilId('elf-male')}:{}}));}
 function outcome(value){window.__foilFixture.foil=value;window.__foilFixture.n=0;setForced(value);}
 const piece={id:'sample',rank:'3',suit:'heart',owner:1,row:0,col:0,alive:true,isKing:false,revealed:false};
 return <div className="tottery-root"><style>{styles+skinStyles}</style><style>{'.foil-fixture-tools{position:relative;z-index:1;padding:12px;background:#101a2a;border-bottom:1px solid #bca16b;color:#eee;font:12px/1.6 system-ui}.foil-fixture-tools button{margin:4px;padding:7px 10px;background:#24334c;color:#eee;border:1px solid #8c7b56;border-radius:4px}.foil-fixture-tools button[aria-pressed=true]{color:#f4d88f;border-color:#f4d88f}.foil-fixture-tools output{display:block;overflow-wrap:anywhere}.foil-check-board{padding:25px;display:flex;gap:35px;flex-wrap:wrap}.foil-check-board section{display:flex;gap:18px;align-items:center}.foil-check-grid{display:grid;grid-template-columns:repeat(9,50px);gap:5px;padding:20px}.foil-check-grid>div{display:flex;justify-content:center;align-items:center}'}</style>
 <header className="foil-fixture-tools"><b>ローカル確認専用：本番の抽選・プロフィールは変更しません</b><nav>
 <button onClick={()=>setMode('skins')}>ガチャ・錬成画面</button><button onClick={()=>setMode('board')}>盤面の表示</button>
 <button onClick={()=>seed(false)}>通常版だけの所持へ</button><button onClick={()=>seed(true)}>全通常・フォイル3枚ずつ</button>
 <button aria-pressed={forced} onClick={()=>outcome(true)}>次の獲得をフォイル判定</button><button aria-pressed={!forced} onClick={()=>outcome(false)}>次の獲得を通常判定</button></nav>
 <output>foil={String(forced)} / ether={state.ether} / equipped={JSON.stringify(state.equipped)} / lastCraft={JSON.stringify(state.lastCraft)} / pending={JSON.stringify(state.pending)} / owned={JSON.stringify(state.owned)}</output></header>
 <SeatsProvider value={{names:['自分','相手'],skins:[{'3':foilId('zombie-female'),'6':foilId('elf-male')},{'3':foilId('zombie-female')}]}}>
 {mode==='skins'?<SkinsScreen onBack={()=>{}} onBattlePass={()=>{}}/>:<>
 <div className="foil-check-board"><section aria-label="自分のフォイル"><span>自分</span><Piece piece={{...piece,owner:0}} viewer={0} size="lg"/></section><section aria-label="相手の伏せ駒"><span>相手・非公開</span><Piece piece={piece} viewer={0} size="lg"/></section><section aria-label="相手の公開フォイル"><span>相手・公開後</span><Piece piece={{...piece,revealed:true}} viewer={0} size="lg"/></section></div>
 <p style={{padding:'0 20px'}}>9×9の表示負荷：自分の表駒と相手の裏駒。裏面にはフォイル演出を出しません。</p>
 <div className="foil-check-grid">{Array.from({length:81},(_,i)=>{const s=FOIL_SKINS[i%FOIL_SKINS.length];return i%2?<Piece key={i} piece={{...piece,id:'hidden'+i}} viewer={0} size="md"/>:<CardFace key={i} rank={s.rank} suit="spade" skinId={s.id} size="md"/>;})}</div>
 </>}
 </SeatsProvider></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
` },
  plugins: [{name:'foil-fixture-random',setup(builder){
    builder.onLoad({filter:/src\/skins\/collection\.js$/},()=>{
      let code=fs.readFileSync(path.join(repo,'src/skins/collection.js'),'utf8');
      const replacements=[
        ['export function pull(state, amount, random = Math.random)','export function pull(state, amount, random = window.__foilFixture.gachaRandom)'],
        ['export function craft(state, id, random = Math.random)','export function craft(state, id, random = window.__foilFixture.craftRandom)'],
      ];
      for(const [from,to] of replacements){if(!code.includes(from))throw Error('Fixture signature changed: '+from);code=code.replace(from,to);}
      return {contents:code,loader:'js',resolveDir:path.join(repo,'src/skins')};
    });
  }}],
});
if(process.argv.includes('--build-only')){console.log('Foil UI fixture compiled:',result.outputFiles[0].contents.length,'bytes');process.exit(0);}
const root=fs.mkdtempSync(path.join(os.tmpdir(),'tottery-foil-check-'));
const bootstrap=`
const memory=new Map();
Object.defineProperty(window,'localStorage',{value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),clear:()=>memory.clear()}});
localStorage.setItem('tottery.skins.v1',JSON.stringify({ether:10000,owned:{'elf-male':2},motion:'full'}));
localStorage.setItem('tottery.audio.v1',JSON.stringify({muted:true}));
window.__foilFixture={foil:true,n:0,gachaRandom(){return (window.__foilFixture.n++%2===0)?.2:window.__foilFixture.foil?.005:.5;},craftRandom(){return window.__foilFixture.foil?.005:.5;}};
const localFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);return url.origin===location.origin?localFetch(input,init):Promise.resolve(new Response('{}',{headers:{'Content-Type':'application/json'}}));};
history.replaceState(null,'',location.pathname+'?test=1');
`;
fs.writeFileSync(path.join(root,'index.html'),`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>フォイル実装確認</title><body style="margin:0"><div id="root"></div><script>${bootstrap}</script><script>${result.outputFiles[0].text}</script></body></html>`);
fs.symlinkSync(path.join(repo,'assets/skins'),path.join(root,'skins'));
const types={'.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.json':'application/json','.mp4':'video/mp4'};
const server=http.createServer((request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end('not found');return;}response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(data);});
});
server.listen(4218,'127.0.0.1',()=>console.log('Foil check ready: http://127.0.0.1:4218'));
