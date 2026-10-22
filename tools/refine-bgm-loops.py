"""Choose compatible, beat-aligned loop regions from preserved source music."""
from pathlib import Path
import json, re, subprocess, tempfile, warnings, hashlib
import numpy as np
from scipy import signal
from scipy.io import wavfile
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'reports/bgm-loops-20261021'; OUT.mkdir(exist_ok=True)
BACKUP=OUT/'originals';BACKUP.mkdir(exist_ok=True)
SR=44100;FS=11025;HOP=256
mapping={'home':'title','result_win':'resultWin','result_lose':'resultLose','result_draw':'resultDraw'}
manifest=json.loads((ROOT/'docs/selected-audio.json').read_text())
catalog=json.loads((ROOT.parent/'音楽・効果音候補集/catalog.json').read_text())['bgm']

def decode(path,wav):
 subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100','-c','2',str(path),str(wav)],check=True,capture_output=True)
 with warnings.catch_warnings():
  warnings.simplefilter('ignore');sr,x=wavfile.read(wav)
 assert sr==SR
 return x.astype(np.float64)/32768

def write(path,x):wavfile.write(path,SR,(np.clip(x,-1,1)*32767).astype(np.int16))
def features(x):
 mono=signal.resample_poly(x.mean(axis=1),1,4)
 f,t,z=signal.stft(mono,FS,nperseg=2048,noverlap=2048-HOP,boundary=None)
 power=np.abs(z)**2
 good=(f>70)&(f<2400)
 midi=np.rint(69+12*np.log2(np.maximum(f,1)/440)).astype(int)%12
 chroma=np.array([power[good&(midi==c)].sum(axis=0) for c in range(12)])
 chroma=np.sqrt(chroma);chroma/=np.maximum(np.linalg.norm(chroma,axis=0),1e-12)
 bands=np.array([power[(f>=a)&(f<b)].sum(axis=0) for a,b in [(40,160),(160,400),(400,900),(900,2400),(2400,5000)]])
 bands=np.sqrt(bands);bands/=np.maximum(np.linalg.norm(bands,axis=0),1e-12)
 loud=10*np.log10(np.maximum(power.sum(axis=0),1e-12))
 flux=np.maximum(np.diff(np.log1p(np.abs(z)*80),axis=1),0).sum(axis=0)
 flux=np.r_[0,flux];flux=np.maximum(0,flux-signal.medfilt(flux,43))
 return t,chroma,bands,loud,flux

def choose(x,hint):
 t,c,b,l,on=features(x);dt=HOP/FS;dur=len(x)/SR
 ac=signal.fftconvolve(on,on[::-1],mode='full')[len(on)-1:]
 bpms=np.arange(max(60,hint*.85) if hint else 65,min(165,hint*1.15) if hint else 155,.1)
 scores=np.array([np.interp(60/v/dt,np.arange(len(ac)),ac) for v in bpms])
 if hint:scores*=np.exp(-.5*((bpms-hint)/(hint*.07))**2)
 bpm=float(bpms[np.argmax(scores)]);beat=60/bpm
 phases=np.arange(0,beat,dt/2)
 onset=np.minimum(on,np.percentile(on,97))
 sums=[np.interp(np.arange(p,dur,beat),t,onset).sum() for p in phases]
 phase=float(phases[np.argmax(sums)])
 grid=np.arange(phase,dur,beat)
 # Compare a full bar's harmonic/spectral trajectory, not just a zero crossing.
 overlap=4*beat
 offsets=np.linspace(0,overlap,24,endpoint=False)
 def region(at,mat):return np.array([np.interp(at+offsets,t,row) for row in mat])
 def compare(start,end):
  a=region(start,c);d=region(end-overlap,c)
  harmony=float(np.mean(np.sum(a*d,axis=0)))
  color=float(np.mean(np.sum(region(start,b)*region(end-overlap,b),axis=0)))
  loud=float(np.mean(abs(np.interp(start+offsets,t,l)-np.interp(end-overlap+offsets,t,l))))
  # Dense beat peaks should coincide across the blend.
  oa=np.interp(start+offsets,t,on);ob=np.interp(end-overlap+offsets,t,on)
  rhythm=float(np.dot(oa,ob)/max(np.linalg.norm(oa)*np.linalg.norm(ob),1e-12))
  return harmony,color,loud,rhythm
 old=compare(0,dur)
 best=None
 fallback=None
 for i,start in enumerate(grid):
  if start<.3 or start>min(28,dur*.22):continue
  for j in range(i+8,len(grid)):
   end=grid[j]
   if (j-i)%4 or end<dur*.76 or end>dur-.25 or end-start-overlap<dur*.70:continue
   # Avoid both a quiet intro and the source's final fade-out.
   levels=np.interp(np.r_[start+offsets,end-overlap+offsets],t,l)
   if np.mean(levels)<np.percentile(l,60)-6:continue
   h,col,ld,r=compare(start,end)
   retained=(end-start-overlap)/dur
   score=5*h+.35*col+.12*r-.02*ld+.4*retained
   candidate=(score,start,end,h,col,ld,r)
   if fallback is None or score>fallback[0]:fallback=candidate
   if h < min(.94, old[0]):continue
   if best is None or score>best[0]:best=(score,start,end,h,col,ld,r)
 alignment='beat-grid'
 if best is None:
  # Quiet introductions and free-tempo music may not fit a single global grid.
  # Preserve their harmony instead of forcing a mismatched bar cut.
  alignment='harmonic-priority'
  for start in np.arange(0,min(8*beat,dur*.12),beat/4):
   for end in np.arange(dur-8*beat,dur+.001,beat/4):
    if end-start-overlap<dur*.70:continue
    h,col,ld,r=compare(start,end)
    if h<old[0]-.005:continue
    retained=(end-start-overlap)/dur
    bars=(end-start-overlap)/(4*beat)
    beat_error=abs(bars-round(bars))
    score=5*h+.35*col+.12*r-.025*ld+.4*retained-.15*beat_error
    if best is None or score>best[0]:best=(score,start,end,h,col,ld,r)
 if best is None:best=fallback
 if best is None:raise RuntimeError('No viable loop region')
 score,start,end,h,col,ld,r=best
 # Original fixed overlap used the beginning against the final tail.
 old=compare(0,dur)
 return start,end,overlap,dict(alignment=alignment,estimatedBpm=round(bpm,2),beatSeconds=beat,sourceStartSeconds=start,sourceEndSeconds=end,overlapSeconds=overlap,harmonicSimilarity=h,previousUnmatchedEndpointsSimilarity=old[0],spectralSimilarity=col,overlapLevelDifferenceDb=ld,rhythmSimilarity=r)

