// Local-only fixture UI. Builds the actual GameCore with its initializer replaced
// by a selected committed position; no fixture entry is included in dist/.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { build } from "esbuild";
const root = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-ace-check-"));
const repo = process.cwd();
const options = {
  bundle: true,
  jsx: "automatic",
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  write: false,
};
const result = await build({
  ...options,
  stdin: {
    resolveDir: repo,
    loader: "jsx",
    contents: `
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameCore } from './src/ui/game.jsx';
import { SeatsProvider } from './src/ui/names.jsx';
import { SkinsScreen } from './src/ui/skins.jsx';
import { CardFace, Piece } from './src/ui/cards.jsx';
import { claimSpecial, equip } from './src/skins/collection.js';
import { useCollection, updateCollection } from './src/skins/store.js';
import { armAudioUnlock } from './src/audio/index.js';
import styles from './src/styles.css'; import skins from './src/skins/styles.css';
armAudioUnlock();
const magician = 'genie-magician';
function CardChecks(){
 const piece=(owner,extra={})=>({id:'fixture-A-'+owner,rank:'A',suit:'spade',alive:true,owner,...extra});
 return <section className="tottery-root" aria-label="Aの盤面カード確認" style={{minHeight:0,padding:16,border:'1px solid #92784d',marginBottom:20}}>
 <h2 style={{marginTop:0}}>Aの盤面カード・表示確認</h2>
 {[
 ['lg','大きなカード 78×104px'],['md','5×5盤 50×67px'],['xs','9×9盤 26×35px'],
 ].map(([size,label])=><div key={size} style={{marginBottom:18}}>
 <h3>{label}</h3><div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}>
 {[
 ['spade','スペード'],['heart','ハート'],['diamond','ダイヤ'],['club','クラブ'],
 ].map(([suit,name])=><div key={suit} style={{display:'flex',flexDirection:'column',gap:6,alignItems:'center'}}>
 <CardFace rank="A" suit={suit} size={size} skinId={magician}/><span style={{fontSize:11}}>{name}</span>
 </div>)}
 </div></div>)}
 <h3>所有者・伏せ札・公開・王の表示</h3>
 <SeatsProvider value={{skins:[{A:magician},{A:magician}]}}>
 <div style={{display:'flex',gap:20,flexWrap:'wrap',alignItems:'end',paddingTop:12}}>
 {[
 ['自分のA',piece(0)],['相手の伏せ札',piece(1,{isKing:true})],
 ['相手の公開A',piece(1,{revealed:true})],['自分の王A',piece(0,{isKing:true})],
 ].map(([label,card])=><div key={label} style={{display:'flex',flexDirection:'column',gap:12,alignItems:'center'}}>
 <Piece piece={card} viewer={0} size="md"/><span style={{fontSize:11}}>{label}</span>
 </div>)}
 </div></SeatsProvider>
 </section>;
}
function App(){
 const [mode,setMode]=useState(null),[key,setKey]=useState(0);
 const [message,setMessage]=useState('');
 const collection=useCollection();
 const go=async(label,fixture)=>{await updateCollection(s=>({...s,motion:fixture.motion||'full'}));setMode({label,...fixture});setKey(k=>k+1);};
 const equipForCheck=async()=>{try{await updateCollection(s=>equip(claimSpecial(s,magician),magician));setMessage('確認用Aを装備しました。');}catch(e){setMessage(e.message);}};
 return <><style>{styles+skins}</style><nav style={{padding:12,display:'flex',gap:8,flexWrap:'wrap'}}>
 <button onClick={()=>setMode(null)}>スキン画面</button>
 <button onClick={equipForCheck}>確認用Aを装備</button>
 {[
 ['5×5 入れ替え',{size:5,count:0}],['5×5 撃破',{size:5,count:1}],
 ['9×9 6体',{size:9,count:6}],['9×9 10体',{size:9,count:10}],
 ['王A 2回',{size:9,count:0,king:true}],['包囲から王位継承',{size:9,count:6,succession:true}],
 ['短縮10体',{size:9,count:10,motion:'short'}],['演出なし',{size:9,count:10,motion:'off'}],
 ['相手視点',{size:9,count:10,viewer:1}],['味方敵混在',{size:5,count:0,mixed:true}],
 ].map(([label,fixture])=><button key={label} onClick={()=>go(label,fixture)}>{label}</button>)}
 </nav><p style={{textAlign:'center',color:'#f2ead9'}}>ローカル実機確認 · {mode?.label || 'Aの盤面カード・装備'}</p>
 <p role="status" style={{textAlign:'center',color:'#f2ead9'}}>A所持枚数: {collection.owned[magician]||0} / equipped.A: {collection.equipped.A||'未装備'} {message}</p>
 {mode?<SeatsProvider value={{skins:[collection.equipped,mode.succession?{'2':'zombie-male'}:{}]}}><GameCore key={key} fixture={mode} onExit={()=>setMode(null)} /></SeatsProvider>:<main style={{maxWidth:740,margin:'auto',padding:'0 10px',boxSizing:'border-box'}}><CardChecks/><SkinsScreen /></main>}</>;
}
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
`,
  },
  plugins: [
    {
      name: "initial-position",
      setup(b) {
        b.onLoad({ filter: /src\/ui\/game\.jsx$/ }, () => ({
          loader: "jsx",
          resolveDir: path.join(repo, "src/ui"),
          contents:
            fs
              .readFileSync("src/ui/game.jsx", "utf8")
              .replace(
                "export function GameCore({",
                "export function GameCore({fixture,",
              )
              .replace(
                "(0, useState)(initialState)",
                "(0, useState)(() => acePosition(fixture))",
              )
              .replaceAll(
                "network ? p : cpu ? 0 : null",
                "fixture.viewer ?? null",
              )
              .replace(
                "P = network ? p : cpu ? 0 : (aceMagic.viewer ?? a.currentTurn)",
                "P = fixture.viewer ?? (aceMagic.viewer ?? a.currentTurn)",
              ) +
            '\nimport {acePosition} from "../../tools/fixtures/ace-position.mjs";',
        }));
      },
    },
  ],
});
if (process.argv.includes("--build-only")) {
  console.log(
    `A fixture bundle OK (${result.outputFiles[0].contents.length} bytes)`,
  );
  fs.rmSync(root, { recursive: true, force: true });
  process.exit(0);
}
fs.writeFileSync(
  path.join(root, "index.html"),
  `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aマジシャン・実機確認</title><body style="margin:0;background:#071120"><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`,
);
fs.symlinkSync(path.join(repo, "assets/skins"), path.join(root, "skins"));
fs.symlinkSync(path.join(repo, "assets/audio"), path.join(root, "audio"));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
};
http
  .createServer((req, res) => {
    const name = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = path.resolve(
      root,
      "." + (name === "/" ? "/index.html" : name),
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile()) throw new Error();
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] || "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Accept-Ranges", "bytes");
      const match = /bytes=(\d+)-(\d*)/.exec(req.headers.range || "");
      if (match) {
        const start = Number(match[1]),
          end = match[2]
            ? Math.min(Number(match[2]), stat.size - 1)
            : stat.size - 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Content-Length": end - start + 1,
        });
        fs.createReadStream(file, { start, end }).pipe(res);
      } else {
        res.setHeader("Content-Length", stat.size);
        fs.createReadStream(file).pipe(res);
      }
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(4199, "127.0.0.1", () => console.log("http://127.0.0.1:4199"));
