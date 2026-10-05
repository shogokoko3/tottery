import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import fs from 'node:fs';
import {Wallet} from '../src/server/wallet.js';
import {normalize} from '../src/skins/collection.js';
import {chanceDay, rewardEventId, validWinChanceReward, WIN_CHANCE_KEY} from '../src/game/win-chance.js';
const T=Date.UTC(2026,9,2,7),day=chanceDay(T);
const fresh=()=>{const db=new DatabaseSync(':memory:');return {db,w:new Wallet((q,...a)=>db.prepare(q).all(...a))}};
const {db,w}=fresh();
for(let n=0;n<3;n++)w.credit('cap','generic:'+n,10,'earn',T);
assert.throws(()=>w.credit('cap','another',1,'earn',T),/これ以上/);
for(let done=1;done<=3;done++)assert.equal(w.winChanceReward('cap',day,done,T).tickets,30+done,'full mission quota must not discard win tickets');
assert.equal(w.winChanceReward('cap',day,1,T).tickets,33,'retry cannot award twice');
assert.throws(()=>w.winChanceReward('cap',day,4,T),/正しく/);
assert.equal(w.debit('cap','spend',1,'pull',T).tickets,32);
assert.equal(w.winChanceReward('cap',day,1,T).tickets,32,'replay after gacha cannot restore spent ticket');
for(const [d,n] of [['2026-02-30',1],['2026-10-03',1],['2026-09-22',1],[day,0],[day,1.5],[day,'1'],[null,1]])assert.equal(validWinChanceReward(d,n,T),false);
assert.equal(validWinChanceReward('2026-10-02',1,Date.UTC(2026,9,1,19,59)),false,'04:59 JST before next reward day');
assert.equal(validWinChanceReward('2026-10-02',1,Date.UTC(2026,9,1,20)),true,'05:00 JST starts next day');
assert.equal(w.winChanceReward('other',day,1,T).tickets,1);
assert.equal(w.winChanceReward('cap','2026-10-01',1,T).tickets,33,'offline previous-day claim is retained');
assert.throws(()=>w.credit('attack',rewardEventId('victim',day,1),1,'earn',T),/正しく/,'reserved reward ID cannot be planted');
assert.equal(w.winChanceReward('victim',day,1,T).tickets,1);
// Existing earn rows from released clients must count as received, including local IDs.
for(const [uid,id] of [['legacy',rewardEventId('legacy',day,1)],['local-owner',rewardEventId('local',day,2)]]){
 db.prepare('INSERT INTO wallet_ledger (id,uid,tickets,gems,kind,ref,at,gems_free) VALUES (?,?,1,0,\'earn\',?,?,0)').run(id,uid,day,T);
 db.prepare('INSERT INTO wallets (uid,tickets,updated,gems,gems_free) VALUES (?,1,?,0,0)').run(uid,T);
 assert.equal(w.winChanceReward(uid,day,uid==='legacy'?1:2,T).tickets,1);
}
assert.equal(w.winChanceReward('not-local-owner',day,2,T).tickets,1,'other player local collision does not suppress own reward');

// Actual Worker routing; only authentication and DO transport are fixtures.
const worker=(await import('../src/server/worker.js')).default;
let routed;
globalThis.fetch=async()=>Response.json({users:[{localId:'authenticated'}]});
const env={SEASONS:{idFromName:n=>n,get:()=>({fetch:async req=>{routed=await req.json();return Response.json({tickets:1})}})}};
const post=(op,body)=>worker.fetch(new Request('https://example.test/api/wallet/'+op,{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify(body)}),env);
const today=chanceDay();
assert.equal((await post('win-chance-reward',{day:today,done:1,uid:'other',n:999})).status,200);
assert.deepEqual(routed,{op:'wallet-win-chance-reward',uid:'authenticated',day:today,done:1});
assert.equal((await post('earn',{id:rewardEventId('local',today,2),n:999})).status,200);
assert.deepEqual(routed,{op:'wallet-win-chance-reward',uid:'authenticated',day:today,done:2},'old clients use the dedicated quota and server amount');
for(const body of [{day:today,done:4},{day:'2099-01-01',done:1},{day:today,done:'1'}])assert.equal((await post('win-chance-reward',body)).status,400);
assert.equal((await post('earn',{id:'win-chance:bad',n:1})).status,400);

