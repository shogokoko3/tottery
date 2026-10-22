import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ALICE_SKINS} from '../src/skins/alice.js';
const dir=process.argv[2]||'dist',origin='https://tottery.tsmanager.workers.dev';
const hash=x=>createHash('sha256').update(x).digest('hex');
const get=async(p,method='GET')=>fetch(origin+'/'+encodeURI(p),{method,signal:AbortSignal.timeout(30000)});
const buildRes=await get('build-info.json');assert.equal(buildRes.status,200);
const build=await buildRes.json();assert.deepEqual(build,JSON.parse(fs.readFileSync(path.join(dir,'build-info.json'))));
const htmlRes=await get('');assert.equal(htmlRes.status,200);const html=Buffer.from(await htmlRes.arrayBuffer());assert.equal(hash(html),hash(fs.readFileSync(path.join(dir,'index.html'))));
const assets=[...new Set(ALICE_SKINS.flatMap(s=>[s.image,s.boardCard,s.foilImage]))];
for(const f of fs.readdirSync(path.join(dir,'fields')))if(/^[a-z-]+\.[a-f0-9]{8}\.(png|webp)$/.test(f))assets.push('fields/'+f);
for(let i=0;i<assets.length;i+=6)await Promise.all(assets.slice(i,i+6).map(async p=>{
 const r=await get(p,'HEAD');assert.equal(r.status,200,p);assert.ok(r.headers.get('content-type')?.startsWith('image/'),p);
 const length=r.headers.get('content-length');if(length)assert.equal(Number(length),fs.statSync(path.join(dir,p)).size,p);
}));
const samples=[ALICE_SKINS[0].image,ALICE_SKINS.find(s=>s.rank==='10').boardCard,ALICE_SKINS.find(s=>s.rank==='Q').foilImage,...assets.filter(p=>p.startsWith('fields/alice-')).slice(0,2)];
for(const p of samples){const r=await get(p);assert.equal(r.status,200,p);assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(fs.readFileSync(path.join(dir,p))),p);}
const log=fs.readFileSync('reports/alice-online-20261011/worker-deploy-final.log','utf8');
const deploymentId=log.match(/Current Version ID: ([\w-]+)/)?.[1];assert.ok(deploymentId);
fs.writeFileSync('reports/alice-online-20261011/release.json',JSON.stringify({verifiedAt:new Date().toISOString(),url:origin,deploymentId,build,ruleVersion:19,htmlSha256:hash(html),checkedAssets:assets,byteVerifiedAssets:samples},null,2)+'\n');
console.log(`Production release verified: HTML and build match, ${assets.length} images available, ${samples.length} sample images match byte for byte.`);
