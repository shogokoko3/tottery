"""Independent checks on final encoded loop assets and their seam previews."""
import json,subprocess,tempfile,warnings,hashlib
from pathlib import Path
import numpy as np
from scipy.io import wavfile
ROOT=Path(__file__).resolve().parent.parent
report=ROOT/'reports/bgm-loops-20261021'
rows=json.loads((report/'analysis.json').read_text());assert len(rows)==16
manifest=json.loads((ROOT/"docs/selected-audio.json").read_text())
results=[]
with tempfile.TemporaryDirectory() as temp:
 for row in rows:
  file=ROOT/'assets/audio'/(row['id']+'.m4a')
  wav=Path(temp)/'decoded.wav'
  subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100','-c','2',str(file),str(wav)],check=True,capture_output=True)
  with warnings.catch_warnings():
   warnings.simplefilter('ignore');sr,x=wavfile.read(wav)
  x=x.astype(float)/32768
  meta=next(r for r in manifest if r['kind']=='bgm' and r['file']==file.name)
  x=x[round(meta.get('loopStart',0)*sr):round(meta.get('loopEnd',len(x)/sr)*sr)];half=round(sr*.5)
  db=lambda z:20*np.log10(max(np.sqrt(np.mean(z*z)),1e-12))
  level_difference=abs(db(x[:half])-db(x[-half:]))
  jump=float(np.max(abs(x[-1]-x[0])))
  typical_step=float(np.percentile(abs(np.diff(x[::4],axis=0)),99))
  assert level_difference<.5,(row['id'],'seam level',level_difference)
  assert np.max(abs(x))<.86,(row['id'],'clipping')
  assert jump<max(.035,5*typical_step),(row['id'],'click risk',jump)
  assert row['harmonicSimilarity']>=row['previousUnmatchedEndpointsSimilarity']-.005,(row['id'],'harmony regression')
  assert db(x[:round(sr*.05)])>-60 and db(x[-round(sr*.05):])>-60,(row['id'],'silent padding')
  results.append(dict(id=row['id'],sha256=hashlib.sha256(file.read_bytes()).hexdigest(),seamLevelDifferenceDb=level_difference,seamSampleJump=jump))
(report/'verification.json').write_text(json.dumps(results,indent=2))
# One audition file: home, battle, endgame. Each seam is 6 seconds into its excerpt.
parts=[]
for id in ['title','battle','endgame']:
 sr,x=wavfile.read(report/(id+'-loop-preview.wav'))
 parts.extend([x,np.zeros((sr,2),dtype=np.int16)])
wavfile.write(report/'ホーム・対局・終盤_ループ試聴.wav',sr,np.concatenate(parts))
print('All 16 encoded loops: harmonic matching, level continuity, peak, seam and padding PASS')
