import assert from 'node:assert/strict';
import {wonderlandFxScene} from './wonderland-fx-fixtures.mjs';
import {alicePresentationEvent,aliceEffectDuration,aliceEffectProgress} from '../src/game/alice-presentation.js';
import {reducer} from '../src/game/reducer.js';
import {syncAlice} from '../src/game/alice-rules.js';
const events=[];
for(const type of ['croquet','caucus','reverse','revive'])for(const variant of type==='croquet'?['empty','return','hit','king']:['empty']) {
 const {before,after,action}=wonderlandFxScene(type,variant);
 const copy=structuredClone({before,after});
 for(const viewer of [0,1]) {
  const e=alicePresentationEvent(before,after,viewer);assert.equal(e.type,type);assert.ok(e.mask.every(x=>/^\d,\d$/.test(x)));
  assert.equal(alicePresentationEvent(after,after,viewer),null,'no duplicate event on clock/UI update');
  events.push({type,variant,viewer,moves:e.moves.length,targets:e.targets.length});
  if(type==='croquet'){
   assert.equal(e.moves.length,1);assert.equal(e.targets[0].hit,['hit','king'].includes(variant));assert.equal(e.targets[0].royal,variant==='king');
   assert.deepEqual(e.royalResult,variant==='king'?{lost:viewer===1}:undefined,'terminal king defeat waits for each viewer to confirm');
   assert.equal(aliceEffectDuration(e),variant==='king'?3000:variant==='hit'?2400:1800);
   assert.deepEqual(e.moves[0].to,{row:after.lastDefeat?.cells?.[1]?.row??after.pieces['own-1'].row,col:after.lastDefeat?.cells?.[1]?.col??after.pieces['own-1'].col});
   assert.equal(aliceEffectProgress(e,1).fly,1);assert.ok(Math.abs(aliceEffectProgress(e,1).impact-1)<1e-9);
   if(e.targets[0].hit){assert.equal(aliceEffectProgress(e,.60).fly,1);assert.equal(aliceEffectProgress(e,.60).impact,0,'impact follows completed flight');}
  }
  if(type==='caucus'){
   const start=aliceEffectProgress(e,0).rotation,end=aliceEffectProgress(e,1).rotation;
   assert.equal((end-start)/(Math.PI*2),2.5,'two extra turns plus the original half turn');
   const samples=Array.from({length:101},(_,i)=>aliceEffectProgress(e,i/100).rotation);
   assert.ok(samples.every((n,i)=>i===0||n>=samples[i-1]),'rotation never reverses');
   for(const m of e.moves){const x=m.from.col-4,y=m.from.row-4;
    assert.ok(Math.abs(4+y*Math.cos(end)+x*Math.sin(end)-m.to.row)<1e-9);
    assert.ok(Math.abs(4+x*Math.cos(end)-y*Math.sin(end)-m.to.col)<1e-9,'final animation position matches reducer result');
   }
  }
  if(type==='reverse'){
   assert.equal(e.targets.filter(t=>t.changed).length,2);assert.equal(e.targets.filter(t=>!t.changed).length,1);
   assert.equal(aliceEffectDuration(e),2100);
   assert.equal(aliceEffectProgress(e,.24).flip,0,'charge completes before the card turns');
   assert.ok(Math.abs(aliceEffectProgress(e,.45).flip-.5)<1e-9,'both faces meet at the luminous midpoint');
   assert.equal(aliceEffectProgress(e,.66).flip,1,'new face settles before the result label');
  }
  if(type==='revive'){assert.equal(e.targets.length,1);assert.equal(after.winner,null);assert.ok(after.pieces['own-0'].alive);}
 }
 assert.deepEqual({before,after},copy,'presentation never mutates the match');
 assert.deepEqual(reducer(before,action),after,'deterministic gameplay unchanged');
 if(variant==='king')assert.equal(after.phase,'gameover');
}
// Friendly fire also needs a defeat confirmation; a false king does not end the match.
const own= structuredClone(wonderlandFxScene('croquet').before);
const lost=reducer(own,{type:'ALICE_ACTION',kind:'field',player:0,pickIds:['own-1'],row:7,col:4,seed:2000});
assert.equal(lost.phase,'gameover');assert.equal(lost.winner,1);assert.equal(alicePresentationEvent(own,lost,0).targets[0].royal,true);
assert.deepEqual(alicePresentationEvent(own,lost,0).royalResult,{lost:true});
assert.deepEqual(alicePresentationEvent(own,lost,1).royalResult,{lost:false});
const fake=structuredClone(wonderlandFxScene('croquet').before);fake.pieces['foe-1'].falseKing=true;fake.board[1][2]=fake.pieces['foe-1'];
const fakeHit=reducer(fake,{type:'ALICE_ACTION',kind:'field',player:0,pickIds:['own-1'],row:1,col:2,seed:2000});
assert.equal(alicePresentationEvent(fake,fakeHit,0).targets[0].royal,false);
assert.equal(alicePresentationEvent(fake,fakeHit,0).royalResult,undefined);
// A king with a return available must continue to the return placement, not results.
const revivable=structuredClone(own);revivable.pieces['foe-0'].rank='2';
revivable.areaLoadouts[1]={'2':'alice-2-dodo'};
const returnBefore=syncAlice(revivable);
const returnAfter=reducer(returnBefore,{type:'ALICE_ACTION',kind:'field',player:0,pickIds:['own-1'],row:0,col:4,seed:2000});
assert.equal(returnAfter.phase,'play');assert.equal(returnAfter.winner,null);assert.ok(returnAfter.aliceRevive);
assert.equal(alicePresentationEvent(returnBefore,returnAfter,0).royalResult,undefined,'a returning king never waits for a match-results button');
// Previous replay data, recorded before presentation metadata, remains usable.
for(const type of ['croquet','caucus','reverse','revive']){const {before,after}=wonderlandFxScene(type);const legacy={...after,lastAlicePower:{...after.lastAlicePower}};delete legacy.lastAlicePower.presentation;assert.equal(alicePresentationEvent(before,legacy,0).type,type);}
// Normal Alice's reversal keeps an opponent's hidden card hidden in both faces and labels.
let {before}=wonderlandFxScene('reverse');
before=structuredClone(before);before.pieces['own-0'].rank='2';before.board[7][4]=before.pieces['own-0'];
before.pieces['own-1'].rank='A';before.board[5][2]=before.pieces['own-1'];
before.shuffleMode={aId:'own-1',picks:['foe-2']};before=syncAlice(before);
const after=reducer(before,{type:'ALICE_ACTION',kind:'reverse',aId:'own-1',player:0,pickIds:['foe-2'],seed:10});
assert.notEqual(before,after);
const e=alicePresentationEvent(before,after,0);assert.equal(e.targets[0].before.rank,null);assert.equal(e.targets[0].after.rank,null);assert.equal(e.targets[0].label,null);
// Rotation uses the opponent-visible illusion location, never its hidden real square.
let {before:b,after:a}=wonderlandFxScene('caucus');b=structuredClone(b);a=structuredClone(a);
b.pieces['foe-0'].illusion={row:2,col:4,until:12};b.board[0][4]=b.pieces['foe-0'];
a.pieces['foe-0'].illusion={row:6,col:4,until:12};a.board[8][4]=a.pieces['foe-0'];
const ghost=alicePresentationEvent(b,a,0).moves.find(m=>m.id==='foe-0');assert.deepEqual(ghost.from,{row:2,col:4});assert.deepEqual(ghost.to,{row:6,col:4});assert.equal(ghost.piece.rank,null);
console.log('Wonderland presentation: 14 scene/seat cases, royal/self/fake-king distinction, impact timing, 2.5-turn landing, partial miss, revival, privacy and reducer parity: OK');
