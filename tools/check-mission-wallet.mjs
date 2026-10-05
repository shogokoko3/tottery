import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { Wallet } from '../src/server/wallet.js';
import { MISSIONS, statusOf } from '../src/game/missions.js';
import { missionRewardOf, missionFromLegacyId, validMissionReward } from '../src/game/mission-reward.js';
import { missionPeriods, periodicMissionRows, recordMissionLogin } from '../src/game/periodic-missions.js';
import { normalize } from '../src/skins/collection.js';
import { BATTLEPASS_ENTITLEMENT } from '../src/iap/catalog.js';

const T = Date.UTC(2026,9,5,5), DAY = 86400000;
const fresh = () => {
  const db = new DatabaseSync(':memory:');
  return { db, w: new Wallet((q,...a) => db.prepare(q).all(...a)) };
};
const { db, w } = fresh();
const daily = 'daily:2026-10-05:login';
const seedOld = (uid, id, {tickets=0,gems=0,kind='earn'}={}) => {
  db.prepare('INSERT INTO wallet_ledger (id,uid,tickets,gems,gems_free,kind,ref,at) VALUES (?,?,?,0,?,?,?,?)').run(id,uid,tickets,gems,kind,kind==='pass'?'2026-10-05':'2026-10-05',T);
  db.prepare('INSERT INTO wallets (uid,tickets,updated,gems,gems_free) VALUES (?,?,?,0,?) ON CONFLICT(uid) DO UPDATE SET tickets=tickets+excluded.tickets,gems_free=gems_free+excluded.gems_free').run(uid,tickets,T,gems);
};
seedOld('old-owner','mission:level-5',{gems:500});
assert.equal(w.missionReward('old-owner','level-5',T).applied,false);
assert.equal(w.missionReward('new-player','level-5',T).gemsFree,500,'another player can receive the same mission');
assert.equal(w.missionReward('new-player','level-5',T).applied,false);
w.apply('old-owner','spend-old',{gemsFree:-500},'fixture',null,T);
assert.equal(w.missionReward('old-owner','level-5',T).gemsFree,0,'old receipt never restores spent gems');
assert.deepEqual(w.summary('old-owner',T).missionClaims,['level-5']);
seedOld('old-periodic',`mission:${daily}:2026-10-05`,{gems:10});
assert.equal(w.missionReward('old-periodic',daily,T).applied,false);
assert.equal(w.missionReward('another-periodic',daily,T).gemsFree,10);
assert.equal(missionFromLegacyId(`mission:${daily}:2026-10-05`),daily);
assert.equal(missionFromLegacyId(`mission:${daily}:2026-10-06`),null);
const currencyMissions=MISSIONS.filter(m=>m.reward.type==='gems');
assert.equal(currencyMissions.length,6);
for(const m of currencyMissions) w.missionReward('all',m.id,T);
assert.equal(w.summary('all',T).gemsFree,3000,'all six legitimate rewards fit without the generic 2500 cap');
for(let i=0;i<5;i++)w.earnGems('all',`generic:${i}`,500,T);
assert.throws(()=>w.earnGems('all','generic:overflow',1,T),/これ以上/);
assert.equal(w.missionReward('all',daily,T).gemsFree,5510,'periodic reward is independent of generic cap');
for(const id of ['unknown','days-3','daily:2026-02-30:login','weekly:2026-10-06:wins','daily:2026-10-05:all']) {
  assert.equal(missionRewardOf(id),null);
  assert.throws(()=>w.missionReward('invalid',id,T));
}
assert.throws(()=>w.missionReward('invalid','level-5',T,'ticket'));
assert.equal(validMissionReward('daily:2026-10-06:login',T),false);
assert.equal(validMissionReward('daily:2026-09-27:login',T),false);
assert.equal(validMissionReward('daily:2026-09-28:login',T),true);
assert.throws(()=>w.missionReward('invalid','daily:2026-09-27:login',T));
assert.equal(w.missionReward('old-periodic',daily,T+40*DAY).applied,false,'old successful retries remain idempotent');
assert.deepEqual(w.summary('old-periodic',T+40*DAY).missionClaims,[],'old periods do not evict permanent receipts from the bounded client cache');
assert.deepEqual(w.summary('all',T+400*DAY).missionClaims.sort(),currencyMissions.map(m=>m.id).sort());
for (const id of ['mission:new-player:level-20','earn:other:gift','pass:other:cell']) {
  assert.throws(()=>w.credit('invalid',id,1,'earn',T));
  assert.throws(()=>w.adReward('invalid',id,T));
}
seedOld('old-generic','letter:welcome',{tickets:1});
assert.equal(w.credit('old-generic','letter:welcome',1,'earn',T).applied,false);
assert.equal(w.credit('new-generic','letter:welcome',1,'earn',T).tickets,1);
assert.equal(w.credit('new-generic','letter:welcome',1,'earn',T).applied,false);
for(const uid of ['old-pass','new-pass'])db.prepare('INSERT INTO entitlements VALUES (?,?,?,?)').run(uid,BATTLEPASS_ENTITLEMENT,'test',T);
seedOld('old-pass','bp:pass:1:cell',{tickets:1,kind:'pass'});
assert.equal(w.passReward('old-pass','bp:pass:1:cell',T).applied,false);
assert.equal(w.passReward('new-pass','bp:pass:1:cell',T).tickets,1);
assert.equal(w.passReward('new-pass','bp:pass:1:cell',T).applied,false);
assert.throws(()=>w.passReward('not-owned','bp:pass:1:cell',T),/持って/);
for(let i=1;i<72;i++)w.passReward('new-pass',`bp:pass:1:cell${i}`,T);
assert.throws(()=>w.passReward('new-pass','bp:pass:4:cell',T),/上限/);

