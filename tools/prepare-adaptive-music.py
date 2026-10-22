"""One-pass intro + authored loop range, harmony and transition metadata."""
from pathlib import Path
import json, subprocess, tempfile, warnings, shutil
import numpy as np
from scipy import signal
from scipy.io import wavfile
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'reports/adaptive-music-20261022';OUT.mkdir(exist_ok=True)
(OUT/'originals').mkdir(exist_ok=True)
SR=44100
old=json.loads((ROOT/'reports/bgm-loops-20261021/analysis.json').read_text())
manifest=json.loads((ROOT/'docs/selected-audio.json').read_text())
catalog=json.loads((ROOT.parent/'音楽・効果音候補集/catalog.json').read_text())['bgm']
alias={'home':'title','result_win':'resultWin','result_lose':'resultLose','result_draw':'resultDraw'}
def decode(file,wav):
 subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100','-c','2',str(file),str(wav)],check=True,capture_output=True)
 with warnings.catch_warnings():warnings.simplefilter('ignore');rate,x=wavfile.read(wav)
 assert rate==SR
 return x.astype(float)/32768

def chroma(x):
 mono=signal.resample_poly(x.mean(axis=1),1,4)
 f,t,z=signal.stft(mono,SR/4,nperseg=4096,noverlap=4096-512,boundary=None)
 p=abs(z)**2;good=(f>65)&(f<1500)
 midi=np.rint(69+12*np.log2(np.maximum(f,1)/440)).astype(int)%12
 c=np.array([p[good&(midi==k)].sum(axis=0) for k in range(12)])
 c=np.sqrt(c);c/=np.maximum(np.linalg.norm(c,axis=0),1e-12)
 return t,c

def harmony_at(t,c,at):
 v=c[:,(t>=max(0,at-.4))&(t<at+1.2)].mean(axis=1)
 best=None
 for root in range(12):
  for mode,third in [('major',4),('minor',3)]:
   notes=[root,(root+third)%12,(root+7)%12]
   score=v[notes].sum()+.12*v[root]
   if best is None or score>best[0]:best=(score,root,mode,notes)
 _,root,mode,notes=best
 fit=float(v[notes].sum()/max(v.sum(),1e-9))
 if fit<.43:root=int(np.argmax(v));mode='open'
 return {'at':round(float(at),4),'root':root,'mode':mode,'fit':round(fit,3)}

