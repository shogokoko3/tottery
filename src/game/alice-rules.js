import {discardCards} from "./reserve.js";
import { ALICE_SKINS } from '../skins/alice.js';
import { getLegalMoves, territoryRows, kingPowersOn, kingRankOf } from './board.js';
import { ALICE_RULE_VERSION, GAME_RULE_VERSION } from './rule-version.js';

export const hasAliceRules = s => s.ruleVersion >= ALICE_RULE_VERSION && s.ruleVersion <= GAME_RULE_VERSION;
export function aliceSkin(s, owner, rank) {
  if (!hasAliceRules(s)) return null;
  const id = s.areaLoadouts?.[owner]?.[rank];
  return ALICE_SKINS.find(x => x.id === id?.replace(/:foil$/, '') && x.rank === rank) || null;
}
export function aliceKing(s, owner) {
  const k = s.pieces[s.players[owner].kingId];
  return k?.alive && kingPowersOn(s) && aliceSkin(s, owner, k.rank) ? k : null;
}
export function aliceField(s, owner) {
  const k = aliceKing(s, owner);
  return s.areasEnabled && s.boardSize===9 && k && k.rank!=='A' && s.areaLoadouts?.[owner]?.[k.rank]?.endsWith(':foil')
    ? aliceSkin(s, owner, k.rank)?.fieldEffect?.type : null;
}
export const alive = (s, owner) => Object.values(s.pieces).filter(p => p.alive && (owner == null || p.owner === owner));
export function emptyCells(s, owner = null) {
  const [lo, hi] = owner == null ? [0, s.boardSize - 1] : territoryRows(s.boardSize, owner);
  const cells = [];
  for (let row = lo; row <= hi; row++) for (let col = 0; col < s.boardSize; col++)
    if (!s.board[row][col]) cells.push({row, col});
  return cells;
}
const turn = s => s.turnNo || 0;
// 自分の次の3手番まで。既存の氷と同じ絶対手番番号で保持する。
const threeTurns = (s, owner) => turn(s) + (owner === s.currentTurn ? 8 : 7);
export function aliceRandom(seed) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}
const pick = (xs, rng) => xs[Math.floor(rng() * xs.length)];
function update(s, p) {
  const pieces = {...s.pieces, [p.id]: p}, board = s.board.map(r => [...r]);
  if (p.alive) board[p.row][p.col] = p;
  return {...s, pieces, board};
}
function log(s, text) { return {...s, log: [...s.log, text]}; }
function used(s, owner, key) { return s.aliceUsed?.[owner]?.[key] === turn(s); }
function spend(s, owner, key) {
  return {...s, aliceUsed: {...s.aliceUsed, [owner]: {...s.aliceUsed?.[owner], [key]: turn(s)}}};
}
export function reverseCandidates(s, a) {
  return alive(s).filter(p => !p.tea && p.id !== a.id &&
    (p.owner !== a.owner || (p.rank !== 'A' && ((a.isKing && kingPowersOn(s)) || !p.isKing))) &&
    !(p.reverseUntil > turn(s)) && (p.owner===a.owner || !p.barrier));
}
/** 逆転の縛り中(逆転してから3ターンはもう一度選べない)。盤の印(src/ui/cards.jsx)と文言に使う */
export const reverseLocked = (s, p) => !!p && p.reverseUntil > turn(s);
/** 残りターン。氷と同じ「手数÷2」だが、縛りの手数(+8/+7)は氷(+6)より長いので、決まりの「3ターン」を上限にする */
export const reverseTurnsLeft = (s, p) => reverseLocked(s, p) ? Math.min(3, Math.ceil((p.reverseUntil - turn(s)) / 2)) : 0;
export function reverseLimit(s, a) { return Math.min(a.isKing && kingPowersOn(s) ? 3 : 1, reverseCandidates(s, a).length); }
const inverse = {2:'K',3:'Q',4:'J',5:'10',6:'9',7:'8',8:'7',9:'6',10:'5',J:'4',Q:'3',K:'2'};
function reverse(s, p, reveal) {
  if (!inverse[p.rank]) return s; // 相手のAだけが不発。他の対象には続けて適用する。
  return update(s, {...p, rank: inverse[p.rank], originalRank:p.originalRank || p.rank, reverseUntil: threeTurns(s, p.owner),
    revealed: reveal ? true : !!p.revealed, history: [...p.history, '数字が逆転した']});
}
// 合法手・CPU・表示に共通する駒の印。現在の数字の装備で王の力を再評価する。
export function syncAlice(s) {
  if (!hasAliceRules(s) || !s.board?.length) return s;
  if (!s.areaLoadouts?.some(l=>Object.values(l||{}).some(id=>String(id).startsWith('alice-'))) && !Object.values(s.pieces).some(p=>p.tea || p.aliceSkin || p.danceUntil || p.illusion || p.ownerHidden)) return s;
  let changed = false; const pieces = {...s.pieces};
  for (const p of Object.values(pieces)) {
    if (!p.alive) continue;
    const k = aliceKing(s, p.owner), skin = aliceSkin(s, p.owner, p.rank);
    const flags = {aliceSkin: !!skin, aliceKingRank: k?.rank || null,
      soldier: !!k && ['J','Q','K'].includes(k.rank) && !p.isKing && !p.tea && !['A','J','Q'].includes(p.rank),
      teaMovement: p.tea ? (k?.rank === '9' ? 'diag' : k?.rank === '8' ? 'orth' : p.teaMovement) : undefined,
      movementRank: p.danceUntil > turn(s) ? p.danceRank : null,
      blockedCell: s.aliceBlocked?.[p.owner] || null,
      barrier: (s.aliceBarrier?.[p.owner] || 0) > turn(s)};
    if (Object.entries(flags).some(([key,value]) => p[key] !== value)) { pieces[p.id] = {...p, ...flags}; changed = true; }
  }
  const areas = [...(s.areas || [null,null])];
  const legacy={2:'earth',3:'earth',4:'sea',5:'sea',6:'forest',7:'forest',8:'ice',9:'ice',10:'sky',J:'palace',Q:'palace',K:'palace'};
  const players=[...s.players];
  if(s.phase==='play' || s.phase==='gameover') for (const owner of [0,1]) {
    const old=areas[owner], king=pieces[s.players[owner].kingId], rank=king?.rank;
    const id=s.areaLoadouts?.[owner]?.[rank], foil=s.areasEnabled && s.boardSize===9 && id?.endsWith(':foil');
    const skin=aliceSkin(s,owner,rank);
    const type=king?.alive ? (foil ? (skin ? (rank==='A'?null:skin.fieldEffect?.type) : legacy[rank]) : null) : old?.type?.startsWith('alice-')?null:old?.type;
    if(type!==old?.type && (type || old)){
      areas[owner]=type?{type,rank,skin:id,used:false,uses:0}:null;changed=true;
      if(old?.type==='sky'){
        players[owner]={...players[owner],skyTwice:false};
        for(const p of Object.values(pieces))if(p.owner===owner && p.skyTwice)pieces[p.id]={...p,skyTwice:false};
      }
    }
  }
  return changed ? {...s, pieces, players, areas, board: s.board.map(r => r.map(p => p ? pieces[p.id] : null))} : s;
}
export function aliceBoard(s, viewer) {
  if (!hasAliceRules(s)) return s.board;
  const board = s.board.map(r => [...r]);
  for (const p of alive(s)) {
    if (p.owner === viewer || !p.illusion || p.illusion.until <= turn(s)) continue;
    if (board[p.row][p.col]?.id === p.id) board[p.row][p.col] = null;
    if (p.illusion.dispelled) continue;
    const {row,col} = p.illusion;
    board[row][col] = {...p, id: `ghost-${p.id}`, row, col, ghostOf: p.id};
  }
  return board;
}
export function aliceAfterTurn(s) {
  if (!hasAliceRules(s)) return s;
  const rng = aliceRandom((s.aliceSeed || 0) ^ Math.imul(turn(s)+1, 2654435761));
  const owner = s.currentTurn, other = 1-owner;
  let next = s;
  for (const p of alive(s, owner)) if (p.illusion) next = update(next, {...p, illusion:null});
  const blocked = {...s.aliceBlocked, [other]: null, [owner]: null};
  if (aliceField(next, other) === 'alice-maze') blocked[owner] = pick(emptyCells(next), rng) || null;
  return syncAlice({...next, aliceBlocked: blocked});
}
export const aliceClocksHidden = s => [0,1].some(o => aliceField(s,o) === 'alice-maze');
export function revivalAvailable(s, dead) {
  if (!dead.isKing || !['2','3'].includes(dead.rank) || !aliceSkin(s, dead.owner, dead.rank) || !kingPowersOn(s)) return false;
  const total = s.players[dead.owner].armyRankCounts[dead.rank] || 1;
  return (s.aliceRevives?.[dead.id] || 0) < total && emptyCells(s, dead.owner).length > 0;
}
// removePiece の最後で呼ぶ。通常の王位継承・即時敗北とは別に復活待ちを作る。
export function aliceAfterDefeat(s, dead, opts) {
  if (!hasAliceRules(s)) return s;
  let next = s;
  if (dead.isKing && revivalAvailable(s, dead)) next = {...next, winner:null, phase:'play', aliceRevive:{owner:dead.owner, pieceId:dead.id}};
  if (dead.falseKing && opts.by) {
    const killer = next.pieces[opts.by];
    if (killer?.alive) next = update(next, {...killer, revealed:true, frozenUntil: Math.max(killer.frozenUntil||0, threeTurns(next,killer.owner))});
  }
  const killer = next.pieces[opts.by], k = killer && aliceKing(next,killer.owner);
  if (killer && k && ['J','Q','K'].includes(k.rank) && !dead.tea && dead.owner !== killer.owner) {
    const red = suit => ['H','D','heart','diamond','hearts','diamonds','♥','♦'].includes(suit);
    const match = k.rank === 'Q' ? red(killer.suit) === red(dead.suit) : killer.rank === dead.rank;
    // seq は映像の合図(src/skins/events.js recruitFilm)。動画は配置より先に流す(2026-10-16 本人の指示)
    if (match) { const seq=(next.aliceRecruitSeq||0)+1; next = {...next, aliceRecruitSeq:seq, aliceRecruit: [...(next.aliceRecruit||[]), {owner:killer.owner, card:dead, rank:k.rank, seq}]}; }
  }
  return next;
}
function spawn(s, owner, cell, rank) {
  const id = `t${s.aliceSerial||0}`;
  const p = {id, rank:'tea', suit:null, tea:true, teaMovement:rank==='9'?'diag':'orth', owner, row:cell.row,col:cell.col,alive:true,isKing:false,revealed:true,history:[]};
  return update({...s,aliceSerial:(s.aliceSerial||0)+1},p);
}
const cellOk = (s, a) => Number.isInteger(a.row) && Number.isInteger(a.col) && a.row>=0 && a.row<s.boardSize && a.col>=0 && a.col<s.boardSize;
/** 革命の扉(アリスのAのフォイル効果)を持つ、盤上の自分のA。無ければ null */
export function revolutionAce(s, owner) {
  return alive(s,owner).find(p=>p.rank==='A' && aliceSkin(s,owner,'A') && s.areaLoadouts?.[owner]?.A?.endsWith(':foil')) || null;
}
/** 革命の扉で逆転の対象になりうる駒(自分: 王とA以外 / 相手: 王以外。縛り中・バリア中・ティーカップは除く。2026-10-16 本人の訂正) */
export function revolutionCandidates(s, owner) {
  return alive(s).filter(p=>!p.tea && !(p.reverseUntil>turn(s)) && (p.owner===owner || !p.barrier) && (p.owner===owner?(!p.isKing&&p.rank!=='A'):!p.isKing));
}
/**
 * 革命の扉を今すぐ発動できるか。魔術師(canUseAceFoil)と同じ形で {ok, why} を返し、
 * 盤の上の帯(src/ui/game.jsx)が釦の有効・無効と理由を出す(2026-10-15 本人の指示。
 * 王の力の小窓を開かないと使えるか分からなかった)。aliceAction の revolution と同じ条件
 */
