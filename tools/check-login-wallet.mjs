import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { Wallet } from '../src/server/wallet.js';
import { loginDay, TICKETS, legacyLoginIndex } from '../src/game/login-bonus.js';
import { normalize } from '../src/skins/collection.js';

const T = Date.UTC(2026,9,3,5), DAY = 86400000;
const fresh = () => {
  const db = new DatabaseSync(':memory:');
  return { db, w: new Wallet((q,...a) => db.prepare(q).all(...a)) };
};
const { w, db } = fresh();
const grant = (uid, now=T) => w.loginReward(uid, w.loginStatus(uid,now).login.day, now);
const seedOld = (uid, id, amount, now=T) => {
  db.prepare("INSERT INTO wallet_ledger (id,uid,tickets,gems,gems_free,kind,ref,at) VALUES (?,?,?,0,0,'earn',?,?)").run(id,uid,amount,new Date(now).toISOString().slice(0,10),now);
  db.prepare('INSERT INTO wallets (uid,tickets,updated,gems,gems_free) VALUES (?,?,?,0,0) ON CONFLICT(uid) DO UPDATE SET tickets=tickets+excluded.tickets').run(uid,amount,now);
};

// Actual old global ID reproduces the reported collision without new-route assumptions.
seedOld('old-owner','login:0',1);
assert.throws(() => w.credit('another','login:0',1,'earn',T), /正しく/); // new protection now closes this route
assert.equal(grant('another').tickets,1, 'another account receives its own first login');
assert.equal(w.loginStatus('old-owner',T).login.received,true);
assert.equal(grant('old-owner').tickets,1, 'accepted old reward is never credited again');
for (let i=0;i<3;i++) w.credit('cap','mission:'+i,10,'earn',T);
assert.throws(() => w.credit('cap','over-cap',1,'earn',T),/これ以上/);
assert.equal(grant('cap').tickets,31, 'login bypasses unrelated generic cap');
assert.equal(grant('cap').tickets,31, 'repeat request and second device cannot duplicate');
w.debit('cap','spent',1,'pull',T);
assert.equal(grant('cap').tickets,30, 'repeat after spending cannot restore spent ticket');
assert.equal(w.loginStatus('unclaimed',T).login.taken,0);
assert.equal(w.loginStatus('unclaimed',T+5*DAY).login.taken,0,'viewing without claiming does not advance cycle');
for(let i=0;i<7;i++) assert.equal(grant('cycle',T+i*DAY).login.amount,TICKETS[i]);
assert.equal(w.balance('cycle'),10);
assert.equal(grant('cycle',T+20*DAY).login.amount,1,'skipped days do not reset or mint missing rewards');
assert.equal(grant('cycle',T+21*DAY).login.taken,8);
seedOld('progress','login:5',1,T-DAY);
assert.equal(grant('progress').login.amount,3,'cycle migrates from accepted server receipts');
const day = loginDay(T);
assert.equal(loginDay(Date.UTC(2026,9,2,14,59,59)),'2026-10-02');
assert.equal(loginDay(Date.UTC(2026,9,2,15)),'2026-10-03');
for (const id of ['login:-1','login:01','login:1.5','login:1e3','login:9007199254740991','login:U:2026-10-03']) assert.equal(legacyLoginIndex(id),null);
for (const date of ['2026-10-04','2026-10-01','2026-02-30','bogus',null]) assert.throws(() => w.loginReward('unseen',date,T));
const prior = w.loginStatus('delayed',T).login.day;
assert.equal(w.loginReward('delayed',prior,T+DAY).tickets,1,'server-issued previous-day reward survives offline retry');
assert.equal(grant('delayed',T+DAY).tickets,2,'following day remains independently claimable');
assert.throws(() => w.loginReward('impostor',prior,T+DAY),'another account cannot claim the issued day');
assert.throws(() => w.earnGems('impostor',`login:delayed:${day}`,1,T),/正しく/);
assert.throws(() => w.adReward('impostor',`login:unclaimed:${day}`,T),/正しく/);
// Different client counters cannot create multiple grants; retries keep the original day.
assert.equal(w.legacyLoginReward('old-client','login:0',T).tickets,1);
assert.equal(w.legacyLoginReward('old-client','login:6',T).tickets,1);
assert.equal(w.legacyLoginReward('old-client','login:0',T+DAY).tickets,1);
assert.equal(w.legacyLoginReward('old-client','login:99999',T+DAY).tickets,2);
assert.equal(grant('old-client',T+DAY).tickets,2,'old and new routes share one daily receipt');

