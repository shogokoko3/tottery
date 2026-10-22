import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Wallet } from '../src/server/wallet.js';
import { ALL_POOL, POOL, SKINS, byId, draw, rate, poolForSeries } from '../src/skins/catalog.js';
import { resolveSummonFreeze } from '../src/skins/summon-freeze.js';
import { normalize, pull } from '../src/skins/collection.js';
import { areaForSkin } from '../src/game/areas.js';
assert.equal(POOL.length,15);
assert.equal(ALL_POOL.length,27);
assert.equal(poolForSeries('alice').length,12);
for(const series of ['heroes','alice']) {
 assert.ok(Math.abs(poolForSeries(series).reduce((n,s)=>n+rate(s),0)-100)<1e-9);
 for(let n=0;n<10000;n++) assert.equal(draw(()=>n/10000,series).series,series);
}
for(const s of SKINS.filter(s=>s.series==='alice')) {
 assert.equal(areaForSkin(s.rank,`${s.id}:foil`),s.fieldEffect?.type || null);
 assert.equal(s.video,null);
 for(const key of ['image','card','foilImage']) assert.ok(fs.existsSync('assets/'+s[key]));
}
const initial=['alice-Q-queen','alice-K-king',...Array(8).fill('alice-2-dodo')];
const frozen=resolveSummonFreeze(initial,()=>0.9);
assert.ok(frozen.freeze);
assert.ok(frozen.skins.every(id=>byId(id).series==='alice'));
const local=pull(normalize({tickets:10}),10,()=>0.5,{series:'alice'});
assert.equal(local.tickets,0);
assert.ok(local.pending.results.every(r=>byId(r.id).series==='alice'));
const D=new DatabaseSync(':memory:');
const w=new Wallet((q,...a)=>D.prepare(q).all(...a));
w.credit('alice-test','seed',20,'migrate',1800000000000);
const first=w.pull('alice-test','alice-draw',10,1800000000000,'alice');
assert.ok(first.skins.every(id=>byId(id).series==='alice'));
assert.deepEqual(w.pull('alice-test','alice-draw',10,1800000000000,'alice').skins,first.skins);
assert.equal(w.summary('alice-test').tickets,10);
assert.throws(()=>w.pull('alice-test','alice-draw',10,1800000000000,'heroes'),/シリーズ/);
assert.throws(()=>w.pull('alice-test','invalid',10,1800000000000,'missing'),/シリーズ/);
assert.equal(w.summary('alice-test').tickets,10);
assert.ok(!first.skins.some(id=>byId(id).rank==='A'));
console.log('Alice: series odds, assets, freeze isolation, local/server grants, replay, rejection without debit, A exclusion, field metadata OK');
