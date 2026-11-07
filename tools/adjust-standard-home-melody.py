# coding: utf-8
"""Restate approved motifs at the two passages identified on 2026-10-28.

Keeps the chosen recording, its softened 32-second passage and the authored
loop return. No synthesis, pitch shift, tempo change or music generation.
"""
from pathlib import Path
import hashlib, json, shutil, subprocess, tempfile, warnings
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT/'reports/home-default-melody-20261028'
OLD_MASTER = ROOT/'assets/audio/masters/home-soft-loop-20261023.m4a'
OLD_SHA = '52b83ca12190fbbd87e5906490bfa08eaa80e756a6206ba8a526bf04de685f95'
PCM_SOURCE = ROOT/'reports/home-bgm-loop-20261023/home-soft-loop-master.wav'
MASTER = ROOT/'assets/audio/masters/home-soft-melody-loop-20261028.m4a'
SR = 44100
LOOP_START = 4.12
LOOP_END = 96.03401360544218

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def db(samples): return float(20*np.log10(max(np.sqrt(np.mean(samples*samples)),1e-12)))
def write(path,samples):
    pcm=np.clip(np.rint(samples*32768),-32768,32767).astype(np.int16)
    wavfile.write(path,SR,pcm)
def encode(source,target):
    subprocess.run(['afconvert','-f','m4af','-d','aac','-b','256000',str(source),str(target)],check=True,capture_output=True)
def read(path):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        sr,pcm=wavfile.read(path)
    assert sr==SR and pcm.shape[1]==2
    return pcm.astype(float)/32768

assert sha(OLD_MASTER)==OLD_SHA, 'Preserve the previously selected master'
OUT.mkdir(exist_ok=True)
for name in ['assets/audio/homeDefault.m4a','docs/audio-source-overrides.json',
             'docs/selected-audio.json','src/audio/music-layouts.js',
             'reports/adaptive-music-20261022/layouts.json']:
    target=OUT/'before'/name
    if not target.exists():
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(ROOT/name,target)

x=read(PCM_SOURCE)
edited=x.copy()
plan=json.loads((OUT/'edge-candidates.json').read_text())
edits=[]
fade_seconds=.18
width=round(fade_seconds*SR)
for target in plan:
    picked=target['candidates'][0]
    a,b,donor=[round(picked[k]*SR) for k in ['start','end','donor']]
    n=b-a
    phrase=x[donor:donor+n].copy()
    # Keep the restored phrase gentle. This shelf has no resonant peak.
    low=signal.sosfiltfilt(signal.butter(2,1750,fs=SR,output='sos'),phrase,axis=0)
    phrase=low+(phrase-low)*10**(-2/20)
    context=round(.30*SR)
    gains=[]
    for old,new in [(x[a:a+context],phrase[:context]),(x[b-context:b],phrase[-context:])]:
        gains.append(float(np.clip(db(old)-db(new),-2.5,2)))
    progress=.5-.5*np.cos(np.linspace(0,np.pi,n))
    phrase*=10**(((gains[0]*(1-progress)+gains[1]*progress)/20)[:,None])
    wet=np.ones(n)
    wet[:width]=.5-.5*np.cos(np.linspace(0,np.pi,width))
    wet[-width:]=wet[:width][::-1]
    edited[a:b]=x[a:b]*(1-wet[:,None])+phrase*wet[:,None]
    for edge in [a,b]:
        before=x[edge]-x[edge-1]
        after=edited[edge]-edited[edge-1]
        assert np.max(abs(after-before))<1e-5, 'No new step at edit edge'
    edits.append(dict(reportedSecond=target['target'],start=a/SR,end=b/SR,
                      donorStart=donor/SR,donorEnd=(donor+n)/SR,
                      source='previously selected recording, earlier motif',
                      crossfadeSeconds=fade_seconds,upperShelfDb=-2,
                      startGainDb=gains[0],endGainDb=gains[1],
                      startHarmonyScore=picked['startHarmony'],endHarmonyScore=picked['endHarmony'],
                      sourceRmsDb=db(x[a:b]),editedRmsDb=db(edited[a:b])))
mask=np.ones(len(x),dtype=bool)
for edit in edits: mask[round(edit['start']*SR):round(edit['end']*SR)]=False
assert np.array_equal(x[mask],edited[mask])
assert np.array_equal(x[29*SR:36*SR],edited[29*SR:36*SR])
assert np.array_equal(x[94*SR:],edited[94*SR:])
assert np.max(abs(edited))<.9
wav=OUT/'home-soft-melody-loop-master.wav'
write(wav,edited)
encode(wav,MASTER)
with tempfile.TemporaryDirectory() as temp:
    decoded=Path(temp)/'decoded.wav'
    subprocess.run(['afconvert','-f','WAVE','-d','LEI16@44100','-c','2',str(MASTER),str(decoded)],check=True,capture_output=True)
    y=read(decoded)
assert len(y)==len(x)
aa,bb=round(LOOP_START*SR),round(LOOP_END*SR)
norm=min(1.,10**(-23/20)/np.sqrt(np.mean(y*y)))
context=round(.15*SR)
reference=y[aa-context:aa+context]
loop_context=y[bb-context:bb+context]
relative_error=float(np.sqrt(np.mean((reference-loop_context)**2))/np.sqrt(np.mean(reference**2)))
seam_step=float(np.max(abs(y[bb-1]-y[aa])))*norm
assert relative_error<.08 and seam_step<.015
old=read(OUT/'current.wav')
old_norm=.504389431337821
# Render the source + track + BGM bus gains used at default settings (60%).
# The iPhone speaker response is intentionally not claimed to be reproduced.
playback_gain=.75*norm*.6
old_gain=.75*old_norm*.6
for stem,samples in [('before_60-88_game-level',old[60*SR:88*SR]*old_gain),
                     ('after_60-88_game-level',y[60*SR:88*SR]*playback_gain),
                     ('after_full_game-level',np.concatenate([y[:bb],y[aa:bb]])*playback_gain),
                     ('after_loop-join_game-level',np.concatenate([y[bb-6*SR:bb],y[aa:aa+6*SR]])*playback_gain)]:
    path=OUT/(stem+'.wav')
    write(path,samples)
    encode(path,OUT/(stem+'.m4a'))
result=dict(previousMaster=str(OLD_MASTER.relative_to(ROOT)),previousSha256=OLD_SHA,
            editingPcm=str(PCM_SOURCE.relative_to(ROOT)),editingPcmSha256=sha(PCM_SOURCE),
            master=str(MASTER.relative_to(ROOT)),masterSha256=sha(MASTER),
            duration=len(y)/SR,loopStart=LOOP_START,loopEnd=LOOP_END,normalizationGain=float(norm),
            edits=edits,unchangedOutsideEditsBeforeEncoding=True,focus32SecondsPcmUnchanged=True,
            loopReturnPcmUnchanged=True,loopContextRelativeError=relative_error,loopSampleJump=seam_step,
            peak=float(np.max(abs(y))),preview=dict(bgmVolume=.6,trackGain=.75*norm,combinedGain=playback_gain,
            excerptStart=60,excerptEnd=88,reportedSecondsInExcerpt=[8,22],fullSeconds=(bb+bb-aa)/SR),
            runwayCreditsUsed=0,perceptualApproval='User listening pending',
            note='Compatibility scores and signal checks do not establish perceived musical naturalness.')
(OUT/'edit-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
