import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {alicePresentationEvent,aliceEffectDuration,aliceEffectProgress} from '../game/alice-presentation.js';
import {useCollection} from '../skins/store.js';
import {useReducedMotion} from './skin-modal.jsx';
import {Piece} from './cards.jsx';
import CSS from './alice-effects.css';
import { playSound, duckMusic } from '../audio/index.js';
import {AliceExtraEffects} from './alice-extra-effects.jsx';

export function useAliceEffects(state,viewer=null,blocked=false) {
  const collection=useCollection(),reduce=useReducedMotion();
  const previous=useRef(state),[running,setRunning]=useState(null);
  const enabled=collection.motion!=='off'&&!reduce;
  const fresh=useMemo(()=>{
    const event=alicePresentationEvent(previous.current,state,viewer);
    if(!event || (!enabled&&!event.royalResult))return null;
    return {event,before:previous.current,duration:enabled?Math.round(aliceEffectDuration(event)*(collection.motion==='short'?.55:1)):0,startedAt:null};
  },[state,viewer,enabled,collection.motion]);
  useLayoutEffect(()=>{previous.current=state;if(fresh)setRunning(fresh);else if(!['play','gameover'].includes(state.phase)||(!enabled&&!running?.event.royalResult))setRunning(null);},[state,fresh,enabled]);
  useEffect(()=>{
    if(!running||blocked)return;
    const cue = {reverse:'alice_reverse',revolution:'alice_revolution',caucus:'alice_caucus',quadrille:'alice_quadrille',maze:'alice_maze',tea:'alice_tea',illusion:'alice_illusion',croquet:'alice_croquet',revive:'revive',recruit:'recruit'}[running.event.type];
    const stop = cue ? playSound(cue) : null;
    const release = cue ? duckMusic(Math.min(running.duration, 2200)) : null;
    setRunning(r=>r&&{...r,startedAt:performance.now()});
    if(running.event.royalResult)return ()=>{stop?.();release?.();};
    const timer=setTimeout(()=>setRunning(null),running.duration);
    return ()=>{clearTimeout(timer);stop?.();release?.();};
  },[running?.event.id,blocked]);
  const active=(previous.current!==state?fresh:null)||running;
  const visible=!blocked&&(enabled||active?.event.royalResult)?active:null;
  return {...visible,duration:enabled?visible?.duration:0,dismiss:()=>setRunning(null),busy:!!visible,viewer:visible?.event.viewer,displayState:visible?.event.displayAfter?state:visible?.before||state,
    isMasked:(row,col)=>!!visible?.event.mask.includes(`${row},${col}`)};
}

