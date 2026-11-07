import assert from 'node:assert/strict';
import {wonderlandFxScene} from './wonderland-fx-fixtures.mjs';
import {reducer} from '../src/game/reducer.js';
import {filmPlanFor,filmQueueState} from '../src/skins/events.js';
import {alicePresentationEvent} from '../src/game/alice-presentation.js';
import {captureDisplayState} from '../src/game/capture-presentation.js';
import {byId} from '../src/skins/catalog.js';

for(const variant of ['hit','king']) {
  const {before,after}=wonderlandFxScene('croquet',variant);
  const loadouts=before.areaLoadouts;
  const skin=byId(loadouts[0].Q);
  assert.ok(after.captureReveal?.croquet);
  assert.equal(after.captureReveal.defeated.length,1,'犠牲にした自軍の兵は相手の撃破札に混ぜない');
  assert.equal(after.captureReveal.defeated[0].owner,1);
  assert.equal(after.captureReveal.defeated[0].isKing,variant==='king');
  const copy=structuredClone({before,after});
  for(const viewer of [0,1,null]) {
    const plan=filmPlanFor(before,after,loadouts,viewer);
    assert.equal(plan[0].skin.video,skin.videos.field,'クロッケーの動画が先頭');
    assert.equal(plan[0].afterReveal,false);
    assert.equal(filmQueueState(plan,{revealPending:true}).active,plan[0]);
    const rest=plan.slice(1);
    assert.equal(filmQueueState(rest,{revealPending:true}).busy,false,'公開待ちの映像は盤面・撃破札を止めない');
    if(variant==='hit'){
      assert.equal(rest.at(-1).skin.video,skin.videos.recruit);
      assert.equal(rest.at(-1).afterReveal,true,'味方化の動画は公開を待つ');
    }
    const event=alicePresentationEvent(before,after,viewer);
    assert.equal(event.type,'croquet');
    assert.equal(event.targets[0].royal,false,'飛翔中に王を先出ししない');
    assert.equal(event.royalResult,undefined);
    if(viewer!==1)assert.equal(event.targets[0].piece.rank,null,'未公開の相手の正体は裏面のまま');
    const display=captureDisplayState(after,before);
    assert.deepEqual(display.players.map(p=>p.capturedOwn),before.players.map(p=>p.capturedOwn),'履歴から正体を先出ししない');
    const shown=reducer(after,{type:'DISMISS_CAPTURE'});
    assert.equal(shown.captureReveal,null);
    assert.deepEqual(shown.aliceRecruit,after.aliceRecruit);
    if(variant==='hit')assert.equal(filmQueueState(rest,{revealPending:false}).active.skin.video,skin.videos.recruit);
    assert.deepEqual(shown.pieces,after.pieces,'公開の確認は対局の結果を変えない');
  }
  assert.deepEqual({before,after},copy,'演出の計画は盤面を変更しない');
}
for(const variant of ['empty','return']) {
  const {before,after}=wonderlandFxScene('croquet',variant);
  assert.equal(after.captureReveal,null);
  assert.equal(filmPlanFor(before,after,before.areaLoadouts,0).length,0,'外れでは撃破・味方化の動画なし');
}
const {before,after}=wonderlandFxScene('recruit');
assert.equal(before.captureReveal,null);
assert.equal(filmPlanFor(before,after,before.areaLoadouts,0).length,0,'再配置で動画を繰り返さない');
console.log('クロッケー: 動画→盤面→相手の撃破札公開→味方化動画→再配置、両視点の秘匿、王・外れ・再描画を確認: OK');