// SQL failure rolls back both balance and receipt inside the same transaction used by the DO.
const txn = fn => { db.exec('BEGIN'); try { const out=fn(); db.exec('COMMIT'); return out; } catch(e) {db.exec('ROLLBACK'); throw e;} };
w.loginStatus('atomic',T);
db.exec("CREATE TRIGGER fail_login_update BEFORE UPDATE ON login_rewards WHEN NEW.uid='atomic' BEGIN SELECT RAISE(ABORT,'forced failure'); END");
assert.throws(() => txn(() => w.loginReward('atomic',day,T)),/forced failure/);
assert.equal(w.balance('atomic'),0);
assert.equal(w.loginStatus('atomic',T).login.received,false);
db.exec('DROP TRIGGER fail_login_update');
assert.equal(txn(() => w.loginReward('atomic',day,T)).tickets,1);
w.forget('atomic');
assert.equal(db.prepare('SELECT COUNT(*) n FROM login_rewards WHERE uid=?').get('atomic').n,0);

// Real Worker authenticated routing discards client-supplied UID, amount and counter.
const worker=(await import('../src/server/worker.js')).default;
let routed;
globalThis.fetch=async()=>Response.json({users:[{localId:'authenticated'}]});
const env={SEASONS:{idFromName:n=>n,get:()=>({fetch:async req=>{routed=await req.json();return Response.json({tickets:1})}})}};
const post=(op,body)=>worker.fetch(new Request('https://test.invalid/api/wallet/'+op,{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify(body)}),env);
assert.equal((await post('login-status',{uid:'victim',taken:999,n:999})).status,200);
assert.deepEqual(routed,{op:'wallet-login-status',uid:'authenticated'});
assert.equal((await post('login-reward',{day,uid:'victim',taken:999,n:999})).status,200);
assert.deepEqual(routed,{op:'wallet-login-reward',uid:'authenticated',day});
assert.equal((await post('earn',{id:'login:6',n:999})).status,200);
assert.deepEqual(routed,{op:'wallet-login-legacy',uid:'authenticated',id:'login:6'});
assert.equal((await post('earn',{id:'login:bad',n:1})).status,400);
assert.equal((await post('login-reward',{day:44})).status,400);

// Real DO dispatch, including its transaction boundary and new table lifecycle.
const {SeasonLedger}=await import('../src/server/worker.js');
const doDb=new DatabaseSync(':memory:');
let transactions=0;
const ledger=new SeasonLedger({storage:{
 sql:{exec(q,...a){return {toArray:()=>doDb.prepare(q).all(...a)};}},
 transactionSync(fn){transactions++;doDb.exec('BEGIN');try{const out=fn();doDb.exec('COMMIT');return out;}catch(e){doDb.exec('ROLLBACK');throw e;}},
}});
const internal=async(op,args={})=>ledger.fetch(new Request('https://ledger.test/',{method:'POST',body:JSON.stringify({op,uid:'do-player',...args})}));
const issued=await (await internal('wallet-login-status')).json();
doDb.exec("CREATE TRIGGER fail_do_login BEFORE UPDATE ON login_rewards WHEN NEW.uid='do-player' BEGIN SELECT RAISE(ABORT,'simulated failure'); END");
assert.equal((await internal('wallet-login-reward',{day:issued.login.day})).status,400);
assert.equal(ledger.wallet.balance('do-player'),0);
assert.equal(doDb.prepare('SELECT claimedAt FROM login_rewards WHERE uid=?').get('do-player').claimedAt,null);
doDb.exec('DROP TRIGGER fail_do_login');
assert.equal((await (await internal('wallet-login-reward',{day:issued.login.day})).json()).tickets,1);
assert.equal((await (await internal('wallet-login-legacy',{id:'login:0'})).json()).tickets,1);
assert.ok(transactions>=4);

