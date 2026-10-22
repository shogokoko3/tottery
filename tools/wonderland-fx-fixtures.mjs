import {aliceAreaGameFixture} from './alice-area-game-fixture.mjs';
import {reducer,removePiece,endTurn} from '../src/game/reducer.js';
import {syncAlice} from '../src/game/alice-rules.js';
import {ALICE_FX_SCENES} from '../src/game/alice-presentation.js';
export const FX_SCENES=ALICE_FX_SCENES;
export const previewSeat=type=>['mystery','unmask','reappear','maze','phantom-hit'].includes(type)?1:0;
function change(s,id,patch){const p=s.pieces[id];s.board[p.row][p.col]=null;const q={...p,...patch};s.pieces[id]=q;s.board[q.row][q.col]=q;return s;}
const act=(kind,extra={})=>({type:'ALICE_ACTION',kind,player:0,seed:10,...extra});
export function wonderlandFxScene(type='croquet',variant='empty') {
 const themes={croquet:'alice-croquet',caucus:'alice-caucus',reverse:'alice-tea',revive:'alice-caucus','barrier-release':'alice-quadrille','phantom-hit':'alice-illusion',barrier:'alice-quadrille','false-king':'alice-quadrille',trap:'alice-quadrille',clock:'alice-maze',mystery:'alice-maze',unmask:'alice-maze',tea:'alice-tea',quadrille:'alice-quadrille',illusion:'alice-illusion',deception:'alice-illusion',reappear:'alice-illusion',maze:'alice-maze',recruit:'alice-croquet'};
 let s=aliceAreaGameFixture(themes[type]);let action;
 if(type==='croquet'){
  action=act('field',{pickIds:['own-1'],row:3,col:8});
  if(variant==='return'){const p=s.pieces['own-1'];action={...action,row:p.row,col:p.col,seed:2000};}
  if(variant==='hit'||variant==='king'){const p=s.pieces[variant==='king'?'foe-0':'foe-1'];action={...action,row:p.row,col:p.col,seed:2000};}
 } else if(type==='caucus')action=act('field');
 else if(type==='reverse'){
  s=change(s,'own-0',{rank:'A'});s=change(s,'foe-1',{rank:'A'});s=syncAlice(s);
  s={...s,shuffleMode:{aId:'own-0',picks:['own-1','foe-1','foe-2']}};
  action=act('reverse',{aId:'own-0',pickIds:s.shuffleMode.picks});
 } else if(type==='revive'){s=removePiece(s,'own-0',{by:'foe-1'});action=act('revive',{row:8,col:3});}
 else if(type==='barrier-release'){s=reducer(s,act('king'));s={...s,turnNo:s.aliceBarrier[0]-1,currentTurn:1};action={type:'MOVE_PIECE',player:1,pieceId:'foe-1',row:2,col:2,seed:10};}
 else if(type==='phantom-hit'){s=wonderlandFxScene('deception').after;s=change(s,'foe-1',{row:4,col:1});action={type:'MOVE_PIECE',player:1,pieceId:'foe-1',row:5,col:1,seed:10};}
 else if(type==='barrier'||type==='clock')action=act('king');
 else if(type==='false-king'){s=syncAlice(change(s,'own-0',{rank:'5'}));action=act('king',{pickIds:['own-1']});}
 else if(type==='trap'){
  s=syncAlice(change(s,'own-0',{rank:'5'}));s=reducer(s,act('king',{pickIds:['own-1']}));
  s=change(s,'foe-1',{row:4,col:2});s={...s,currentTurn:1,turnNo:9};
  action={type:'MOVE_PIECE',player:1,pieceId:'foe-1',row:5,col:2,seed:10};
 } else if(type==='mystery'){s=syncAlice(change(s,'own-0',{rank:'7'}));action=act('king');}
 else if(type==='unmask'){
  s=syncAlice(change(s,'own-0',{rank:'7'}));s=endTurn(reducer(s,act('king')));
  const p=Object.values(s.pieces).find(p=>p.alive&&p.owner===1&&p.ownerHidden);
  action=act('unmask',{player:1,pickIds:[p.id]});
 } else if(type==='tea'){
  if(variant==='king')action=act('king');else {s=syncAlice(change(s,'own-0',{rank:'9'}));action=act('field');}
 } else if(type==='quadrille')action=act('field',{pickIds:['own-1','foe-0']});
 else if(type==='illusion'){
  s=change(s,'own-1',{revealed:true});s.known[1]['own-1']=true;
  action=act('field',{pickIds:['own-1','own-3']});
 } else if(type==='deception')action={type:'MOVE_PIECE',player:0,pieceId:'own-1',row:4,col:2,fakeRow:5,fakeCol:1,seed:10};
 else if(type==='reappear'){
  s=wonderlandFxScene('deception').after;
  action={type:'MOVE_PIECE',player:1,pieceId:'foe-1',row:2,col:2,seed:10};
 } else if(type==='maze')action={type:'MOVE_PIECE',player:0,pieceId:'own-1',row:4,col:2,seed:10};
 else if(type==='recruit'){
  s=wonderlandFxScene('croquet','hit').after;action=act('recruit',{row:6,col:4});
 } else if(type==='recruit-k'){
  // 仲間にする配置 → 映像 → 相手の K の予備札の配置、の順を見る場面(2026-10-16 本人の指示)。
  // 相手の foe-1 を J にして(own-1 と同じ黒)、相手の予備札を1枚用意し、クロッケーで当てて取る
  // 王はハートのQ(同じ色なら仲間にできる。own-1 と foe-1 はどちらも黒)
  s=change(s,'own-0',{rank:'Q'});s=change(s,'foe-1',{rank:'J'});s={...s,reserve:[{id:'rsv-1',rank:'6',suit:'spade'}]};s=syncAlice(s);
  const p=s.pieces['foe-1'];action=act('field',{pickIds:['own-1'],row:p.row,col:p.col,seed:2000});
 } else if(type==='revolution'){
  // 革命の扉(Aのフォイル効果)。own-1 を A にして帯から発動する(2026-10-15 本人の指示で帯に移した)
  s=syncAlice(change(s,'own-1',{rank:'A'}));action=act('revolution');
 } else throw Error('Unknown preview scene: '+type);
 const after=reducer(s,action);
 if(after===s)throw Error('Preview action was rejected: '+type);
 return {before:s,after,action};
}