const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
const lerp=(a,b,t)=>a+(b-a)*t;
export {aliceEffectProgress} from '../game/alice-presentation.js';
export function AliceEffectNotice({effect}) {
  if(!effect.event)return null;
  return <div className="alice-effect-notice" role="status"><b>{effect.event.title}</b><span>{effect.event.detail}</span></div>;
}
function ReverseMagic({p,t,changed}) {
  const charge=ease(t/.3),release=ease((t-.45)/.36),fade=Math.sin(Math.PI*t)**.7;
  const flash=Math.sin(Math.PI*clamp((t-.36)/.22))**2;
  const spin=180*ease(t/.78),color=changed?'#a8eced':'#bbc1cc';
  return <g className={`alice-reverse-magic${changed?'':' alice-reverse-miss'}`} transform={`translate(${p.x*9} ${p.y*9})`} opacity={fade}>
    {changed&&<ellipse rx={45+charge*15} ry={62+charge*12} fill="url(#alice-reverse-aura)" opacity={.6+flash*.4}/>}
    <g transform={`rotate(${changed?spin:-spin*.4})`}>
      <ellipse rx="59" ry="69" fill="none" stroke={color} strokeWidth="2" strokeDasharray="14 5 2 5"/>
      {[0,90,180,270].map(a=><path key={a} d="M0 -81 L6 -73 L0 -65 L-6 -73 Z" fill={color} transform={`rotate(${a})`}/>)}
    </g>
    {changed?<>
      <g transform={`rotate(${-spin})`}>
        {[0,180].map(a=><path key={a} d="M-28 -62 A68 68 0 0 1 54 -39 L47 -38 M54 -39 L53 -47" fill="none" stroke="#f6d78d" strokeWidth="4" strokeLinecap="round" transform={`rotate(${a})`}/>)}
      </g>
      <rect x="-37" y="-48" width="74" height="96" rx="30" fill="#7de6ed" fillOpacity={.08+flash*.22} stroke="#d2ffff" strokeWidth="2"/>
      <path d="M-28 28 V-18 Q-28 -40 0 -40 Q28 -40 28 -18 V28" fill="none" stroke="#f5d592" strokeWidth="2"/>
      {Array.from({length:18},(_,j)=>{const angle=j*2.399-spin*Math.PI/180,dist=release>0?28+release*(82+j%4*9):100-charge*60,x=Math.cos(angle)*dist,y=Math.sin(angle)*dist;return <path key={j} d="M-4 0 H4 M0 -4 V4" stroke={j%3?'#bcf4f6':'#ffda94'} strokeWidth={j%3?2:3} transform={`translate(${x} ${y}) rotate(${j*23+spin})`} opacity={release>0?(1-release)*.9:.8}/>;})}
      <ellipse rx={18+flash*55} ry={35+flash*50} fill="url(#alice-reverse-aura)" opacity={flash}/>
      {[0,1].map(j=>{const wave=clamp((t-.45-j*.08)/.38);return <ellipse key={j} rx={36+wave*90} ry={46+wave*90} fill="none" stroke={j?'#f6d991':'#b6fbff'} strokeWidth={4*(1-wave)} opacity={t>.45+j*.08?(1-wave)*.8:0}/>;})}
    </>:<>
      {[0,90,180,270].map(a=><path key={a} d="M-20 -48 L-33 -35 L-33 -22" fill="none" stroke="#d2d5df" strokeWidth="3" transform={`rotate(${a}) translate(0 ${-release*22})`} opacity={1-release*.75}/>)}
      <path d="M-22 -22 L22 22 M22 -22 L-22 22" stroke="#d5d9e2" strokeWidth="5" strokeLinecap="round" opacity={flash*.7}/>
    </>}
  </g>;
}
export function AliceBoardEffects({effect,flipped=false,size='sm',progress=null}) {
  const [time,setTime]=useState(0),layer=useRef(null),[inset,setInset]=useState('5px');
  useLayoutEffect(()=>setTime(effect.duration===0?1:0),[effect.event?.id]);
  useLayoutEffect(()=>{const parent=layer.current?.parentElement;if(!parent)return;const sync=()=>{const s=getComputedStyle(parent);setInset(`${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`);};sync();const r=typeof ResizeObserver!=='undefined'?new ResizeObserver(sync):null;r?.observe(parent);return()=>r?.disconnect();},[effect.event?.id]);
  useEffect(()=>{
    if(!effect.event||progress!==null)return;
    if(effect.duration===0){setTime(1);return;}
    let frame;
    const draw=()=>{const t=clamp((performance.now()-(effect.startedAt??performance.now()))/effect.duration);setTime(t);if(t<1)frame=requestAnimationFrame(draw);};
    frame=requestAnimationFrame(draw);return ()=>cancelAnimationFrame(frame);
  },[effect.event?.id,effect.startedAt,effect.duration,progress]);
  if(!effect.event)return null;
  const e=effect.event,t=progress??time,n=e.boardSize,{fly,impact,rotation,flip,arrival}=aliceEffectProgress(e,t);
  const hit=e.type==='croquet' && e.targets.some(a=>a.hit),royal=hit && e.targets.some(a=>a.royal);
  const lost=royal&&(e.royalResult?.lost??e.targets.some(a=>a.royal&&a.piece?.owner===e.viewer));
  const flare=impact>0?Math.sin(Math.PI*clamp(impact/.34))**2:0;
  const debris=impact>0?Math.sin(Math.PI*impact)**.65:0;
  const point=(row,col)=>({x:(flipped?n-.5-col:col+.5)/n*100,y:(flipped?n-.5-row:row+.5)/n*100});
  const center=p=>point(p.row,p.col);
  const flight=(m,f)=>{const arc=Math.min(1.65,(m.from.row+m.to.row+1)/2-.15);return point(lerp(m.from.row,m.to.row,f)-Math.sin(Math.PI*f)*arc,lerp(m.from.col,m.to.col,f));};
  const clone=(piece,p,style={},key='')=><div key={key} className="alice-fx-card" style={{left:`${p.x}%`,top:`${p.y}%`,width:`${100/n}%`,height:`${100/n}%`,...style}}><Piece piece={piece} viewer={e.viewer} size={size}/></div>;
  const glow=(p,r,opacity=1,color='#f4d18b')=><circle cx={p.x*9} cy={p.y*9} r={r} fill="none" stroke={color} strokeWidth="5" opacity={opacity}/>;
  return <div className={`alice-board-effects alice-fx-${e.type}${royal&&impact>0?' alice-fx-royal':''}${lost?' alice-fx-loss':''}`} ref={layer} style={{inset}} data-effect={e.type} data-progress={t.toFixed(2)} data-rotation={e.type==='caucus'?(rotation*180/Math.PI).toFixed(1):undefined} data-royal={royal} aria-hidden={e.royalResult?undefined:true}>
    <style>{CSS}</style>
    {hit&&<div className="alice-croquet-veil" style={{opacity:(e.royalResult?Math.max(debris,ease(impact/.28)):debris)*(royal?.72:.36)}}/>}
    <svg className="alice-fx-art" viewBox="0 0 900 900" preserveAspectRatio="none" aria-hidden="true">
      <defs><filter id="alice-fx-glow"><feGaussianBlur stdDeviation="4"/></filter><radialGradient id="alice-fx-portal"><stop stopColor="#fff3bd"/><stop offset=".45" stopColor="#d8b566" stopOpacity=".8"/><stop offset="1" stopColor="#d8b566" stopOpacity="0"/></radialGradient><radialGradient id="alice-croquet-flare"><stop stopColor="#fff"/><stop offset=".18" stopColor="#fff9c7"/><stop offset=".48" stopColor="#ffd87c" stopOpacity=".85"/><stop offset="1" stopColor="#f3656b" stopOpacity="0"/></radialGradient></defs>
      {e.type==='caucus'&&<g opacity={Math.sin(Math.PI*t)*.65}>{[1,2,3,4].map(r=><ellipse key={r} cx="450" cy="450" rx={r*100} ry={r*100} fill="none" stroke="#d9bd77" strokeWidth="2" strokeDasharray="5 12" transform={`rotate(${rotation*180/Math.PI} 450 450)`}/>)}{[1,2,3].map(r=><path key={'spin'+r} d={`M450 ${450-r*110} A${r*110} ${r*110} 0 0 1 ${450+r*110} 450`} fill="none" stroke="#fff0ad" strokeWidth="7" strokeLinecap="round" transform={`rotate(${rotation*180/Math.PI+r*90} 450 450)`}/>)}{e.cells.map((c,i)=>{const p=center(c);return <rect key={i} x={p.x*9-43} y={p.y*9-43} width="86" height="86" rx="12" fill="#eed69c" fillOpacity=".14" stroke="#eed69c" strokeWidth="2"/>;})}</g>}
      {e.type==='croquet'&&e.moves.map((m,i)=>{const a=flight(m,Math.max(0,fly-.15)),b=flight(m,fly),mid=flight(m,Math.max(0,fly-.075));return <g key={i} opacity={Math.sin(Math.PI*fly)}><path d={`M${a.x*9} ${a.y*9} Q${mid.x*9} ${mid.y*9} ${b.x*9} ${b.y*9}`} fill="none" stroke="#e89c41" strokeWidth="24" opacity=".35"/><path d={`M${a.x*9} ${a.y*9} Q${mid.x*9} ${mid.y*9} ${b.x*9} ${b.y*9}`} fill="none" stroke="#fff0aa" strokeWidth="7" strokeLinecap="round"/><circle cx={b.x*9} cy={b.y*9} r="44" fill="url(#alice-croquet-flare)"/></g>;})}
      {royal&&impact>0&&<g opacity={debris*.8}>{Array.from({length:28},(_,j)=>{const angle=j*Math.PI/14+impact*.12;return <path key={j} d={`M${450+Math.cos(angle)*120} ${450+Math.sin(angle)*120} L${450+Math.cos(angle)*680} ${450+Math.sin(angle)*680}`} stroke={j%2?'#f19b55':'#ffe3a3'} strokeWidth={j%3?4:16} opacity={j%3?.65:.22}/>;})}<rect width="900" height="900" fill="#fff3be" opacity={flare*.35}/></g>}
      {e.type==='croquet'&&e.targets.map((a,i)=>{const p=center(a),x=p.x*9,y=p.y*9;return <g key={i} className="alice-croquet-burst">
        {!a.hit&&glow(p,24+impact*90,impact>0?(1-impact)*.9:.2)}
        {a.hit&&impact>0&&<>
          <circle cx={x} cy={y} r={(royal?310:180)*(1+impact)} fill="url(#alice-croquet-flare)" opacity={flare}/>
          {Array.from({length:royal?5:3},(_,j)=>{const wave=clamp((impact-j*.1)/(1-j*.1));return <circle key={'wave'+j} cx={x} cy={y} r={20+wave*(royal?790:380)} fill="none" stroke={j%2?'#fff5ce':'#efb65b'} strokeWidth={Math.max(1,(1-wave)*(royal?15:10))} opacity={impact>j*.1?(1-wave)*.9:0}/>;})}
          {Array.from({length:royal?72:32},(_,j)=>{const angle=j*2.399,dist=(royal?520:270)*Math.pow(impact,.64)*( .35+(j%9)/12),dx=x+Math.cos(angle)*dist,dy=y+Math.sin(angle)*dist+impact*impact*75,w=6+j%7;return <polygon className="alice-croquet-shard" key={'shard'+j} points={`${-w},${-w} ${w*1.6},0 0,${w*2}`} transform={`translate(${dx} ${dy}) rotate(${j*41+impact*480})`} fill={['#fff4b8','#efbc62','#dd6b7d','#c1f2ef'][j%4]} stroke="#fff8dd" strokeWidth="1" opacity={debris}/>;})}
          {Array.from({length:royal?24:12},(_,j)=>{const angle=j*Math.PI/(royal?12:6),d=impact*(royal?650:310),len=35+(j%4)*14;return <path key={'ray'+j} d={`M${x+Math.cos(angle)*d} ${y+Math.sin(angle)*d} l${Math.cos(angle)*len} ${Math.sin(angle)*len}`} stroke={j%2?'#fff4b9':'#ff999d'} strokeWidth={royal?8:5} opacity={debris}/>;})}
          {royal&&Array.from({length:5},(_,j)=><path key={'crown'+j} d="M-18 8 L-25 -20 L-8 -8 L0 -30 L10 -8 L27 -20 L19 8 Z" fill="#ffdc87" stroke="#fff6c8" strokeWidth="3" transform={`translate(${x+Math.cos(j*1.25+.3)*impact*350} ${y+Math.sin(j*1.25+.3)*impact*350+impact*impact*90}) rotate(${(j-2)*impact*230})`} opacity={debris}/>)}
        </>}
      </g>;})}
      {e.type==='reverse'&&<defs><radialGradient id="alice-reverse-aura"><stop stopColor="#f3ffff"/><stop offset=".2" stopColor="#c0f8ff" stopOpacity=".9"/><stop offset=".55" stopColor="#73d6e8" stopOpacity=".45"/><stop offset="1" stopColor="#698cda" stopOpacity="0"/></radialGradient></defs>}
      {e.type==='reverse'&&e.targets.map((a,i)=><ReverseMagic key={i} p={center(a)} t={t} changed={a.changed}/>)}
      {e.type==='revive'&&e.targets.map((a,i)=>{const p=center(a);return <g key={i} opacity={Math.sin(Math.PI*t)}><ellipse cx={p.x*9} cy={p.y*9+18} rx={52+arrival*20} ry="28" fill="url(#alice-fx-portal)"/>{glow(p,30+arrival*50,.8)}{Array.from({length:14},(_,j)=>{const angle=j*2.399,d=20+(1-arrival)*95;return <circle key={j} cx={p.x*9+Math.cos(angle)*d} cy={p.y*9+Math.sin(angle)*d-arrival*30} r={2+j%4} fill="#ffe6ac"/>;})}</g>;})}
    </svg>
    {e.type==='caucus'&&e.moves.map(m=>{const c=(n-1)/2,x=m.from.col-c,y=m.from.row-c;return clone(m.piece,point(c+y*Math.cos(rotation)+x*Math.sin(rotation),c+x*Math.cos(rotation)-y*Math.sin(rotation)),{},m.id);})}
    {e.type==='croquet'&&<>{e.targets.map((a,i)=>a.piece&&clone(a.piece,center(a),{opacity:1-ease(impact/.3),filter:`brightness(${1+flare*4})`,transform:`translate(-50%,-50%) scale(${1+impact*.8}) rotate(${Math.sin(impact*35)*10*(1-impact)}deg)`},'victim'+i))}{e.moves.map(m=>clone(m.piece,flight(m,fly),{opacity:hit?1-ease(impact/.3):1,filter:impact>0?`brightness(${1+flare*4})`:undefined,transform:`translate(-50%,-50%) scale(${1+.22*Math.sin(Math.PI*fly)+impact*.3}) rotate(${Math.sin(Math.PI*fly)*-24}deg)`},m.id))}</>}
    {royal&&impact>0&&<div className={`alice-royal-banner${lost?' is-loss':''}`} style={{opacity:e.royalResult?ease(impact/.28):Math.sin(Math.PI*clamp((impact-.09)/.85))**.45,transform:`translate(-50%,-50%) scale(${.8+ease(impact/.28)*.2})`}}>
      <svg viewBox="0 0 100 54" aria-hidden="true"><path d="M18 40 L8 8 L32 24 L50 2 L68 24 L92 8 L82 40 Z" fill={lost?'#a68c99':'#f6d68d'} stroke={lost?'#cfbdc6':'#fff4c3'} strokeWidth="3"/><path d="M18 48 H82" stroke={lost?'#a68c99':'#f6d68d'} strokeWidth="5"/>{lost&&<path d="M53 5 L43 25 L56 30 L45 44" fill="none" stroke="#2a1826" strokeWidth="5"/>}</svg>
      <small>{lost?'ROYAL FALL':'ROYAL BREAK'}</small>
      <b role="status">{lost?'王が撃破された':'王 撃 破'}</b>
      {!lost&&e.royalResult&&<em className="alice-royal-congratulations">Congratulations!!</em>}
      <span>クロッケー大会</span>
      {e.royalResult&&t>=1&&effect.dismiss&&<button type="button" className="btn alice-royal-continue" autoFocus onClick={effect.dismiss}>対戦結果へ</button>}
    </div>}
    {e.type==='reverse'&&e.targets.map((a,i)=>{const p=center(a),piece=flip<.5?a.before:a.after,angle=flip<.5?flip*180:(flip-1)*180,lift=a.changed?Math.sin(Math.PI*clamp((t-.1)/.78)):0,flash=Math.sin(Math.PI*clamp((t-.36)/.22))**2;return <div key={i}>{clone(piece,p,{transform:`translate(-50%,calc(-50% - ${lift*6}px)) perspective(500px) rotateY(${a.changed?angle:0}deg) scale(${1+lift*.09})`,filter:a.changed?`brightness(${1+flash*2}) drop-shadow(0 0 ${3+lift*8}px #8de4ed)`:t>.2?'grayscale(.7)':undefined},'flip'+i)}{t>.64&&<span className={`alice-fx-change alice-reverse-change${a.changed?'':' alice-reverse-change-miss'}`} style={{left:`${p.x}%`,top:`${p.y+100/n*.51}%`,width:`${100/n*.98}%`,opacity:ease((t-.64)/.09),transform:`translate(-50%,${(1-ease((t-.64)/.12))*6}px)`}}>{!a.changed?'不発':a.label?<><del>{a.before.rank||'？'}</del><i>→</i><b>{a.after.rank}</b></>:'逆転'}</span>}</div>;})}
    {e.type==='revive'&&e.targets.map((a,i)=>clone(a.piece,center(a),{opacity:arrival,transform:`translate(-50%,${-50+(1-arrival)*40}%) scale(${.75+arrival*.25})`,filter:`brightness(${1+(1-arrival)*2})`},'revive'+i))}
    <AliceExtraEffects event={e} t={t} point={point} clone={clone}/>
  </div>;
}