// Real client + real SQL wallet: lost replies, failed writes, refresh, concurrent claims, account changes.
const bundled=await build({entryPoints:['src/net/wallet.js'],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'boundaries',setup(b){
  b.onResolve({filter:/(?:auth|season|store)\.js$/},a=>a.importer.endsWith('/src/net/wallet.js')&&['./auth.js','./season.js','../skins/store.js'].includes(a.path)?{path:a.path,namespace:'test'}:undefined);
  b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='./auth.js'?'export async function ensureAuth(){return {uid:globalThis.bridge.uid,idToken:"token"}}':a.path==='./season.js'?'export const seasonApiBase=()=>"https://wallet.test";':'export const getCollection=()=>globalThis.bridge.state;export async function updateCollection(f){const b=globalThis.bridge;if(b.failWrite){b.failWrite=false;throw Error("save failed")}return b.state=b.normalize(f(b.state))}',loader:'js'}));
}}]});
const mem=new Map(); let failStorage=false;
globalThis.localStorage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>{if(failStorage) throw Error('storage failed');mem.set(k,String(v));},removeItem:k=>mem.delete(k)};
globalThis.bridge={uid:'client',state:normalize(null),normalize,failWrite:false};
const cw=fresh().w; let now=T, offline=false, loseReply=false, holdSummary=null, summarySeen;
globalThis.fetch=async(url,opts)=>{
  if(offline)throw Error('offline');
  const op=new URL(url).pathname.split('/').at(-1), body=JSON.parse(opts.body), uid=bridge.uid;
  let data;
  try {
    if(op==='summary') { data=cw.summary(uid,now); if(holdSummary) {const wait=holdSummary; holdSummary=null; summarySeen(); await wait;} }
    else if(op==='login-status') data=cw.loginStatus(uid,now);
    else if(op==='login-reward') data=cw.loginReward(uid,body.day,now);
    else if(op==='earn') data=cw.credit(uid,body.id,body.n,'earn',now);
    else if(op==='debit') data=cw.debit(uid,body.id,body.n,'pull',now);
    else throw Error('Unexpected '+op);
  } catch(e) { return Response.json({error:e.message},{status:400}); }
  if(loseReply){loseReply=false;throw Error('reply lost');}
  return Response.json(data);
};
const client=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const PENDING='tottery.wallet.pending.v1';
const pending=()=>JSON.parse(mem.get(PENDING)||'[]');
const offer=await client.getLoginBonus();
offline=true;
await assert.rejects(client.claimLoginBonus(offer.login.day,offer.uid),/通信/);
assert.equal(bridge.state.tickets,0,'offline claim does not fabricate a displayed balance');
assert.equal(pending().length,1);
offline=false;
await client.syncWallet();
assert.equal(bridge.state.tickets,1); assert.equal(pending().length,0);
await client.debitTickets('gacha',1);
await client.claimLoginBonus(offer.login.day,offer.uid);
await client.syncWallet(); assert.equal(bridge.state.tickets,0,'received tickets stay spent after refresh');
now+=DAY;
const next=await client.getLoginBonus();
loseReply=true;
await assert.rejects(client.claimLoginBonus(next.login.day,next.uid));
assert.equal(cw.balance('client'),1); assert.equal(pending().length,1);
await client.syncWallet(); assert.equal(bridge.state.tickets,1); assert.equal(pending().length,0);
now+=DAY;
const third=await client.getLoginBonus();
bridge.failWrite=true;
await assert.rejects(client.claimLoginBonus(third.login.day,third.uid),/save failed/);
await client.syncWallet(); assert.equal(bridge.state.tickets,2);
now+=DAY;
const fourth=await client.getLoginBonus();
failStorage=true;
await assert.rejects(client.claimLoginBonus(fourth.login.day,fourth.uid),/storage failed/);
assert.equal(cw.balance('client'),2,'failed durable queue write does not start a claim');
failStorage=false; offline=true;
await assert.rejects(client.claimLoginBonus(fourth.login.day,fourth.uid));
offline=false; bridge.uid='other';
await client.syncWallet(); assert.equal(cw.balance('other'),0); assert.equal(pending().length,1);
bridge.uid='client';
await Promise.all([client.claimLoginBonus(fourth.login.day,fourth.uid),client.syncWallet(),client.claimLoginBonus(fourth.login.day,fourth.uid)]);
assert.equal(bridge.state.tickets,4); assert.equal(pending().length,0);
// A rejected generic item stays recoverable and does not block an independent login claim.
for(let i=0;i<3;i++)cw.credit('client','cap:'+i,10,'earn',now);
mem.set(PENDING,JSON.stringify([{id:'over',n:1,at:now}]));
await client.syncWallet(); assert.equal(pending().length,1,'cap rejection is retained');
now+=DAY;
const fifth=await client.getLoginBonus();
assert.equal(pending().length,0,'quota retry can complete the following day');
let release; holdSummary=new Promise(r=>release=r); const seen=new Promise(r=>summarySeen=r);
const syncing=client.syncWallet(); await seen;
const claiming=client.claimLoginBonus(fifth.login.day,fifth.uid);
release(); await Promise.all([syncing,claiming]);
assert.equal(bridge.state.tickets,cw.balance('client'),'old summary cannot erase newer confirmed login reward');

