// ローカル表示専用。本番API・課金を呼ばず、実コンポーネントを確認する。
import { build } from "esbuild";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const bundle = await build({
  bundle: true,
  write: false,
  jsx: "automatic",
  format: "iife",
  loader: { ".png": "dataurl", ".webp": "dataurl", ".css": "text" },
  plugins: [
    {
      name: "preview",
      setup(b) {
        // 購入前後を実際のパス画面で確認する。外部決済は一切呼ばない。
        b.onLoad({ filter: /src\/ui\/battlepass-access\.js$/ }, () => ({
          contents: `import {useCollection} from '../skins/store.js';export function useBattlePassUnlocked(){const c=useCollection();return new URLSearchParams(location.search).get('pass')!=='locked'||(c.entitlements||[]).includes('battlepass')}`,
        }));
        b.onLoad({ filter: /src\/net\/wallet\.js$/ }, async (args) => ({
          contents: fs
            .readFileSync(args.path, "utf8")
            .replace(
              'return mirror(await walletRequest("buy-pass", { id }));',
              'return updateCollection(s=>({...s,entitlements:[...new Set([...(s.entitlements||[]),"battlepass"])]}));',
            ),
        }));
        b.onLoad({ filter: /src\/net\/iap\.js$/ }, () => ({
          contents: `import {PRODUCTS} from '../iap/catalog.js';export async function loadProducts(){return PRODUCTS.map(p=>({...p,price:'表示見本'}));}export const shopAvailable=async()=>true;export const flushPurchases=async()=>{};export const buy=async()=>{throw Error('表示見本のため購入はできません')};export const restore=async()=>({restored:0});`,
        }));
        b.onLoad({ filter: /src\/net\/season\.js$/ }, () => ({
          contents: `export const SEASON_API_ORIGIN='';export const seasonApiBase=()=>'';export const clearSeasonQueue=()=>{};export const queueSeasonMatch=()=>{};export const forgetSeason=async()=>{};export const finishSeasonMatch=async()=>{};export const retrySeasonMatches=async()=>{};export async function seasonRequest(){return {uid:'preview',now:Date.now(),season:{id:'2026-09',start:Date.now()-86400000,end:Date.now()+864000000},player:null,list:[{uid:'sample',name:'表示見本',rating:1600,rated:12,place:1,frame:null}],history:[],claims:[],owned:{backs:[],frames:[],titles:[]},appearance:{back:null,frame:null}}}`,
        }));
      },
    },
  ],
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{GameShell,HomeScreen,MenuScreen,MatchingScreen,RulesSelectScreen,RandomMatchScreen,RoomScreen}from'./src/ui/screens.jsx';
import{SkinsScreen}from'./src/ui/skins.jsx';import{MissionsScreen}from'./src/ui/missions.jsx';import{BattlePassScreen}from'./src/ui/battlepass.jsx';import{TsumeScreen}from'./src/ui/tsume.jsx';import{LettersScreen}from'./src/ui/letters.jsx';import{RankingScreen}from'./src/ui/ranking.jsx';import{TutorialSelect}from'./src/ui/tutorial.jsx';import{SettingsModal}from'./src/ui/overlays.jsx';import{GemShop}from'./src/ui/gem-shop.jsx';import{RulesPanel}from'./src/ui/guides.jsx';import{IconPickModal,TitlePickModal}from'./src/ui/account.jsx';
function App(){const [page,set]=useState(new URLSearchParams(location.search).get('screen')||'home');const [rules,setRules]=useState(false);const back=()=>set('home');let content;
const screens={title:<HomeScreen onStart={back}/>,home:<MenuScreen onPlay={()=>set('matching')} onTutorial={()=>set('tutorial')} onTsume={()=>set('tsume')} onSkins={()=>set('skins')} onBattlePass={()=>set('pass')} onMissions={()=>set('missions')} onRanking={()=>set('ranking')} onLetters={()=>set('letters')}/>,matching:<MatchingScreen onOnline={()=>set('online')} onFriend={()=>set('room')} onCpu={()=>set('rules')} onBack={back} onTutorial={()=>set('tutorial')}/>,rules:<RulesSelectScreen onStart={back} onBack={back} backLabel="戻る"/>,online:<RandomMatchScreen onBack={back} onRoomReady={back} boardSize={9}/>,room:<RoomScreen onBack={back} onRoomReady={back} boardSize={9}/>,tutorial:<TutorialSelect onBack={back} onStart={back}/>,missions:<MissionsScreen onBack={back}/>,tsume:<TsumeScreen onBack={back}/>,pass:<BattlePassScreen onBack={back} onSkins={()=>set('skins')}/>,skins:<SkinsScreen onBack={back} onBattlePass={()=>set('pass')}/>,ranking:<RankingScreen onBack={back}/>,letters:<LettersScreen onBack={back}/>,shop:<GemShop gems={1250} gemsPaid={1000} gemsFree={250} onClose={back} onMessage={()=>{}}/>,settings:<SettingsModal onClose={back}/>,icons:<IconPickModal onClose={back}/>,titles:<TitlePickModal onClose={back}/>,guide:<RulesPanel onClose={back}/>};content=screens[page]||screens.home;return <GameShell onHome={back} showRules={rules} setShowRules={setRules}>{content}</GameShell>};createRoot(document.getElementById('root')).render(<App/>);
`,
    loader: "jsx",
  },
});
const links = [
  ["home", "ホーム"],
  ["skins", "ガチャ・装備"],
  ["missions", "ミッション"],
  ["tsume", "詰め"],
  ["pass", "バトルパス"],
  ["ranking", "ランキング"],
  ["tutorial", "チュートリアル"],
  ["matching", "対戦選択"],
  ["rules", "ルール設定"],
  ["room", "フレンド"],
  ["letters", "お知らせ"],
  ["shop", "ジェムショップ"],
  ["settings", "設定"],
  ["icons", "アイコン"],
  ["titles", "称号"],
  ["guide", "早見表"],
  ["title", "タイトル"],
];
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>トッタリー・デザイン確認</title><style>body{margin:0;background:#080e1a}#preview-nav{position:fixed;bottom:0;left:0;right:0;z-index:20000;display:flex;gap:16px;overflow:auto;background:#030912;padding:9px;font:12px sans-serif;white-space:nowrap}#preview-nav a{color:#e0c58a}</style><div id="root"></div><nav id="preview-nav" aria-label="表示見本の画面選択">${links.map(([id, label]) => `<a href="?screen=${id}&test=1">${label}</a>`).join("")}</nav><script>const nativeFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input.url,location.href);if(u.origin!==location.origin||u.pathname.startsWith('/api/'))return Promise.reject(Error('表示専用: 外部通信なし'));return nativeFetch(input,init)};</script><script>${bundle.outputFiles[0].text}</script>`;
http
  .createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (p === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(html);
      return;
    }
    const f = path.resolve("." + p);
    if (!f.startsWith(process.cwd() + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      res.setHeader(
        "Content-Type",
        f.endsWith(".png")
          ? "image/png"
          : f.endsWith(".webp")
            ? "image/webp"
            : "application/octet-stream",
      );
      res.end(fs.readFileSync(f));
    } catch {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(4272, "127.0.0.1", () => console.log("http://127.0.0.1:4272/"));
