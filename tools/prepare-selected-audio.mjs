// Run from the project root. Original candidate audio remains untouched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {readWav,writeWav,trimSilence,normalize,slice,envelope,fromDb} from './wav.mjs';
const source='../音楽・効果音候補集';
const catalog=JSON.parse(fs.readFileSync(`${source}/catalog.json`,'utf8'));
const chosen={home:'title',waiting:'waiting',setup:'setup',battle:'battle',endgame:'endgame',tutorial:'tutorial',puzzle:'puzzle',story:'story',collection:'collection',shop:'shop',summon:'summon',rewards:'rewards',ranking:'ranking',result_win:'resultWin',result_lose:'resultLose',result_draw:'resultDraw'};
const selectedSe=['tap','confirm','back','error','page','deal','shuffle','dice','place','capture','king_select','start','time30','time10','reveal','ace_swap','ace_capture','ace_foil','earth','sea','forest','ice','thaw','sky','palace','heaven','hell','alice_reverse','alice_revolution','alice_caucus','alice_quadrille','alice_maze','alice_tea','alice_illusion','alice_croquet','revive','recruit','login','mission','claim_all','levelup','mastery','title','foil_acquire','foil_open','forge','dismantle','equip','purchase','friend','summon_bed','reveal_r','reveal_sr','reveal_ssr','summon_freeze','win','lose','draw','puzzle_correct','puzzle_retry'];
const alias={time30:'tick',ace_swap:'aceSwap',ace_capture:'aceCapture',ace_foil:'aceFoil'};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tottery-audio-'));
const manifest=[];
try {
 for(const item of [...catalog.bgm.filter(x=>chosen[x.id]),...catalog.se.filter(x=>selectedSe.includes(x.id))]){
  const bgm=item.kind==='bgm',id=bgm?chosen[item.id]:(alias[item.id]||item.id);
  const file=bgm?`${id}.m4a`:`se-${id}.m4a`;
  const wav=path.join(tmp,'source.wav');
  execFileSync('afconvert',['-f','WAVE','-d','LEI16@44100','-c',bgm?'2':'1',`${source}/${item.file}`,wav]);
  let {ch,rate}=readWav(wav);ch=trimSilence(ch,rate,bgm?-48:-52);
  if(bgm){
   const {env,win}=envelope(ch,rate), sorted=Float32Array.from(env).sort(), ref=sorted[Math.floor(sorted.length*.75)];
   let end=env.length-1;while(end>0&&env[end]<ref*fromDb(-6))end--;
   ch=slice(ch,0,Math.max(Math.floor(ch[0].length*.88),Math.min(ch[0].length,(end+1)*win)));
   const n=ch[0].length,x=Math.min(Math.floor(rate*1.3),Math.floor(n/3));
   // Rotate past the opening overlap: original x..end followed by a tail/head crossfade.
   const out=ch.map(c=>c.slice(x));
   for(let i=0;i<x;i++){const t=i/(x-1);for(let c=0;c<ch.length;c++)out[c][n-2*x+i]=ch[c][n-x+i]*Math.cos(t*Math.PI/2)+ch[c][i]*Math.sin(t*Math.PI/2);}
   ch=out;
  }
  // Avoid hard edges in one-shot effects; retain their natural attack and tail.
  if(!bgm)for(const c of ch){const edge=Math.min(Math.floor(rate*.004),Math.floor(c.length/2));for(let i=0;i<edge;i++){c[i]*=i/edge;c[c.length-1-i]*=i/edge;}}
  const level=normalize(ch,bgm?-23:-19,-2);
  writeWav(wav,ch,rate);
  execFileSync('afconvert',['-f','m4af','-d','aac','-b',bgm?'96000':'64000',wav,`assets/audio/${file}`]);
  manifest.push({id,file,kind:item.kind,name:item.name,scene:item.scene,taskId:item.taskId,duration:ch[0].length/rate,bytes:fs.statSync(`assets/audio/${file}`).size,rms:level.rmsAfter});
  console.log(`${id} ${Math.round(ch[0].length/rate*10)/10}s`);
 }
 fs.writeFileSync('docs/selected-audio.json',JSON.stringify(manifest,null,2));
 console.log(`Prepared ${manifest.length} local audio assets`);
 // Preserve the chosen soft sound design when regenerating source audio.
 execFileSync('python3', ['tools/soften-se.py'], {stdio:'inherit'});
 execFileSync('python3', ['tools/refine-bgm-loops.py'], {stdio:'inherit'});
 execFileSync('python3', ['tools/prepare-tonal-cues.py'], {stdio:'inherit'});
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
