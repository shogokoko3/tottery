"""Independent checks on final encoded loop assets and their seam previews."""
import json,subprocess,tempfile,warnings,hashlib
from pathlib import Path
import numpy as np
from scipy.io import wavfile
ROOT=Path(__file__).resolve().parent.parent
report=ROOT/'reports/bgm-loops-20261021'
rows=json.loads((report/'analysis.json').read_text());assert len(rows)==16
manifest=json.loads((ROOT/"docs/selected-audio.json").read_text())
results=[];previews={}
with tempfile.TemporaryDirectory() as temp:
 for row in rows:
  file=ROOT/'assets/audio'/(row['id']+'.m4a')
  wav=Path(temp)/'decoded.wav'
  subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100','-c','2',str(file),str(wav)],check=True,capture_output=True)
  with warnings.catch_warnings():
   warnings.simplefilter('ignore');sr,x=wavfile.read(wav)
  x=x.astype(float)/32768
  full_rms=float(np.sqrt(np.mean(x*x)))
  meta=next(r for r in manifest if r['kind']=='bgm' and r['file']==file.name)
  decoded=x;meta_start=round(meta.get('loopStart',0)*sr)
  x=x[meta_start:round(meta.get('loopEnd',len(x)/sr)*sr)];half=round(sr*.5)
  db=lambda z:20*np.log10(max(np.sqrt(np.mean(z*z)),1e-12))
  level_difference=abs(db(x[:half])-db(x[-half:]))
  jump=float(np.max(abs(x[-1]-x[0])))
  typical_step=float(np.percentile(abs(np.diff(x[::4],axis=0)),99))
  restored=meta.get('sourceRevision')=='first-demo-20261019'
  approved_full=meta.get('playbackMode')=='full-track-loop'
  authored_home=meta.get('playbackMode')=='authored-intro-loop'
  if approved_full or authored_home:
   choice=json.loads((ROOT/'docs/audio-source-overrides.json').read_text())[row['id']]
   assert hashlib.sha256(file.read_bytes()).hexdigest()==choice['sha256']==meta['sourceSha256']
   assert file.read_bytes()==(ROOT/choice['source']).read_bytes()
   if approved_full:assert meta['loopStart']==0 and abs(meta['loopEnd']-len(x)/sr)<.001
   else:
    assert abs(meta['loopStart']-choice['loopStart'])<1/sr and abs(meta['loopEnd']-choice['loopEnd'])<1/sr
    natural_difference=abs(db(decoded[meta_start-half:meta_start])-db(decoded[meta_start:meta_start+half]))
    assert abs(level_difference-natural_difference)<.4,(row['id'],'changed natural phrase dynamics',level_difference,natural_difference)
   assert abs(20*np.log10(full_rms*meta['normalizationGain'])+23)<.05,(row['id'],'playback loudness')
  elif not restored:assert level_difference<.5,(row['id'],'seam level',level_difference)
  assert np.max(abs(x))*meta.get('normalizationGain',1)<.86,(row['id'],'clipping')
  assert jump<max(.035,5*typical_step),(row['id'],'click risk',jump)
  if not restored and not approved_full and not authored_home:assert row['harmonicSimilarity']>=row['previousUnmatchedEndpointsSimilarity']-.005,(row['id'],'harmony regression')
  if not approved_full:assert db(x[:round(sr*.05)])>-60 and db(x[-round(sr*.05):])>-60,(row['id'],'silent padding')
  results.append(dict(id=row['id'],sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seamLevelDifferenceDb=level_difference,seamSampleJump=jump))
  if row['id'] in ['title','battle','endgame']:
   preview=np.concatenate([x[-6*sr:],x[:6*sr]])*meta.get('normalizationGain',1)
   previews[row['id']]=(sr,(np.clip(preview,-1,1)*32767).astype(np.int16))
(report/'verification.json').write_text(json.dumps(results,indent=2))
# One audition file: home, battle, endgame. Each seam is 6 seconds into its excerpt.
parts=[]
for id in ['title','battle','endgame']:
 sr,x=previews[id]
 wavfile.write(report/(id+'-loop-preview.wav'),sr,x)
 parts.extend([x,np.zeros((sr,2),dtype=np.int16)])
wavfile.write(report/'ホーム・対局・終盤_ループ試聴.wav',sr,np.concatenate(parts))
print('All 16 encoded tracks: approved source identity / authored loop continuity, playback level and seam PASS')