results=[]
with tempfile.TemporaryDirectory() as temp:
 tmp=Path(temp)
 for item in catalog:
  id=mapping.get(item['id'],item['id'])
  row=next((r for r in manifest if r['kind']=='bgm' and r['id']==id),None)
  if not row:continue
  target=ROOT/'assets/audio'/row['file'];backup=BACKUP/row['file']
  if not backup.exists():backup.write_bytes(target.read_bytes())
  x=decode(ROOT.parent/'音楽・効果音候補集'/item['file'],tmp/'source.wav')
  # Discard only genuinely silent decoder padding at the edges.
  rms=np.sqrt(np.mean(x*x,axis=1));active=np.flatnonzero(rms>10**(-48/20))
  if len(active):x=x[max(0,active[0]-2048):min(len(x),active[-1]+2048)]
  match=re.search(r'(\d+)\s*BPM',item.get('description',''),re.I)
  start,end,overlap,record=choose(x,float(match[1]) if match else None)
  a,z,n=round(start*SR),round(end*SR),round(overlap*SR)
  segment=x[a:z];out=segment[n:].copy()
  # Equal-power crossfade spans an integer bar, keeping the beat grid intact.
  u=np.linspace(0,1,n)[:,None]
  out[-n:]=segment[-n:]*np.cos(u*np.pi/2)+segment[:n]*np.sin(u*np.pi/2)
  # Gentle local level matching prevents a fade-out becoming a loop dip.
  half=round(.5*SR);ramp=round(2.5*SR)
  head=np.sqrt(np.mean(out[:half]**2));tail=np.sqrt(np.mean(out[-half:]**2))
  target_level=np.sqrt(max(head*tail,1e-14))
  first_gain=np.clip(target_level/max(head,1e-9),.63,1.58)
  last_gain=np.clip(target_level/max(tail,1e-9),.63,1.58)
  ease=.5+.5*np.cos(np.linspace(0,np.pi,ramp-half))
  head_env=np.r_[np.full(half,first_gain),1+(first_gain-1)*ease]
  tail_env=np.r_[1+(last_gain-1)*ease[::-1],np.full(half,last_gain)]
  out[:ramp]*=head_env[:,None];out[-ramp:]*=tail_env[:,None]
  rms=np.sqrt(np.mean(out*out));peak=np.max(abs(out))
  gain=min(10**(-23/20)/max(rms,1e-12),10**(-2/20)/max(peak,1e-12));out*=gain
  write(tmp/'loop.wav',out)
  subprocess.run(['afconvert','-f','m4af','-d','aac','-b','96000',str(tmp/'loop.wav'),str(target)],check=True,capture_output=True)
  # Check the actual encoded samples too: AAC padding/seams matter in the app.
  encoded=decode(target,tmp/'encoded.wav')
  span=round(6*SR);preview=np.concatenate([encoded[-span:],encoded[:span]])
  write(OUT/(id+'-loop-preview.wav'),preview)
  half=round(.5*SR)
  level=lambda v:20*np.log10(max(np.sqrt(np.mean(v*v)),1e-12))
  record.update(id=id,name=row['name'],durationSeconds=len(encoded)/SR,
   seamLevelDifferenceDb=abs(level(encoded[-half:])-level(encoded[:half])),
   seamSampleJump=float(np.max(abs(encoded[-1]-encoded[0]))),peak=float(np.max(abs(encoded))),
   sourceSha256=hashlib.sha256((ROOT.parent/'音楽・効果音候補集'/item['file']).read_bytes()).hexdigest())
  row.update(duration=len(encoded)/SR,bytes=target.stat().st_size,rms=level(encoded),loopRefined=True,
   loopSourceStart=round(start,3),loopSourceEnd=round(end,3),loopCrossfade=round(overlap,3))
  results.append(record)
  (OUT/'analysis.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
  print(id,round(record['durationSeconds'],1),'seconds; harmony',round(record['harmonicSimilarity'],3),'old',round(record['previousUnmatchedEndpointsSimilarity'],3),flush=True)
 assert len(results)==16
 (ROOT/'docs/selected-audio.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))

# Keep playback loop ranges in sync when this tool is run independently.
subprocess.run(["python3",str(ROOT/"tools/prepare-adaptive-music.py")],cwd=ROOT,check=True)
