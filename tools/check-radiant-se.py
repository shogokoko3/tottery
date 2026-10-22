"""Validate the encoded app assets, not just generator output."""
import json, subprocess, tempfile, warnings, wave
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile
root=Path(__file__).resolve().parent.parent
results=[]
preview=[]
with tempfile.TemporaryDirectory() as temp:
 for id in ['reveal_r','reveal_sr','reveal_ssr','forge','win']:
  wav=Path(temp)/(id+'.wav')
  subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100','-c','1',str(root/'assets/audio'/('se-'+id+'.m4a')),str(wav)],check=True,capture_output=True)
  with warnings.catch_warnings():
   warnings.simplefilter('ignore');sr,data=wavfile.read(wav)
  y=data.astype(float)/32768
  f,p=signal.welch(y,sr,nperseg=min(8192,len(y)))
  high=float(p[f>=3000].sum()/p.sum())
  peak=float(abs(y).max())
  assert high<.001,(id,'sharp treble energy',high)
  assert peak<.35,(id,'peak',peak)
  preview.extend([y,np.zeros(round(sr*.45))])
  results.append(dict(id=id,duration=len(y)/sr,peak=peak,above3kHzEnergyRatio=high))
assert results[0]['duration']<results[1]['duration']<results[2]['duration']
(root/'reports/radiant-audio-20261020/encoded-audio-check.json').write_text(json.dumps(results,indent=2))
with wave.open(str(root/'reports/radiant-audio-20261020/優しい光のSE試聴.wav'),'wb') as w:
 w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100)
 w.writeframes((np.concatenate(preview)*32767).astype('<i2').tobytes())
print('Encoded R/SR/SSR, forge, win: peak/treble bounds and distinct rarity durations PASS')