layouts={};details=[];decoded={}
with tempfile.TemporaryDirectory() as temp:
 tmp=Path(temp)
 for item in catalog:
  id=alias.get(item['id'],item['id']);r=next((v for v in old if v['id']==id),None)
  if not r:continue
  file=ROOT/'assets/audio'/(id+'.m4a');backup=OUT/'originals'/file.name
  if not backup.exists():shutil.copy2(file,backup)
  source=decode(ROOT.parent/'音楽・効果音候補集'/item['file'],tmp/'in.wav')
  active=np.flatnonzero(np.sqrt(np.mean(source**2,axis=1))>10**(-48/20))
  source=source[max(0,active[0]-2048):min(len(source),active[-1]+2048)]
  a,z,n=[round(r[k]*SR) for k in ['sourceStartSeconds','sourceEndSeconds','overlapSeconds']]
  segment=source[a:z];body=segment[n:].copy();u=np.linspace(0,1,n)[:,None]
  body[-n:]=segment[-n:]*np.cos(u*np.pi/2)+segment[:n]*np.sin(u*np.pi/2)
  half=round(.5*SR);ramp=round(2.5*SR)
  head=np.sqrt(np.mean(body[:half]**2));tail=np.sqrt(np.mean(body[-half:]**2));target=np.sqrt(head*tail)
  hg=np.clip(target/head,.63,1.58);tg=np.clip(target/tail,.63,1.58)
  ease=.5+.5*np.cos(np.linspace(0,np.pi,ramp-half))
  body[:ramp]*=np.r_[np.full(half,hg),1+(hg-1)*ease][:,None]
  body[-ramp:]*=np.r_[1+(tg-1)*ease[::-1],np.full(half,tg)][:,None]
  gain=min(10**(-23/20)/np.sqrt(np.mean(body**2)),10**(-2/20)/np.max(abs(body)));body*=gain
  # Use the actual preceding phrase as the introduction, ending at loop entry.
  entry=a+n;introN=min(entry,round(8*r['beatSeconds']*SR))
  intro=source[entry-introN:entry].copy()
  introGain=min(10**(-23/20)/max(np.sqrt(np.mean(intro**2)),1e-9),1.58*gain)
  intro*=introGain
  # Match the boundary's gain to the body without truncating a note.
  blend=min(len(intro),round(.6*SR));weight=np.linspace(0,1,blend)
  intro[-blend:]*=(1+(gain*hg/introGain-1)*weight)[:,None]
  intro[:min(2205,len(intro))]*=np.linspace(0,1,min(2205,len(intro)))[:,None]
  # Repair only the final 5 ms at each join; preserve notes and avoid a click.
  for samples in [intro,body]:
   width=min(220,len(samples));u=np.linspace(0,1,width)[:,None]
   samples[-width:]+=(body[0]-samples[-1])*(-2*u**3+3*u**2)
  # Put the repeat boundary inside continuous audio, away from AAC file edges.
  # The first 150 ms of the body belongs to the one-time prefix; repeat ends at
  # the corresponding point in a 350 ms look-ahead copy of the loop head.
  guard=round(.35*SR);shift=round(.15*SR)
  loopStart=(introN+shift)/SR;loopEnd=(introN+len(body)+shift)/SR
  joined=np.concatenate([intro,body,body[:guard]])
  # Level-match at the actual repeat window, with unity gain at the exact
  # boundary so the waveform remains continuous through AAC look-ahead.
  first=round(loopStart*SR);last=round(loopEnd*SR)
  head=np.sqrt(np.mean(joined[first:first+half]**2));tail=np.sqrt(np.mean(joined[last-half:last]**2))
  target=np.sqrt(head*tail)
  hg=np.clip(target/max(head,1e-9),.5,2);tg=np.clip(target/max(tail,1e-9),.5,2)
  hen=np.r_[np.full(half,hg),1+(hg-1)*ease]
  ten=np.r_[1+(tg-1)*ease[::-1],np.full(half,tg)]
  edge=round(.02*SR);w=.5-.5*np.cos(np.linspace(0,np.pi,edge))
  hen[:edge]=1+(hg-1)*w;ten[-edge:]=1+(tg-1)*w[::-1]
  joined[first:first+ramp]*=hen[:,None];joined[last-ramp:last]*=ten[:,None]
  peak=np.max(abs(joined))
  if peak>.79:joined*=.79/peak
  wavfile.write(tmp/'out.wav',SR,(joined*32767).astype(np.int16))
  subprocess.run(['afconvert','-f','m4af','-d','aac','-b','96000',str(tmp/'out.wav'),str(file)],check=True,capture_output=True)
  x=decode(file,tmp/'decoded.wav');start=loopStart;end=loopEnd
  t,c=chroma(x)
  step=max(.8,2*r['beatSeconds'])
  harmony=[harmony_at(t,c,at) for at in np.arange(0,end-1,step)]
  beat=r['beatSeconds'];cues=[round(float(v),4) for v in np.arange((introN/SR)%beat,end,beat)]
  layout={'loopStart':round(start,6),'loopEnd':round(end,6),'duration':round(len(x)/SR,6),'beatSeconds':round(beat,6),'transitionCues':cues,'harmony':harmony}
  layouts[id]=layout;decoded[id]=(x,t,c)
  row=next(v for v in manifest if v['kind']=='bgm' and v['file']==file.name)
  row.update(duration=len(x)/SR,bytes=file.stat().st_size,introDuration=start,loopStart=start,loopEnd=end)
  details.append({'id':id,'introSeconds':start,'loopSeconds':end-start,'introJoinJump':float(np.max(abs(x[introN]-x[introN-1]))),'loopJoinJump':float(np.max(abs(x[round(end*SR)-1]-x[round(start*SR)]))),'peak':float(np.max(abs(x)))})
  wavfile.write(OUT/(id+'-intro-preview.wav'),SR,(x[:round((start+6)*SR)]*32767).astype(np.int16))
  print(id,'intro',round(start,2),'loop',round(end-start,2),flush=True)
 # Mark authored outgoing beats whose harmony is closest to the endgame opening.
 tx,tt,tc=decoded['endgame'];dest=tc[:,tt<1.5].mean(axis=1);dest/=np.linalg.norm(dest)
 bx,bt,bc=decoded['battle'];exits=[]
 for at in layouts['battle']['transitionCues']:
  v=bc[:,(bt>at-.3)&(bt<at+.7)].mean(axis=1);v/=max(np.linalg.norm(v),1e-9)
  exits.append({'at':at,'fit':round(float(np.dot(v,dest)),3)})
 layouts['battle']['endgameExits']=exits
 (ROOT/'src/audio/music-layouts.js').write_text('// Generated by tools/prepare-adaptive-music.py. Times refer to decoded app assets.\nexport const MUSIC_LAYOUTS = '+json.dumps(layouts,separators=(',',':'))+';\n')
 (ROOT/'docs/selected-audio.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 (OUT/'layouts.json').write_text(json.dumps(layouts,indent=2))
 (OUT/'asset-check.json').write_text(json.dumps(details,indent=2))
