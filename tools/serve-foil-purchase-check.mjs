/** Isolated UI + real SQLite wallet fixture. No production auth or payments. */
import { build } from "esbuild";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { Wallet } from "../src/server/wallet.js";
const root = process.cwd();
const db = new DatabaseSync(":memory:");
const wallet = new Wallet((q, ...args) => db.prepare(q).all(...args));
const uid = "local-foil-review";
wallet.apply(uid, "fixture-credit", { gemsPaid: 10000 }, "fixture", null, Date.now());
const result = await build({
  bundle: true, write: false, jsx: "automatic", format: "iife",
  loader: { ".css": "text", ".png": "dataurl", ".webp": "dataurl" },
  define: { __AUDIO_FILES__: "{}" },
  plugins: [{ name: "isolated-identity", setup(b) {
    b.onResolve({filter:/^\.\/auth\.js$/}, a => a.importer.endsWith('/net/wallet.js') ? {path:'auth',namespace:'fixture'} : null);
    b.onResolve({filter:/^\.\/season\.js$/}, a => a.importer.endsWith('/net/wallet.js') ? {path:'season',namespace:'fixture'} : null);
    b.onLoad({filter:/.*/,namespace:'fixture'}, a => ({contents:a.path==='auth'
      ? 'export async function ensureAuth(){return {uid:"local-foil-review",idToken:"fixture"}}'
      : 'export function seasonApiBase(){return location.origin}',loader:'js'}));
  }}],
  stdin: { resolveDir: root, loader: "jsx", contents: `
import {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {FoilOfferSheet} from './src/ui/foil-offer.jsx';
import {SkinsScreen} from './src/ui/skins.jsx';
import {FoilArtwork} from './src/ui/foil-artwork.jsx';
import {CardFace} from './src/ui/cards.jsx';
import {byId,ALL_SKINS} from './src/skins/catalog.js';
import {foilOffers,skinVisibleInCollection} from './src/skins/foil-shop.js';
import {normalize} from './src/skins/collection.js';
import {useCollection,updateCollection} from './src/skins/store.js';
import {buyFoil,syncWallet} from './src/net/wallet.js';
import styles from './src/styles.css'; import skinStyles from './src/skins/styles.css';
const required=ALL_SKINS.filter(s=>!s.secret).map(s=>s.id);
function App(){
 const c=useCollection(); const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[native,setNative]=useState(false);
 const eligible=skinVisibleInCollection(c,byId('genie-magician:foil'));
 async function seed(complete){await updateCollection(()=>normalize({owned:Object.fromEntries((complete?required:required.slice(1)).map(id=>[id,1])),motion:'full'}));await syncWallet();setMessage(complete?'全32種類を所持':'通常Aを除く31種類を所持');}
 async function purchase(o){setBusy(true);try{await buyFoil(o.product.id,o.skins);setMessage('購入済み・受け取り完了');return true;}catch(e){setMessage(e.message);return false;}finally{setBusy(false);}}
 if(native)return <div className="tottery-root"><style>{styles+skinStyles}</style><SkinsScreen onBack={()=>setNative(false)}/></div>;
 return <div className="tottery-root"><style>{styles+skinStyles}</style><main style={{maxWidth:740,margin:'auto',padding:'24px 16px'}}>
 <p className="skins-eyebrow">A FOIL · REVIEW</p><h1>Aフォイルの確認</h1>
 <p>この画面の購入は仮データです。本番の残高には影響しません。</p>
 <div className="setup-actions"><button className="btn" onClick={()=>seed(false)}>31種類の例</button><button className="btn" onClick={()=>seed(true)}>32種類の例</button><button className="btn" onClick={()=>setShow(true)}>購入案内を開く</button></div>
 <button className="btn" onClick={()=>setNative(true)}>ゲームの所持画面へ</button>
 <p role="status">{message} · Aフォイル {c.owned['genie-magician:foil']||0}枚 · 有償ジェム {c.gemsPaid}</p>
 <p>シークレット表示: {eligible?'解放':'非表示'}</p>
 {eligible&&<div style={{display:'flex',gap:30,alignItems:'center',flexWrap:'wrap'}}><FoilArtwork skin={byId('genie-magician:foil')} style={{width:260,maxWidth:'100%'}}/><CardFace rank="A" suit="spade" skinId="genie-magician:foil"/></div>}
 {show&&foilOffers(c).length>0&&<FoilOfferSheet offers={foilOffers(c)} gemsPaid={c.gemsPaid} working={busy} message={message} onBuy={purchase} onClose={()=>setShow(false)}/>}
 </main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
`},
});
const script = result.outputFiles[0].contents;
const types={'.webp':'image/webp','.png':'image/png','.json':'application/json'};
createServer(async(req,res)=>{
  const path=new URL(req.url,'http://local').pathname;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy', "connect-src 'self';");
  if(path.startsWith('/api/wallet/')){
    let raw=''; for await(const chunk of req)raw+=chunk;
    try{
      const body=JSON.parse(raw||'{}');const op=path.split('/').at(-1);
      db.exec('BEGIN');let data;
      if(op==='summary')data=wallet.summary(uid);
      else if(op==='collection')data=wallet.syncCollection(uid,body.ownedIds,Date.now());
      else if(op==='foil')data=wallet.buyFoil(uid,body.product,body.skins,Date.now());
      else throw Error('This fixture accepts only collection, summary and foil.');
      db.exec('COMMIT');res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(data));
    }catch(e){try{db.exec('ROLLBACK')}catch{}res.statusCode=400;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({error:e.message}));}
  }
  if(path==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(script);}
  if(path==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aフォイル購入確認</title><div id="root"></div><script src="/app.js"></script>');}
  if(path.startsWith('/skins/')){
    const file=resolve(root,'assets',path.slice(1));
    if(file.startsWith(resolve(root,'assets/skins')+'/'))try{res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');return res.end(await readFile(file));}catch{}
  }
  res.statusCode=404;res.end();
}).listen(4460,'127.0.0.1',()=>console.log('A foil purchase review: http://127.0.0.1:4460/'));
