"""Prepare the three approved home themes with authored, codec-safe phrase returns."""
from pathlib import Path
import hashlib,json,shutil,subprocess,tempfile,warnings
import numpy as np
from scipy import signal,ndimage
from scipy.io import wavfile

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'reports/home-phase-bgm-20261024'
OUT.mkdir(exist_ok=True)
SR=44100
CHOICES=ROOT/'docs/home-phase-bgm-choices.json'
choices=json.loads(CHOICES.read_text())
layout_file=ROOT/'src/audio/music-layouts.js'
layouts=json.loads(layout_file.read_text().split('export const MUSIC_LAYOUTS = ',1)[1].strip().removesuffix(';'))
manifest_file=ROOT/'docs/selected-audio.json'
manifest=json.loads(manifest_file.read_text())
override_file=ROOT/'docs/audio-source-overrides.json'
overrides=json.loads(override_file.read_text())
baseline={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'assets/audio').glob('*.m4a')}
for name in ['assets/audio/title.m4a','docs/selected-audio.json','docs/audio-source-overrides.json','src/audio/music-layouts.js']:
 backup=OUT/'before'/name
 if not backup.exists():
  backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,backup)

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def decode(path,wav):
 subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100','-c','2',str(path),str(wav)],check=True,capture_output=True)
 with warnings.catch_warnings():
  warnings.simplefilter('ignore');sr,x=wavfile.read(wav)
 assert sr==SR
 return x.astype(float)/32768
def db(x):return float(20*np.log10(max(np.sqrt(np.mean(x*x)),1e-12)))
def encode(samples,path,tmp):
 wavfile.write(tmp/'out.wav',SR,np.clip(np.rint(samples*32768),-32768,32767).astype(np.int16))
 subprocess.run(['afconvert','-f','m4af','-d','aac','-b','192000',str(tmp/'out.wav'),str(path)],check=True,capture_output=True)
def chroma(x):
 mono=signal.resample_poly(x.mean(axis=1),1,4)
 f,t,z=signal.stft(mono,SR/4,nperseg=4096,noverlap=3840,boundary=None)
 power=abs(z)**2;good=(f>65)&(f<2200)
 pc=np.rint(69+12*np.log2(np.maximum(f,1)/440)).astype(int)%12
 c=np.sqrt(np.array([power[good&(pc==k)].sum(axis=0) for k in range(12)]))
 c/=np.maximum(np.linalg.norm(c,axis=0),1e-12)
 return t,c
def harmony(t,c,duration,beat):
 entries=[]
 for at in np.arange(0,duration-.1,2*beat):
  v=c[:,(t>=max(0,at-.4))&(t<at+1.2)].mean(axis=1)
  candidates=[]
  for root in range(12):
   for mode,third in [('major',4),('minor',3)]:
    notes=[root,(root+third)%12,(root+7)%12]
    candidates.append((float(v[notes].sum()+.12*v[root]),root,mode,notes))
  _,root,mode,notes=max(candidates,key=lambda item:item[0])
  fit=float(v[notes].sum()/max(v.sum(),1e-12))
  if fit<.43:root,mode=int(np.argmax(v)),'open'
  entries.append({'at':round(float(at),6),'root':root,'mode':mode,'fit':round(fit,3)})
 return entries

