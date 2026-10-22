/** ローカル確認用。実際のStoryScreen / StoryIntroを、メモリ上の専用セーブで描く。 */
import { build } from "esbuild";
import fs from "node:fs";
import {
  STORY_ARCS,
  STORY_PHASES,
  CHRONICLE,
} from "../src/game/story-narrative.js";

const result = await build({
  stdin: {
    resolveDir: process.cwd(),
    loader: "jsx",
    contents: `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StoryScreen,StoryIntro} from './src/ui/story.jsx';
import {StoryReader,StoryAfterword} from './src/ui/story-chronicle.jsx';
import {STORY_AXES,PHASE_EPOCH} from './src/game/phase.js';
import {GameView} from './src/ui/game.jsx';
import {SeatsProvider} from './src/ui/names.jsx';
import {reducer} from './src/game/reducer.js';
import {getLegalMoves,kingRankOf} from './src/game/board.js';
import {GAME_RULE_VERSION} from './src/game/rule-version.js';
import {FIRST_GAME,foeAction,openingState} from './src/game/tutorial.js';
import base from './src/styles.css';
import cards from './src/skins/styles.css';
import royal from './src/ui/royal-theme.css';
import titles from './src/ui/title-frame.css';
const q=new URLSearchParams(location.search), initial=Number(q.get('phase'))||1;
function save(phase,cleared=q.get('cleared')==='all'?STORY_AXES:['23']){
 localStorage.setItem('tottery.account.v1',JSON.stringify({name:'物語プレビュー',phase,phaseEpoch:PHASE_EPOCH,story:{1:phase>1?STORY_AXES:cleared,2:phase>2?STORY_AXES:phase===2?cleared:[],3:phase===3?cleared:[]},phaseWins:{1:0,2:0,3:0}}));
}
save(initial);
const tut = FIRST_GAME;
const legal = (a, p) =>
  getLegalMoves(p, a.board, a.boardSize, a.players[p.owner].armyRankCounts, kingRankOf(a, p.owner));
const moveOf = (a, id, row, col) => {
  const hit = legal(a, a.pieces[id]).find((m) => m.row === row && m.col === col);
  if(!hit)throw Error("fixture move missing");
  return { type: "MOVE_PIECE", pieceId: id, row, col, captures: hit.captures };
};
const settle = (a) => {
  for (let g = 0; g < 10 && a.interstitial; g++) a = reducer(a, { type: "DISMISS_INTERSTITIAL" });
  return a;
};
/** 王を選んで確定し、1手目まで(あなたの番) */
function started(king) {
  let s = openingState(tut, GAME_RULE_VERSION);
  s = reducer(s, { type: "SETUP_PICK_KING", player: 0, cardId: king });
  s = reducer(s, { type: "SETUP_CONFIRM", player: 0 });
  return settle(s);
}
/** 1手目のあと、相手の番(待つ札の場面) */
function held(king) {
  let s = started(king);
  s = settle(reducer(s, moveOf(s, "t0", 1, 2)));
  return settle(reducer(s, { type: "DISMISS_CAPTURE" }));
}
/** 討ち終えた局面(撃破の札は閉じたあと) */
function finished(king, finisher, miss = false) {
  let s = held(king);
  s = settle(reducer(s, foeAction(s, tut, 0, (p) => legal(s, p))));
  if (miss) {
    s = settle(reducer(s, moveOf(s, "t0", 1, 1)));
    s = reducer(s, { type: "DISMISS_CAPTURE" });
    s = settle(reducer(s, foeAction(s, tut, 1, (p) => legal(s, p))));
  }
  s = settle(reducer(s, moveOf(s, finisher, 2, 4)));
  return reducer(s, { type: "DISMISS_CAPTURE" });
}


function App(){
 const [phase,setPhase]=useState(initial),[intro,setIntro]=useState(q.get('mode')==='intro'?(q.get('axis')||'89'):null),[reader,setReader]=useState(q.get('mode')==='reader'?(q.get('axis')||'89'):null),[revision,setRevision]=useState(0);
 function choose(p){save(p);setPhase(p);setRevision(i=>i+1);setIntro(null);setReader(null)}
 return <div className="tottery-root"><style>{base+cards+royal+titles}</style><style>{'html,body{margin:0;background:#081120}.preview-toolbar{padding:10px 12px;color:#dac9a5;font:12px/1.5 system-ui;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.preview-toolbar button{background:#22353a;color:#eee0c1;padding:7px;border:1px solid #8b805f;border-radius:4px}.preview-toolbar span{flex-basis:100%}.preview-main{padding:14px 12px 30px;display:flex;justify-content:center}body[data-qa] .preview-toolbar{display:none}'}</style>
 <header className="top-bar"><span className="brand">トッタリー</span><span style={{fontSize:11}}>ストーリー</span></header>
 <nav className="preview-toolbar"><span>デザイン・全21話の確認用（ゲームの記録には影響しません）</span>{[1,2,3].map(p=><button key={p} onClick={()=>choose(p)}>フェーズ {p}</button>)}<button onClick={()=>{save(phase,STORY_AXES);setRevision(i=>i+1)}}>全後日談を解放して確認</button><a href="portraits.html" style={{color:'#dac9a5'}}>見出しイラスト全21枚</a><a href="motivation.html" style={{color:'#dac9a5'}}>戦う理由・王の信念</a><a href="outline.html" style={{color:'#dac9a5'}}>全体構成・全文</a><a href="editorial.html" style={{color:'#dac9a5'}}>逆算設計表</a></nav>
 <main className="preview-main"><StoryScreen key={revision} onBack={()=>{window.__qaHome=true}} onStart={setIntro} onGuide={()=>{window.__qaGuide=true}} /></main>
 {intro&&<StoryIntro key={intro+phase} axis={intro} phase={phase} onBack={()=>setIntro(null)} onStart={()=>{window.__qaStarted={axis:intro,phase};setIntro(null)}}/>}
 {reader&&<StoryReader key={reader+phase} axis={reader} phase={phase} part={q.get('part')||'all'} onClose={()=>setReader(null)} onDone={()=>setReader(null)}/>}
 {q.get('mode')==='result'&&<SeatsProvider value={{names:['あなた','二と三の王'],skins:[{},{}]}}><GameView state={finished('t3','t2')} size={5} viewer={0} youAre={0} dispatch={()=>{}} onExit={()=>{}} onHome={()=>{}} tutorial={FIRST_GAME} onGate={()=>{window.__qaGate=true}} story={{axis:'23',phase:1,title:'二と三の王',ready:true,fresh:true,next:{axis:'45',title:'四と五の王'}}} rematch={null} seasonResult={{active:false}} /></SeatsProvider>}
 {q.get('mode')==='after'&&<StoryAfterword axis={q.get('axis')||'23'} phase={phase}/>}
 </div>
}
createRoot(document.getElementById('root')).render(<App/>);`,
  },
  bundle: true,
  write: false,
  minify: true,
  jsx: "automatic",
  format: "iife",
  loader: { ".css": "text", ".png": "dataurl", ".webp": "dataurl" },
  define: {
    __FIELD_FILES__: "{}",
    __AUDIO_FILES__: "{}",
    __BUILD_VERSION__: '"story-preview"',
    __HONOR_VERSION__: '"preview"',
  },
});
const setup = `const mem=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k),clear:()=>mem.clear()}});Object.defineProperty(navigator,'locks',{value:undefined});window.requestAnimationFrame=fn=>setTimeout(()=>fn(performance.now()),16);window.cancelAnimationFrame=clearTimeout;window.__qaErrors=[];addEventListener('error',e=>window.__qaErrors.push(e.message));addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason)));if(new URLSearchParams(location.search).has('qa'))document.body.dataset.qa='true';`;
fs.mkdirSync("reports/story-chronicle", { recursive: true });
fs.cpSync("assets/story/comics", "reports/story-chronicle/story-comics", { recursive: true });
fs.writeFileSync(
  "reports/story-chronicle/index.html",
  `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>灰冠の年代記｜ストーリーデザイン</title><body><div id="root"></div><script>${setup}</script><script>${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`,
);
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const outline = `<h1>${CHRONICLE.title}</h1><p>${CHRONICLE.subtitle}</p><p>${CHRONICLE.world}</p><p>${CHRONICLE.covenant}</p><p>A・忍者シノは各地の声と記録を運ぶ案内役。対戦は既存の七つの組で進みます。</p>${[1, 2, 3].map((p) => `<p>シノ・フェーズ${p}：${CHRONICLE.guide[p]}</p>`).join("")}<p></p><p><a href="index.html">ゲーム内デザインを見る</a> · 以下は結末を含む制作確認用の全文です。</p><table><tr><th>クラス</th><th>問い</th>${[1, 2, 3].map((p) => `<th>フェーズ${p}<br>${STORY_PHASES[p].title}</th>`).join("")}</tr>${STORY_ARCS.map((a) => `<tr><td>${a.ranks.join("・")} ${a.role}</td><td>${a.question}</td>${[1, 2, 3].map((p) => `<td><a href="#${a.axis}-${p}">${a.episodes[p].title}</a></td>`).join("")}</tr>`).join("")}</table>${STORY_ARCS.map(
  (a) =>
    `<section><h2>${a.ranks.join("・")} ${a.role} ─ ${a.name}</h2><p>${a.characters.map((c) => `${c.name}：${c.detail}`).join("<br>")}</p>${[
      1, 2, 3,
    ]
      .map((p) => {
        const e = a.episodes[p];
        return `<article id="${a.axis}-${p}"><div class="scene"><img src="../../assets/story/chronicle/${a.axis}.webp" style="top:${-(p - 1) * 100}%" alt=""></div><h3>フェーズ${p} · ${e.title}</h3><p class="place">${e.place}</p><p>${e.hook}</p>${e.recap ? `<p class="recap">前話：${e.recap}</p>` : ""}<aside><b>あなたの目的</b><p>${esc(e.purpose.goal)}</p><p>${esc(e.purpose.reason)}</p></aside><h4>戦う前</h4>${e.before.map((x) => `<p><b>${x.speaker}</b><br>${x.text}</p>`).join("")}<h4>勝利後</h4>${e.after.map((x) => `<p><b>${x.speaker}</b><br>${x.text}</p>`).join("")}<blockquote>${e.next}</blockquote></article>`;
      })
      .join("")}</section>`,
).join("")}`;
fs.writeFileSync(
  "reports/story-chronicle/outline.html",
  `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>灰冠の年代記｜全21話の構成と本文</title><style>html{background:#101e25;color:#e6ddc9;font:15px/1.95 'Hiragino Mincho ProN',serif}body{max-width:1050px;margin:auto;padding:30px 20px}a{color:#ddbd78}h1,h2,h3{color:#eed5a0}table{border-collapse:collapse;width:100%;font-size:12px;display:block;overflow:auto}th,td{border:1px solid #596055;padding:10px;min-width:120px}section{margin:65px 0}article{border-top:1px solid #526055;padding:35px 0;max-width:760px;margin:auto}article p{max-width:42em}b{color:#d5b67c}blockquote{border-left:2px solid #b49659;padding-left:16px;color:#ddc48f}.recap,.place{color:#a8b6ae;font-size:13px}.scene{aspect-ratio:16/9;position:relative;overflow:hidden}.scene img{position:absolute;width:100%;height:300%;left:0}</style>${outline}</html>`,
);
console.log("Built reports/story-chronicle/index.html and outline.html");

