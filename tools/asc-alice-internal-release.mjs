// Internal-only release helper. Credentials stay in memory; no tokens enter reports.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {SignJWT,importPKCS8} from 'jose';
import {APP_STORE_ID} from '../src/server/app-version.js';
const report=process.env.RELEASE_REPORT || 'reports/alice-testflight-internal-20261011';
const keyId=process.env.ASC_KEY_ID||'U94V7XX3LN';
const issuer=process.env.ASC_ISSUER_ID||'d709d4c7-c92d-411e-8eef-14639582b814';
const key=await importPKCS8(fs.readFileSync(process.env.ASC_KEY_PATH||`${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${keyId}.p8`,'utf8'),'ES256');
const token=await new SignJWT({aud:'appstoreconnect-v1'}).setProtectedHeader({alg:'ES256',kid:keyId,typ:'JWT'}).setIssuer(issuer).setIssuedAt().setExpirationTime('10m').sign(key);
const api=async(path,method='GET',body)=>{
 const r=await fetch('https://api.appstoreconnect.apple.com'+path,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error(`${method} ${path}: ${r.status} ${(await r.text()).slice(0,500)}`);
 return r.status===204?null:r.json();
};
const all=async(path)=>{const out=[];while(path){const r=await api(path);out.push(...r.data);path=r.links?.next?.replace('https://api.appstoreconnect.apple.com','')||null;}return out;};
const snapshot=async()=>{
 const groups=await all(`/v1/apps/${APP_STORE_ID}/betaGroups?limit=200`);
 for(const g of groups)g.builds=await all(`/v1/betaGroups/${g.id}/builds?limit=200&fields[builds]=version,expired`);
 return {at:new Date().toISOString(),app:APP_STORE_ID,groups};
};
const [mode,version]=process.argv.slice(2);
if(mode==='snapshot'){
 const s=await snapshot();fs.mkdirSync(report,{recursive:true});fs.writeFileSync(report+'/groups.before.json',JSON.stringify(s,null,2));console.log(s.groups.map(g=>({name:g.attributes.name,internal:g.attributes.isInternalGroup,builds:g.builds.length})));
}else if(['status','assign'].includes(mode)&&/^\d{12}$/.test(version||'')){
 const r=await api(`/v1/builds?filter[app]=${APP_STORE_ID}&filter[version]=${version}&include=buildBetaDetail&limit=10`);
 if(!r.data.length){console.log(JSON.stringify({version,processingState:'NOT_UPLOADED'}));process.exit(0);}
 assert.equal(r.data.length,1);const b=r.data[0],detail=r.included?.find(d=>d.type==='buildBetaDetails')?.attributes||{};
 if(mode==='status'){console.log(JSON.stringify({id:b.id,version,attributes:b.attributes,detail}));process.exit(0);}
 assert.equal(b.attributes.processingState,'VALID');assert.equal(b.attributes.expired,false);assert.equal(detail.externalBuildState,'NOT_APPLICABLE','Must be an internal-only upload');
 if(b.attributes.buildAudienceType)assert.equal(b.attributes.buildAudienceType,'INTERNAL_ONLY');
 const before=JSON.parse(fs.readFileSync(report+'/groups.before.json','utf8')),now=await snapshot();
 const group=now.groups.find(g=>g.attributes.name==='開発'&&g.attributes.isInternalGroup);assert.ok(group,'Internal 開発 group');
 const externals=now.groups.filter(g=>!g.attributes.isInternalGroup);
 assert.ok(externals.every(g=>!g.builds.some(x=>x.id===b.id)),'No external assignment');
 if(!group.builds.some(x=>x.id===b.id))await api(`/v1/betaGroups/${group.id}/relationships/builds`,'POST',{data:[{type:'builds',id:b.id}]});
 const after=await snapshot();assert.ok(after.groups.find(g=>g.id===group.id).builds.some(x=>x.id===b.id));
 for(const old of before.groups.filter(g=>!g.attributes.isInternalGroup)){
  const current=after.groups.find(g=>g.id===old.id);assert.ok(current);assert.equal(current.attributes.publicLinkEnabled,old.attributes.publicLinkEnabled);assert.equal(current.attributes.publicLink,old.attributes.publicLink);
  assert.deepEqual(current.builds.map(x=>x.id).sort(),old.builds.map(x=>x.id).sort(),'Existing external distribution preserved');assert.ok(!current.builds.some(x=>x.id===b.id));
 }
 const final=await api(`/v1/builds/${b.id}?include=buildBetaDetail`);const finalDetail=final.included?.find(d=>d.type==='buildBetaDetails')?.attributes||{};
 assert.equal(finalDetail.internalBuildState,'IN_BETA_TESTING');assert.equal(finalDetail.externalBuildState,'NOT_APPLICABLE');
 fs.writeFileSync(report+'/groups.after.json',JSON.stringify(after,null,2));
 fs.writeFileSync(report+'/release.json',JSON.stringify({verifiedAt:new Date().toISOString(),app:APP_STORE_ID,version:'1.0',build:version,buildId:b.id,attributes:final.data.attributes,detail:finalDetail,group:{id:group.id,name:group.attributes.name},externalGroupsPreserved:true},null,2)+'\n');
 console.log(JSON.stringify({build:version,processingState:'VALID',internalBuildState:finalDetail.internalBuildState,externalBuildState:finalDetail.externalBuildState,group:group.attributes.name,externalGroupsPreserved:true}));
}else throw new Error('Use snapshot, status <build>, or assign <build>');
