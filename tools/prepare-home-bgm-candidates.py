# coding: utf-8
"""Keep the generated masters and prepare full-length warm, level-matched auditions."""
from pathlib import Path
import concurrent.futures, hashlib, json, subprocess, tempfile, warnings
import numpy as np
from scipy import signal, ndimage
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT/'reports/home-bgm-runway-20261023'
manifest = json.loads((OUT/'generation.json').read_text())
(OUT/'originals').mkdir(exist_ok=True)
SR = 44100

def fetch(track):
    path = OUT/'originals'/('%02d_original.mp3' % track['index'])
    if not path.exists():
        part = path.with_suffix('.part')
        # Use the system TLS trust store; the old framework Python lacks its CA bundle.
        subprocess.run(['/usr/bin/curl', '--fail', '--location', '--retry', '2',
                        '--connect-timeout', '15', '--max-time', '120',
                        '--output', str(part), track['url']], check=True, capture_output=True)
        assert part.stat().st_size>100000, 'Incomplete generated audio'
        part.replace(path)
    return path

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    originals = list(pool.map(fetch, manifest['tracks']))

def decode(path, wav):
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', '-c', '2', str(path), str(wav)], check=True, capture_output=True)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        rate, pcm = wavfile.read(wav)
    assert rate==SR
    return pcm.astype(float)/32768

def levels(x):
    return {'rmsDb': float(20*np.log10(max(np.sqrt(np.mean(x*x)), 1e-12))),
            'peak': float(np.max(abs(x)))}

def spectrum(x):
    mono = signal.resample_poly(x.mean(axis=1), 1, 2)
    freq, power = signal.welch(mono, SR/2, nperseg=16384)
    total = max(float(power.sum()), 1e-15)
    return freq, power, {'above3kHzRatio': float(power[freq>=3000].sum()/total),
                          'above6kHzRatio': float(power[freq>=6000].sum()/total)}

reports = []
with tempfile.TemporaryDirectory() as temp:
    temp = Path(temp)
    for track, source in zip(manifest['tracks'], originals):
        x = decode(source, temp/'source.wav')
        freq, power, before_high = spectrum(x)
        y = x.copy()
        # Suppress only a strong, sustained narrow treble resonance if present.
        # A blend bounds the notch depth; all generated originals are preserved.
        floor = ndimage.median_filter(power, size=41)
        peaks, _ = signal.find_peaks(power/np.maximum(floor, 1e-15), height=25, distance=80)
        notches = []
        for peak in sorted(peaks, key=lambda k:power[k], reverse=True):
            hz = float(freq[peak])
            band = abs(freq-hz)<35
            if 2500<hz<8000 and power[band].sum()/max(power.sum(), 1e-15)>.015:
                b, a = signal.iirnotch(hz, 8, fs=SR)
                softened = signal.filtfilt(b, a, y, axis=0)
                y = .5*y+.5*softened
                notches.append(round(hz, 1))
                if len(notches)==3: break
        # Gentle broad warmth preserves the cello/harp attack and room sound.
        lower = signal.sosfiltfilt(signal.butter(2, 2000, fs=SR, output='sos'), y, axis=0)
        y = .82*y+.18*lower
        y = signal.sosfiltfilt(signal.butter(2, 7500, fs=SR, output='sos'), y, axis=0)
        gain = min(10**(-21/20)/max(np.sqrt(np.mean(y*y)), 1e-12), .79/max(np.max(abs(y)), 1e-12))
        y *= gain
        # Only ten milliseconds at the physical file edges prevent cut clicks.
        edge = round(.01*SR)
        y[:edge] *= np.linspace(0, 1, edge)[:, None]
        y[-edge:] *= np.linspace(1, 0, edge)[:, None]
        file = '%02d_%s_full.m4a' % (track['index'], ['palace', 'moonlit', 'journey'][track['index']-1])
        wavfile.write(temp/'prepared.wav', SR, np.clip(np.rint(y*32768), -32768, 32767).astype(np.int16))
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '192000', str(temp/'prepared.wav'), str(OUT/file)], check=True, capture_output=True)
        final = decode(OUT/file, temp/'verified.wav')
        assert abs(len(final)-len(x))<=2, 'Do not shorten the full composition'
        assert np.max(abs(final))<.86, 'Encoded audio clipping'
        _, _, after_high = spectrum(final)
        assert after_high['above6kHzRatio']<=before_high['above6kHzRatio']+.00001
        row = {'index': track['index'], 'name': track['name'], 'file': file,
               'taskId': track['taskId'], 'duration': len(final)/SR,
               'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
               'fileSha256': hashlib.sha256((OUT/file).read_bytes()).hexdigest(),
               'before': {**levels(x), **before_high},
               'after': {**levels(final), **after_high},
               'notchesHz': notches, 'constantGain': float(gain),
               'fullLengthPreserved': True}
        reports.append(row)
        print(json.dumps({k:row[k] for k in ['index','name','file','duration','notchesHz','after']}, ensure_ascii=False), flush=True)

assert max(r['after']['rmsDb'] for r in reports)-min(r['after']['rmsDb'] for r in reports)<.5
(OUT/'verification.json').write_text(json.dumps({'tracks': reports, 'creditsUsed': 24,
                                              'processing': 'Full length retained; gentle treble softening; constant level matching; no pitch or tempo change'},
                                             ensure_ascii=False, indent=2)+'\n')
print('Three complete audition tracks verified.', flush=True)