export function canUseRevolution(s, owner) {
  if (!hasAliceRules(s) || s.phase !== 'play' || s.winner != null) return {ok:false, why:'対局中ではありません'};
  if (!s.areasEnabled) return {ok:false, why:'エリアありの対戦で使えます'};
  const ace = revolutionAce(s, owner);
  if (!ace) return {ok:false, why:'アリスのAのフォイルを盤に置いていません'};
  if (s.aliceRevive || s.aliceRecruit?.length) return {ok:false, why:'現在の操作を終えてください'};
  if (owner !== s.currentTurn) return {ok:false, why:'相手の番です'};
  if (s.pendingKingChoice || s.kPlacement || s.extraMoveFor) return {ok:false, why:'通常の行動の前にだけ使えます'};
  if (used(s, owner, 'revolution')) return {ok:false, why:'このターンでは発動済みです'};
  if (ace.frozenUntil > turn(s)) return {ok:false, why:'Aが動けないあいだは使えません'};
  if (!revolutionCandidates(s, owner).length) return {ok:false, why:'逆転できる駒がありません'};
  return {ok:true, why:''};
}
export function aliceAction(s, a, hooks) {
  if (a.type !== 'ALICE_ACTION') return null;
  if (!hasAliceRules(s) || s.phase !== 'play' || s.winner != null) return s;
  const owner = a.player ?? s.currentTurn;
  if (s.aliceRecruit?.length) {
    const entry = s.aliceRecruit[0];
    if (owner !== entry.owner || !['recruit','decline'].includes(a.kind)) return s;
    // 置き場は自陣の空きマスだけ。レジェンドのKが予備札を配置するときと同じ決まり(2026-10-15 本人の指示)
    if (a.kind === 'recruit' && !emptyCells(s, owner).some(c => c.row === a.row && c.col === a.col)) return s;
    let next = {...s, aliceRecruit:s.aliceRecruit.slice(1)};
    if (a.kind === 'recruit') {
      const id=`r${s.aliceSerial||0}`;
      next = update({...next,aliceSerial:(s.aliceSerial||0)+1}, {...entry.card,id,owner,alive:true,isKing:false,falseKing:false,illusion:null,ownerHidden:false,frozenUntil:null,danceUntil:null,rank:entry.card.rank,row:a.row,col:a.col,history:[],revealed:true});
      next = log(next,'撃破した駒を仲間にした');
      // 仲間の映像は撃破の時点(待ちが立ったとき)に流し終えている(recruitFilm)。配置ではもう流さない(2026-10-16 本人の指示)
    }
    if(a.kind==='decline' && next.aliceRevive?.pieceId!==entry.card.id)next=discardCards(next,[entry.card]);
    return syncAlice(next);
  }
  if (s.aliceRevive) {
    const pending = s.aliceRevive;
    if (a.kind !== 'revive' || owner !== pending.owner || !cellOk(s,a) || !emptyCells(s,owner).some(c=>c.row===a.row && c.col===a.col)) return s;
    const dead = s.pieces[pending.pieceId];
    let next = update({...s, aliceRevive:null, aliceRevives:{...s.aliceRevives,[dead.id]:(s.aliceRevives?.[dead.id]||0)+1}}, {...dead,alive:true,row:a.row,col:a.col,everRevived:true});
    next = {...next,players:next.players.map((p,i)=>i===owner?{...p,capturedOwn:p.capturedOwn.filter(c=>c.id!==dead.id)}:p), lastAlicePower:{owner,rank:dead.rank,kind:'revive',seq:(s.lastAlicePower?.seq||0)+1}};
    next = log(next,'王が自陣に帰還した');
    return syncAlice(next);
  }
  if (owner !== s.currentTurn || s.pendingKingChoice || s.kPlacement || s.extraMoveFor) return s;
  if (!Number.isInteger(a.seed) || a.seed<0 || a.seed>4294967295) return s;
  const rng = aliceRandom(a.seed), k = aliceKing(s,owner), ids = a.pickIds || [];
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) return s;
  const selected = ids.map(id=>s.pieces[id]);
  if (selected.some(p=>!p?.alive)) return s;
  let next = {...s,aliceSeed:a.seed}, presentation, royal=false;
  const usedKey = a.kind === 'reverse' ? `reverse-${a.aId}` : a.kind === 'revolution' ? 'revolution' : a.kind === 'field' ? 'field' : 'king';
  if (a.kind !== 'unmask' && !(a.kind==='king' && k?.rank==='5') && used(s,owner,usedKey)) return s;
  if (a.kind === 'reverse') {
    const ace = s.pieces[a.aId];
    if (!ace?.alive || (!ace.isKing && ace.movementRank) || ace.owner !== owner || ace.rank !== 'A' || !aliceSkin(s,owner,'A') || ace.frozenUntil>turn(s)) return s;
    const candidates=reverseCandidates(s,ace), limit=reverseLimit(s,ace);
    if (!limit || ids.length!==limit || selected.some(p=>!candidates.some(c=>c.id===p.id))) return s;
    royal=ace.isKing && kingPowersOn(s);
    presentation={pickIds:ids};
    // Aが王のときだけ、選んだ駒を自分の駒も相手の駒も公開にする(2026-10-16 本人)。王でなければ公開・非公開はそのまま
    for (const p of selected) next=reverse(next,p,royal);
    if (!royal) next=update(next,{...next.pieces[ace.id],revealed:true});
    next={...next,selectedId:null,shuffleMode:null};
    next=log(next,'アリスが数字の逆転を試みた');
  } else if (a.kind === 'revolution') {
    const ace=revolutionAce(s,owner);
    if (!ace || !s.areasEnabled || ace.frozenUntil>turn(s)) return s;
    const candidates=revolutionCandidates(s,owner);
    if (!candidates.length) return s;
    const target=pick(candidates,rng);presentation={pickIds:[target.id]};
    next=reverse(next,target,false); next=log(next,'アリスのフォイル効果で数字を逆転した');
  } else if (a.kind === 'king') {
    if (!k || k.frozenUntil>turn(s)) return s;
    if (k.rank === '4') {
      const n=s.aliceCharges?.[k.id]||0; if(n>=3)return s;
      next={...next,aliceCharges:{...s.aliceCharges,[k.id]:n+1},aliceBarrier:{...s.aliceBarrier,[owner]:turn(s)+2}};
      next=log(next,'グリフォンが全軍にバリアを張った');
    } else if(k.rank === '5') {
      const n=s.aliceCharges?.[k.id]||0, p=selected[0];
      if(n>=3 || ids.length!==1 || p.owner!==owner || p.isKing || p.falseKing || alive(s,owner).filter(p=>p.falseKing).length>=3)return s;
      next=update({...next,aliceCharges:{...s.aliceCharges,[k.id]:n+1}},{...p,falseKing:true}); next=log(next,'ニセウミガメが偽の王を任命した');
    } else if(k.rank === '6') {
      if(!Array.isArray(s.clocks))return s;
      const clocks=[...s.clocks]; clocks[1-owner]=Math.min(clocks[1-owner],Math.max(10000,clocks[1-owner]-30000)); next={...next,clocks}; next=log(next,'白ウサギが相手の持ち時間を減らした');
    } else if(k.rank === '7') {
      const candidates=alive(s,1-owner).filter(p=>!p.tea && !p.ownerHidden && !p.barrier);
      const count=Math.min(2,candidates.length);
      for(let i=0;i<count;i++){const p=candidates.splice(Math.floor(rng()*candidates.length),1)[0];next=update(next,{...p,ownerHidden:true});}
      if(!candidates.length && !alive(s,1-owner).some(p=>!p.tea && !p.ownerHidden))return s;
      next=log(next,'イモムシが相手の駒の正体を隠した');
    } else if(['8','9'].includes(k.rank)) {
      const cells=emptyCells(s,owner); if(!cells.length)return s;
      next=spawn(next,owner,pick(cells,rng),k.rank);next=log(next,'ティーカップを召喚した');
      return hooks.endAction(syncAlice(spend({...next,lastAlicePower:{owner,rank:k.rank,kind:a.kind,seq:(s.lastAlicePower?.seq||0)+1}},owner,usedKey)),null);
    } else return s;
  } else if(a.kind === 'field') {
    const type=aliceField(s,owner); if(!type)return s;
    if(type==='alice-caucus') {
      if(s.boardSize!==9)return s;
      const positions=[];for(let d=1;d<=4;d++){positions.push([4-d,4],[4+d,4],[4,4-d],[4,4+d]);if(d>=3){const v=d-1; positions.push([4-v,4-v],[4-v,4+v],[4+v,4-v],[4+v,4+v]);}}
      const board=next.board.map(r=>[...r]);const pieces={...next.pieces};
      for(const [r,c] of positions){const p=s.board[r][c];board[8-r][8-c]=p?{...p,row:8-r,col:8-c}:null;if(p)pieces[p.id]=board[8-r][8-c];}
      for(const p of Object.values(pieces))if(p.alive && p.illusion && positions.some(([r,c])=>r===p.illusion.row&&c===p.illusion.col)){
        const changed={...p,illusion:{...p.illusion,row:8-p.illusion.row,col:8-p.illusion.col}};pieces[p.id]=changed;board[p.row][p.col]=changed;
      }
      next={...next,board,pieces};
    } else if(type==='alice-quadrille') {
      presentation={pickIds:ids};
      const [source,target]=selected;
      if(ids.length!==2 || source.owner!==owner || source.isKing || source.tea || source.rank==='A' || target.owner===owner || target.barrier)return s;
      next=update(next,{...target,danceRank:source.rank,danceUntil:threeTurns(s,target.owner)});
    } else if(type==='alice-tea') {
      let cells=emptyCells(next,owner), n=alive(next).length;
      if(n>=18 || !cells.length)return s;
      while(n<18 && cells.length){const at=cells.splice(Math.floor(rng()*cells.length),1)[0];next=spawn(next,owner,at,k.rank);n++;}
    } else if(type==='alice-illusion') {
      presentation={pickIds:ids};
      const [p,q]=selected;if(ids.length!==2 || p.owner!==owner || q.owner!==owner)return s;
      next=update(next,{...p,row:q.row,col:q.col,revealed:false}); next=update(next,{...q,row:p.row,col:p.col,revealed:false});
      // 見抜き情報も消す。公開フラグだけ消しても相手画面が表向きのままになる。
      const known=(next.known||[{},{}]).map(m=>({...m}));delete known[1-owner][p.id];delete known[1-owner][q.id];next={...next,known,lastAliceSmoke:turn(s)};
    } else if(type==='alice-croquet') {
      const p=selected[0];if(ids.length!==1 || !p.soldier || p.owner!==owner || Math.max(Math.abs(p.row-k.row),Math.abs(p.col-k.col))>2 || !cellOk(s,a))return s;
      const cells=[[0,0],[-1,0],[1,0],[0,-1],[0,1]].map(([r,c])=>({row:a.row+r,col:a.col+c})).filter(c=>cellOk(s,c));
      const at=pick(cells,rng), occupant=s.board[at.row][at.col], victim=occupant?.id===p.id?null:occupant, ghost=aliceBoard(s,owner)[at.row][at.col];
      // from は「どこから飛ばしたか」(王の5×5の中)。公開情報なので相手の王の読み(cpu-alice.js)に使える
      presentation={pieceId:p.id,from:{row:p.row,col:p.col},landing:{row:at.row,col:at.col}};
      if(ghost?.ghostOf){const real=next.pieces[ghost.ghostOf];next=update(next,{...real,illusion:{...real.illusion,dispelled:true}});}
      if(victim){ next=hooks.removePiece(next,p.id,{by:null});if(victim.id!==p.id)next=hooks.removePiece(next,victim.id,{by:p.id}); }
      else {const board=next.board.map(r=>[...r]);board[p.row][p.col]=null;next=update({...next,board},{...p,row:at.row,col:at.col,...(ghost?.ghostOf?{revealed:true}:{})});}
    } else return s;
    next=log(next,'シーズン2の盤面効果を発動した');
  } else if(a.kind==='unmask') {
    const p=selected[0]; if(ids.length!==1 || p.owner!==owner || !p.ownerHidden)return s;
    // 移動する駒を確定する。確認後に別の駒へ選び直せない。
    return {...update(next,{...p,ownerHidden:false}),aliceCommitted:p.id,selectedId:p.rank==='A'&&!p.movementRank?null:p.id,shuffleMode:p.rank==='A'&&!p.movementRank?{aId:p.id,picks:[]}:null};
  } else return s;
  if(next.winner!=null)next={...next,phase:'gameover'};
  next={...next,lastAlicePower:{owner,rank:a.kind==='reverse'||a.kind==='revolution'?'A':k?.rank,kind:a.kind,seq:(s.lastAlicePower?.seq||0)+1,at:turn(s),...(presentation?{presentation}:{}),
    // 映像の振り分け用：A の逆転が王の力だったか(2026-10-14 本人の指示。王なら3体版、王以外なら1体版)
    ...(a.kind==='reverse'?{royal}:{})}};
  return syncAlice(spend(next,owner,usedKey));
}
