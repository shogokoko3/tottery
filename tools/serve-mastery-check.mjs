// 終局画面の熟練度メーターの見え方を確かめる小さなページ。通信はしない。
//   node tools/serve-mastery-check.mjs  →  http://127.0.0.1:4264
import { build } from "esbuild";
import http from "node:http";

const result = await build({
  bundle: true,
  jsx: "automatic",
  write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  stdin: {
    resolveDir: process.cwd(),
    loader: "jsx",
    contents: `
import {createRoot} from 'react-dom/client';
import {MasteryGains} from './src/ui/mastery.jsx';
import {masteryProgress} from './src/game/profile.js';
import styles from './src/styles.css';
import frames from './src/ui/title-frame.css';

// 実際の recordMastery が返す形に合わせて作る
const gain = (rank, before, added) => ({
  rank, added, before, after: before + added,
  stepBefore: masteryProgress(before).step,
  progress: masteryProgress(before + added),
});

const 場面 = [
  ['ふつうの1局(段は上がらない)', [gain('J',41,3), gain('2',12,2), gain('K',7,1)], []],
  ['段が上がった', [gain('Q',78,3), gain('10',29,2)], []],
  ['称号が届いた', [gain('J',79,3), gain('4',5,3)], [{id:'mastery-J',name:'縦横無尽'}]],
  ['極みに届いた', [gain('K',499,3)], []],
  ['1枚だけ指した', [gain('A',0,1)], []],
];

function App(){
  return <div className="tottery-root" style={{padding:'20px 16px 60px',background:'#081120',minHeight:'100vh'}}>
    <style>{styles+frames}</style>
    <h1 style={{color:'#dbc698',fontSize:20,letterSpacing:'.14em'}}>終局画面の熟練度メーター</h1>
    <p style={{color:'#93a1b6',fontSize:12,lineHeight:1.8}}>
      プレイヤーレベルのゲージとは別の欄。その局で使った札だけを並べる。
    </p>
    <div style={{maxWidth:470,margin:'0 auto'}}>
      {場面.map(([名,gains,titles])=>
        <section key={名} style={{marginTop:26}}>
          <h2 style={{color:'#c7ac72',fontSize:12,letterSpacing:'.14em'}}>{名}</h2>
          <MasteryGains gains={gains} titles={titles}/>
        </section>)}
    </div>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
  },
});

if (process.argv.includes("--check")) {
  console.log("熟練度メーターの組み立て: OK");
  process.exit(0);
}
const bootstrap = `const memory=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}});window.fetch=async()=>new Response('{}',{headers:{'Content-Type':'application/json'}});localStorage.setItem('tottery.skins.v1',JSON.stringify({motion:'off',owned:{}}));`;
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>トッタリー — 熟練度メーター</title><body style="margin:0"><div id="root"></div><script>${bootstrap}</script><script>${result.outputFiles[0].text}</script></body></html>`;
http
  .createServer((req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
  })
  .listen(4264, "127.0.0.1", () =>
    console.log("Mastery meter: http://127.0.0.1:4264"),
  );
