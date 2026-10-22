import {aliceBoard, aliceField, aliceKing, aliceClocksHidden, hasAliceRules} from './alice-rules.js';
import {isKnownTo} from './areas.js';

export const ALICE_FX_SCENES = [
  ['croquet','クロッケー'],['caucus','回転'],['reverse','数字逆転'],['revive','帰還'],
  ['barrier-release','バリア解除'],['phantom-hit','幻を撃破'],['barrier','全軍バリア'],['false-king','偽の王を任命'],['trap','偽の王の罠'],
  ['clock','時間短縮'],['mystery','正体を隠す'],['unmask','正体判明'],
  ['tea','ティーカップ召喚'],['quadrille','カドリール'],['illusion','幻影'],
  ['deception','チェシャ猫の偽移動'],['reappear','真の位置が判明'],
  ['maze','森の封鎖'],['recruit','仲間化'],
];
export const ALICE_EFFECT_MS = {croquet:1800,caucus:1900,reverse:2100,revive:1700,
  'barrier-release':1200,'phantom-hit':1500,barrier:1700,'false-king':1600,trap:1700,clock:1700,mystery:1800,unmask:1400,
  tea:1900,quadrille:1900,illusion:2100,deception:1600,reappear:1700,maze:1200,recruit:1800};
export function aliceEffectDuration(event) {
  if(event.type==='croquet' && event.targets.some(t=>t.royal))return 3000;
  if(event.type==='croquet' && event.targets.some(t=>t.hit))return 2400;
  return ALICE_EFFECT_MS[event.type];
}
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n);};
export function aliceEffectProgress(event,t) {
  const collision=event.type==='croquet' && event.targets.some(a=>a.hit);
  return {fly:ease(collision?(t-.09)/.47:(t-.14)/.65),
    impact:clamp(collision?(t-.60)/.40:(t-.77)/.23),
    rotation:ease((t-.09)/.72)*5*Math.PI,
    flip:ease((t-.24)/.42),arrival:ease((t-.28)/.54)};
}
const at = p => ({row:p.row,col:p.col});
const cell = p => `${p.row},${p.col}`;
const realId=p=>p.ghostOf||p.id;
const visiblePieces=(s,viewer)=>aliceBoard(s,viewer).flat().filter(Boolean);
// Pass only the face and location this seat may see. Never pass rule-only flags.
function visual(s,p,viewer) {
  const shown=!(p.ownerHidden && p.owner===viewer) && (p.owner===viewer || p.revealed || isKnownTo(s,viewer,p));
  return {...at(p),id:p.id,owner:p.owner,rank:shown?p.rank:null,suit:shown?p.suit:null,
    revealed:shown,isKing:shown&&!!p.isKing,tea:!!p.tea,teaMovement:p.teaMovement,
    soldier:shown&&!!p.soldier,ownerHidden:!shown,alive:true};
}
// An opponent sees an obscured board change, without a before/after identity map.
const boardVisual=(s,viewer)=>visiblePieces(s,viewer).map(p=>({...visual(s,p,viewer),id:`cell-${p.row}-${p.col}`}));
const TITLES={croquet:'クロッケー大会',caucus:'コーカス・レース',reverse:'数字逆転',revive:'王の帰還',
  'barrier-release':'バリア解除','phantom-hit':'幻を撃破',barrier:'全軍バリア','false-king':'偽の王を任命',trap:'偽の王の罠',clock:'白ウサギの時間短縮',
  mystery:'正体を隠す',unmask:'正体判明',tea:'ティーカップ召喚',quadrille:'カドリール',illusion:'幻影',
  deception:'チェシャ猫の偽移動',reappear:'真の位置が判明',maze:'迷いの森',recruit:'仲間化'};
