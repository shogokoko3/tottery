# coding: utf-8
"""Author a short, harmony-matched return for the selected soft home master."""
from pathlib import Path
import hashlib,json,shutil,subprocess,tempfile,warnings
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'reports/home-bgm-loop-20261023'
OUT.mkdir(exist_ok=True)
SOURCE=ROOT/'assets/audio/masters/home-soft-approved-20261023.m4a'
SOURCE_SHA='b29f7ff460df47c7cb5f88381866c9ab38910708877e3715956128cf188cdbc7'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SOURCE_SHA
SR=44100
def read(path,wav):
 subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100','-c','2',str(path),str(wav)],check=True,capture_output=True)
 with warnings.catch_warnings():
  warnings.simplefilter('ignore');sr,pcm=wavfile.read(wav)
 assert sr==SR
 return pcm.astype(float)/32768
def write(path,x):wavfile.write(path,SR,np.clip(np.rint(x*32768),-32768,32767).astype(np.int16))
def db(x):return float(20*np.log10(max(np.sqrt(np.mean(x*x)),1e-12)))
def chroma(x):
 mono=signal.resample_poly(x.mean(axis=1),1,4)
 f,t,z=signal.stft(mono,SR/4,nperseg=4096,noverlap=3840,boundary=None)
 p=abs(z)**2;good=(f>65)&(f<1800)
 pc=np.rint(69+12*np.log2(np.maximum(f,1)/440)).astype(int)%12
 c=np.sqrt(np.array([p[good&(pc==k)].sum(axis=0) for k in range(12)]))
 c/=np.maximum(np.linalg.norm(c,axis=0),1e-12)
 return t,c

for name in ['assets/audio/title.m4a','docs/audio-source-overrides.json','docs/selected-audio.json','src/audio/music-layouts.js']:
 backup=OUT/'before'/name
 if not backup.exists():
  backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,backup)
snapshot=OUT/'audio-before.json'
if not snapshot.exists():snapshot.write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'assets/audio').glob('*.m4a')},indent=2)+'\n')