// 見出しの21枚をフェーズ順で比較できる確認用ギャラリー。
const portraits = STORY_ARCS.map(
  (arc) =>
    `<section id="rank-${arc.axis}"><h2>${arc.ranks.join("・")}　${arc.role}<small>${arc.cast}</small></h2><div class="portraits">${[1, 2, 3].map((phase) => `<figure><a href="../../assets/story/chapter-portraits/${arc.axis}-phase-${phase}.png"><img src="../../assets/story/chapter-portraits/${arc.axis}-phase-${phase}.webp" alt="${arc.cast}・フェーズ${phase}" width="400" height="600" loading="lazy"></a><figcaption><small>PHASE ${phase} · ${STORY_PHASES[phase].label}</small><b>${arc.episodes[phase].title}</b><p>${arc.episodes[phase].hook}</p></figcaption></figure>`).join("")}</div></section>`,
).join("");
fs.writeFileSync(
  "reports/story-chronicle/portraits.html",
  `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>見出しイラスト全21枚｜灰冠の年代記</title><style>html{background:#101b20;color:#e9e1d1;font:14px/1.8 system-ui}body{max-width:1000px;margin:auto;padding:24px 16px}a{color:#ddc494}h1,h2,b{font-family:'Hiragino Mincho ProN',serif;color:#f0dfbc}h1{font-size:27px}h2{font-size:21px;margin-bottom:18px}h2 small{display:block;font:12px/1.7 system-ui;color:#c6b996;margin-top:5px}nav{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0}nav a{padding:7px 13px;border:1px solid #54645e;border-radius:5px;text-decoration:none}section{margin:45px 0;scroll-margin-top:20px}.portraits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0;overflow:hidden;background:#19292f;border:1px solid #3d514e;border-radius:9px}figure img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:contain}figcaption{padding:12px}figcaption small{color:#c4b390;font-size:10px}figcaption b{display:block;font-size:18px;margin:6px 0}figcaption p{color:#bac6be;font-size:12px;margin:0}@media(max-width:620px){.portraits{grid-template-columns:repeat(3,180px);overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:12px}figure{scroll-snap-align:start}body{padding:20px 12px}}</style><h1>灰冠の年代記<br>見出しイラスト全21枚</h1><p>各クラスの顔が見える、一覧専用の縦長イラスト。フェーズごとに物語に沿った構図へ変わります。画像を押すと原寸で開きます。</p><p><a href="index.html">ゲーム内の表示を見る</a> · <a href="outline.html">全21話を読む</a></p><nav>${STORY_ARCS.map((a) => `<a href="#rank-${a.axis}">${a.ranks.join("・")}</a>`).join("")}</nav>${portraits}</html>`,
);
console.log(
  "Built reports/story-chronicle/portraits.html (21 dedicated chapter illustrations)",
);

