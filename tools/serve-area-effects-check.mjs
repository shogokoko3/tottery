// Disposable local test: no production authentication, matchmaking or ranking writes.
import { build } from "esbuild";
import http from "node:http";
import fs from "node:fs";
const result = await build({
  bundle: true,
  jsx: "automatic",
  write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: {
    __AUDIO_FILES__: "{}",
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
          s = 'import {areaFixture} from "../../tools/area-fixture.mjs";\n' + s;
          s += `\nfunction fixtureState(){const params=new URLSearchParams(location.search),theme=params.get('area') || 'ice';
const type=['heaven','hell'].includes(theme)?'palace':theme;
const s=areaFixture(type);s.ruleVersion=11;
s.areas[0].skin=theme==='hell'?'demon-k':'angel-k';
if(params.get('foe'))s.areas[1]={type:params.get('foe'),skin:'demon-k',used:false,uses:0};
return s;}`;
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
function App(){return <><nav style={{padding:8,background:'#10203a',display:'flex',gap:12}}>{[['earth','土'],['sea','海'],['forest','森'],['ice','氷'],['sky','空'],['heaven','天界'],['hell','魔界']].map(([id,label])=><a style={{color:'#eee'}} href={'?test=1&area='+id} key={id}>{label}</a>)}</nav><SeatsProvider value={{names:['あなた','相手'],skins:[{},{}],backs:[null,null],frames:[null,null]}}><GameCore boardSize={9} onExit={()=>location.reload()}/></SeatsProvider></>};createRoot(document.getElementById('root')).render(<App/>);
`,
  },
});
const html = `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>エリア演出確認</title><style>body{margin:0;background:#081120}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`;
http
  .createServer((req, res) => {
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
  .listen(4257, "127.0.0.1", () =>
    console.log("Local area fixture http://127.0.0.1:4257/?test=1&area=ice"),
  );