// Real authenticated Worker + real transactional DO. Client amounts and UIDs cannot control the grant.
const {default:worker,SeasonLedger}=await import('../src/server/worker.js');
const doDb=new DatabaseSync(':memory:');let transactions=0;
const ledger=new SeasonLedger({storage:{sql:{exec(q,...a){return {toArray:()=>doDb.prepare(q).all(...a)};}},transactionSync(fn){transactions++;doDb.exec('BEGIN');try{const out=fn();doDb.exec('COMMIT');return out;}catch(e){doDb.exec('ROLLBACK');throw e;}}}});
globalThis.fetch=async()=>Response.json({users:[{localId:'authenticated'}]});
const env={SEASONS:{idFromName:n=>n,get:()=>ledger}};
const post=(op,body,auth=true)=>worker.fetch(new Request('https://test.invalid/api/wallet/'+op,{method:'POST',headers:{...(auth?{Authorization:'Bearer fixture'}:{}),'Content-Type':'application/json',Origin:'capacitor://localhost'},body:JSON.stringify(body)}),env);
assert.equal((await post('mission-reward',{mission:'level-5'},false)).status,401);
let res=await post('earn-gems',{id:'mission:level-5',gems:999999,uid:'victim'});
assert.equal(res.status,200);assert.equal(res.headers.get('Access-Control-Allow-Origin'),'capacitor://localhost');
assert.equal((await res.json()).gemsFree,500);assert.equal(ledger.wallet.summary('victim').gemsFree,0);
assert.equal((await (await post('mission-reward',{mission:'level-5',gems:999999})).json()).applied,false);
assert.equal((await post('earn',{id:'mission:level-5',n:1})).status,400);
const currentDaily=`daily:${missionPeriods().day}:login`;
res=await post('earn-gems',{id:`mission:${currentDaily}:${missionPeriods().day}`,gems:999999});
assert.equal(res.status,200);assert.equal((await res.json()).gemsFree,510);
doDb.exec("CREATE TRIGGER fail_mission BEFORE UPDATE ON wallets WHEN NEW.uid='authenticated' BEGIN SELECT RAISE(ABORT,'forced failure'); END");
assert.equal((await post('mission-reward',{mission:'level-20'})).status,400);
assert.equal(ledger.wallet.summary('authenticated').gemsFree,510);
assert.equal(doDb.prepare("SELECT COUNT(*) n FROM wallet_ledger WHERE id='mission:authenticated:level-20'").get().n,0);
doDb.exec('DROP TRIGGER fail_mission');
assert.equal((await (await post('mission-reward',{mission:'level-20'})).json()).gemsFree,1010);
assert.ok(transactions>=4);

