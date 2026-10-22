import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Piece} from '../src/ui/cards.jsx';
import {SeatsProvider} from '../src/ui/names.jsx';
import {FieldBackdrop} from '../src/ui/fields/backdrop.jsx';
import {AliceBoardEffects} from '../src/ui/alice-effects.jsx';
import {alicePresentationEvent,aliceEffectDuration} from '../src/game/alice-presentation.js';
import {aliceBoard} from '../src/game/alice-rules.js';
import {boardFieldTheme} from '../src/game/field-presentation.js';
import {FX_SCENES,wonderlandFxScene,previewSeat} from './wonderland-fx-fixtures.mjs';
import MAIN from '../src/styles.css';
import SKIN from '../src/skins/styles.css';
import AREA from '../src/ui/area-effects.css';
function App(){
 const initial=new URLSearchParams(location.search).get('effect');
 const [type,setType]=useState(FX_SCENES.some(([id])=>id===initial)?initial:'croquet');
 const initialLanding=new URLSearchParams(location.search).get('landing');
 const [variant,setVariant]=useState(['empty','return','hit','king'].includes(initialLanding)?initialLanding:'empty'),[viewer,setViewer]=useState(previewSeat(initial)),[t,setT]=useState(0),[playing,setPlaying]=useState(false),[playId,setPlayId]=useState(0);
 const scene=useMemo(()=>wonderlandFxScene(type,variant),[type,variant]),event=useMemo(()=>alicePresentationEvent(scene.before,scene.after,viewer),[scene,viewer]);
 const duration=event?aliceEffectDuration(event):1000,active=!!event&&t<1,state=active&&!event.displayAfter?scene.before:scene.after,board=aliceBoard(state,viewer),flip=viewer===1;
 const choose=id=>{setType(id);setVariant('empty');setViewer(previewSeat(id));reset();history.replaceState(null,'','?effect='+id);};
 useEffect(()=>{if(!playing)return;let frame;const start=performance.now();const draw=()=>{const p=Math.min(1,(performance.now()-start)/duration);setT(p);if(p<1)frame=requestAnimationFrame(draw);else setPlaying(false);};frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);},[playing,playId,type,variant,viewer]);
 const reset=()=>{setT(0);setPlaying(false);};
 window.wonderlandPreview={type,variant,viewer,t,event,state,scene,playing};
 return <SeatsProvider value={{names:['あなた','相手'],skins:scene.before.areaLoadouts,backs:[null,null],frames:[null,null]}}>
 <style>{MAIN+SKIN+AREA}</style><main className="tottery-root fx-preview"><header><small>WONDERLAND / ANIMATION PREVIEW</small><h1>ワンダーランドの能力演出</h1><p>演出を選んで、何度でも再生できます。</p></header>
 <nav aria-label="演出の切り替え">{FX_SCENES.slice(0,4).map(([id,label])=><button key={id} aria-pressed={id===type} onClick={()=>choose(id)}>{label}</button>)}</nav>
 <label className="fx-scene-picker">残りの能力演出<select aria-label="残りの能力演出" value={FX_SCENES.slice(4).some(([id])=>id===type)?type:''} onChange={e=>e.target.value&&choose(e.target.value)}><option value="">演出を選択</option>{FX_SCENES.slice(4).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <section className="fx-scene"><div className="fx-summary"><b>{event?.title||FX_SCENES.find(([id])=>id===type)?.[1]}</b><span>{event?.detail||'この視点では専用演出を表示しません。視点を切り替えて確認できます。'}</span></div>
 <div className="fx-frame"><div className={`board-grid area-board fx-preview-board${boardFieldTheme(state)?" area-illustrated":""}`} style={{gridTemplateColumns:'repeat(9,1fr)'}}>
 <FieldBackdrop theme={boardFieldTheme(state)} areas={state.areas}/>
 {Array.from({length:81},(_,i)=>{const row=flip?8-Math.floor(i/9):Math.floor(i/9),col=flip?8-i%9:i%9,p=board[row][col],mask=active&&event.mask.includes(`${row},${col}`);return <div key={i} className={`cell zone-${row>=5?0:row<=3?1:'center'}${mask?' alice-fx-mask':''}`}>{p&&<div className="piece-slot"><Piece piece={p} viewer={viewer} size="xs"/></div>}</div>;})}
 {active&&<AliceBoardEffects effect={{event,duration,startedAt:0}} flipped={flip} size="xs" progress={t}/>}</div></div>
 <div className="fx-playback"><button className="fx-play" disabled={!event} onClick={()=>{setT(0);setPlayId(i=>i+1);setPlaying(true);}}>▶ {playing?'もう一度再生':'演出を再生'}</button><button onClick={reset}>最初に戻す</button></div>
 <label className="fx-timeline">コマ送り <input aria-label="演出の進み具合" type="range" min="0" max="100" value={Math.round(t*100)} onChange={e=>{setPlaying(false);setT(Number(e.target.value)/100);}}/><output>{Math.round(t*100)}%</output></label>
 <div className="fx-options"><label>視点 <select aria-label="視点" value={viewer} onChange={e=>{setViewer(Number(e.target.value));reset();}}><option value="0">赤陣営</option><option value="1">青陣営</option></select></label>{type==='croquet'&&<label>着地 <select aria-label="着地の結果" value={variant} onChange={e=>{setVariant(e.target.value);reset();}}><option value="empty">空きマス</option><option value="return">元のマス</option><option value="hit">駒に衝突</option><option value="king">王に衝突</option></select></label>}</div>
 <p className="fx-note">{type==='reverse'?'鏡の光が集まり、カードが裏返って数字が逆転します。相手のAは不発。他の2体には効果を適用します。':type==='caucus'?'素早く2回転半して、180度回転した位置に着地します。対象外の駒はその場に残ります。':type==='revive'?'撃破された王が、選んだ自陣の空きマスへ帰還します。':type!=='croquet'?({barrier:'すべての味方を盾で包みます。王にもバリアが適用されます。','false-king':'使う側には任命した駒の王冠、相手には任命されたことだけを表示します。',trap:'偽の王を撃破した駒に鎖が絡まり、3ターン動けなくなります。',clock:'懐中時計を逆回しにします。森で時間が隠れている時は、残り時間を表示しません。',mystery:'正体を隠された側には、表向きのカードが霧の中で裏返る様子を表示します。',unmask:'動かす駒を確定した持ち主にだけ、正体が戻る様子を表示します。',tea:'湯気と光る受け皿から、ティーカップが現れます。',quadrille:'味方と相手を踊る光で結び、動き方の変更を知らせます。',illusion:'煙が盤面を完全に覆ってから、入れ替え後の盤面を表示します。',deception:'使う側には本当の移動先、相手側には偽の移動先だけを見せます。',reappear:'偽の位置の煙が消え、本当の位置に駒が現れます。',maze:'空きマスにツタの封鎖が現れます。封鎖された側の視点で確認できます。',recruit:'陣営の色が変わる光から、仲間になった駒が現れます。'}[type]||''):variant==='king'?'相手の王への直撃は、金色の衝撃波・王冠の破片・ロイヤルブレイクで大きく演出します。':'衝突すると閃光、衝撃波、カードの破片が広がります。空きマスなら着地します。'}</p></section></main>
 </SeatsProvider>;
}
createRoot(document.getElementById('root')).render(<App/>);
