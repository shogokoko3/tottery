import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const source=read('src/game/story-comics.json');
const ref=fs.readFileSync('../漫画原作/王拾い_台本_全話.md','utf8');
const titles=[...ref.matchAll(/^# 第\d+話「([^」]+)」/gm)].map(m=>m[1]);
assert.equal(titles.length,21);assert.deepEqual(source.episodes.map(e=>e.title),titles);
assert.deepEqual(source.episodes.map(e=>e.sequence),Array.from({length:21},(_,i)=>i+1));
const text=e=>e.comicPages.flatMap(p=>p.panels.flatMap(p=>p.lines.map(l=>l.text))).join('');
assert.match(text(source.episodes[13]),/届かない/,'大河の敗走を勝利に変えない');
const villageVoices=source.episodes[14].comicPages.flatMap(p=>p.panels.flatMap(p=>p.lines));
for(const [speaker,words]of [['ゲン','俺が王だ。'],['村の女','じゃあ、私も連れていきな。'],['村人たち','私も王だよ！']]){
 assert(villageVoices.some(l=>l.speaker===speaker&&l.text.includes(words)),'土の民それぞれが自分の声で引き受ける: '+speaker);
}
const end=text(source.episodes.at(-1));
for(const phrase of ['動くな。剣を、捨てろ。','全軍、武器を下げて退け。','もう、持っていたくない。','で、俺はいつ畑に帰れる？','十年後','その一枚が、王かもしれない。'])assert(end.includes(phrase),phrase);
const backup='reports/story-ouhiroi-20261016/旧版_灰冠の年代記';
for(const f of read(backup+'/manifest.json'))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(backup+'/'+f.file)).digest('hex'),f.sha256,f.file);
assert.equal(read(backup+'/src/game/story-comics.json').title,'灰冠の年代記');
console.log('原作21話の並び・敗走・終章と、旧版13ファイルの保存を確認');