// 改稿設計の正本から、制作確認も更新する。旧稿の評価や画像生成履歴と混同しない。
const design=JSON.parse(fs.readFileSync('reports/story-redesign/design.json','utf8'));
const table=(headers,rows)=>'<div style="overflow:auto"><table><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</table></div>';
const style='<style>body{max-width:1400px;margin:auto;padding:28px;background:#f7f4ed;color:#292720;font:14px/1.8 system-ui}th,td{border:1px solid #c0b79e;padding:10px;vertical-align:top;min-width:120px}table{border-collapse:collapse}h2{margin-top:40px}</style>';
fs.writeFileSync('reports/story-chronicle/editorial.html','<!doctype html><meta charset="utf-8"><title>責任から逆算する全体設計</title>'+style+'<h1>責任から逆算する全体設計</h1><p>'+esc(design.sourceStatus.requestedDocx)+'</p><p>'+esc(design.sourceStatus.aphorisms)+'</p><p>'+esc(design.route)+'</p><h2>人物別・逆算設計</h2>'+table(['キャラ','軸','名言集の格言','問い','F3','F2','F1','シノの学び','回収'],design.characterMatrix.map(r=>['character','axis','aphorism','question','F3','F2','F1','shinoLearns','finalPayoff'].map(k=>r[k])))+'<h2>漫画の状態</h2><p>'+esc(design.artStatus)+'</p>');
fs.writeFileSync('reports/story-chronicle/motivation.html','<!doctype html><meta charset="utf-8"><title>21の経験と最終章</title>'+style+'<h1>21の経験と最終章</h1>'+table(['話','経験','回収'],design.experienceMatrix.map(r=>[r.id,r.experience,r.finalPayoff+'〔名言集 '+r.quoteNumbers.join('・')+'〕'])));
console.log('Built current editorial.html and motivation.html from redesign/design.json');

const quoteSource=JSON.parse(fs.readFileSync('reports/story-redesign/quotes-source.json','utf8'));
const bases=design.characterMatrix.map(r=>'<article><h2>'+esc(r.character)+'</h2><p>'+esc(r.aphorism)+'</p><p>'+esc(r.quoteBasis.application)+'</p><p>'+esc(r.quoteBasis.caution)+'</p><p>補助項目：'+r.quoteBasis.secondary.join('・')+'</p></article>').join('');
fs.writeFileSync('reports/story-chronicle/quotes.html','<!doctype html><meta charset="utf-8"><title>名言集との対応</title>'+style+'<h1>名言集との対応</h1><p>'+esc(quoteSource.sourceWarning)+'</p>'+bases+'<h2>翻案の範囲</h2>'+design.adaptationLimits.map(x=>'<p>'+esc(x)+'</p>').join(''));
