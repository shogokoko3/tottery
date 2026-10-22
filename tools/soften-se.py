# coding: utf-8
"""Reproducible soft SE pass. Original installed SE are kept as rollback sources."""
from pathlib import Path
import json,subprocess,tempfile,shutil,wave
import numpy as np
from scipy import signal
from scipy.io import wavfile
import warnings
import sys
from soft_se_design import radiant, RADIANT_IDS

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'reports/se-soft-20261020'
OUT.mkdir(exist_ok=True); (OUT/'originals').mkdir(exist_ok=True)
manifest=json.loads((ROOT/'docs/selected-audio.json').read_text())
SR=44100
# Brief wooden/paper gestures replace the ringing reveal/reward/notification tones.
patterns={
'confirm':[(0,.75)],'error':[(0,.55),(.10,.4)],'king_select':[(0,.85),(.14,.35)],
'start':[(0,.85),(.15,.55)],'tick':[(0,.55)],'time10':[(0,.55),(.16,.4)],
'reveal':[(0,.45)],'login':[(0,.65),(.13,.45)],'mission':[(0,.6)],
'claim_all':[(0,.55),(.09,.45),(.18,.35)],'levelup':[(0,.75),(.13,.5),(.26,.35)],
'mastery':[(0,.6),(.12,.4)],'title':[(0,.8),(.18,.4)],'foil_acquire':[(0,.8),(.14,.45)],
'foil_open':[(0,.55)],'equip':[(0,.65)],'purchase':[(0,.65),(.12,.4)],'friend':[(0,.55),(.13,.45)],
'reveal_r':[(0,.5)],'reveal_sr':[(0,.65),(.14,.35)],'reveal_ssr':[(0,.9),(.16,.45),(.30,.25)],
'win':[(0,.75),(.15,.5),(.30,.35)],'lose':[(0,.45)],'draw':[(0,.5),(.15,.4)],
'puzzle_correct':[(0,.65),(.12,.4)],'puzzle_retry':[(0,.4)]}

def read(f):
 with warnings.catch_warnings():
  warnings.simplefilter('ignore')
  rate,data=wavfile.read(str(f))
 assert rate==SR
 return data.astype(float)/32768

def write(f,y):
 with wave.open(str(f),'wb') as w:
  w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((np.clip(y,-1,1)*32767).astype('<i2').tobytes())

def organic(id):
 rng=np.random.default_rng(sum((i+1)*ord(c) for i,c in enumerate(id)))
 pat=patterns[id];dur=pat[-1][0]+.34
 y=np.zeros(int(dur*SR));n=int(.31*SR);t=np.arange(n)/SR
 for i,(at,g) in enumerate(pat):
  # Damped wood body, soft felt attack and a very short paper brush. No bell or sustained oscillator.
  noise=rng.normal(0,1,n)
  body=signal.sosfilt(signal.butter(2,[140,750],fs=SR,btype='bandpass',output='sos'),noise)
  body*=np.exp(-t/0.043)*np.minimum(t/.007,1)
  paper=signal.sosfilt(signal.butter(2,[350,1700],fs=SR,btype='bandpass',output='sos'),rng.normal(0,1,n))
  paper*=np.exp(-t/.055)*np.minimum(t/.012,1)*.25
  tap=(body+paper)*g
  pos=int(at*SR);y[pos:pos+n]+=tap[:len(y)-pos]
 y*=min(.28/max(np.max(np.abs(y)),1e-9),1.8)
 return y

def soften(y):
 # Remove strong narrow ringing partials, then gently roll off sharp glass/metal transients.
 n=min(len(y),16384)
 f,p=signal.welch(y,SR,nperseg=n)
 floor=signal.medfilt(p,31)+1e-14
 peaks,_=signal.find_peaks(p/floor,height=14,distance=max(1,int(180/(SR/n))))
 candidates=sorted((k for k in peaks if 650<f[k]<7000),key=lambda k:p[k],reverse=True)[:6]
 for k in candidates:
  b,a=signal.iirnotch(float(f[k]),7,fs=SR)
  y=signal.lfilter(b,a,y)
 # Smooth spectral roll-off, with no residual whistling band above 2.4 kHz.
 freq=np.fft.rfftfreq(len(y),1/SR)
 roll=np.ones(len(freq));transition=(freq>1400)&(freq<2400)
 roll[transition]=.5+.5*np.cos(np.pi*(freq[transition]-1400)/1000)
 roll[freq>=2400]=0
 y=np.fft.irfft(np.fft.rfft(y)*roll,n=len(y))
 y*=.78
 return y,[round(float(f[k])) for k in candidates]

only_radiant = "--radiant-only" in sys.argv
report=json.loads((OUT/"analysis.json").read_text()) if only_radiant else []
preview=[]
with tempfile.TemporaryDirectory(prefix='tottery-soft-se-') as temp:
 tmp=Path(temp)
 for x in manifest:
  if x['kind']!='se' or (only_radiant and x['id'] not in RADIANT_IDS):continue
  file=ROOT/'assets/audio'/x['file'];original=OUT/'originals'/x['file']
  if not original.exists():shutil.copy2(file,original)
  wav=tmp/'in.wav'
  subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100','-c','1',str(original),str(wav)],check=True,capture_output=True)
  before=read(wav)
  if x['id'] in RADIANT_IDS:after=radiant(x['id'],SR);notches=[];method='warm diffuse harmonic bloom'
  elif x['id'] in patterns:after=organic(x['id']);notches=[];method='wood-paper replacement'
  else:after,notches=soften(before);method='ringing suppression and soft lowpass'
  # Never raise gain after removing high frequencies; control the final peak separately.
  peak=np.max(np.abs(after));after*=min(1,.5/max(peak,1e-9))
  fade=min(300,len(after)//2);after[:fade]*=np.linspace(0,1,fade);after[-fade:]*=np.linspace(1,0,fade)
  dst=tmp/'out.wav';write(dst,after)
  subprocess.run(['afconvert','-f','m4af','-d','aac','-b','64000',str(dst),str(file)],check=True,capture_output=True)
  def energy_high(z):
   freqs,power=signal.welch(z,SR,nperseg=min(len(z),8192));return float(np.sum(power[freqs>=3000])/max(np.sum(power),1e-20))
  report=[r for r in report if r['id'] != x['id']]
  report.append({'id':x['id'],'method':method,'notchHz':notches,'beforeHighRatio':energy_high(before),'afterHighRatio':energy_high(after),'duration':len(after)/SR})
  x['bytes']=file.stat().st_size;x['duration']=len(after)/SR;x['softened']=True;x['rms']=float(20*np.log10(max(np.sqrt(np.mean(after**2)),1e-12)))
  if x['id'] in (['reveal_r','reveal_sr','reveal_ssr','forge','win'] if only_radiant else ['confirm','capture','levelup','reveal_ssr','ice','win']):
   preview.extend([after,np.zeros(int(SR*.45))])
  print(x['id'],method,flush=True)
 write(OUT/('光に包まれる_SE試聴.wav' if only_radiant else '見直し後_SE試聴.wav'),np.concatenate(preview))
(OUT/'analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
(ROOT/'docs/selected-audio.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('Prepared soft SE:', sum(r['method']=='warm diffuse harmonic bloom' for r in report), 'warm blooms;', len(report), 'total records')
