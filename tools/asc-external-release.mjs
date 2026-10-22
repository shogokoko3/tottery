// External TestFlight release helper. Explicit user authorization required. Credentials stay in memory; no tokens enter reports.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {SignJWT,importPKCS8} from 'jose';
import {APP_STORE_ID} from '../src/server/app-version.js';
const report=process.env.RELEASE_REPORT || 'reports/legend-costume-external-testflight-20261015';
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
assert.ok(['status','submit','verify'].includes(mode));
assert.match(version||'',/^\d{12}$/);
const found=await api(`/v1/builds?filter[app]=${APP_STORE_ID}&filter[version]=${version}&include=buildBetaDetail,betaAppReviewSubmission&limit=10`);
if(!found.data.length){console.log(JSON.stringify({version,processingState:'NOT_UPLOADED'}));process.exit(0);}
assert.equal(found.data.length,1);
const b=found.data[0];
const detail=found.included?.find(x=>x.type==='buildBetaDetails');
const review=found.included?.find(x=>x.type==='betaAppReviewSubmissions');
if(mode==='status'){
 console.log(JSON.stringify({id:b.id,version,attributes:b.attributes,detail:detail?.attributes,review:review?.attributes}));process.exit(0);
}
assert.equal(b.attributes.processingState,'VALID');
assert.equal(b.attributes.expired,false);
assert.notEqual(b.attributes.buildAudienceType,'INTERNAL_ONLY');
const before=JSON.parse(fs.readFileSync(report+'/groups.before.json','utf8'));
const now=await snapshot();
const group=now.groups.find(g=>g.attributes.name==='テスター'&&!g.attributes.isInternalGroup);
assert.ok(group,'Existing external テスター group');
const oldGroup=before.groups.find(g=>g.id===group.id);assert.ok(oldGroup);
assert.equal(group.attributes.publicLinkEnabled,oldGroup.attributes.publicLinkEnabled);
assert.equal(group.attributes.publicLink,oldGroup.attributes.publicLink);
if(mode==='submit'){
 const localizations=await all(`/v1/builds/${b.id}/betaBuildLocalizations?limit=200`);
 const notes=process.env.TESTFLIGHT_NOTES_FILE?fs.readFileSync(process.env.TESTFLIGHT_NOTES_FILE,'utf8').trim():'レジェンド・ゲートのフォイル加工を見直しました。衣装の布地や鎧にも虹色の反射を追加し、ワンダーランドと同じくらい輝くように調整しています。カード一覧・詳細・対局中の表示をご確認ください。';
 assert.ok(notes.length,'TestFlight release notes must not be empty');
 const ja=localizations.find(l=>l.attributes.locale==='ja');
 if(ja){if(ja.attributes.whatsNew!==notes)await api(`/v1/betaBuildLocalizations/${ja.id}`,'PATCH',{data:{type:'betaBuildLocalizations',id:ja.id,attributes:{whatsNew:notes}}});}
 else await api('/v1/betaBuildLocalizations','POST',{data:{type:'betaBuildLocalizations',attributes:{locale:'ja',whatsNew:notes},relationships:{build:{data:{type:'builds',id:b.id}}}}});
 assert.ok(detail);
 if(!detail.attributes.autoNotifyEnabled)await api(`/v1/buildBetaDetails/${detail.id}`,'PATCH',{data:{type:'buildBetaDetails',id:detail.id,attributes:{autoNotifyEnabled:true}}});
 if(!group.builds.some(x=>x.id===b.id))await api(`/v1/betaGroups/${group.id}/relationships/builds`,'POST',{data:[{type:'builds',id:b.id}]});
 if(!review && detail.attributes.externalBuildState!=='IN_BETA_TESTING'){
  const submitted=await api('/v1/betaAppReviewSubmissions','POST',{data:{type:'betaAppReviewSubmissions',relationships:{build:{data:{type:'builds',id:b.id}}}}});
  fs.writeFileSync(report+'/submission.json',JSON.stringify(submitted,null,2)+'\n');
 }
}
const after=await snapshot();
const assigned=after.groups.find(g=>g.id===group.id);
assert.ok(assigned.builds.some(x=>x.id===b.id),'External group includes latest build');
for(const old of before.groups.filter(g=>!g.attributes.isInternalGroup)){
 const current=after.groups.find(g=>g.id===old.id);assert.ok(current);
 assert.equal(current.attributes.publicLinkEnabled,old.attributes.publicLinkEnabled);
 assert.equal(current.attributes.publicLink,old.attributes.publicLink);
 for(const oldBuild of old.builds)assert.ok(current.builds.some(x=>x.id===oldBuild.id),'Existing external build preserved');
}
const final=await api(`/v1/builds/${b.id}?include=buildBetaDetail,betaAppReviewSubmission`);
const finalDetail=final.included?.find(d=>d.type==='buildBetaDetails')?.attributes||{};
const finalReview=final.included?.find(d=>d.type==='betaAppReviewSubmissions')?.attributes||{};
fs.writeFileSync(report+'/groups.after.json',JSON.stringify(after,null,2)+'\n');
const result={verifiedAt:new Date().toISOString(),app:APP_STORE_ID,version:'1.0',build:version,buildId:b.id,attributes:final.data.attributes,detail:finalDetail,review:finalReview,group:{id:group.id,name:group.attributes.name,publicLink:group.attributes.publicLink},existingExternalBuildsPreserved:true};
fs.writeFileSync(report+'/release.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({build:version,processingState:final.data.attributes.processingState,externalBuildState:finalDetail.externalBuildState,review:finalReview,group:group.attributes.name,publicLinkPreserved:true}));
