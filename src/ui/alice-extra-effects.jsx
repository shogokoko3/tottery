import React from 'react';
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
const lerp=(a,b,t)=>a+(b-a)*t;
const crown='M-24 12 L-32 -20 L-12 -7 L0 -32 L12 -7 L32 -20 L24 12 Z';
const shield='M0 -46 L36 -30 L32 15 Q22 35 0 48 Q-22 35 -32 15 L-36 -30 Z';
const local=(p,n)=>`translate(${p.x*9} ${p.y*9}) scale(${9/n})`;
function Sparks({t,color='#ffe5ab',count=14}){
 const spread=ease((t-.22)/.58),fade=Math.sin(Math.PI*t)**.7;
 return <g opacity={fade}>{Array.from({length:count},(_,j)=>{const a=j*2.399,d=20+spread*(55+j%5*8);return <path key={j} d="M-3 0 H3 M0 -3 V3" transform={`translate(${Math.cos(a)*d} ${Math.sin(a)*d-spread*12}) rotate(${j*29+t*120})`} stroke={color} strokeWidth="2"/>;})}</g>;
}
export function AliceExtraEffects({event:e,t,point,clone}) {
 const type=e.type,n=e.boardSize,fade=Math.sin(Math.PI*t)**.65,arrive=ease((t-.22)/.5),flip=ease((t-.24)/.42);
 const center=p=>point(p.row,p.col),maskTurn=type==='mystery'||type==='unmask';
 const travel=ease((t-.12)/.58);
 const fog=type==='illusion'?ease(t/.32)*(1-ease((t-.61)/.37)):0;
 const targetBadge=(a,label,i)=><span key={'badge'+i} className="alice-fx-change alice-extra-badge" style={{left:`${center(a).x}%`,top:`${center(a).y+100/n*.5}%`,width:`${100/n*.94}%`,opacity:fade}}>{label}</span>;
 return <>
  {type==='illusion'&&(t<.5?e.boardBefore:e.boardAfter)?.map((p,i)=>clone(p,center(p),{},'illusion-'+i))}
  <svg className="alice-fx-art alice-extra-art" viewBox="0 0 900 900" preserveAspectRatio="none">
   <defs>
    <radialGradient id="alice-extra-light"><stop stopColor="#fff6cf"/><stop offset=".35" stopColor="#efce7e" stopOpacity=".7"/><stop offset="1" stopColor="#edc975" stopOpacity="0"/></radialGradient>
    <radialGradient id="alice-extra-mist"><stop stopColor="#aac4c8" stopOpacity=".75"/><stop offset=".5" stopColor="#648899" stopOpacity=".35"/><stop offset="1" stopColor="#648899" stopOpacity="0"/></radialGradient>
   </defs>
   {type==='barrier'&&<g opacity={fade}>
    <ellipse cx="450" cy={center({row:e.owner===0?n-2.5:1.5,col:(n-1)/2}).y*9} rx={arrive*820} ry={arrive*500} fill="none" stroke="#c5f9f7" strokeWidth="8" opacity={(1-arrive)*.7}/>
    {e.targets.map((a,i)=><g key={i} transform={local(center(a),n)} opacity={ease((t-.06-i*.013)/.24)}><path d={shield} fill="#3da2a7" fillOpacity=".22" stroke="#173d48" strokeWidth="6"/><path d={shield} fill="none" stroke="#cafcf5" strokeWidth="3"/><path d="M0 -32 V31 M-23 0 H23" fill="none" stroke="#efdba2" strokeWidth="2"/><path d={shield} fill="none" stroke="#83d0d7" strokeWidth="2" transform={`scale(${1+arrive*.45})`} opacity={1-arrive}/><Sparks t={t} color="#c5fbf3" count={6}/></g>)}
   </g>}
   {type==='barrier-release'&&e.targets.map((a,i)=><g key={'release'+i} transform={local(center(a),n)} opacity={1-ease(t/.85)}><path d={shield} fill="#3da2a7" fillOpacity={(1-arrive)*.2} stroke="#cafcf5" strokeWidth="3" strokeDasharray={`${12*(1-arrive)+2} ${arrive*24}`} transform={`scale(${1+arrive*.3})`}/>{Array.from({length:6},(_,j)=><path key={j} d="M-5 -8 L7 0 L-3 9" fill="none" stroke="#a6e6e4" strokeWidth="2" transform={`rotate(${j*60}) translate(0 ${-35-arrive*48})`} opacity={1-arrive}/>)}</g>)}
   {type==='phantom-hit'&&e.targets.map((a,i)=><g key={'phantom'+i} transform={local(center(a),n)} opacity={fade}>{Array.from({length:8},(_,j)=><ellipse key={j} cx={Math.cos(j*2.399)*(20+arrive*48)} cy={Math.sin(j*2.399)*28-arrive*42} rx={18+arrive*12} ry="18" fill="url(#alice-extra-mist)" opacity={1-arrive*.75}/>)}<path d="M-25 5 Q0 28 25 5 M-20 -15 L-10 -11 M10 -11 L20 -15" fill="none" stroke="#c9c1ee" strokeWidth="3" opacity={1-arrive} transform={`translate(0 ${-arrive*24})`}/></g>)}
   {type==='false-king'&&e.targets.map((a,i)=><g key={i} transform={local(center(a),n)} opacity={fade}><ellipse rx={35+arrive*30} ry={45+arrive*28} fill="url(#alice-extra-light)"/><path d={crown} fill="#e4cc87" stroke="#fff3c5" strokeWidth="2" transform={`translate(0 ${-66+(1-arrive)*-22}) scale(${.5+arrive*.5})`}/><path d="M-27 -8 Q-45 0 -27 30 M27 -8 Q45 0 27 30" fill="none" stroke="#e6d399" strokeWidth="3"/><Sparks t={t}/></g>)}
   {type==='trap'&&e.targets.map((a,i)=><g key={i} transform={local(center(a),n)} opacity={fade}>
    <path d={crown} transform={`translate(0 ${-65-arrive*25}) scale(${1-arrive*.4})`} fill="none" stroke="#e5cd92" strokeWidth="3" strokeDasharray="8 8" opacity={1-arrive}/>
    <ellipse rx="45" ry="54" fill="#99ddf2" fillOpacity={arrive*.22} stroke="#b1e4ee" strokeWidth="3"/>
    {Array.from({length:8},(_,j)=><ellipse key={j} cx={Math.cos(j*Math.PI/4)*43} cy={Math.sin(j*Math.PI/4)*49} rx="8" ry="14" fill="none" stroke="#d9f5fb" strokeWidth="3" transform={`rotate(${j*45+25} ${Math.cos(j*Math.PI/4)*43} ${Math.sin(j*Math.PI/4)*49})`}/>)}
    <path d="M-35 -35 L35 35 M35 -35 L-35 35" stroke="#bfdce9" strokeWidth="6" opacity={arrive*.55}/><Sparks t={t} color="#b9e7f2"/>
   </g>)}
   {type==='clock'&&<g transform="translate(450 410)" opacity={fade}>
    <circle r="184" fill="#091527" fillOpacity=".85" stroke="#debd75" strokeWidth="5"/><circle r="160" fill="none" stroke="#f8e2a2" strokeWidth="2"/>
    <path d="M-25 -186 Q-25 -226 0 -226 Q25 -226 25 -186" fill="none" stroke="#e5c784" strokeWidth="8"/>
    {Array.from({length:12},(_,i)=><path key={i} d="M0 -132 V-151" stroke="#ecd6a1" strokeWidth={i%3?4:7} transform={`rotate(${i*30})`}/>)}
    <path d="M0 0 V-107 M0 0 L62 -29" fill="none" stroke="#f7e3b6" strokeWidth="9" strokeLinecap="round" transform={`rotate(${-1080*ease(t/.82)})`}/>
    <circle r="12" fill="#e6ca83"/>
    {[0,1,2].map(i=><path key={i} d="M-180 -72 A195 195 0 0 0 -168 91 L-190 80 M-168 91 L-169 64" fill="none" stroke="#a9dfe4" strokeWidth="4" transform={`rotate(${i*120-t*180})`} opacity=".8"/>)}
   </g>}
   {maskTurn&&e.targets.map((a,i)=><g key={i} transform={local(center(a),n)} opacity={fade}><ellipse rx={42+arrive*12} ry={50+arrive*12} fill="url(#alice-extra-mist)"/>{type==='mystery'?Array.from({length:6},(_,j)=><ellipse key={j} cx={Math.cos(j*1.1+t*2)*35} cy={Math.sin(j*1.1+t*2)*35} rx="32" ry="20" fill="url(#alice-extra-mist)"/>):<Sparks t={t} color="#d5f6fa"/>}<ellipse rx="40" ry="49" fill="none" stroke="#b4d9d9" strokeWidth="2" strokeDasharray="8 6" transform={`rotate(${t*180})`}/></g>)}
   {type==='mystery'&&!e.targets.length&&<g opacity={fade*.7}>{Array.from({length:7},(_,i)=>{const p=center({row:e.owner===0?1.6:n-2.6,col:1+i});return <ellipse key={i} cx={p.x*9+Math.sin(t*6+i)*30} cy={p.y*9} rx="125" ry="100" fill="url(#alice-extra-mist)"/>;})}</g>}
   {type==='tea'&&e.targets.map((a,i)=>{const appear=ease((t-.18-i*.012)/.5);return <g key={i} transform={local(center(a),n)} opacity={Math.sin(Math.PI*appear)}><ellipse cy="25" rx={25+appear*26} ry="15" fill="url(#alice-extra-light)"/><ellipse cy="26" rx="40" ry="16" fill="none" stroke="#f1db9e" strokeWidth="3"/>{[0,1,2].map(j=><path key={j} d={`M${-14+j*14} -25 Q${-32+j*14} -40 ${-8+j*14} -52 Q${6+j*14} -62 ${-14+j*14} -77`} fill="none" stroke="#e3ece1" strokeWidth="3" transform={`translate(0 ${-appear*20})`} opacity=".75"/>)}<Sparks t={appear}/></g>;})}
   {type==='quadrille'&&e.targets.map((a,i)=>{const p=center(a),s=e.source&&center(e.source),x=p.x*9,y=p.y*9;return <g key={i} opacity={fade}>
    {s&&<><path d={`M${s.x*9} ${s.y*9} Q450 450 ${x} ${y}`} fill="none" stroke="#c3eddf" strokeWidth="15" opacity=".12"/><path d={`M${s.x*9} ${s.y*9} Q450 450 ${x} ${y}`} fill="none" stroke="#ead397" strokeWidth="3" strokeDasharray="12 18" strokeDashoffset={-t*240}/></>}
    <g transform={local(p,n)}><ellipse rx="48" ry="55" fill="none" stroke="#b9eadc" strokeWidth="3" strokeDasharray="18 7" transform={`rotate(${t*240})`}/>{[0,1,2].map(j=><g key={j} transform={`rotate(${j*120-t*120}) translate(0 -72) rotate(${-j*120+t*120})`}><path d="M0 0 V-22 L16 -25 V-4" fill="none" stroke="#e9d59b" strokeWidth="3"/><ellipse cx="-5" cy="0" rx="6" ry="4" fill="#e9d59b"/><ellipse cx="11" cy="-4" rx="6" ry="4" fill="#e9d59b"/></g>)}<Sparks t={t} color="#c9eedf" count={8}/></g>
   </g>;})}
   {type==='deception'&&e.moves.map((m,i)=>{const p=point(lerp(m.from.row,m.to.row,travel),lerp(m.from.col,m.to.col,travel));return <g key={i} opacity={fade}>{Array.from({length:7},(_,j)=>{const f=Math.max(0,travel-j*.06),q=point(lerp(m.from.row,m.to.row,f),lerp(m.from.col,m.to.col,f));return <ellipse key={j} cx={q.x*9} cy={q.y*9} rx={18+j*7} ry={22+j*5} fill="url(#alice-extra-mist)" opacity={1-j*.1}/>;})}<ellipse cx={p.x*9} cy={p.y*9} rx="68" ry="72" fill="url(#alice-extra-mist)"/></g>;})}
   {(e.reappeared||[]).map((a,i)=><g key={'return'+i} opacity={fade}>{[a.from,a.to].map((p,j)=><g key={j} transform={local(center(p),n)}><ellipse rx={35+arrive*48} ry={45+arrive*40} fill="url(#alice-extra-mist)" opacity={j?arrive:1-arrive}/>{j===1&&<Sparks t={t} color="#c3e5e7"/>}</g>)}</g>)}
   {type==='recruit'&&e.targets.map((a,i)=><g key={i} transform={local(center(a),n)} opacity={fade}><ellipse cy="22" rx={35+arrive*15} ry="17" fill="url(#alice-extra-light)" stroke="#e8ce93" strokeWidth="2"/><ellipse rx="48" ry="56" fill="none" stroke={arrive>.5?'#f3b6c3':'#91c3ef'} strokeWidth="3" strokeDasharray="16 7" transform={`rotate(${t*260})`}/><path d={crown} fill="#f3d48c" stroke="#fff0b6" strokeWidth="2" transform={`translate(0 ${-57+(1-arrive)*-30}) scale(.65)`}/><Sparks t={t} color="#f1cbad"/></g>)}
   {(e.blockedCells||[]).map((a,i)=><g key={'maze'+i} transform={local(center(a),n)} opacity={ease(t/.4)*(1-ease((t-.84)/.16)*.3)}><rect x="-43" y="-43" width="86" height="86" rx="11" fill="#10271c" fillOpacity=".65" stroke="#b8d29a" strokeWidth="3"/>{[0,90,180,270].map(j=><g key={j} transform={`rotate(${j})`}><path d="M-40 40 Q-43 -12 18 -38" fill="none" stroke="#99ba7b" strokeWidth="4" strokeDasharray="130" strokeDashoffset={(1-arrive)*130}/><path d="M-36 8 Q-16 -10 -29 -17 Q-43 -4 -36 8 M-14 -27 Q-10 -48 4 -39 Q5 -23 -14 -27" fill="#aec989" opacity={arrive}/></g>)}<path d="M-16 -16 L16 16 M16 -16 L-16 16" stroke="#e6dcc0" strokeWidth="5" strokeLinecap="round" opacity={arrive}/></g>)}
  </svg>
  {type==='phantom-hit'&&e.targets.map((a,i)=>clone(a.piece,center(a),{opacity:1-ease(t/.55),filter:`blur(${arrive*5}px)`,transform:`translate(-50%,${-50-arrive*18}%) scale(${1+arrive*.18})`},'phantom-'+i))}
  {type==='trap'&&e.targets.map((a,i)=>clone(a.piece,center(a),{filter:`saturate(${1-arrive*.55}) drop-shadow(0 0 6px #b8e9f8)`},'trap-'+i))}
  {type==='tea'&&e.targets.map((a,i)=>{const p=ease((t-.18-i*.012)/.5);return clone(a.piece,center(a),{opacity:p,transform:`translate(-50%,${-50+(1-p)*32}%) scale(${.6+p*.4})`,filter:`brightness(${1+(1-p)*1.5})`},'tea-'+i);})}
  {maskTurn&&e.targets.map((a,i)=>{const p=flip<.5?a.before:a.after,angle=flip<.5?flip*180:(flip-1)*180;return clone(p,center(a),{transform:`translate(-50%,-50%) perspective(450px) rotateY(${angle}deg)`,filter:`drop-shadow(0 0 6px #a8d4d9)`},'mask-'+i);})}
  {type==='deception'&&e.moves.map((m,i)=>clone(travel<1?m.piece:e.targets[i]?.piece||m.piece,point(lerp(m.from.row,m.to.row,travel),lerp(m.from.col,m.to.col,travel)),{opacity:.65+arrive*.35,transform:`translate(-50%,${-50-Math.sin(Math.PI*travel)*12}%)`},'deception-'+i))}
  {(e.reappeared||[]).map((a,i)=><React.Fragment key={'reappear'+i}>{t<.44&&clone(a.before,center(a.from),{opacity:1-ease(t/.4)},'ghost-'+i)}{clone(a.after,center(a.to),{opacity:ease((t-.3)/.4),filter:`brightness(${1+(1-arrive)*.8})`},'return-'+i)}</React.Fragment>)}
  {type==='recruit'&&e.targets.map((a,i)=>clone(a.piece,center(a),{opacity:arrive,transform:`translate(-50%,${-50+(1-arrive)*40}%) scale(${.6+arrive*.4})`},'recruit-'+i))}
  {type==='phantom-hit'&&t>.4&&e.targets.map((a,i)=>targetBadge(a,'幻',i))}
  {type==='barrier-release'&&t>.3&&e.targets.map((a,i)=>targetBadge(a,'解除',i))}
  {type==='quadrille'&&t>.42&&e.targets.map((a,i)=>targetBadge(a,'♪ 3',i))}
  {type==='mystery'&&t>.6&&e.targets.map((a,i)=>targetBadge(a,'？',i))}
  {type==='trap'&&t>.45&&e.targets.map((a,i)=>targetBadge(a,'❄ 3',i))}
  {type==='illusion'&&<div className="alice-field-fog" style={{opacity:fog}}>{Array.from({length:10},(_,j)=><i key={j} style={{left:`${(j*31+t*28)%130-15}%`,top:`${j*29%110-10}%`,transform:`scale(${1.2+t*.5})`}}/>)}</div>}
  {type==='false-king'&&!e.targets.length&&<div className="alice-extra-token" style={{opacity:fade,transform:`translate(-50%,-50%) scale(${.8+arrive*.2})`}}><svg viewBox="-45 -45 90 90"><path d={crown} fill="#e2c681" stroke="#fff0bd" strokeWidth="2"/></svg><b>偽の王を任命</b><small>場所は明かされない</small></div>}
  {type==='clock'&&<div className="alice-clock-label" style={{opacity:fade}}><b>{e.seconds==null?'TIME SHIFT':e.seconds?`−${e.seconds}秒`:'下限を維持'}</b><small>{e.seconds==null?'最大30秒短縮':'白ウサギの時間短縮'}</small></div>}
 </>;
}
