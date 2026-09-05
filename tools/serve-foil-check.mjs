/** Local-only, deterministic UI check for actual gacha / crafting / equipped foil components. */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";

const repo = process.cwd();
const port = Number(process.env.FOIL_CHECK_PORT || 4218);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid FOIL_CHECK_PORT");
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
import {normalize,grantSkin} from './src/skins/collection.js';
import {POOL,FOIL_SKINS,foilId} from './src/skins/catalog.js';
import styles from './src/styles.css';
import skinStyles from './src/skins/styles.css';
function App(){
 const state=useCollection(); const [mode,setMode]=useState('skins'); const [forced,setForced]=useState(true); const [sample,setSample]=useState('SSR'); const [backCount,setBackCount]=useState(0);
 async function seed(all){await updateCollection(()=>normalize({ether:10000,motion:'full',owned:all?Object.fromEntries([...POOL,...FOIL_SKINS].map(s=>[s.id,3])):{'elf-male':2},equipped:all?{'3':foilId('zombie-female'),'6':foilId('elf-male')}:{}}));}
 async function milestoneSeed(kind){
  const value=kind==='legacy'?{owned:{'elf-male':100,'pirate-male':99}}:
    kind==='near'?{owned:{'elf-male':1},acquired:{'elf-male':99},ether:80}:
    kind==='claimed'?{owned:{'elf-male':1,'elf-male:foil':1},acquired:{'elf-male':100},foilMilestones:{'elf-male':true}}:
    {owned:Object.fromEntries(POOL.map(s=>[s.id,1])),acquired:Object.fromEntries(POOL.map(s=>[s.id,100]))};
  await updateCollection(()=>normalize({ether:0,motion:'full',...value}));setMode('skins');
 }
 async function receiptSeed(){await updateCollection(()=>normalize({ether:10000,motion:'full',owned:{'dragon-knight:foil':1},pending:{results:[{id:'dragon-knight:foil',isNew:true}],at:Date.now()}}));setMode('skins');}
 function scenario(value){window.__foilFixture.sample=value;window.__foilFixture.n=0;setSample(value);}
 function outcome(value){window.__foilFixture.foil=value;window.__foilFixture.n=0;setForced(value);}
 function returnHome(){setBackCount(n=>n+1);setMode('home');window.scrollTo(0,0);}
 const piece={id:'sample',rank:'3',suit:'heart',owner:1,row:0,col:0,alive:true,isKing:false,revealed:false};
 return <div className="tottery-root"><style>{styles+skinStyles}</style><style>{'.foil-fixture-tools{position:relative;z-index:1;min-width:0;padding:6px 12px;background:#101a2a;border-bottom:1px solid #bca16b;color:#eee;font:12px/1.6 system-ui}.foil-fixture-tools summary{cursor:pointer;padding:4px 0;font-weight:700}.foil-fixture-tools summary small{font-weight:400;margin-left:8px;color:#d3c7a6}.foil-fixture-tools button,.foil-fixture-tools select{margin:3px;padding:8px 10px;min-height:38px;background:#24334c;color:#eee;border:1px solid #8c7b56;border-radius:4px;font:inherit}.foil-fixture-tools select{max-width:100%;min-width:0}.foil-fixture-options{display:flex;flex-wrap:wrap;gap:8px}.foil-fixture-options label{display:flex;align-items:center;min-width:0}.foil-fixture-tools fieldset{min-width:0;margin:8px 0;padding:5px;border:1px solid #6c634d}.foil-fixture-tools output{display:block;overflow-wrap:anywhere;word-break:break-word}.foil-fixture-current{font-size:10px;color:#bcbcab}.foil-fixture-note{margin:4px 0 8px}.foil-fixture-data output{max-height:180px;overflow:auto}.foil-fixture-home{max-width:640px;margin:0 auto;padding:32px 20px;color:#eee}.foil-check-board{padding:25px;display:flex;gap:35px;flex-wrap:wrap}.foil-check-board section{display:flex;gap:18px;align-items:center}.foil-check-grid{display:grid;grid-template-columns:repeat(9,50px);gap:5px;padding:20px}.foil-check-grid>div{display:flex;justify-content:center;align-items:center}'}</style>
 <header className="foil-fixture-tools">
 <details><summary>検証設定 <small>{sample} / {forced?'フォイル':'通常'}</small></summary>
 <p className="foil-fixture-note">この画面だけの仮データです。設定を閉じてゲームを操作できます。</p>
 <div className="foil-fixture-options"><label>抽選例 <select aria-label="抽選例" value={sample} onChange={e=>scenario(e.target.value)}><option value="SSR">SSR昇格</option><option value="SR">SR昇格</option><option value="R">R</option><option value="mixed">10連・通常とフォイル混在</option></select></label><label>加工 <select aria-label="加工" value={forced?'foil':'normal'} onChange={e=>outcome(e.target.value==='foil')}><option value="foil">フォイル</option><option value="normal">通常</option></select></label></div>
 <nav aria-label="検証画面"><button onClick={()=>setMode('skins')}>ガチャ・錬成</button><button onClick={()=>setMode('board')}>盤面</button></nav>
 <fieldset><legend>所持データ</legend><button onClick={()=>seed(false)}>通常版だけ</button><button onClick={()=>seed(true)}>全種3枚ずつ</button><button onClick={receiptSeed}>保存済み結果</button></fieldset>
 <fieldset><legend>通算100回報酬</legend><button onClick={()=>milestoneSeed('legacy')}>旧所持100枚・99枚</button><button onClick={()=>milestoneSeed('near')}>錬成直前99回</button><button onClick={()=>milestoneSeed('all')}>全15種達成</button><button onClick={()=>milestoneSeed('claimed')}>受取済み</button><button onClick={()=>updateCollection(s=>grantSkin(s,'pirate-male'))}>海賊を1枚追加</button></fieldset>
 <details className="foil-fixture-data"><summary>保存状態を見る</summary><output>ether={state.ether} / equipped={JSON.stringify(state.equipped)} / lastCraft={JSON.stringify(state.lastCraft)} / pending={JSON.stringify(state.pending)} / owned={JSON.stringify(state.owned)} / acquired={JSON.stringify(state.acquired)} / foilMilestones={JSON.stringify(state.foilMilestones)}</output></details>
 </details><output className="foil-fixture-current" data-testid="foil-fixture-status">表示: {mode} · ホームへ戻った回数: {backCount}</output></header>
 <SeatsProvider value={{names:['自分','相手'],skins:[{'3':foilId('zombie-female'),'6':foilId('elf-male')},{'3':foilId('zombie-female')}]}}>
 {mode==='skins'?<SkinsScreen onBack={returnHome} onBattlePass={()=>{}}/>:mode==='home'?<main className="foil-fixture-home" data-testid="foil-fixture-home" data-back-count={backCount}><h1>ホーム</h1><p role="status">スキン画面からホームに戻りました。</p><button className="skin-btn skin-btn-gold" onClick={()=>setMode('skins')}>ガチャ・錬成を開く</button></main>:<>
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
window.__foilFixture={foil:true,sample:'SSR',n:0,gachaRandom(){const f=window.__foilFixture;const step=f.n++;const card=Math.floor(step/2);if(step%2===0)return f.sample==='mixed'?[.972,.2,.83,.45,.78,.99,.96,.1,.978,.995][card%10]:f.sample==='SSR'?.972:f.sample==='SR'?.85:.2;return f.sample==='mixed'?(card%3===0?.005:.5):f.foil?.005:.5;},craftRandom(){return window.__foilFixture.foil?.005:.5;}};
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
server.listen(port,'127.0.0.1',()=>console.log('Foil check ready: http://127.0.0.1:'+port));