// Real client with actual SQL wallet, including lost replies, storage failure and account isolation.
const bundled=await build({entryPoints:['src/net/wallet.js'],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'boundaries',setup(b){
  b.onResolve({filter:/(?:auth|season|store)\.js$/},a=>a.importer.endsWith('/src/net/wallet.js')&&['./auth.js','./season.js','../skins/store.js'].includes(a.path)?{path:a.path,namespace:'fixture'}:undefined);
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path==='./auth.js'?'export async function ensureAuth(){return {uid:globalThis.bridge.uid,idToken:"token"}}':a.path==='./season.js'?'export const seasonApiBase=()=>"https://wallet.test";':'export const getCollection=()=>globalThis.bridge.state;export async function updateCollection(f){const b=globalThis.bridge;if(b.failWrite){b.failWrite=false;throw Error("save failed")}return b.state=b.normalize(f(b.state))}'}));
}}]});
const mem=new Map();let failStorage=false,offline=false,loseReply=false,invalidReply=false,holdSummary=null,summarySeen;
globalThis.localStorage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>{if(failStorage)throw Error('storage failed');mem.set(k,String(v));},removeItem:k=>mem.delete(k)};
globalThis.bridge={uid:'client',state:normalize(null),normalize,failWrite:false};
const cw=fresh().w;let now=T;
globalThis.fetch=async(url,opts)=>{
  if(offline)throw Error('offline');
  const op=new URL(url).pathname.split('/').at(-1),body=JSON.parse(opts.body),uid=bridge.uid;
  let data;
  try {
    if(op==='summary'){data=cw.summary(uid,now);if(holdSummary){const held=holdSummary;holdSummary=null;summarySeen();await held;}}
    else if(op==='mission-reward')data=cw.missionReward(uid,body.mission,now);
    else if(op==='earn-gems'){const mission=missionFromLegacyId(body.id);data=mission?cw.missionReward(uid,mission,now,'gems'):cw.earnGems(uid,body.id,body.gems,now);}
    else if(op==='exchange')data=cw.exchange(uid,body.id,body.tickets,now);
    else if(op==='debit')data=cw.debit(uid,body.id,body.n,'pull',now);
    else throw Error('Unexpected '+op);
  }catch(e){return Response.json({error:e.message},{status:400});}
  if(loseReply){loseReply=false;throw Error('lost reply');}
  if(invalidReply&&op==='mission-reward')data={...data,missionReceipt:null};
  return Response.json(data);
};
const client=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const PENDING='tottery.wallet.pending.v1',pending=()=>JSON.parse(mem.get(PENDING)||'[]');
offline=true;
await assert.rejects(client.claimMissionReward('level-5'),/通信/);
assert.equal(bridge.state.gemsFree,0);assert.equal(pending().length,1);
offline=false;await client.syncWallet();
assert.equal(bridge.state.gemsFree,500);assert.equal(pending().length,0);
assert.ok(bridge.state.walletMissionClaims.includes('level-5'));
cw.apply('client','spent',{gemsFree:-500},'fixture',null,T);
await client.claimMissionReward('level-5');await client.syncWallet();assert.equal(bridge.state.gemsFree,0);
loseReply=true;await assert.rejects(client.claimMissionReward('level-20'));
assert.equal(cw.summary('client',T).gemsFree,500);assert.equal(bridge.state.gemsFree,0);assert.equal(pending().length,1);
await client.syncWallet();assert.equal(bridge.state.gemsFree,500);assert.equal(pending().length,0);
bridge.failWrite=true;await assert.rejects(client.claimMissionReward('battles-10'),/save failed/);
await client.syncWallet();assert.equal(bridge.state.gemsFree,1000);
failStorage=true;await assert.rejects(client.claimMissionReward('battles-50'),/storage failed/);
assert.equal(cw.summary('client',T).gemsFree,1000);failStorage=false;
offline=true;await assert.rejects(client.claimMissionReward('battles-50'));
offline=false;bridge.uid='other';await client.syncWallet();
assert.equal(bridge.state.gemsFree,0);assert.equal(pending().length,1);
bridge.uid='client';await Promise.all([client.claimMissionReward('battles-50'),client.syncWallet(),client.claimMissionReward('battles-50')]);
assert.equal(bridge.state.gemsFree,1500);assert.equal(pending().length,0);
invalidReply=true;await assert.rejects(client.claimMissionReward('battles-100'),/確認できません/);
await client.syncWallet();assert.equal(pending().length,1,'malformed successful response does not erase pending receipt');
invalidReply=false;await client.syncWallet();assert.equal(bridge.state.gemsFree,2000);assert.equal(pending().length,0);
let release;holdSummary=new Promise(r=>release=r);const seen=new Promise(r=>summarySeen=r);
const syncing=client.syncWallet();await seen;const claiming=client.claimMissionReward('battles-500');release();
await Promise.all([syncing,claiming]);assert.equal(bridge.state.gemsFree,2500,'old summary cannot erase the newer reward');
// Existing TestFlight pending IDs still use the old endpoint and duplicated date.
mem.set(PENDING,JSON.stringify([{id:`mission:${daily}:2026-10-05`,gems:10,at:T}]));
await client.syncWallet();assert.equal(bridge.state.gemsFree,2510);assert.equal(pending().length,0);
mem.set(PENDING,JSON.stringify([{id:'mission:daily:2026-09-01:login:2026-09-01',gems:10,at:T-34*DAY}]));
await client.syncWallet();assert.equal(pending().length,1,'expired unverified claims remain available for support review');

