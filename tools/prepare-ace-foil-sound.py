#!/usr/bin/env python3
"""Make the original A-foil cue with macOS afconvert and Python's standard library.

The dry finger snap starts at 0.230 seconds. The existing original A swap cue
starts at 0.480 seconds, matching the hat animation. No downloaded sounds.
Usage: python3 tools/prepare-ace-foil-sound.py [--check]
"""

import argparse
import array
import math
from pathlib import Path
import random
import shutil
import subprocess
import struct
import sys
import tempfile
import wave

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets/audio/se-ace-swap.m4a"
OUTPUT = ROOT / "assets/audio/se-ace-foil.m4a"
SNAP_AT = 0.230
HATS_AT = 0.480


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def decode(converter, source, path):
    run(converter, "-f", "WAVE", "-d", "LEI16", str(source), str(path))
    # afconvert emits WAVE_FORMAT_EXTENSIBLE, unsupported by macOS Python 3.9's
    # wave reader. Read its PCM chunks directly so no additional package is needed.
    raw = path.read_bytes()
    assert raw[:4] == b"RIFF" and raw[8:12] == b"WAVE"
    chunks = {}
    cursor = 12
    while cursor + 8 <= len(raw):
        name, size = struct.unpack_from("<4sI", raw, cursor)
        chunks[name] = raw[cursor + 8:cursor + 8 + size]
        cursor += 8 + size + size % 2
    tag, channels, rate, _, _, bits = struct.unpack_from("<HHIIHH", chunks[b"fmt "])
    assert tag in (1, 65534) and bits == 16
    if tag == 65534:
        assert chunks[b"fmt "][24:40] == bytes.fromhex("0100000000001000800000aa00389b71")
    samples = array.array("h", chunks[b"data"])
    if sys.byteorder != "little":
        samples.byteswap()
    return channels, rate, samples


def synthesize(channels, rate, original):
    shift = round(HATS_AT * rate) * channels
    mixed = array.array("h", [0]) * shift + original
    rng = random.Random(20260916)
    snap = []
    previous = 0.0
    for frame in range(round(0.065 * rate)):
        t = frame / rate
        noise = rng.uniform(-1, 1)
        high = (noise - previous) * 0.5
        previous = noise
        attack = min(1, t / 0.00025)
        tail = min(1, (0.065 - t) / 0.003)
        snap.append(attack * tail * (
            0.62 * high * math.exp(-t / 0.007)
            + 0.26 * math.sin(2 * math.pi * 1600 * t) * math.exp(-t / 0.009)
            + 0.16 * math.sin(2 * math.pi * 340 * t) * math.exp(-t / 0.012)
        ))
    scale = 0.64 * 32767 / max(abs(value) for value in snap)
    start = round(SNAP_AT * rate) * channels
    for frame, value in enumerate(snap):
        for channel in range(channels):
            mixed[start + frame * channels + channel] = round(value * scale)
    # The hat sound is copied without changing its volume or stereo image.
    assert mixed[shift:] == original
    assert all(sample == 0 for sample in mixed[:start])
    assert max(abs(sample) for sample in mixed) < 32767
    return mixed


def check_encoded(converter, temporary, channels, rate, original):
    out_channels, out_rate, encoded = decode(converter, OUTPUT, temporary / "verified.wav")
    assert (out_channels, out_rate) == (channels, rate)
    shift = round(HATS_AT * rate) * channels
    assert len(encoded) == len(original) + shift, "AAC must retain the animation's exact duration"

    def peak(start, end):
        return max(abs(sample) for sample in encoded[round(start * rate) * channels:round(end * rate) * channels])

    assert peak(0, 0.210) < 100, "Unexpected sound before the snap"
    assert peak(0.225, 0.270) > 5000, "Finger snap is missing or mistimed"
    assert peak(0.325, 0.450) < 100, "Snap must have a short, dry tail"
    delayed = encoded[shift:]
    dot = sum(a * b for a, b in zip(original, delayed))
    energy = math.sqrt(sum(a * a for a in original) * sum(b * b for b in delayed))
    correlation = dot / energy
    assert correlation > 0.99, "Hat cue must match the original at +0.480 seconds"
    duration = len(encoded) / channels / rate
    print(f"A foil audio OK: {duration:.3f}s, snap 0.230s, hats +0.480s, correlation {correlation:.5f}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check the committed cue without rewriting it")
    options = parser.parse_args()
    converter = shutil.which("afconvert")
    if not converter:
        parser.error("macOS afconvert is required; this script does not download audio tools")
    with tempfile.TemporaryDirectory(prefix="tottery-ace-foil-audio-") as directory:
        temporary = Path(directory)
        channels, rate, original = decode(converter, SOURCE, temporary / "swap.wav")
        if not options.check:
            samples = synthesize(channels, rate, original)
            if sys.byteorder != "little":
                samples.byteswap()
            pcm = temporary / "foil.wav"
            with wave.open(str(pcm), "wb") as audio:
                audio.setparams((channels, 2, rate, 0, "NONE", "not compressed"))
                audio.writeframes(samples.tobytes())
            run(converter, "-f", "m4af", "-d", "aac", "-b", "128000", "-q", "127", str(pcm), str(OUTPUT))
        check_encoded(converter, temporary, channels, rate, original)


if __name__ == "__main__":
    main()