// Run actual client against actual wallet, controlling response timing and connectivity.
const bundled=await build({entryPoints:['src/net/wallet.js'],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'boundaries',setup(b){
 b.onResolve({filter:/(?:auth|season|store)\.js$/},a=>a.importer.endsWith('/src/net/wallet.js')&&['./auth.js','./season.js','../skins/store.js'].includes(a.path)?{path:a.path,namespace:'test'}:undefined);
 b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='./auth.js'?'export async function ensureAuth(){return {uid:globalThis.bridge.uid,idToken:"token"}}':a.path==='./season.js'?'export const seasonApiBase=()=>"https://wallet.test";':'export const getCollection=()=>globalThis.bridge.state;export async function updateCollection(f){const b=globalThis.bridge;if(b.failWrite){b.failWrite=false;throw Error("save failed")}return b.state=b.normalize(f(b.state))}',loader:'js'}));
}}]});
const mem=new Map();globalThis.localStorage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
globalThis.bridge={uid:'client',state:normalize(null),normalize,failWrite:false};
const cw=fresh().w;
let offline=false,lose=false,holdSummary=null,seenSummary=null,inFlight=0,maxInFlight=0;
const calls=[];
globalThis.fetch=async(url,opts)=>{
 const op=new URL(url).pathname.split('/').at(-1),body=JSON.parse(opts.body);calls.push(op);
 if(offline)throw Error('offline');
 inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
 try{
  const uid=bridge.uid;
  let data;
  if(op==='summary'){
   data=cw.summary(uid);
   if(holdSummary){const held=holdSummary;holdSummary=null;seenSummary();await held;}
  }else if(op==='win-chance-reward')data=cw.winChanceReward(uid,body.day,body.done,Date.now());
  else if(op==='debit')data=cw.debit(uid,body.id,body.n,'pull',Date.now());
  else throw Error('unexpected '+op);
  if(lose){lose=false;throw Error('lost response')}
  return Response.json(data);
 }finally{inFlight--}
};
const client=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const pending=()=>JSON.parse(mem.get('tottery.wallet.pending.v1')||'[]');
await client.earnWinChanceTicket(today,1,'client');assert.equal(bridge.state.tickets,1);
await client.syncWallet();assert.equal(bridge.state.tickets,1,'gacha refresh preserves received reward');
offline=true;assert.equal(await client.earnWinChanceTicket(today,2,'client'),false);
assert.equal(pending().length,1);assert.equal(bridge.state.tickets,1,'unconfirmed reward is not falsely added locally');
offline=false;await client.syncWallet();assert.equal(bridge.state.tickets,2);assert.equal(pending().length,0);
lose=true;assert.equal(await client.earnWinChanceTicket(today,3,'client'),false);
assert.equal(cw.summary('client').tickets,3);await client.syncWallet();assert.equal(bridge.state.tickets,3,'lost ACK retry no duplicate');
await client.debitTickets('gacha',1);await client.syncWallet();assert.equal(bridge.state.tickets,2,'actual use remains a deduction');
// Old response is deliberately held while a win arrives. It must commit before the credit.
let release;holdSummary=new Promise(r=>release=r);const seen=new Promise(r=>seenSummary=r);
const summary=client.syncWallet();await seen;
const credit=client.earnWinChanceTicket('2026-10-01',1,'client');
await new Promise(r=>setTimeout(r,15));assert.equal(cw.summary('client').tickets,2,'reward waits behind older response');
release();await Promise.all([summary,credit]);assert.equal(bridge.state.tickets,3);assert.equal(maxInFlight,1);
// Recovery from old saved successes, including a previous day, and repeat entry.
mem.set(WIN_CHANCE_KEY,JSON.stringify({day:today,done:3,played:0,target:1,uid:'client'}));
await Promise.all([client.syncWallet(),client.syncWallet()]);assert.equal(bridge.state.tickets,3);
mem.set(WIN_CHANCE_KEY,JSON.stringify({day:'2026-10-01',done:3,played:0,target:1,uid:'client'}));
await client.syncWallet();assert.equal(bridge.state.tickets,5,'only missing successes are recovered');
await client.syncWallet();assert.equal(bridge.state.tickets,5);
mem.delete(WIN_CHANCE_KEY);
bridge.failWrite=true;assert.equal(await client.earnWinChanceTicket('2026-09-30',1,'client'),false);
await client.syncWallet();assert.equal(bridge.state.tickets,6,'local write failure retains receipt and does not double grant');
offline=true;await client.earnWinChanceTicket('2026-09-30',2,'client');offline=false;
bridge.uid='different';await client.syncWallet();assert.equal(cw.summary('different').tickets,0);assert.equal(pending().length,1,'account mismatch retains original owner receipt');
bridge.uid='client';await client.syncWallet();assert.equal(bridge.state.tickets,7);assert.equal(pending().length,0);
// More rewards queued during a flush survive and are delivered by its completion.
await Promise.all([client.earnWinChanceTicket('2026-09-29',1,'client'),client.earnWinChanceTicket('2026-09-29',2,'client'),client.syncWallet()]);
assert.equal(bridge.state.tickets,9);assert.equal(pending().length,0);
console.log('Win wallet regression: quota, 05:00 reset, legacy receipts, auth routing, sync race, retries, recovery, spend, account isolation and concurrent queue passed.');
