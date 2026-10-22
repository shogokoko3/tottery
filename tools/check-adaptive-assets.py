from pathlib import Path
import json,subprocess,tempfile,warnings
import numpy as np
from scipy.io import wavfile
from scipy import signal
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'reports/adaptive-music-20261022'
layouts=json.loads((OUT/'layouts.json').read_text());palettes=json.loads((OUT/'tonal-assets.json').read_text())
def read(file,wav,channels):
 subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100','-c',str(channels),str(file),str(wav)],check=True,capture_output=True)
 with warnings.catch_warnings():warnings.simplefilter('ignore');sr,x=wavfile.read(wav)
 return x.astype(float)/32768
checks=[];maxHigh=0;audio={};tones={}
with tempfile.TemporaryDirectory() as temp:
 wav=Path(temp)/'read.wav'
 for id,layout in layouts.items():
  x=read(ROOT/'assets/audio'/(id+'.m4a'),wav,2);start=round(layout['loopStart']*44100)
  assert abs(len(x)/44100-layout['duration'])<.001
  body=x[start:round(layout["loopEnd"]*44100)];half=22050
  db=lambda a:20*np.log10(max(np.sqrt(np.mean(a*a)),1e-12))
  level=abs(db(body[:half])-db(body[-half:]));jump=float(max(abs(body[-1]-body[0])))
  assert level<1.5,(id,'level step',level)
  assert jump<.045,(id,'loop click',jump)
  assert max(abs(x[start]-x[start-1]))<.045,(id,'intro click')
  assert np.max(abs(x))<.86
  for h in layout['harmony']:assert 0<=h['root']<12 and h['mode'] in ['major','minor','open']
  checks.append({'id':id,'loopLevelDifferenceDb':level,'loopSampleJump':jump})
  if id in ['title','battle','endgame','summon']:audio[id]=x
 for entry in palettes:
  y=read(ROOT/'assets/audio'/entry['file'],wav,1)
  f,p=signal.welch(y,44100,nperseg=8192)
  high=float(p[f>=3000].sum()/p.sum());maxHigh=max(high,maxHigh)
  assert high<.001,(entry['file'],'sharp treble')
  assert max(abs(y))<.35,(entry['file'],'peak')
  tones[entry['file']]=y
 (OUT/'verification.json').write_text(json.dumps({'music':checks,'tonalAssets':len(tones),'maximumAbove3kHzEnergyRatio':maxHigh},indent=2))
 def save(name,x):wavfile.write(OUT/name,44100,(np.clip(x,-1,1)*32767).astype(np.int16))
 title=audio['title'];start=round(layouts['title']['loopStart']*44100)
 save('ホーム_導入から本体.wav',title[:start+6*44100])
 save('ホーム_本体だけの折り返し.wav',np.concatenate([title[round(layouts['title']['loopEnd']*44100)-6*44100:round(layouts['title']['loopEnd']*44100)],title[start:start+6*44100]]))
 # Offline render using the same boundary selection and fade times as the player.
 b=layouts['battle'];decision=b['loopStart']+12
 opts=[]
 for cue in b['endgameExits']:
  delay=cue['at']-decision
  if .1<=delay<=2.8:opts.append((cue['fit']-.13*delay,delay))
 delay=max(opts)[1];when=4+delay;fade=min(1.2,max(.65,b['beatSeconds']))
 duration=when+8;out=np.zeros((round(duration*44100),2));n=round(when*44100)
 outgoing=audio['battle'][round((decision-4)*44100):round((decision-4+duration)*44100)]
 out[:len(outgoing)]=outgoing*.6
 ramp=np.minimum(1,np.maximum(0,(np.arange(len(out))/44100-when)/fade))
 out*=1-ramp[:,None]
 incoming=audio['endgame'][:len(out)-n]*.65
 out[n:n+len(incoming)]+=incoming*ramp[n:n+len(incoming),None]
 save('通常対局から終盤_接続.wav',out)
 x=audio['summon'][10*44100:19*44100].copy()*.65;layout=layouts['summon']
 for at,family in [(1,1),(3,2),(5.5,3)]:
  h=layout['harmony'][0]
  for q in layout['harmony']:
   if q['at']<=10+at:h=q
  y=tones[f"se-bloom-{family}-{h['root']}-{h['mode']}.m4a"]
  y=signal.sosfilt(signal.butter(2,3200,fs=44100,output='sos'),y)
  pos=round(at*44100);length=min(len(y),len(x)-pos)
  x[pos:pos+length]*=.35 if family==3 else .6
  x[pos:pos+length]+=y[:length,None]*.7
 save('召喚BGMと報酬SE_音程合わせ.wav',x)
print('16 intro/loop assets + 108 soft harmonic variants PASS; previews rendered')
