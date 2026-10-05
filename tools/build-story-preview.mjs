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
 <nav className="preview-toolbar"><span>デザイン・全21話の確認用（ゲームの記録には影響しません）</span>{[1,2,3].map(p=><button key={p} onClick={()=>choose(p)}>フェーズ {p}</button>)}<button onClick={()=>{save(phase,STORY_AXES);setRevision(i=>i+1)}}>全後日談を解放して確認</button><a href="portraits.html" style={{color:'#dac9a5'}}>見出しイラスト全21枚</a><a href="motivation.html" style={{color:'#dac9a5'}}>戦う理由・王の信念</a><a href="outline.html" style={{color:'#dac9a5'}}>全体構成・全文</a><a href="editorial.html" style={{color:'#dac9a5'}}>今回の改稿・歴史的着想</a></nav>
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

// 修正前の根拠を、現在の21話の目的・対立と並べて確認する。
const reviews = JSON.parse(fs.readFileSync("reports/story-chronicle/motivation-review.json", "utf8"));
const ideals = STORY_ARCS.map(a => {
  const e = a.episodes[3], p = e.purpose;
  return '<tr><th>' + esc(a.ranks.join("・") + " " + a.role) + '</th><td>' + esc(p.rivalIdeal) + '</td><td>' + esc(p.playerIdeal) + '</td><td>' + esc(p.reason) + '<br><a href="outline.html#' + a.axis + '-3">本文を読む</a></td></tr>';
}).join("");
const audit = [1,2,3].map(phase => '<section><h2>フェーズ ' + phase + ' · ' + esc(STORY_PHASES[phase].label) + '</h2><p>' + esc(STORY_PHASES[phase].summary) + '</p>' + reviews.filter(r => r.phase === phase).map(r => {
  const a = STORY_ARCS.find(a => a.axis === r.axis), e = a.episodes[phase], p = e.purpose;
  const quote = r.originalSpeaker === "語り" ? r.originalExcerpt : "「" + r.originalExcerpt.replaceAll("「","『").replaceAll("」","』") + "」";
  return '<article id="' + r.axis + '-' + phase + '"><small>' + esc(a.ranks.join("・") + " · " + a.cast) + '</small><h3>' + esc(e.title) + '</h3><details><summary>修正前にあった戦う理由を確認</summary><p>修正前の本文より · ' + esc(r.originalSpeaker) + '</p><blockquote>' + esc(quote) + '</blockquote><p>' + esc(r.assessment) + '</p></details><dl><dt>あなたの目的</dt><dd>' + esc(p.goal) + '</dd><dt>戦いを避けられない理由</dt><dd>' + esc(p.reason) + '</dd>' + (p.leadership ? '<dt>王への問い</dt><dd>' + esc(p.leadership) + '</dd>' : '') + '<dt>プレイヤーの決意</dt><dd>' + esc(e.before.at(-1).text) + '</dd><dt>勝利の代償・残る問い</dt><dd>' + esc(e.after[0].text) + '</dd></dl><a href="outline.html#' + r.axis + '-' + phase + '">この話の全文</a> · <a href="index.html?phase=' + phase + '&axis=' + r.axis + '&mode=reader&part=all&cleared=all">ゲーム画面で読む</a></article>';
}).join("") + '</section>').join("");
fs.writeFileSync("reports/story-chronicle/motivation.html",
 '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>戦う理由と王の信念｜灰冠の年代記</title><style>html{background:#101e25;color:#e6ddc9;font:15px/1.9 system-ui}body{max-width:1050px;margin:auto;padding:28px 18px}h1,h2,h3{color:#ead5a7;font-family:"Hiragino Mincho ProN",serif}h1{font-size:29px}h2{margin-top:48px}a{color:#dfc087}small,dt{color:#c7b38c}article{border:1px solid #495b55;border-radius:8px;padding:20px;margin:20px 0;background:#17292e}details{background:#0d1a21;padding:12px 16px}summary{cursor:pointer}blockquote{border-left:2px solid #bfa370;padding:8px 14px;margin:14px 0}dt{font-size:12px;margin-top:14px}dd{margin:4px 0}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #526057;padding:13px;text-align:left;vertical-align:top}th{min-width:95px}.table-scroll{overflow-x:auto}td{min-width:160px}nav{display:flex;gap:14px;flex-wrap:wrap}.premise{border-left:3px solid #c2a873;padding:14px 18px;background:#192f34}p{max-width:60em}</style><h1>戦う理由と、<br>王の信念</h1><p>全21話の改稿確認。結末を含みます。</p><nav><a href="index.html">ゲーム画面</a><a href="outline.html">全21話の全文</a><a href="portraits.html">見出しイラスト</a></nav><div class="premise"><b>あなたが戦う理由</b><p>' + esc(CHRONICLE.player) + '</p><p>フェーズ2では、判断し、皆を率い、結果を引き受ける王が必要になる。フェーズ3では、その王が何を守るべきかで対立する。</p></div><p>修正前にも、薬の護送、検問橋の通行、避難民の救出、徴発令の見直しという目的はありました。一方、主人公の切実さや、味方を相手に戦う理由が弱い話がありました。各話に目的・相手が退けない事情・プレイヤーの決意を加え、腕試しだった対戦を具体的な利害と信念の衝突へ変更しました。</p><h2>フェーズ3 · 七つの王の対立</h2><div class="table-scroll"><table><thead><tr><th>立場</th><th>相手の王</th><th>あなたの王</th><th>実際に争うこと</th></tr></thead><tbody>' + ideals + '</tbody></table></div>' + audit + '</html>');
