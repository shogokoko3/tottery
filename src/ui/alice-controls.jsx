import React, {useState} from 'react';
import {alive, aliceKing, aliceSkin, hasAliceRules, emptyCells, reverseLimit, aliceBoard} from '../game/alice-rules.js';
import {getLegalMoves, kingRankOf, squareName} from '../game/board.js';
import {SUIT_SYMBOL} from '../game/constants.js';

/** 王の力(4〜9)の名前。相手の効果の一覧(alice-areas.jsx)でも使う */
export const ALICE_KING_TEXT={4:'全軍バリア',5:'偽の王を任命',6:'相手の時間を30秒減らす',7:'相手の正体を2体隠す',8:'ティーカップを召喚（手番消費）',9:'ティーカップを召喚（手番消費）'};
const kingText=ALICE_KING_TEXT;

/**
 * シーズン2(アリス)の王の力と、待ちの帯。
 *
 * 2026-10-16 本人の指示で「王の力・特殊能力」の釦と小窓は廃止。見つけにくく、押す頻度も低い。
 * 代わりに、使える技をそのまま帯で出す(魔術師の帯・革命の扉の帯と同じ作り)。
 *   - 王の力(4〜9): 「王の力 ○○」＋発動。5 は偽の王にする駒を選んでから
 *   - 正体不明の駒(相手の 7 にかけられたとき): 動かす駒を選んで確定
 *   - チェシャ猫(10)の騙す位置: 駒を選んだあとに出る
 *   - アリスの A: 盤の A をタップして逆転の対象を選ぶ、の案内
 *   - 相手が仲間にする・王の帰還先を決めている待ち / 自分の王の帰還先
 */
