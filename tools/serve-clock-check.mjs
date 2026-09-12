// Disposable local fixture; it does not contact the public game or Firebase.
import { build } from "esbuild";
import http from "node:http";
import fs from "node:fs";
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
          contents: `export async function publishPlayer(){};export async function registerPlayer(){return {profile:{},sync:Promise.resolve({ok:false})}};export async function dropOldRows(){};export async function syncPlayer(){return false;}`,
        }));
        b.onLoad({ filter: /src\/ui\/game\.jsx$/ }, () => {
          let s = fs.readFileSync("src/ui/game.jsx", "utf8");
          s = s.replace(
            "(0, useState)(initialState)",
            "(0, useState)(fixtureState)",
          );
          s += `\nfunction fixtureState(){const s=initialState();const specs=[['A',0,6,4,true],['6',0,7,3,false],['8',0,7,5,false],['A',1,1,4,false],['4',1,1,3,true],['9',1,1,5,false],['6',1,3,7,false]];const pieces={};const board=Array.from({length:9},()=>Array(9).fill(null));specs.forEach(([rank,owner,row,col,isKing],i)=>{const p={id:'fixture'+i,rank,suit:'spade',owner,row,col,isKing,alive:true,revealed:false,history:[]};pieces[p.id]=p;board[row][col]=p;if(isKing)s.players[owner].kingId=p.id;});return {...s,boardSize:9,board,pieces,phase:'play',ruleVersion:2,clockExtensionUses:[Number(new URLSearchParams(location.search).get('used')||0),0],clocks:[40000,300000],currentTurn:0,setupMode:'simultaneous',interstitial:null};}`;
          return { loader: "jsx", contents: s };
        });
      },
    },
  ],
  stdin: {
    resolveDir: process.cwd(),
    loader: "jsx",
    contents: `
import {createRoot} from 'react-dom/client';import {GameCore} from './src/ui/game.jsx';import {SeatsProvider} from './src/ui/names.jsx';
function App(){return <><nav style={{background:'#10203a',padding:8,display:'flex',gap:8,flexWrap:'wrap'}}>{[[0,'残り6回'],[3,'残り3回'],[5,'残り1回'],[6,'追加終了']].map(([used,label])=><a style={{color:'#f0d98a',fontSize:12}} href={'/?test=1&used='+used} key={used}>{label}</a>)}</nav><SeatsProvider value={{names:['あなた','CPU'],skins:[{},{}],backs:['moon-crest','moon-crest'],frames:['gold-laurel',null]}}><GameCore cpu boardSize={9} onExit={()=>{}}/></SeatsProvider></>};createRoot(document.getElementById('root')).render(<App/>);`,
  },
});
const html = `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>持ち時間・追加回数の確認</title><style>body{margin:0;background:#081120}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  })
  .listen(4257, "127.0.0.1", () =>
    console.log("Local fixture http://127.0.0.1:4257/?test=1"),
  );
