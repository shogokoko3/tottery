import assert from 'node:assert/strict';
import {FX_SCENES,wonderlandFxScene,previewSeat} from './wonderland-fx-fixtures.mjs';
import {alicePresentationEvent,aliceEffectDuration} from '../src/game/alice-presentation.js';
import {reducer} from '../src/game/reducer.js';
const privateSeat={'phantom-hit':0,unmask:0,reappear:0,maze:0};let cases=0;
for(const [type] of FX_SCENES){
 const {before,after,action}=wonderlandFxScene(type),original=structuredClone({before,after});
 for(const seat of [0,1]){
  const e=alicePresentationEvent(before,after,seat);
  if(privateSeat[type]===seat)assert.equal(e,null,`${type}: this seat receives no private change`);
  else {
   assert.equal(e.type,type);assert.ok(aliceEffectDuration(e)>0);assert.equal(e.viewer,seat);
   for(const pos of [...e.targets,...e.cells,...e.blockedCells,...e.moves.flatMap(m=>[m.from,m.to])])assert.ok(pos.row>=0&&pos.row<after.boardSize&&pos.col>=0&&pos.col<after.boardSize);
   const inspect=value=>{if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){assert.ok(!['ghostOf','illusion','falseKing','danceRank','movementRank','frozenUntil','clocks','aliceRecruit'].includes(key),`${type}: rule-only ${key} must not enter presentation`);inspect(v);}};inspect(e);
  }
  assert.equal(alicePresentationEvent(after,after,seat),null,'clock/UI updates never repeat an ability');cases++;
 }
 assert.ok(alicePresentationEvent(before,after,previewSeat(type)),`${type} has a playable default preview`);
 assert.deepEqual({before,after},original,'event generation is read-only');assert.deepEqual(reducer(before,action),after,'fixture replays the real rule action');
}
let {before,after}=wonderlandFxScene('false-king');
const alternative=reducer(before,{type:'ALICE_ACTION',kind:'king',player:0,seed:10,pickIds:['own-2']});
assert.deepEqual(alicePresentationEvent(before,after,1),alicePresentationEvent(before,alternative,1),'opponent cannot identify the appointed fake king from event data');
assert.equal(alicePresentationEvent(before,after,0).targets.length,1);
({before,after}=wonderlandFxScene('mystery'));
const alternateMist=reducer(before,{type:'ALICE_ACTION',kind:'king',player:0,seed:2000});
assert.deepEqual(alicePresentationEvent(before,after,0),alicePresentationEvent(before,alternateMist,0),'caster receives no secret randomized target identities');
for(const t of alicePresentationEvent(before,after,1).targets){assert.ok(t.before.rank);assert.equal(t.after.rank,null);assert.equal(t.after.suit,null);}
({before,after}=wonderlandFxScene('clock'));
assert.equal(alicePresentationEvent(before,after,0).seconds,undefined,'maze never exposes hidden clock values or actual reduction');
before=structuredClone(before);before.areaLoadouts[0]['6']=before.areaLoadouts[0]['6'].replace(':foil','');
after=reducer(before,{type:'ALICE_ACTION',kind:'king',player:0,seed:10});assert.equal(alicePresentationEvent(before,after,1).seconds,30);
({before,after}=wonderlandFxScene('illusion'));
const illusion=alicePresentationEvent(before,after,1);assert.equal(illusion.mask.length,81);assert.deepEqual(illusion.moves,[]);
for(const id of ['own-1','own-3']){const p=after.pieces[id],q=illusion.boardAfter.find(v=>v.row===p.row&&v.col===p.col);assert.equal(q.rank,null);assert.equal(q.suit,null);assert.match(q.id,/^cell-/);assert.notEqual(q.id,id);}
({before,after}=wonderlandFxScene('deception'));
const seen=alicePresentationEvent(before,after,1),actual=after.pieces['own-1'];assert.deepEqual(seen.moves[0].to,{row:actual.illusion.row,col:actual.illusion.col});assert.ok(!seen.mask.includes(`${actual.row},${actual.col}`),'false move must never indicate the concealed real destination');assert.equal(seen.moves[0].piece.rank,null);
const own=alicePresentationEvent(before,after,0);assert.deepEqual(own.moves[0].to,{row:actual.row,col:actual.col});
({before,after}=wonderlandFxScene('unmask'));const face=alicePresentationEvent(before,after,1).targets[0];assert.equal(face.before.rank,null);assert.ok(face.after.rank);
({before,after}=wonderlandFxScene('reappear'));const returnFx=alicePresentationEvent(before,after,1);assert.equal(returnFx.reappeared.length,1);assert.deepEqual(returnFx.reappeared[0].to,{row:4,col:2});assert.equal(returnFx.reappeared[0].after.rank,null,'position reveal does not also reveal a private rank');
const tea= wonderlandFxScene('tea','king');assert.equal(tea.after.currentTurn,1);assert.equal(alicePresentationEvent(tea.before,tea.after,1).targets.length,1);
console.log(`Wonderland extra presentation: ${cases} scene/seat cases, default previews, repeat suppression, private fake-king/mist/clock/illusion/deception/unmask/reappearance, single-cup turn consumption and reducer replay: OK`);

({before,after}=wonderlandFxScene('phantom-hit'));const phantom=alicePresentationEvent(before,after,1);assert.equal(phantom.targets.length,1);assert.deepEqual({row:phantom.targets[0].row,col:phantom.targets[0].col},{row:5,col:1});assert.ok(after.pieces['own-1'].alive,'hitting a ghost does not kill the real piece');assert.equal(phantom.targets[0].piece.rank,null);
({before,after}=wonderlandFxScene('barrier-release'));for(const seat of [0,1]){const release=alicePresentationEvent(before,after,seat);assert.ok(release.targets.length);assert.ok(release.targets.every(t=>!('piece' in t)),'barrier expiry reveals no card face');}