results=[]
with tempfile.TemporaryDirectory() as temp:
 tmp=Path(temp)
 for phase in [1,2,3]:
  choice=choices['phases'][str(phase)]
  assert choice['status']=='approved'
  selected=ROOT/choice.get('selectedMaster',choice['source'])
  assert digest(selected)==choice['sourceSha256']
  selected_master=ROOT/('assets/audio/masters/home-phase-%d-approved-20261024.m4a'%phase)
  selected_master.parent.mkdir(exist_ok=True)
  if not selected_master.exists():shutil.copy2(selected,selected_master)
  assert digest(selected_master)==choice['sourceSha256']
  x=decode(selected_master,tmp/'source.wav')
  config=choice['loopEdit']
  a,b,w=[round(config[k]*SR) for k in ['sourceStart','sourceEnd','crossfadeSeconds']]
  assert w<a<b<len(x)-SR//2
  t,c=chroma(x)
  offsets=np.linspace(-w/SR,-.025,70)
  ca=np.array([np.interp(a/SR+offsets,t,v) for v in c])
  cb=np.array([np.interp(b/SR+offsets,t,v) for v in c])
  harmonic_fit=float(np.mean(np.sum(ca*cb,axis=0)))
  assert harmonic_fit>.90,(phase,'incompatible crossfade harmony',harmonic_fit)
  y=x[:b].copy()
  weight=(.5-.5*np.cos(np.linspace(0,np.pi,w)))[:,None]
  tail=x[b-w:b];incoming=x[a-w:a]
  blended=tail*(1-weight)+incoming*weight
  # A bounded, slow envelope compensation avoids a soft dip midway through
  # the crossfade without changing the rest of the approved performance.
  smooth=lambda v:ndimage.gaussian_filter1d(np.mean(v*v,axis=1),SR*.10)
  expected=smooth(tail)*(1-weight[:,0])+smooth(incoming)*weight[:,0]
  actual=smooth(blended)
  compensation=np.clip(np.sqrt(expected/np.maximum(actual,1e-12)),.90,1.15)
  compensation=1+(compensation-1)*np.sin(np.linspace(0,np.pi,w))**2
  y[-w:]=blended*compensation[:,None]
  assert np.array_equal(y[:b-w],x[:b-w])
  guard=round(.9*SR);shift=round(.35*SR)
  y=np.concatenate([y,x[a:a+guard]])
  # Both repeat points sit inside identical real source audio. This avoids
  # AAC priming/padding and continues a note across the actual runtime jump.
  start=(a+shift)/SR;end=(b+shift)/SR
  encoding_gain=min(10**(-22/20)/np.sqrt(np.mean(y*y)),.70/max(np.max(abs(y)),1e-12))
  master=ROOT/('assets/audio/masters/home-phase-%d-loop-20261024.m4a'%phase)
  encode(y*encoding_gain,master,tmp)
  final=decode(master,tmp/'verified.wav')
  normalization=min(1.,10**(-23/20)/np.sqrt(np.mean(final*final)))
  aa,bb=round(start*SR),round(end*SR);span=round(.15*SR)
  reference=final[aa-span:aa+span];returned=final[bb-span:bb+span]
  error=float(np.sqrt(np.mean((returned-reference)**2))/max(np.sqrt(np.mean(reference**2)),1e-12))
  jump=float(np.max(abs(final[bb-1]-final[aa])))*normalization
  actual_step=float(np.max(abs(final[aa-1]-final[aa])))*normalization
  level_step=abs(db(final[bb-SR//2:bb])-db(final[aa:aa+SR//2]))
  natural_step=abs(db(final[aa-SR//2:aa])-db(final[aa:aa+SR//2]))
  assert error<.08,(phase,'encoded repeated phrase',error)
  assert jump<.015 and jump<actual_step+.01,(phase,'loop click',jump)
  assert abs(level_step-natural_step)<.4,(phase,'changed natural dynamics',level_step,natural_step)
  assert np.max(abs(final))*normalization<.86
  assert abs(db(final*normalization)+23)<.05
  id='title' if phase==1 else 'homePhase%d'%phase
  target=ROOT/'assets/audio'/(id+'.m4a');shutil.copy2(master,target)
  phase_out=OUT/('phase%d'%phase);phase_out.mkdir(exist_ok=True)
  result={'phase':phase,'id':id,'name':choice['name'],'approvedSource':str(selected_master.relative_to(ROOT)),
          'approvedSourceSha256':choice['sourceSha256'],'master':str(master.relative_to(ROOT)),
          'masterSha256':digest(master),'fileSha256':digest(target),'duration':len(final)/SR,
          'sourceReturn':a/SR,'sourceEnd':b/SR,'editStart':(b-w)/SR,'editEnd':b/SR,
          'loopStart':start,'loopEnd':end,'loopSeconds':end-start,'crossfadeSeconds':w/SR,
          'bpm':config['bpm'],'harmonicSimilarity':harmonic_fit,'returnContextRelativeError':error,
          'loopSampleJump':jump,'referenceSampleStep':actual_step,'seamLevelDifferenceDb':level_step,
          'naturalPhraseLevelDifferenceDb':natural_step,'normalizationGain':normalization,'encodingGain':encoding_gain,
          'unchangedBeforeTail':True,'focus32SecondsPcmUnchanged':bool(np.array_equal(y[29*SR:36*SR],x[29*SR:36*SR])),
          'creditsUsed':0}
  verification_path=phase_out/'edit-verification.json'
  verification_path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
  duration=len(final)/SR;beat=60/config['bpm'];ht,hc=chroma(final)
  revision='approved-home-phase-%d-loop-20261024'%phase
  layout={'loopStart':start,'loopEnd':end,'duration':duration,'beatSeconds':beat,
          'transitionCues':[round(float(at),6) for at in np.arange(0,end,beat)],
          'harmony':harmony(ht,hc,duration,beat),'normalizationGain':normalization,
          'sourceRevision':revision,'sourceSha256':digest(master),'playbackMode':'authored-intro-loop',
          'editVerification':str(verification_path.relative_to(ROOT))}
  layouts[id]=layout
  overrides[id]={'revision':revision,'name':choice['name'],'storyPhase':phase,
                 'source':str(master.relative_to(ROOT)),'approvedFrom':str(selected_master.relative_to(ROOT)),
                 'sha256':digest(master),'playbackMode':'authored-intro-loop','bpm':config['bpm'],
                 'loopStart':start,'loopEnd':end,'loopCrossfade':w/SR,
                 'reportDirectory':str(phase_out.relative_to(ROOT)),
                 'editVerification':str(verification_path.relative_to(ROOT)),
                 'reason':'採用曲の導入を初回だけ流し、旋律・和音と拍の合うフレーズへ接続。実際の反復点は同一の録音内に置く。'}
  row=next((r for r in manifest if r.get('kind')=='bgm' and r['id']==id),None)
  if row is None:row={'id':id,'kind':'bgm'};manifest.append(row)
  for key in ['taskId','loopRefined','loopSourceStart','loopSourceEnd']:row.pop(key,None)
  row.update(file=target.name,name=choice['name'],scene='ホーム・関連メニュー(フェーズ%d)'%phase,storyPhase=phase,
             duration=duration,bytes=target.stat().st_size,rms=db(final),introDuration=start,
             loopStart=start,loopEnd=end,loopCrossfade=w/SR,source=overrides[id]['source'],
             sourceRevision=revision,approvedFrom=overrides[id]['approvedFrom'],sourceSha256=digest(master),
             normalizationGain=normalization,playbackMode='authored-intro-loop')
  choice.update(selectedMaster=str(selected_master.relative_to(ROOT)),implementationStatus='implemented',
                trackId=id,asset=str(target.relative_to(ROOT)),assetSha256=digest(target),
                loopStart=start,loopEnd=end,verification=str(verification_path.relative_to(ROOT)))
  seam=np.concatenate([final[bb-12*SR:bb],final[aa:aa+12*SR]])*normalization*.75
  encode(seam,OUT/('phase%d-loop-seam.m4a'%phase),tmp)
  audition=np.concatenate([final[:bb],final[aa:bb],final[aa:bb]])*normalization*.75
  encode(audition,OUT/('phase%d-loop-preview.m4a'%phase),tmp)
  results.append(result)
  print(json.dumps({k:result[k] for k in ['phase','name','loopStart','loopEnd','loopSeconds','harmonicSimilarity','returnContextRelativeError','loopSampleJump']},ensure_ascii=False),flush=True)
layout_file.write_text('// Generated music layouts; approved phase homes by tools/prepare-home-phase-bgm.py.\nexport const MUSIC_LAYOUTS = '+json.dumps(layouts,separators=(',',':'))+';\n')
manifest_file.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
override_file.write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n')
CHOICES.write_text(json.dumps(choices,ensure_ascii=False,indent=2)+'\n')
adaptive=ROOT/'reports/adaptive-music-20261022'
if adaptive.exists():(adaptive/'layouts.json').write_text(json.dumps(layouts,indent=2)+'\n')
for name,sha in baseline.items():
 if name not in ['title.m4a','homePhase2.m4a','homePhase3.m4a']:
  assert digest(ROOT/'assets/audio'/name)==sha,('unrelated audio changed',name)
(OUT/'verification.json').write_text(json.dumps({'tracks':results,'otherAudioUnchanged':True,'runwayCreditsUsed':0},ensure_ascii=False,indent=2)+'\n')
print('Three approved phase homes installed with verified source identity and continuous encoded returns.',flush=True)