console.log('Login wallet regression passed: daily eligibility, 7-day amounts, quota independence, legacy collisions/migration, authenticated routing, atomic rollback, retries, spending, sync ordering and account isolation.');

// Exercise the real JSX component with a minimal hook scheduler and the real wallet client above.
// No browser layout is simulated here: these assertions cover the receive/error button behavior.
const uiBundle=await build({entryPoints:['src/ui/loginbonus.jsx'],bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',logLevel:'silent',plugins:[{name:'ui-boundaries',setup(b){
 b.onResolve({filter:/^(react|react\/jsx-runtime)$|icons\.jsx$|net\/wallet\.js$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:
  a.path==='react' ? 'export const useState=(v)=>globalThis.hooks.state(v);export const useRef=(v)=>globalThis.hooks.ref(v);export const useEffect=(f)=>globalThis.hooks.effect(f);' :
  a.path==='react/jsx-runtime' ? 'export const Fragment="fragment";export const jsx=(type,props)=>({type,props});export const jsxs=jsx;' :
  a.path.endsWith('icons.jsx') ? 'export const Ticket="ticket-icon",Check="check-icon";' :
  'export const getLoginBonus=()=>globalThis.uiWallet.getLoginBonus();export const claimLoginBonus=(...a)=>{globalThis.uiClaims++;return globalThis.uiWallet.claimLoginBonus(...a)};'
 }));
}}]});
const {LoginBonus}=await import('data:text/javascript;base64,'+Buffer.from(uiBundle.outputFiles[0].text).toString('base64'));
let values=[],cursor=0,effects=[];
globalThis.hooks={
 state(v){const i=cursor++;if(!(i in values))values[i]=v;return [values[i],n=>values[i]=typeof n==='function'?n(values[i]):n];},
 ref(v){const i=cursor++;if(!(i in values))values[i]={current:v};return values[i];},
 effect(f){const i=cursor++;if(!(i in values)){values[i]=true;effects.push(f);}},
};
globalThis.uiWallet=client;globalThis.uiClaims=0;
const render=()=>{cursor=0;return LoginBonus();};
const nodes=(v,out=[])=>{if(Array.isArray(v))v.forEach(x=>nodes(x,out));else if(v&&typeof v==='object'){out.push(v);nodes(v.props?.children,out);}return out;};
const content=v=>Array.isArray(v)?v.map(content).join(''):v&&typeof v==='object'?content(v.props?.children):v==null||v===false?'':String(v);
const button=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&content(n).includes(label));
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setTimeout(r,0));};
bridge.uid='ui-player';mem.delete(PENDING);
assert.equal(render(),null);effects.splice(0).forEach(f=>f());await settle();
let tree=render();assert.match(content(tree),/受け取る/);
assert.doesNotMatch(content(tree),/受け取りました/);
loseReply=true;
const action=button(tree,'受け取る').props.onClick;
const firstClick=action(),doubleClick=action();
assert.equal(uiClaims,1,'same-frame double taps send one request');
await Promise.all([firstClick,doubleClick]);
tree=render();assert.doesNotMatch(content(tree),/受け取りました/);assert.match(content(tree),/確認できませんでした/);
assert.ok(button(tree,'あとで確認する'),'failed receipt does not trap player on modal');
assert.equal(cw.balance('ui-player'),1);
await button(tree,'受け取る').props.onClick();tree=render();
assert.match(content(tree),/受け取りました/);assert.equal(cw.balance('ui-player'),1);
button(tree,'ホームへ').props.onClick();assert.equal(render(),null);
values=[];effects=[];
assert.equal(render(),null);effects.splice(0).forEach(f=>f());await settle();
assert.equal(render(),null,'already claimed server status suppresses modal after remount');
values=[];effects=[];offline=true;
render();effects.splice(0).forEach(f=>f());await settle();tree=render();
assert.ok(button(tree,'もう一度確認する'));assert.ok(button(tree,'あとで確認する'));
assert.doesNotMatch(content(tree),/受け取りました/);
offline=false;await button(tree,'もう一度確認する').props.onClick();assert.equal(render(),null);
console.log('Login bonus UI passed: server-confirmed success only, double tap guard, retry, dismiss, already received and offline status.');
