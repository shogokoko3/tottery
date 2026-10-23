# coding: utf-8
"""Three reversible phrase edits of the approved home original, for audition."""
from pathlib import Path
import json, hashlib, subprocess, warnings
import numpy as np
from scipy.io import wavfile
from scipy import signal, ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT/'reports/home-bgm-32s-20261023'
OUT.mkdir(exist_ok=True)
SOURCE = ROOT.parent/'音楽・効果音候補集/bgm/home.mp3'
with warnings.catch_warnings():
    warnings.simplefilter('ignore')
    SR, original_pcm = wavfile.read(OUT/'source.wav')
assert SR == 44100 and original_pcm.shape[1] == 2
x = original_pcm.astype(float)/32768

def envelope(length, fade):
    fade = min(fade, length//2)
    w = np.ones(length)
    u = np.linspace(0, np.pi, fade)
    w[:fade] = .5-.5*np.cos(u)
    w[-fade:] = w[:fade][::-1]
    return w

def phrase(start, end, donor, fade=.12):
    a, b, s = [round(t*SR) for t in [start, end, donor]]
    part = x[s:s+b-a].copy()
    # Match the donor to the local accompaniment, without boosting sharp peaks.
    surroundings = np.concatenate([x[a-round(.6*SR):a], x[b:b+round(.6*SR)]])
    goal = np.sqrt(np.mean(surroundings**2))
    gain = float(np.clip(goal/max(np.sqrt(np.mean(part**2)), 1e-9), .75, 1.25))
    part *= gain
    wet = envelope(len(part), round(fade*SR))
    out = x.copy()
    # Complementary curves avoid the +3 dB bump of an equal-power correlated mix.
    out[a:b] = x[a:b]*(1-wet[:, None]) + part*wet[:, None]
    return out, {'start': start, 'end': end, 'donorStart': donor,
                 'donorEnd': donor+(end-start), 'fadeSeconds': fade, 'donorGain': gain}

# A shorter D→G answer replaces the more emphatic D→C passage. Copying from the
# same performance preserves the actual instrument tone, stereo room and tempo.
one, edit_one = phrase(31.02, 34.12, 27.954866)

# Keep every note in place; control only the local emphasis and upper resonance.
a, b = round(29.9*SR), round(35.25*SR)
part = x[a:b]
low = signal.sosfiltfilt(signal.butter(2, 1750, fs=SR, output='sos'), part, axis=0)
warm = low + (part-low)*10**(-3.5/20)
energy = ndimage.uniform_filter1d(np.mean(part**2, axis=1), round(.05*SR), mode='nearest')
level = 10*np.log10(np.maximum(energy, 1e-12))
reduction = -np.minimum(4, np.maximum(0, level+15)*.65)
reduction = ndimage.gaussian_filter1d(reduction, round(.045*SR), mode='nearest')
soft = warm*10**(reduction[:, None]/20)
wet = envelope(len(part), round(.65*SR))
two = x.copy()
two[a:b] = part*(1-wet[:, None])+soft*wet[:, None]
edit_two = {'start': a/SR, 'end': b/SR, 'upperBandDb': -3.5,
            'maximumCompressionDb': float(-np.min(reduction)), 'notesChanged': False}

# Restate a calmer early motif across the complete phrase, rather than adding
# a synthetic melody or changing the original recording's timbre/pitch.
three, edit_three = phrase(29.49, 35.64, 11.05, .16)

variants = [
    ('01_harmony', '① 和音のつながりを整える', one, edit_one),
    ('02_soft', '② 音の強さと響きをなめらかにする', two, edit_two),
    ('03_melody', '③ 旋律の流れを整える', three, edit_three),
]
result = {'original': str(SOURCE.relative_to(ROOT.parent)),
          'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
          'duration': len(x)/SR, 'previewStart': 24, 'previewEnd': 42,
          'focusInPreviewSeconds': 8, 'runwayGenerationCredits': 0, 'variants': []}

def pcm(samples):
    return np.clip(np.rint(samples*32768), -32768, 32767).astype(np.int16)

def export(stem, samples):
    wav = OUT/(stem+'.wav')
    dst = OUT/(stem+'.m4a')
    wavfile.write(wav, SR, pcm(samples))
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '192000', str(wav), str(dst)], check=True, capture_output=True)
    return dst

export('00_original_preview_24-42', x[24*SR:42*SR])
for stem, name, samples, edit in variants:
    start, end = round(edit['start']*SR), round(edit['end']*SR)
    assert len(samples) == len(x)
    assert np.array_equal(pcm(samples[:start]), original_pcm[:start])
    assert np.array_equal(pcm(samples[end:]), original_pcm[end:])
    assert np.max(abs(samples)) < 1
    for edge in [start, end]:
        # Verify the edit introduces no extra step at either boundary.
        original_step = x[edge]-x[edge-1]
        edited_step = samples[edge]-samples[edge-1]
        assert np.max(abs(edited_step-original_step)) < .001
    full = export(stem+'_full', samples)
    preview = export(stem+'_preview_24-42', samples[24*SR:42*SR])
    rms = lambda y: float(20*np.log10(max(np.sqrt(np.mean(y*y)), 1e-12)))
    result['variants'].append({'name': name, 'edit': edit, 'full': full.name,
                              'preview': preview.name, 'peak': float(np.max(abs(samples))),
                              'focusRmsBeforeDb': rms(x[31*SR:34*SR]),
                              'focusRmsAfterDb': rms(samples[31*SR:34*SR]),
                              'outsideEditPcmIdentical': True})
    print(name, full.name, flush=True)

for i in range(len(variants)):
    for j in range(i):
        diff = np.sqrt(np.mean((variants[i][2][29*SR:36*SR]-variants[j][2][29*SR:36*SR])**2))
        assert diff > .005, 'Alternatives must be meaningfully different'

(OUT/'edits.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print('Three full versions and synchronized previews exported; source and app files preserved.', flush=True)
