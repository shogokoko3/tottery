/** Local-only UI fixture. All matchmaking/auth traffic is replaced with memory data. */
import { build } from "esbuild";
import fs from "node:fs";
import http from "node:http";
const out = await build({
  bundle: true,
  write: false,
  jsx: "automatic",
  loader: { ".css": "text", ".webp": "dataurl", ".png": "dataurl" },
  define: { __AUDIO_FILES__: "{}" },
  plugins: [
    {
      name: "local-network",
      setup(b) {
        b.onLoad({ filter: /src\/net\/firebase\.js$/ }, () => ({
          loader: "js",
          contents: `
 export const LOBBY_TTL=180000, DB_URL='local';
 const ok=data=>Promise.resolve({ok:true,data});
 export const readLobby=()=>ok(window.fixture.entries);
 export const readLobbyPath=()=>ok('me');
 export const writeLobby=(p,data)=>{window.fixture.calls.push(['lobby',p,data]);return ok(null)};
 export const readRoom=()=>ok({matchSize:window.fixture.roomSize,createdAt:1,seats:{host:'other',guest:'me'}});
 export const createRoom=(code,data)=>{window.fixture.calls.push(['create',data]);return ok(null)};
 export const updateRoom=(code,data)=>{window.fixture.calls.push(['ready',data]);return ok(null)};
 export const joinRoom=code=>{window.fixture.calls.push(['join',code]);return ok(null)};
 export const generateRoomCode=()=> 'TEST';
 ${[
   ...fs
     .readFileSync("src/net/firebase.js", "utf8")
     .matchAll(/export (?:async )?(?:function|const) (\w+)/g),
 ]
   .map((m) => m[1])
   .filter(
     (n) =>
       ![
         "LOBBY_TTL",
         "DB_URL",
         "readLobby",
         "readLobbyPath",
         "writeLobby",
         "readRoom",
         "createRoom",
         "updateRoom",
         "joinRoom",
         "generateRoomCode",
       ].includes(n),
   )
   .map((n) => `export const ${n}=(...args)=>ok(null);`)
   .join("\n")}
 `,
        }));
        b.onLoad({ filter: /src\/net\/auth\.js$/ }, () => ({
          loader: "js",
          contents:
            fs
              .readFileSync("src/net/auth.js", "utf8")
              .replace(
                /export async function ensureAuth\(/,
                "async function originalEnsureAuth(",
              )
              .replace(/export function myUid\(/, "function originalMyUid(") +
            `\nexport async function ensureAuth(){return {uid:'me'}}; export function myUid(){return 'me'};`,
        }));
      },
    },
  ],
  stdin: {
    resolveDir: process.cwd(),
    loader: "jsx",
    contents: `
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{RulesSelectScreen,RandomMatchScreen}from'./src/ui/screens.jsx';
import{loadOnlineSize,saveOnlineSize}from'./src/net/match-settings.js';
import css from './src/styles.css';
function App(){const[page,setPage]=useState('rules'),[size,setSize]=useState(loadOnlineSize),[kind,setKind]=useState('9');
function start(n){saveOnlineSize(n);setSize(n);window.fixture={roomSize:kind==='mismatch'?5:Number(kind),entries:{offer:{host:'other',createdAt:Date.now(),...(kind==='legacy'?{}:{matchSize:kind==='mismatch'?9:Number(kind)})}},calls:[]};setPage('search')}
return <div><style>{css}</style><label>待機相手<select value={kind} onChange={e=>setKind(e.target.value)}><option value="9">9×9</option><option value="5">5×5</option><option value="legacy">旧版</option><option value="mismatch">掲示と部屋が不一致</option></select></label>{page==='rules'?<RulesSelectScreen initialSize={loadOnlineSize()} onStart={start} onBack={()=>{}} backLabel="戻る"/>:page==='search'?<><RandomMatchScreen boardSize={size} onBack={()=>setPage('rules')} onRoomReady={()=>setPage('matched')}/><button onClick={()=>setPage('results')}>通信結果を見る</button></>:<><p>{page==='matched'?'マッチ成立':'待機結果'}</p><pre>{JSON.stringify(window.fixture.calls,null,2)}</pre><button onClick={()=>setPage('rules')}>設定へ戻る</button></>}</div>}
createRoot(document.getElementById('root')).render(<App/>);
`,
  },
});
http
  .createServer((req, res) => {
    res.setHeader(
      "Content-Type",
      req.url === "/app.js" ? "text/javascript" : "text/html",
    );
    res.end(
      req.url === "/app.js"
        ? out.outputFiles[0].text
        : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/app.js"></script>',
    );
  })
  .listen(4230, "127.0.0.1", () => console.log("http://127.0.0.1:4230"));
