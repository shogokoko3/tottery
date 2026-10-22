import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
const m=JSON.parse(fs.readFileSync('src/game/story-comics.json','utf8'));
const sealStory=m.version.startsWith('19-')||/^\d+-ouhiroi-seal-power-/.test(m.version);
const{verifyReaderApproval}=await import(sealStory?'../reports/story-seal-v6-20261018/apply-reviewed.mjs':m.version.startsWith('18-')?'../reports/story-conversation-v5-20261017/apply-reviewed.mjs':m.version.startsWith('17-')?'../reports/story-dialogue-revision-20261017/apply-reviewed.mjs':m.version.startsWith('16-')?'../reports/story-full-revision-20261017/apply-reviewed.mjs':'../reports/story-reader-revision-20261016/apply-reviewed.mjs');
assert.equal(m.presentation,'manga-atlas');
const{script,receipt}=verifyReaderApproval();
const pages=[...m.prologue.mangaPages,...m.episodes.flatMap(e=>e.mangaPages)];
assert.equal(pages.length,receipt.pages.length);assert.equal(new Set(pages.map(p=>p.id)).size,pages.length);
assert.deepEqual(pages.map(p=>p.id),script.episodes.flatMap(e=>e.pages.map(p=>p.id)));
for(const e of [m.prologue,...m.episodes]){
 const accessible=e.comicPages||e.pages;
 for(const stage of ['before','after']){
  const lines=ps=>ps.filter(p=>p.stage===stage).flatMap(p=>p.panels.flatMap(p=>p.lines));
  assert.deepEqual(lines(e.mangaPages),lines(accessible),'漫画と読み上げ本文・話者が一致');
 }
}
for(const p of pages){
 assert.equal(p.art.layout,'printed-manga');assert.equal(p.art.lettering,'printed-in-scene');assert.equal(p.art.cells.length,1);
 const data=fs.readFileSync(`assets/story/comics/${p.art.sheet}.webp`);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),p.art.sha256);
 assert(p.art.sheet.startsWith('ouhiroi-reader-'),'読者検証済みの稿を使う');
 assert(fs.existsSync(`assets/story/comics/${p.art.cover.sheet}.webp`),'一覧用の絵も保持');
 for(const[x,y,w,h]of p.art.cells)assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=p.art.width&&y+h<=p.art.height);
}
for(const e of m.episodes){const b=e.mangaPages.filter(p=>p.stage==='before'),a=e.mangaPages.filter(p=>p.stage==='after');assert(b.length&&a.length);for(const p of b)assert(!a.some(q=>q.art.sheet===p.art.sheet),'対局前に後日談を出さない');}
console.log(`漫画${pages.length}ページ: 全画像の読者判定・ハッシュ、前後の分離、読み上げ本文を確認`);
