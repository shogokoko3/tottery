import assert from 'node:assert/strict';
import {STORY_AXES, PHASE_EPOCH} from '../src/game/phase.js';
import {STORY_ARCS,CHRONICLE,storyEpisode,episodeAccess,storyPages,storyComicPages,storyReadingPages,finaleReady} from '../src/game/story-narrative.js';
import {storyRival,stageOf} from '../src/game/story.js';
assert.equal(CHRONICLE.title,'誰がための王印');
assert.deepEqual(STORY_ARCS.map(a=>a.axis),STORY_AXES);
for(const arc of STORY_ARCS){
 assert.deepEqual(arc.ranks,stageOf(arc.axis).ranks);
 for(const phase of [1,2,3]){
  const e=storyEpisode(arc.axis,phase); const profile={phase,phaseEpoch:PHASE_EPOCH,story:{1:[],2:[],3:[]}};
  if(e.id==='k-3')profile.story[3]=STORY_AXES.filter(a=>a!=='k');
  const snapshot=JSON.stringify(profile);
  const before=storyReadingPages(profile,arc.axis,phase);
  assert(before.length>0);
  assert.deepEqual(storyReadingPages(profile,arc.axis,phase,'after'),[]);
  assert.deepEqual(storyPages(profile,arc.axis,phase),before.flatMap(p=>p.panels.flatMap(p=>p.lines)));
  if(phase<3)assert.deepEqual(storyReadingPages(profile,arc.axis,phase+1,'all'),[]);
  assert.equal(JSON.stringify(profile),snapshot,'reading never writes progress');
  profile.story[phase].push(arc.axis);
  const after=storyReadingPages(profile,arc.axis,phase,'after');assert(after.length);
  assert.deepEqual(storyComicPages(profile,arc.axis,phase,'all').flatMap(p=>p.panels.flatMap(p=>p.lines)),[...before,...after].flatMap(p=>p.panels.flatMap(p=>p.lines)),'漫画と元本文が一致');
  profile.phase=3;assert.deepEqual(storyReadingPages(profile,arc.axis,phase,'after'),after,'legacy clears remain readable');
  const rival=storyRival(arc.axis,phase);
  assert(e.before.some(l=>l.speaker===rival.quoteSpeaker&&l.text===rival.quote));
  assert.notEqual(rival.quoteSpeaker,'語り','challenge is spoken dialogue');
 }
}
for(let mask=0;mask<64;mask++){
 const p={phase:3,phaseEpoch:PHASE_EPOCH,story:{3:STORY_AXES.filter(a=>a!=='k').filter((_,i)=>mask&(1<<i))}};
 assert.equal(finaleReady(p),mask===63);assert.equal(episodeAccess(p,'k',3).available,mask===63);
 p.story[3].push('k');assert(episodeAccess(p,'k',3).available);
}
assert.deepEqual(storyReadingPages({},'missing',1),[]);
console.log('誰がための王印: 21話の前後本文、未来フェーズの制限、旧クリア記録、報酬の非変更、最終章64条件を確認');
