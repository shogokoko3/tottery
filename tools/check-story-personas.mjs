import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=JSON.parse(fs.readFileSync('src/game/story-comics.json','utf8'));
const lines=[...m.prologue.pages,...m.episodes.flatMap(e=>e.comicPages)].flatMap(p=>p.panels.flatMap(p=>p.lines));
const text=JSON.stringify(m);
assert.doesNotMatch(text,/シノ|エドリク|ロウとセラ|記憶は戻らない|あなたは一年前/);
assert(lines.some(l=>l.speaker==='ニノ'));assert(lines.some(l=>l.speaker==='リン'));
assert(!lines.some(l=>l.speaker==='あなた'),'プレイヤーはニノを追憶する第三者');
for(const l of lines){assert(l.speaker&&l.text);if(l.speaker!=='語り')assert(/^「.*」$/.test(l.text));}
assert.match(m.guide,/十七歳の(?:影の)?少女/);
for(const name of ['ニノ','リン','ミオ','ゲン','ガラ','サイ','ジーク','ノア','オルガ','ダグ','ユーゴ','セレネ','アルス','ゼノ'])assert(text.includes(name),name);
console.log('ニノとリンを中心とした登場人物・三人称・台詞の話者を確認');