export function alicePresentationEvent(before,after,seat=null) {
  if(!before || !hasAliceRules(after) || before.phase!=='play' || !['play','gameover'].includes(after.phase))return null;
  const mark=after.lastAlicePower,fresh=mark && mark.seq!==before.lastAlicePower?.seq;
  const newMove=after.lastMove && after.lastMove.seq!==before.lastMove?.seq;
  const newCards=Object.values(after.pieces).filter(p=>p.alive && !before.pieces[p.id]?.alive);
  const recruited=newCards.find(p=>before.aliceRecruit?.some(r=>r.owner===p.owner) && !p.tea && p.id.startsWith('r'));
  const unveiled=Object.values(after.pieces).filter(p=>p.alive && before.pieces[p.id]?.ownerHidden && !p.ownerHidden);
  const trapped=Object.values(after.pieces).find(p=>p.alive && p.frozenUntil>Math.max(before.pieces[p.id]?.frozenUntil||0,after.turnNo||0) && Object.values(before.pieces).some(q=>q.alive && q.falseKing && !after.pieces[q.id]?.alive));
  const fallbackOwner=recruited?.owner ?? unveiled[0]?.owner ?? (newMove?after.lastMove.owner:after.currentTurn);
  const viewer=seat??(fresh?mark.owner:fallbackOwner),owner=fresh?mark.owner:fallbackOwner;
  const old=visiblePieces(before,viewer),now=visiblePieces(after,viewer);
  const oldBy=new Map(old.map(p=>[realId(p),p])),newBy=new Map(now.map(p=>[realId(p),p]));
  const moves=[];let type,targets=[],cells=[],detail='',extra={},stamp=fresh?`power-${mark.seq}`:`turn-${after.turnNo}`;
  const pair=id=>{const p=oldBy.get(id),q=newBy.get(id);return p&&q?{...at(q),before:visual(before,p,viewer),after:visual(after,q,viewer)}:null;};
  if(fresh && mark.kind==='field') {
    const field=aliceField(before,mark.owner);
    if(field==='alice-caucus') {
      type='caucus';
      for(const p of old){const q=newBy.get(realId(p));if(q&&(p.row!==q.row||p.col!==q.col))moves.push({id:realId(p),from:at(p),to:at(q),piece:visual(before,p,viewer)});}
      for(let d=1;d<=4;d++){cells.push({row:4-d,col:4},{row:4+d,col:4},{row:4,col:4-d},{row:4,col:4+d});if(d>=3){const v=d-1;for(const r of [-v,v])for(const c of [-v,v])cells.push({row:4+r,col:4+c});}}
    } else if(field==='alice-croquet') {
      type='croquet';
      const deaths=after.lastDefeat?.seq!==before.lastDefeat?.seq?after.lastDefeat?.cells||[]:[];
      const fallen=deaths.length>=2?before.board[deaths[0].row]?.[deaths[0].col]:null;
      const moved=Object.values(after.pieces).find(p=>p.alive&&p.owner===mark.owner&&before.pieces[p.id]?.soldier&&(p.row!==before.pieces[p.id].row||p.col!==before.pieces[p.id].col));
      const source=before.pieces[mark.presentation?.pieceId]||fallen||moved,seen=source&&oldBy.get(source.id);
      const landing=mark.presentation?.landing||(deaths.length>=2?at(deaths[1]):moved?at(moved):null);
      if(landing){const victim=before.board[landing.row]?.[landing.col],shown=old.find(p=>cell(p)===cell(landing));
        targets=[{...landing,hit:deaths.length>=2,royal:deaths.length>=2&&!!victim?.isKing&&after.pieces[victim.id]?.alive===false,piece:shown?visual(before,shown,viewer):null}];}
      if(seen&&landing)moves.push({id:source.id,from:at(seen),to:landing,piece:visual(before,seen,viewer)});
    } else if(field==='alice-tea')type='tea';
    else if(field==='alice-quadrille') {
      type='quadrille';
      for(const q of now)if(after.pieces[realId(q)]?.danceUntil>Math.max(before.pieces[realId(q)]?.danceUntil||0,after.turnNo||0))targets.push({...at(q),piece:visual(after,q,viewer)});
      const id=mark.presentation?.pickIds?.[0],p=id&&oldBy.get(id);
      if(p)extra.source={...at(p),piece:visual(before,p,viewer)};
      detail='選んだ相手の動き方を3ターン変更';
    } else if(field==='alice-illusion') {
      type='illusion';extra={boardBefore:boardVisual(before,viewer),boardAfter:boardVisual(after,viewer)};
      detail='煙で盤面を覆い、味方2体の位置を交換';
    }
  } else if(fresh && (mark.kind==='reverse'||mark.kind==='revolution')) {
    type='reverse';
    const selected=mark.presentation?.pickIds||(mark.kind==='reverse'?before.shuffleMode?.picks||[]:[]);
    const changed=Object.values(after.pieces).filter(p=>p.alive&&before.pieces[p.id]?.rank!==p.rank).map(p=>p.id);
    for(const id of new Set([...selected,...changed])){const a=pair(id);if(!a)continue;targets.push({...a,changed:before.pieces[id]?.rank!==after.pieces[id]?.rank,label:a.after.rank?`${a.before.rank||'？'} → ${a.after.rank}`:null});}
  } else if(fresh && mark.kind==='revive') {
    type='revive';const p=newCards.find(p=>p.owner===mark.owner&&p.isKing),q=p&&newBy.get(p.id);if(q)targets=[{...at(q),piece:visual(after,q,viewer)}];
  } else if(fresh && mark.kind==='king') {
    if(mark.rank==='4'){
      type='barrier';targets=now.filter(p=>p.owner===owner).map(p=>({...at(p)}));detail='全軍を次の自分のターンまで守る';
    } else if(mark.rank==='5') {
      type='false-king';
      if(viewer===owner){for(const p of now)if(after.pieces[realId(p)]?.falseKing&&!before.pieces[realId(p)]?.falseKing)targets.push({...at(p),piece:visual(after,p,viewer)});}
      detail=viewer===owner?'選んだ駒を偽の王に任命':'相手が偽の王を任命した';
    } else if(mark.rank==='6') {
      type='clock';
      if(!aliceClocksHidden(before)&&!aliceClocksHidden(after))extra.seconds=Math.round(Math.max(0,before.clocks[1-owner]-after.clocks[1-owner])/1000);
      detail='相手の持ち時間を短縮・10秒以下にはしない';
    } else if(mark.rank==='7') {
      type='mystery';
      if(viewer!==owner){for(const p of now)if(p.owner===viewer&&p.ownerHidden&&!before.pieces[realId(p)]?.ownerHidden){const a=pair(realId(p));if(a)targets.push(a);}}
      detail=viewer===owner?'相手の駒の正体を霧で隠した':'動かす駒を確定すると、その正体が判明';
    } else if(['8','9'].includes(mark.rank))type='tea';
  }
  if(type==='tea'){
    targets=newCards.filter(p=>p.tea).map(p=>newBy.get(p.id)).filter(Boolean).map(p=>({...at(p),piece:visual(after,p,viewer)}));
    detail=mark.kind==='king'?'ティーカップを1体配置・手番を消費':'18体になるまで自陣にティーカップを配置';
  }
  if(!type && recruited){type='recruit';const q=newBy.get(recruited.id);if(q)targets=[{...at(q),piece:visual(after,q,viewer)}];detail='撃破した相手の駒が味方として参戦';stamp=`recruit-${after.aliceSerial}`;}
  if(!type && unveiled.some(p=>p.owner===viewer)){
    type='unmask';targets=unveiled.filter(p=>p.owner===viewer).map(p=>pair(p.id)).filter(Boolean);
    detail='この駒を動かすことが確定';stamp=`unmask-${targets.map(p=>cell(p)).join('-')}-${after.turnNo}`;
  }
  if(!type && trapped){const q=newBy.get(trapped.id);if(q){type='trap';targets=[{...at(q),piece:visual(after,q,viewer)}];const p=oldBy.get(trapped.id);if(p)moves.push({id:trapped.id,from:at(p),to:at(q),piece:visual(after,q,viewer)});detail='撃破した駒を3ターン行動不能にする';stamp=`trap-${after.lastDefeat?.seq}`;}}
  const reappeared=[];
  for(const p of old){const id=realId(p),real=before.pieces[id],q=newBy.get(id);if(real?.illusion&&!after.pieces[id]?.illusion&&q&&q.owner!==viewer){reappeared.push({from:at(p),to:at(q),before:visual(before,p,viewer),after:visual(after,q,viewer)});}}
  if(!type && newMove){const p=after.pieces[after.lastMove.pieceId],q=p&&newBy.get(p.id),oldP=p&&oldBy.get(p.id);
    if(p?.illusion&&q&&oldP){type='deception';moves.push({id:p.id,from:at(oldP),to:at(q),piece:visual(before,oldP,viewer)});targets=[{...at(q),piece:visual(after,q,viewer)}];detail=viewer===owner?'自分には本当の移動先を表示':'煙の中に見える移動先';stamp=`deception-${after.lastMove.seq}`;}
  }
  if(!type){
    // Only animate the visible ghost cell; the surviving real piece stays secret.
    const ghosts=old.filter(p=>p.ghostOf && !before.pieces[p.ghostOf]?.illusion?.dispelled && after.pieces[p.ghostOf]?.alive && (after.pieces[p.ghostOf]?.illusion?.dispelled || (newMove && cell(after.lastMove.to)===cell(p))));
    if(ghosts.length){type='phantom-hit';targets=ghosts.map(p=>({...at(p),piece:visual(before,p,viewer)}));detail='幻が煙に消えた・本体は撃破されていない';stamp=`phantom-${after.lastMove?.seq??after.lastAlicePower?.seq}-${after.turnNo}`;}
  }
  if(!type){
    const released=now.filter(p=>before.pieces[realId(p)]?.barrier && !after.pieces[realId(p)]?.barrier);
    if(released.length){type='barrier-release';targets=released.map(p=>({...at(p)}));detail='全軍を守るバリアが消えた';}
  }
  if(!type && reappeared.length){type='reappear';targets=reappeared.map(p=>({...p.to,piece:p.after}));detail='煙が晴れ、本当の位置が分かる';}
  const blockedCells=[];
  const blocked=after.aliceBlocked?.[viewer],oldBlocked=before.aliceBlocked?.[viewer];
  if(blocked && (after.turnNo!==before.turnNo || !oldBlocked || cell(blocked)!==cell(oldBlocked)))blockedCells.push({...blocked});
  if(!type && blockedCells.length){type='maze';detail='このマスは今のターン移動できない';}
  if(!type)return null;
  if(type==='croquet'){
    const royal=targets.find(t=>t.royal);
    detail=royal?(royal.piece?.owner===viewer?'自分の王が撃破された':'相手の王を撃破'):targets[0]?.hit?'衝突した2体を撃破':'トランプ兵が着地';
    // 勝敗はルール上すぐ確定するが、結果画面は各端末で確認するまで待つ。
    // 帰還できる王の撃破では、対局が続くため結果確認を挟まない。
    if(royal && after.phase==='gameover' && after.winner!=null)extra.royalResult={lost:after.winner!==viewer};
  }
  if(type==='caucus')detail='指定マスの駒が180度回転';
  if(type==='revive')detail='復活先へ帰還・対局を続行';
  if(type==='reverse')detail=targets.some(t=>t.changed)?'数字が逆転した・3ターン再逆転不可':'効果は不発';
  const masksCards=['croquet','reverse','revive','tea','unmask','mystery','recruit','trap','deception','reappear','phantom-hit'];
  const mask=new Set(moves.flatMap(m=>[cell(m.from),cell(m.to)]));
  if(masksCards.includes(type))targets.forEach(p=>mask.add(cell(p)));
  reappeared.forEach(p=>{mask.add(cell(p.from));mask.add(cell(p.to));});
  if(type==='illusion')for(let row=0;row<after.boardSize;row++)for(let col=0;col<after.boardSize;col++)mask.add(`${row},${col}`);
  return {id:`alice-${type}-${stamp}`,type,viewer,owner,title:TITLES[type],detail,moves,targets,cells,mask:[...mask],boardSize:after.boardSize,reappeared,blockedCells,displayAfter:['maze','trap','reappear','recruit','phantom-hit','barrier-release'].includes(type),...extra};
}
