// Synthesized layers from the approved capture preview. The caller supplies the
// existing SE bus so mute/volume settings work on iOS as well as the web.
export function captureSoundOnBus(audioCtx, output, hit) {
  const audioBus = audioCtx.createGain();
  audioBus.gain.value = 0.84;
  const limiter = audioCtx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 10;
  limiter.ratio.value = 5;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  audioBus.connect(limiter);
  limiter.connect(output);
  const nodes = new Set();
  const externalStops = new Set();
  function stopAudio() {
    for (const stop of externalStops) stop();
    externalStops.clear();
    for (const n of nodes) {
      try {
        n.stop();
      } catch {}
    }
    nodes.clear();
  }
  function tone(freq, endFreq, dur, gain, type = "sine", delay = 0) {
    if (!audioCtx) return;
    const start = audioCtx.currentTime + delay,
      osc = audioCtx.createOscillator(),
      g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(audioBus);
    nodes.add(osc);
    osc.onended = () => {
      nodes.delete(osc);
      osc.disconnect();
      g.disconnect();
    };
    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  function noise(dur, gain, freq, band = "bandpass", delay = 0) {
    if (!audioCtx) return;
    const n = Math.floor(audioCtx.sampleRate * dur),
      buffer = audioCtx.createBuffer(1, n, audioCtx.sampleRate),
      data = buffer.getChannelData(0);
    let seed = 7421;
    for (let i = 0; i < n; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    const source = audioCtx.createBufferSource(),
      filter = audioCtx.createBiquadFilter(),
      g = audioCtx.createGain(),
      at = audioCtx.currentTime + delay;
    source.buffer = buffer;
    filter.type = band;
    filter.frequency.setValueAtTime(freq, at);
    filter.Q.value = 0.75;
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(100, freq * 0.55),
      at + dur,
    );
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    source.connect(filter);
    filter.connect(g);
    g.connect(audioBus);
    nodes.add(source);
    source.onended = () => {
      nodes.delete(source);
      source.disconnect();
      filter.disconnect();
      g.disconnect();
    };
    source.start(at);
    source.stop(at + dur + 0.015);
  }
  function sound(kind) {
    if (!audioCtx || audioCtx.state !== "running") return;
    if (kind === "dash") {
      noise(0.16, 0.055, 1800);
      tone(170, 350, 0.11, 0.027, "sine");
    }
    if (kind === "hit") {
      const stop = hit?.();
      if (stop) externalStops.add(stop);
      tone(185, 52, 0.19, 0.17);
      noise(0.085, 0.2, 920);
      tone(1250, 460, 0.1, 0.04, "triangle");
    }
    if (kind === "open") {
      tone(784, 784, 0.26, 0.023, "sine");
      tone(1175, 1175, 0.31, 0.015, "sine", 0.035);
    }
    if (kind === "break") {
      // A dry initial crack, then separate short glass-like splinters.
      noise(0.095, 0.22, 2600);
      tone(185, 55, 0.22, 0.13);
      [1319, 1976, 2637, 3520].forEach((f, i) =>
        tone(
          f,
          f * 0.97,
          0.16 + i * 0.045,
          0.027 - i * 0.004,
          "sine",
          i * 0.019,
        ),
      );
      noise(0.23, 0.046, 3900, "highpass", 0.047);
    }
    if (kind === "crack" || kind === "crack2" || kind === "crack3") {
      const level = kind === "crack" ? 0 : kind === "crack2" ? 1 : 2;
      noise(0.035, 0.073 + level * 0.012, 2000 + level * 350);
      tone(1150 + level * 330, 960 + level * 260, 0.065, 0.025, "triangle");
    }
    if (kind === "charge") {
      const dur = 0.403;
      tone(165, 600, dur, 0.043, "sine");
      tone(220, 780, dur, 0.026, "triangle");
      noise(dur, 0.04, 1550);
    }
    if (kind === "hush") {
      stopAudio();
    }
    if (kind === "royal") {
      tone(105, 40, 0.42, 0.16);
      tone(196, 196, 0.73, 0.065, "triangle", 0.03);
      tone(294, 294, 0.92, 0.055, "sine", 0.07);
      tone(392, 392, 1.08, 0.04, "sine", 0.1);
      tone(784, 784, 0.88, 0.034, "sine", 0.18);
    }
  }

  return {
    play: sound,
    stop() {
      stopAudio();
      audioBus.disconnect();
      limiter.disconnect();
    },
  };
}