with tempfile.TemporaryDirectory() as temp:
 tmp=Path(temp);x=read(SOURCE,tmp/'source.wav')
 # The recorded performance is about 78.3 BPM. These two returns share
 # G-minor harmony and are 120 recorded beats apart, within 40 ms.
 # Preserve the introduction and the complete softened 32-second passage.
 start=round(3.92*SR)
 end=round((3.92+120*60/78.3-.04)*SR)
 width=round(.55*SR)
 t,c=chroma(x)
 offsets=np.linspace(-.65,-.04,32)
 a=np.array([np.interp(start/SR+offsets,t,v) for v in c])
 b=np.array([np.interp(end/SR+offsets,t,v) for v in c])
 harmonic_similarity=float(np.mean(np.sum(a*b,axis=0)))
 assert harmonic_similarity>.90,('return harmony',harmonic_similarity)
 joined=x[:end].copy()
 weight=(.5-.5*np.cos(np.linspace(0,np.pi,width)))[:,None]
 # A complementary 550 ms edit replaces the decaying tail with the actual
 # phrase preceding the return. No new instruments, pitches or long overlay.
 joined[-width:]=x[end-width:end]*(1-weight)+x[start-width:start]*weight
 assert np.array_equal(joined[:end-width],x[:end-width])
 # Place both repeat points inside identical continuous audio, away from AAC
 # file edges; codec look-ahead and the source's ending silence are excluded.
 guard=round(.6*SR);shift=round(.2*SR)
 joined=np.concatenate([joined,x[start:start+guard]])
 loop_start=(start+shift)/SR;loop_end=(end+shift)/SR
 assert np.max(abs(joined))<=1
 # Give the AAC encoder 3 dB of headroom; the runtime gain compensates this
 # constant level change without altering dynamics or the selected timbre.
 encoding_gain=10**(-3/20)
 wav=OUT/'home-soft-loop-master.wav';write(wav,joined*encoding_gain)
 master=ROOT/'assets/audio/masters/home-soft-loop-20261023.m4a'
 subprocess.run(['afconvert','-f','m4af','-d','aac','-b','256000',str(wav),str(master)],check=True,capture_output=True)
 y=read(master,tmp/'encoded.wav');aa=round(loop_start*SR);bb=round(loop_end*SR)
 gain=min(1.,10**(-23/20)/np.sqrt(np.mean(y*y)))
 # The real join must behave like the same uninterrupted source phrase.
 context=round(.15*SR)
 reference=y[aa-context:aa+context];return_context=y[bb-context:bb+context]
 relative_error=float(np.sqrt(np.mean((return_context-reference)**2))/np.sqrt(np.mean(reference**2)))
 jump=float(np.max(abs(y[bb-1]-y[aa])))*gain
 original_step=float(np.max(abs(y[aa-1]-y[aa])))*gain
 level_difference=abs(db(y[bb-round(.5*SR):bb])-db(y[aa:aa+round(.5*SR)]))
 assert relative_error<.08,('encoded repeated phrase',relative_error)
 assert jump<.015 and jump<original_step+.01,('loop click',jump)
 assert level_difference<1.5,('repeat level',level_difference)
 assert abs((loop_end-loop_start)/(60/78.3)-120)<.06
 assert np.max(abs(y))*gain<.86
 # A complete first pass plus two repeats, rendered at game reference level.
 cycle=y[aa:bb]
 audition=np.concatenate([y[:bb],cycle,cycle])*gain
 write(OUT/'home-soft-loop-full.wav',audition)
 subprocess.run(['afconvert','-f','m4af','-d','aac','-b','192000',str(OUT/'home-soft-loop-full.wav'),str(OUT/'home-soft-loop-full.m4a')],check=True,capture_output=True)
 seam=np.concatenate([y[bb-8*SR:bb],y[aa:aa+10*SR]])*gain
 write(OUT/'home-soft-loop-seam.wav',seam)
 subprocess.run(['afconvert','-f','m4af','-d','aac','-b','192000',str(OUT/'home-soft-loop-seam.wav'),str(OUT/'home-soft-loop-seam.m4a')],check=True,capture_output=True)
 result=dict(source=str(SOURCE.relative_to(ROOT)),sourceSha256=SOURCE_SHA,master=str(master.relative_to(ROOT)),masterSha256=hashlib.sha256(master.read_bytes()).hexdigest(),
             editStart=(end-width)/SR,editEnd=end/SR,sourceReturn=start/SR,crossfadeSeconds=width/SR,loopStart=loop_start,loopEnd=loop_end,duration=len(y)/SR,
             loopSeconds=loop_end-loop_start,recordedBpm=78.3,encodingGain=encoding_gain,harmonicSimilarity=harmonic_similarity,returnContextRelativeError=relative_error,
             loopSampleJump=jump,referenceSampleStep=original_step,seamLevelDifferenceDb=level_difference,normalizationGain=gain,
             unchangedBeforeTail=True,focus32SecondsPcmUnchanged=np.array_equal(joined[29*SR:36*SR],x[29*SR:36*SR]),auditionSeconds=len(audition)/SR,runwayCreditsUsed=0)
 assert result['focus32SecondsPcmUnchanged']
 (OUT/'edit-verification.json').write_text(json.dumps(result,indent=2)+'\n')
 choice=dict(revision='approved-home-soft-loop-20261023',source=result['master'],approvedFrom='reports/home-bgm-32s-20261023/02_soft_full.m4a',
             sha256=result['masterSha256'],playbackMode='authored-intro-loop',bpm=78.3,beatsPerBar=4,loopStart=loop_start,loopEnd=loop_end,
             loopCrossfade=result['crossfadeSeconds'],reportDirectory=str(OUT.relative_to(ROOT)),editVerification=str((OUT/'edit-verification.json').relative_to(ROOT)),
             reason='採用した②を維持し、最後の550msを同じ和音の戻り前フレーズへ接続。導入は初回だけ再生し、AAC境界外の約92秒を繰り返す。')
 overrides=json.loads((ROOT/'docs/audio-source-overrides.json').read_text());overrides['title']=choice
 (ROOT/'docs/audio-source-overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(result,indent=2))
