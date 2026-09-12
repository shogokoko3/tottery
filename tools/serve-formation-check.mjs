// 布陣の称号(隅の要塞・双翼の陣)の演出を、決まった盤面で確認するローカル専用の画面。
// 本番の認証・マッチング・ランキングには触れない。
//   node tools/serve-formation-check.mjs   → http://127.0.0.1:4270/?test=1&form=wings (form=fortress も)
import { build } from "esbuild";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
const result = await build({
  bundle: true,
  jsx: "automatic",
  write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: {
    __AUDIO_FILES__: "{}",
    __HONOR_VERSION__: JSON.stringify(fs.readdirSync("honors")[0]),
    __FIELD_FILES__: JSON.stringify(
      Object.fromEntries(
        fs
          .readdirSync("fields")
          .filter((f) => f.endsWith(".png"))
          .map((f) => [f.split(".")[0], f]),
      ),
    ),
  },
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
          contents: `export async function readRanks(){return {ok:true,list:[]}};export async function readWorldGames(){return 0};export async function publishRank(){};export async function deleteRank(){}`,
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
          s =
            'import {formationFixture} from "../../tools/formation-fixture.mjs";\n' +
            s;
          s += `\nfunction fixtureState(){const params=new URLSearchParams(location.search);return formationFixture(params.get('form')||'wings');}`;
          return { loader: "jsx", contents: s };
        });
      },
    },
  ],
  stdin: {
    resolveDir: process.cwd(),
    loader: "jsx",
    contents: `
import {useState} from 'react';import {IconPickModal} from './src/ui/account.jsx';import {loadProfile,grantTitle} from './src/game/profile.js';import {createRoot} from 'react-dom/client';import {GameCore} from './src/ui/game.jsx';import {SeatsProvider} from './src/ui/names.jsx';
function App(){const [icons,setIcons]=useState(false);return <div className="tottery-root"><button onClick={()=>setIcons(true)}>アイコンを確認</button>{icons&&<IconPickModal onClose={()=>setIcons(false)}/>} <nav style={{padding:8,background:'#10203a',display:'flex',gap:12}}>{[['wings','双翼の陣'],['earth','継承の狩り'],['forest','消去法の詰め'],['sea','道連れの特攻'],['palace','天界'],['hell','魔界'],['fortress','隅の要塞']].map(([id,label])=><a style={{color:'#eee'}} href={'?test=1&form='+id} key={id}>{label}</a>)}</nav><SeatsProvider value={{names:['あなた','CPU'],skins:[{},{}],backs:[null,null],frames:[null,null]}}><GameCore boardSize={9} cpu={{level:1}} onExit={()=>location.reload()}/></SeatsProvider></div>};createRoot(document.getElementById('root')).render(<App/>);
`,
  },
});
const html = `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>布陣の称号 確認</title><style>body{margin:0;background:#081120}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`;
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (
      url.pathname.startsWith("/honors/") ||
      url.pathname.startsWith("/skins/")
    ) {
      const file = path.resolve("." + decodeURIComponent(url.pathname));
      if (
        !file.startsWith(process.cwd() + path.sep) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile()
      ) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".png": "image/png",
          ".webp": "image/webp",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(fs.readFileSync(file));
      return;
    }
    if (
      req.url.startsWith("/fields/") &&
      /^\/fields\/[a-z]+\.[a-f0-9]+\.png$/.test(req.url)
    ) {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(fs.readFileSync(`.${req.url}`));
      return;
    }
    if (req.url.startsWith("/api/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  })
  .listen(4270, "127.0.0.1", () =>
    console.log("http://127.0.0.1:4270/?test=1&form=wings"),
  );
