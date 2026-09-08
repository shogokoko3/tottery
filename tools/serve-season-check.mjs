// Local, disposable UI fixture. It never contacts Firebase or the public game API.
import { build } from "esbuild";
import http from "node:http";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Ledger } from "../src/server/ledger.js";
import { seasonAt } from "../src/game/season.js";
const db = new DatabaseSync(":memory:"),
  ledger = new Ledger((q, ...p) => db.prepare(q).all(...p)),
  now = Date.now(),
  current = seasonAt(now);
for (let i = 0; i < 100; i++)
  ledger.record(
    {
      id: `fixture-${i}`,
      host: "fixture",
      guest: "opponent",
      winner: i < 80 ? 0 : 1,
      names: ["月夜の旅人", "星読み"],
      icons: [null, null],
    },
    now - 1000,
  );
for (const key of ["soldier", "general"])
  ledger.claim("fixture", `${current.id}:${key}`, now);
ledger.equip("fixture", "moon-crest", "gold-laurel", now);
const previous = seasonAt(current.start - 1);
for (let i = 0; i < 12; i++)
  ledger.record(
    {
      id: `past-${i}`,
      host: "fixture",
      guest: "opponent",
      winner: 0,
      names: ["月夜の旅人", "星読み"],
      icons: [null, null],
    },
    previous.end - 10000 + i,
  );
const result = await build({
  bundle: true,
  jsx: "automatic",
  write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  plugins: [
    {
      name: "fixture",
      setup(b) {
        b.onLoad({ filter: /src\/net\/auth\.js$/ }, () => ({
          loader: "js",
          contents: `export const API_KEY='',OPERATOR_UID='operator';export async function ensureAuth(){return {uid:'fixture',idToken:'fixture'}};export function myUid(){return 'fixture'};export function useOperatorSlot(){};export async function authedFetch(){throw Error('fixture: network blocked')}`,
        }));
        b.onLoad({ filter: /src\/net\/ranking\.js$/ }, () => ({
          loader: "js",
          contents: `export async function readRanks(){return {ok:true,list:[]}};export async function readWorldGames(){return 0};export async function publishRank(){}`,
        }));
        b.onLoad({ filter: /src\/net\/players\.js$/ }, () => ({
          loader: "js",
          contents: `export async function publishPlayer(){};export async function dropOldRows(){};export async function syncPlayer(){return false;}`,
        }));
        b.onLoad({ filter: /src\/ui\/game\.jsx$/ }, () => {
          let s = fs.readFileSync("src/ui/game.jsx", "utf8");
          s = s.replace(
            "(0, useState)(initialState)",
            "(0, useState)(fixtureState)",
          );
          s += `\nfunction fixtureState(){const s=initialState();const specs=[['A',0,6,4,true],['6',0,7,3,false],['8',0,7,5,false],['A',1,1,4,false],['4',1,1,3,true],['9',1,1,5,false],['6',1,3,7,false]];const pieces={};const board=Array.from({length:9},()=>Array(9).fill(null));specs.forEach(([rank,owner,row,col,isKing],i)=>{const p={id:'fixture'+i,rank,suit:'spade',owner,row,col,isKing,alive:true,revealed:false,history:[]};pieces[p.id]=p;board[row][col]=p;if(isKing)s.players[owner].kingId=p.id;});return {...s,boardSize:9,board,pieces,phase:'play',currentTurn:0,setupMode:'simultaneous',interstitial:null};}`;
          return { loader: "jsx", contents: s };
        });
      },
    },
  ],
  stdin: {
    resolveDir: process.cwd(),
    loader: "jsx",
    contents: `
import {useState} from 'react';import {createRoot} from 'react-dom/client';import {GameShell} from './src/ui/screens.jsx';import {RankingScreen} from './src/ui/ranking.jsx';import {AppearanceSettings} from './src/ui/season.jsx';import {GameCore} from './src/ui/game.jsx';import {SeatsProvider} from './src/ui/names.jsx';import {saveName,adoptUid} from './src/game/profile.js';import {useCollection} from './src/skins/store.js';
saveName('月夜の旅人');adoptUid('fixture');
function App(){const [page,setPage]=useState('rank'),c=useCollection();return <><nav style={{background:'#10203a',padding:8,display:'flex',gap:8}}>{[['rank','ランキング'],['notes','盤面'],['appearance','装飾']].map(([id,label])=><button onClick={()=>setPage(id)} key={id}>{label}</button>)}</nav><output style={{background:'#10203a',color:'#eee',display:'block',padding:4}}>テスト用・チケット {c.tickets}</output>{page==='notes'?<SeatsProvider value={{names:['あなた','CPU'],skins:[{},{}],backs:['moon-crest','moon-crest'],frames:['gold-laurel',null]}}><GameCore cpu boardSize={9} onExit={()=>setPage('rank')}/></SeatsProvider>:<GameShell>{page==='rank'?<RankingScreen onBack={()=>setPage('home')}/>:page==='appearance'?<AppearanceSettings/>:<button className="btn" onClick={()=>setPage('rank')}>ホームからランキングへ</button>}</GameShell>}</>};createRoot(document.getElementById('root')).render(<App/>);`,
  },
});
const html = `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>シーズン・推理メモ確認</title><style>body{margin:0;background:#081120}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`;
http
  .createServer(async (req, res) => {
    if (req.url.startsWith("/api/season/")) {
      try {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw || "{}"),
          op = req.url.split("/").at(-1);
        let data;
        if (op === "claim") data = ledger.claim("fixture", body.id, Date.now());
        else if (op === "equip")
          data = ledger.equip("fixture", body.back, body.frame, Date.now());
        else data = ledger.summary("fixture", Date.now());
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  })
  .listen(4256, "127.0.0.1", () =>
    console.log("Local fixture http://127.0.0.1:4256/?test=1"),
  );
