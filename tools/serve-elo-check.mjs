// Local-only UI fixture: real GameCore and wire modules, no public writes or accounts.
import { build } from "esbuild";
import http from "node:http";
const createdAt = Date.now(),
  acts = {};
let sequence = 0;
const result = await build({
  bundle: true,
  jsx: "automatic",
  write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  plugins: [
    {
      name: "local-fixture",
      setup(b) {
        b.onLoad({ filter: /src\/net\/auth\.js$/ }, () => ({
          loader: "js",
          contents: `export const API_KEY='',OPERATOR_UID='operator';export function myUid(){return new URLSearchParams(location.search).get('seat')==='1'?'guest':'host'};export async function ensureAuth(){return {uid:myUid(),idToken:'fixture'}};export function useOperatorSlot(){};export async function authedFetch(url,init={}){return fetch('/wire?path='+encodeURIComponent(new URL(url).pathname),init)}`,
        }));
        b.onLoad({ filter: /src\/net\/players\.js$/ }, () => ({
          loader: "js",
          contents: `export async function publishPlayer(){};export async function dropOldRows(){};export async function syncPlayer(){return false}`,
        }));
      },
    },
  ],
  stdin: {
    resolveDir: process.cwd(),
    loader: "jsx",
    contents: `import {createRoot} from 'react-dom/client';import {GameCore} from './src/ui/game.jsx';import {SeatsProvider} from './src/ui/names.jsx';const seat=Number(new URLSearchParams(location.search).get('seat')||0);const network={code:'ELOROOM',createdAt:${createdAt},myPlayerIndex:seat,foeUid:seat===0?'guest':'host',ruleVersion:2,ratings:[4000,4000]};createRoot(document.getElementById('root')).render(<SeatsProvider value={{names:['赤の確認役','青の確認役'],skins:[{},{}]}}><GameCore network={network} boardSize={9} onExit={()=>{document.body.innerText='ホームへ戻りました'}}/></SeatsProvider>);`,
  },
});
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Elo 対戦画面確認</title><body><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`;
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1:4258");
    if (url.pathname === "/wire") {
      const path = url.searchParams.get("path");
      let body = "";
      for await (const chunk of req) body += chunk;
      let data = null;
      if (path.startsWith("/ranks/"))
        data = { rating: path.includes("/host.") ? 1500 : 1700 };
      else if (path === "/rooms/ELOROOM/acts.json") {
        if (req.method === "POST") {
          const key = String(++sequence).padStart(5, "0");
          acts[key] = JSON.parse(body);
          data = { name: key };
          console.log(acts[key].type);
        } else data = acts;
      } else if (path === "/rooms/ELOROOM.json")
        data = {
          createdAt,
          seats: { host: "host", guest: "guest" },
          guestPresent: true,
          round: 0,
          acts,
        };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return;
    }
    if (url.pathname === "/api/season/summary") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  })
  .listen(4258, "127.0.0.1", () =>
    console.log("http://127.0.0.1:4258/?seat=0"),
  );
