"""Warm, diffuse reward blooms. No bells, metallic attacks or high partials."""
import numpy as np
from scipy import signal

RADIANT_IDS = {'reveal_r','reveal_sr','reveal_ssr','foil_acquire','foil_open',
               'levelup','mastery','title','login','mission','claim_all','forge','win','puzzle_correct'}

def radiant(id, sr, root=7, mode="major", family=None):
    tier = 3 if id in {'reveal_ssr','foil_acquire','forge','win'} else 2 if id in {'reveal_sr','levelup','mastery','title','claim_all','puzzle_correct'} else 1
    if family is not None: tier=family
    third=3 if mode=='minor' else 4
    intervals=([0,7] if tier==1 else [0,7,12,7]) if mode=='open' else [0,third,7] if tier==1 else [0,third,7,12] if tier==2 else [0,7,12,12+third]
    notes=[440*2**((48+root+v-69)/12) for v in intervals]
    spacing = [0,.09,.15][tier-1]
    tail = [.78,.95,1.18][tier-1]
    duration = tail + spacing*(len(notes)-1)
    y = np.zeros(round(duration*sr))
    rng = np.random.default_rng(sum(map(ord,id)))
    for k,hz in enumerate(notes):
        start = round(k*spacing*sr)
        t = np.arange(len(y)-start)/sr
        # Slow felt attack and diffuse, warm harmonics: never a struck bell.
        env = (1-np.exp(-t/.065))**2 * np.exp(-t/.23)
        env *= np.minimum(1,(t[-1]-t)/.16)
        tone = np.zeros(len(t))
        for detune in [-.002, .002]:
            for harmonic,level in [(1,1),(2,.12)]:
                tone += level*np.sin(2*np.pi*hz*(1+detune)*harmonic*t + k*.4)
        y[start:] += tone*env/(len(notes)*2)
    t = np.arange(len(y))/sr
    air = signal.sosfilt(signal.butter(2,[280,1050],fs=sr,btype='bandpass',output='sos'),rng.normal(0,1,len(y)))
    y += air*.07*np.sin(np.pi*np.minimum(1,t/duration))**2
    y = signal.sosfilt(signal.butter(3,1350,fs=sr,output='sos'),y)
    y *= .24/max(np.max(np.abs(y)),1e-9)
    edge = min(round(sr*.035),len(y)//2)
    y[:edge] *= np.linspace(0,1,edge)
    y[-edge:] *= np.linspace(1,0,edge)
    return y