// A local-only optimistic receipt no longer hides a missed reward after server sync.
const normal=MISSIONS.find(m=>m.id==='battles-10'),profile={battles:10,missions:['battles-10'],missionProgress:recordMissionLogin({},T)};
assert.equal(statusOf(normal,profile,normalize({})).claimed,true,'legacy state before first server sync');
assert.equal(statusOf(normal,profile,normalize({walletMissionClaims:[]})).claimed,false);
assert.equal(statusOf(normal,profile,normalize({walletMissionClaims:['battles-10']})).claimed,true);
assert.equal(periodicMissionRows(profile,normalize({missionClaims:[daily],walletMissionClaims:[]}),T).find(m=>m.id===daily).claimed,false);
assert.equal(periodicMissionRows(profile,normalize({walletMissionClaims:[daily]}),T).find(m=>m.id===daily).claimed,true);
console.log('Mission wallet regression passed: cross-account legacy IDs, fixed catalog amounts, independent quotas, date limits, transactional rollback, authenticated old/new routes, iOS CORS, pass quota, durable retries, lost replies, storage errors, account isolation and server receipt recovery.');

// Real JSX handlers: show success only after confirmation, then retry a partially completed batch.
const uiBundle=await build({entryPoints:['src/ui/missions.jsx'],bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',logLevel:'silent',plugins:[{name:'mission-ui-boundaries',setup(b){
  const mocks={
    react:'export const useState=v=>globalThis.hooks.state(v);export const useRef=v=>globalThis.hooks.ref(v);export const useEffect=f=>globalThis.hooks.effect(f);',
    'react/jsx-runtime':'export const Fragment="fragment";export const jsx=(type,props)=>({type,props});export const jsxs=jsx;',
    './gem.jsx':'export const GemAmount="gem";',
    '../icons.jsx':'export const ArrowLeft="back",Check="check",Crown="crown";',
    '../net/wallet.js':'export const claimMissionReward=(...a)=>globalThis.uiClient.claimMissionReward(...a);export const syncWallet=()=>globalThis.uiClient.syncWallet();',
    '../game/profile.js':'export const loadProfile=()=>globalThis.uiProfile;export const touchDay=loadProfile;export const markMissionClaimed=id=>globalThis.uiProfile={...globalThis.uiProfile,missions:[...globalThis.uiProfile.missions,id]};export const grantMissionTitle=()=>{throw Error("unexpected title")};',
    '../game/secrets.js':'export const listSecrets=()=>({found:[]});export const chanceLabel=()=>"";',
    '../game/gifts.js':'export const giftLabel=r=>`${r.amount}ジェム`;export const giveGift=()=>{throw Error("currency must use server")};',
    '../skins/store.js':'export const getCollection=()=>globalThis.bridge.state;export const useCollection=getCollection;export const updateCollection=async f=>globalThis.bridge.state=globalThis.bridge.normalize(f(globalThis.bridge.state));',
    './mission-profile.js':'export const useMissionProfile=()=>[globalThis.uiProfile,p=>globalThis.uiProfile=p];',
  };
  b.onResolve({filter:/.*/},a=>(a.path==='react'||a.path==='react/jsx-runtime'||a.importer.endsWith('/src/ui/missions.jsx'))&&mocks[a.path]?{path:a.path,namespace:'ui-fixture'}:undefined);
  b.onLoad({filter:/.*/,namespace:'ui-fixture'},a=>({loader:'js',contents:mocks[a.path]}));
}}]});
const {MissionsScreen}=await import('data:text/javascript;base64,'+Buffer.from(uiBundle.outputFiles[0].text).toString('base64'));
let values=[],cursor=0,effects=[];
globalThis.hooks={state(v){const i=cursor++;if(!(i in values))values[i]=v;return[values[i],n=>values[i]=typeof n==='function'?n(values[i]):n];},ref(v){const i=cursor++;if(!(i in values))values[i]={current:v};return values[i];},effect(f){const i=cursor++;if(!(i in values)){values[i]=true;effects.push(f);}}};
globalThis.uiProfile={battles:500,days:0,xp:0,missions:[],missionProgress:recordMissionLogin({},Date.now())};
globalThis.uiClient=client;bridge.uid='ui-missions';bridge.state=normalize(null);mem.delete(PENDING);now=Date.now();
const render=()=>{cursor=0;return MissionsScreen({onBack(){}});};
const nodes=(v,out=[])=>{if(Array.isArray(v))v.forEach(x=>nodes(x,out));else if(v&&typeof v==='object'){out.push(v);nodes(v.props?.children,out);}return out;};
const content=v=>Array.isArray(v)?v.map(content).join(''):v&&typeof v==='object'?content(v.props?.children):v==null||v===false?'':String(v);
const button=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&content(n).includes(label));
let tree=render();effects.splice(0).forEach(f=>f());await client.syncWallet();
button(tree,'ノーマル').props.onClick();tree=render();
assert.match(content(button(tree,'一括受取')),/4/);
offline=true;await button(tree,'一括受取').props.onClick();tree=render();
assert.equal(bridge.state.gemsFree,0);assert.deepEqual(uiProfile.missions,[]);
assert.doesNotMatch(content(tree),/受け取りました/);assert.match(content(tree),/通信/);
offline=false;let requestCount=0;
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,opts)=>{if(String(url).endsWith('/mission-reward')&&++requestCount===2)return Response.json({error:'fixture retry required'},{status:503});return realFetch(url,opts);};
const click=button(tree,'一括受取').props.onClick;
await Promise.all([click(),click()]);tree=render();
assert.equal(requestCount,2,'same-frame double tap runs one batch');
assert.equal(bridge.state.gemsFree,500);assert.deepEqual(uiProfile.missions,['battles-10']);
assert.match(content(tree),/1件を受け取ったところで止まりました/);
globalThis.fetch=realFetch;
await button(tree,'一括受取').props.onClick();tree=render();
assert.equal(bridge.state.gemsFree,2000);assert.equal(new Set(uiProfile.missions).size,4);
assert.match(content(tree),/3件の報酬を受け取りました/);
await client.syncWallet();assert.equal(bridge.state.gemsFree,2000);assert.equal(pending().length,0);
console.log('Mission UI passed: no optimistic currency/claim, offline retry, double-tap guard, partial batch confirmation and idempotent completion.');