export function AliceControls({state:s,viewer,dispatch,myTurn,busy=false}) {
  const [first,setFirst]=useState(''),[cell,setCell]=useState('');
  if(!hasAliceRules(s) || s.phase!=='play')return null;
  const k=aliceKing(s,viewer), own=alive(s,viewer);
  const pending=s.aliceRecruit?.[0] || s.aliceRevive;
  const reviving=!!s.aliceRevive && !s.aliceRecruit?.length;
  const act=(kind,extra={})=>dispatch({type:'ALICE_ACTION',kind,player:viewer,...extra});
  const label=p=>`${p.owner===viewer?'自':'敵'} ${squareName(p.row,p.col,s.boardSize)} ${p.tea?'ティーカップ':p.ownerHidden && p.owner===viewer?'正体不明':p.owner===viewer||p.revealed?`${p.rank}${SUIT_SYMBOL[p.suit]||''}`:'非公開'}`;
  const select=(value,set,items,prompt)=><select aria-label={prompt} value={items.some(p=>p.id===value)?value:''} onChange={e=>set(e.target.value)}><option value="">{prompt}</option>{items.map(p=><option key={p.id} value={p.id}>{label(p)}</option>)}</select>;
  const used=key=>s.aliceUsed?.[viewer]?.[key]===(s.turnNo||0);
  if(pending){
    if(busy)return null;
    // 相手が決めているあいだは待つ時間(2026-10-16 本人の指示)。帯で大きく出し、K の予備札はこの配置が終わってから引く
    if(pending.owner!==viewer)return <div className="area-bar alice-wait-bar" role="status" aria-live="polite"><span className="area-chip area-chip-alice-ace"><b>相手の選択を待っています…</b><small>{reviving?'相手が王の帰還先を選んでいます':'相手が撃破した駒を仲間にするかを決めています。相手の配置が終わってから、こちらの処理に進みます'}</small></span></div>;
    // 仲間にする置き場は、Kの予備札と同じ盤の画面(ReservePlacer。src/ui/game.jsx)で選ぶ(2026-10-15 本人の指示)
    if(!reviving)return null;
    const cells=emptyCells(s,viewer);
    const chosenCell=cells.find(c=>`${c.row},${c.col}`===cell);
    const at=()=>{const [row,col]=cell.split(',').map(Number);return {row,col};};
    return <div className="alice-dialog"><section className="alice-power-panel alice-controls" role="dialog" aria-modal="true" aria-label="王の帰還先を選択"><header><b>王の帰還先を選択</b></header>
      <select aria-label="対象マス" value={chosenCell?cell:""} onChange={e=>setCell(e.target.value)}><option value="">マスを選択</option>{cells.map(c=><option key={`${c.row},${c.col}`} value={`${c.row},${c.col}`}>{squareName(c.row,c.col,s.boardSize)}</option>)}</select>
      <button className="btn btn-primary" disabled={!chosenCell} onClick={()=>act('revive',at())}>配置する</button></section></div>;
  }
  const ace=own.find(p=>p.rank==='A' && aliceSkin(s,viewer,'A'));
  const selected=s.pieces[s.selectedId];
  const fakeMoves=k?.rank==='10'&&selected&&selected.owner===viewer?getLegalMoves(selected,aliceBoard(s,viewer),s.boardSize,s.players[viewer].armyRankCounts,kingRankOf(s,viewer)).filter(m=>!s.board[m.row][m.col]):[];
  const bars=[];
  const bar=(key,content)=>bars.push(<div className="area-bar ace-foil-bar alice-king-bar" role="group" key={key}>{content}</div>);
  const why=!myTurn?(s.currentTurn!==viewer?'相手の番です':'いまは使えません'):busy?'演出が終わると使えます':'';
  // 王の力(4〜9)
  if(k&&kingText[k.rank]){
    const charged=['4','5'].includes(k.rank), left=Math.max(0,3-(s.aliceCharges?.[k.id]||0));
    const spent=k.rank!=='5'&&used('king'), out=charged&&left<=0;
    const needPick=k.rank==='5'&&!own.some(p=>p.id===first&&!p.isKing&&!p.falseKing);
    const status=out?'3回使い切った':spent?'このターンは発動済み':charged?`残り${left}回`:['8','9'].includes(k.rank)?'手番を使う':'毎ターン1回・手番は使わない';
    bar('king',<>
      <span className="area-chip area-chip-alice-ace" title={`王の力: ${kingText[k.rank]}`}><b>王の力 {kingText[k.rank]}</b><small>{status}</small></span>
      {k.rank==='5'&&!out&&select(first,setFirst,own.filter(p=>!p.isKing&&!p.falseKing),'偽の王にする駒')}
      <button className="btn btn-primary btn-small" style={spent||out?{visibility:'hidden'}:undefined} disabled={!!why||spent||out||needPick||k.frozenUntil>(s.turnNo||0)} title={why||(needPick?'偽の王にする駒を選んでください':'発動')} onClick={()=>act('king',{pickIds:k.rank==='5'?[first]:[]})}>発動</button>
    </>);
  }
  // 相手の 7 で正体が分からなくなった駒。動かす駒を決めると正体が分かる
  if(own.some(p=>p.ownerHidden)){
    const hidden=own.filter(p=>p.ownerHidden);
    bar('unmask',<>
      <span className="area-chip area-chip-alice-ace"><b>正体不明の駒</b><small>動かす駒を決めると正体が分かります</small></span>
      {select(first,setFirst,hidden,'動かす駒')}
      <button className="btn btn-primary btn-small" disabled={!!why||!hidden.some(p=>p.id===first)} title={why||'この駒を動かす'} onClick={()=>act('unmask',{pickIds:[first]})}>この駒を動かす</button>
    </>);
  }
  // チェシャ猫(10)の騙す位置。駒を選んだあとに出る
  if(fakeMoves.length>0){
    bar('fake',<>
      <span className="area-chip area-chip-alice-ace"><b>チェシャ猫の騙す位置</b><small>選んだら、続けて盤面で本当の移動先を選択</small></span>
      <select aria-label="チェシャ猫の騙す位置" value={s.aliceFake?`${s.aliceFake.row},${s.aliceFake.col}`:''} onChange={e=>{const [row,col]=e.target.value.split(',').map(Number);dispatch({type:'ALICE_FAKE',row,col,clear:!e.target.value});}}><option value="">使わない</option>{fakeMoves.map(c=><option key={`${c.row},${c.col}`} value={`${c.row},${c.col}`}>{squareName(c.row,c.col,s.boardSize)}</option>)}</select>
    </>);
  }
  // アリスの A: 盤の A をタップして逆転の対象を選ぶ(自分の番で、まだ何も選んでいないとき)
  if(ace&&myTurn&&!s.selectedId&&!s.shuffleMode&&!used(`reverse-${ace.id}`)){
    bar('ace',<span className="area-chip area-chip-alice-ace"><b>アリスの数字逆転</b><small>盤面の A をタップし、逆転する駒を{reverseLimit(s,ace)}体選びます。相手の A には不発。⇅の駒(逆転から3ターン)は選べません</small></span>);
  }
  return bars.length?<>{bars}</>:null;
}
