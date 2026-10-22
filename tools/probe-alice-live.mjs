/** Explicit production release probe. Creates only disposable identities and a private room. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {API_KEY} from '../src/net/auth.js';
import {DB_URL} from '../src/net/firebase.js';
import {ALICE_SKINS} from '../src/skins/alice.js';
import {acceptAct} from '../src/net/sync.js';
const origin='https://tottery.tsmanager.workers.dev';
const code='ALICE'+Math.random().toString(36).slice(2,5).toUpperCase();
const actors=[];const checks=[];let roomCreated=false,walletTouched=false;
const authCall=async(op,body)=>fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${op}?key=${API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
const call=async(who,path,method='GET',body)=>{
 const r=await fetch(`${DB_URL}/${path}.json?auth=${who.idToken}`,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 return {status:r.status,ok:r.ok,data:await r.json()};
};
const api=async(who,path,body={})=>{
 const r=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${who.idToken}`},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 return {status:r.status,ok:r.ok,data:await r.json()};
};
const check=(name,r,allowed=true)=>{assert.equal(r.ok,allowed,`${name}: HTTP ${r.status}`);checks.push({name,status:r.status});};
try{
 for(let i=0;i<3;i++){const r=await authCall('signUp',{returnSecureToken:true});assert.ok(r.ok,'Disposable sign-in');actors.push(await r.json());}
 const [host,guest,outsider]=actors;
 check('private test room',await call(host,`rooms/${code}`,'PUT',{seats:{host:host.localId},createdAt:Date.now(),hostRuleVersion:19,matchSize:9}));roomCreated=true;
 check('guest seat',await call(guest,`rooms/${code}/seats/guest`,'PUT',guest.localId));
 check('guest version',await call(guest,`rooms/${code}/guestRuleVersion`,'PUT',19));
 const loadout=Object.fromEntries(ALICE_SKINS.map(s=>[s.rank,s.id+':foil']));
 check('Alice loadout',await call(host,`rooms/${code}/hostSkins`,'PUT',loadout));
 let n=0;const put=async(who,body)=>{
  const id='-'+String(++n).padStart(19,'0');const act={...body,by:who.localId,__id:`alice-${n}`};
  const r=await call(who,`rooms/${code}/acts/${id}`,'PUT',act);return {r,id,act};
 };
 const packets=[
  {type:'ALICE_ACTION',kind:'reverse',aId:'c0',pickIds:['c1','c2','c3'],seed:4294967295,player:0},
  {type:'ALICE_ACTION',kind:'revolution',seed:0,player:0},
  {type:'ALICE_ACTION',kind:'king',pickIds:['c1'],seed:12,player:0},
  {type:'ALICE_ACTION',kind:'field',pickIds:['c1','c2'],row:0,col:8,seed:123,player:0},
  {type:'ALICE_ACTION',kind:'revive',row:8,col:0,seed:7,player:1},
  {type:'ALICE_ACTION',kind:'recruit',row:4,col:4,seed:8,player:0},
  {type:'ALICE_ACTION',kind:'decline',seed:9,player:0},
  {type:'ALICE_ACTION',kind:'unmask',pickIds:['c3'],seed:10,player:0},
  {type:'MOVE_PIECE',pieceId:'c1',row:4,col:4,fakeRow:0,fakeCol:8,seed:11,player:0}
 ];
 for(const packet of packets){const who=packet.player?guest:host;const {r,id,act}=await put(who,packet);check(packet.kind||'fake move',r);const read=await call(who===host?guest:host,`rooms/${code}/acts/${id}`);check('peer read',read);assert.deepEqual(read.data,act);assert.equal(acceptAct(read.data,who===host?guest.localId:host.localId,who===host?1:0,who.localId).player,packet.player);}
 for(const bad of [{kind:'x'.repeat(25)},{seed:-1},{seed:4294967296},{fakeRow:9},{fakeCol:9}]){const {r}=await put(host,{type:'ALICE_ACTION',kind:'king',...bad});check('invalid field rejected',r,false);}
 check('outsider read rejected',await call(outsider,`rooms/${code}`),false);
 const {r}=await put(outsider,{type:'ALICE_ACTION',kind:'king',seed:1});check('outsider write rejected',r,false);
 const summary=await api(host,'/api/wallet/summary');walletTouched=true;check('production wallet API',summary);assert.deepEqual(summary.data.gachaSeries,['heroes','alice']);
 const health=await fetch(origin+'/api/season/health',{signal:AbortSignal.timeout(15000)});check('production API health',health);assert.equal((await health.json()).ok,true);
 console.log(`Alice production: ${checks.length} checks passed (all action shapes, peer reads, forged/out-of-range rejection, series API).`);
}finally{
 const host=actors[0];
 if(walletTouched)check('test wallet cleanup',await api(host,'/api/season/forget'));
 if(roomCreated){check('test room cleanup',await call(host,`rooms/${code}`,'DELETE'));const r=await call(host,`rooms/${code}`);assert.ok(!r.ok||r.data===null);}
 for(const a of actors){const r=await authCall('delete',{idToken:a.idToken});assert.ok(r.ok,'Disposable identity cleanup');}
 fs.writeFileSync('reports/alice-online-20261011/live-probe.json',JSON.stringify({verifiedAt:new Date().toISOString(),origin,checks,cleanedUp:true},null,2)+'\n');
}