console.log("Built reports/story-chronicle/motivation.html (21 original excerpts and seven royal conflicts).");


// 今回の推敲と歴史的着想を、実際に使う本文に結び付けた確認ページ。
const conflicts = STORY_ARCS.map(a => {
  const e=a.episodes[3];
  return `<article><small>${esc(a.ranks.join('・'))} · ${esc(a.cast)}</small><h2>${esc(e.title)}</h2><p>${esc(e.hook)}</p><dl><dt>相手が守ろうとするもの</dt><dd>${esc(e.purpose.rivalIdeal)}</dd><dt>あなたの選択</dt><dd>${esc(e.purpose.playerIdeal)}</dd><dt>戦いのあとに果たすこと</dt><dd>${esc(e.after[0].text)}</dd></dl><a href="outline.html#${a.axis}-3">この話の全文</a> · <a href="index.html?phase=3&axis=${a.axis}&mode=reader&part=all&cleared=all">ゲーム画面で読む</a></article>`;
}).join('');
const kingArc=STORY_ARCS.find(a=>a.axis==='k');
const kingScenes=[1,2,3].map(phase=>{
  const e=kingArc.episodes[phase];
  return `<article><small>フェーズ ${phase}</small><h3>${esc(e.title)}</h3><p>${esc(e.hook)}</p><b>エドリク</b><blockquote>${esc(e.before[1].text)}</blockquote><b>あなた</b><blockquote>${esc(e.before[3].text)}</blockquote><a href="outline.html#k-${phase}">前後を含めて読む</a></article>`;
}).join('');
fs.writeFileSync('reports/story-chronicle/editorial.html',`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>守る責任と、支配する力｜ストーリー改稿</title><style>
*{box-sizing:border-box}html{background:#101c23;color:#e8dfcd;font:16px/1.95 system-ui}body{max-width:1020px;margin:auto;padding:36px 22px 70px}h1,h2,h3{font-family:'Hiragino Mincho ProN',serif;color:#f0d5a0;line-height:1.5}h1{font-size:clamp(25px,5vw,38px);margin:14px 0}h2{font-size:22px}h3{font-size:21px}p{max-width:46em}a{color:#e6c489;text-underline-offset:4px}nav{display:flex;gap:12px 22px;flex-wrap:wrap;margin:24px 0 35px}article{background:#192b30;border:1px solid #42544f;border-radius:10px;padding:24px;margin:22px 0;break-inside:avoid}small,dt{color:#bdc7b7;font-size:13px}dt{margin-top:17px}dd{margin:5px 0}blockquote{margin:12px 0 22px;border-left:2px solid #ac915b;padding:4px 0 4px 16px}section{margin-top:52px}.principle{border-top:1px solid #897a56;border-bottom:1px solid #897a56;padding:18px 0;margin:30px 0}.refs{font-size:14px;color:#bdc9bf}.refs p{max-width:65em}@media(max-width:480px){body{padding:23px 15px 50px}article{padding:19px 16px}h2{font-size:20px}}@media print{html{background:white;color:#222}article{background:white;color:#222}h1,h2,h3,a{color:#222}nav{display:none}}
</style><small>灰冠の年代記 · 全21話の改稿 · 2026年10月2日</small><h1>守る責任と、<br>支配する力。</h1><p>物語の大筋を保ち、日本語と人物ごとの語り口を整えました。以下は結末を含む確認ページです。</p><nav><a href="outline.html">全21話の全文を読む</a><a href="index.html?phase=3&cleared=all">ゲーム画面で確認する</a><a href="portraits.html">見出しイラスト</a></nav><div class="principle"><b>人の上に立つとは、守るべき人の暮らしを預かること。</b><p>選んで命じるだけでなく、食事が減った家へ説明する。奪った物の償いに付き添う。救出したあとも夜警に立つ。責任を、戦いのあとに続く行動として描きました。</p></div><p>「王」は王家、盟約の指揮役、物語の中心となる問いに残し、会話では頭領・指揮官・隊を率いる者など、立場に合う言葉を使っています。人物の言葉は全て鉤括弧で囲みました。</p><section><h2>恐怖で国を守ると信じる王</h2><p>エドリクは内乱を見た記憶から、反抗を許せば国が再び戦場になると考えます。徴発、期限のない権限、反対者の拘束へと、その考えが暮らしを脅かしていきます。敗れたあとも思想はすぐには変わりません。</p>${kingScenes}</section><section><h2>七つの立場が、譲れないもの</h2><p>全員が同じ考えになる結末にはせず、選択の損失や残る不信にも向き合います。</p>${conflicts}</section><section class="refs"><h2>歴史的着想について</h2><p>マキャヴェリ『君主論』第17章の「愛されることと恐れられること」をめぐる議論から、統治を恐怖に頼る人物像の着想を得ています。同章には憎悪を避ける条件もあり、エドリクの弾圧をそのまま歴史上の著者の主張として描いたものではありません。<a href="https://www.gutenberg.org/files/57037/57037-h/57037-h.htm">原典の英訳を読む</a></p><p>ホッブズ『リヴァイアサン』第17章の、争いを抑え人々を守るための共通の権力という問いも参考にしました。内乱を恐れる王と、ばらばらの諸侯をまとめる必要に翻案しています。登場人物や事件、拘束命令などは本作の創作です。<a href="https://www.gutenberg.org/files/3207/3207-h/3207-h.htm">原典の英語本文を読む</a></p></section></html>`);
console.log('Built reports/story-chronicle/editorial.html (prose revision and historical inspirations).');
