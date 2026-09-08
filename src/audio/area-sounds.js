// 盤面エリア専用のオリジナル合成音。既存の効果音用バスで音量・ミュートを共有する。
export function areaSoundSamples(type, sampleRate = 24000, hit = true) {
  const seconds = type === "thaw" ? 1 : type === "birth" ? 1.8 : 6;
  const out = new Float32Array(Math.ceil(sampleRate * seconds));
  let seed = 1747,
    smooth = 0;
  const bell = (t, start, hz, decay = 5) => {
    const x = t - start;
    return x < 0
      ? 0
      : Math.sin(2 * Math.PI * hz * x) *
          Math.exp(-x * decay) *
          (1 - Math.exp(-x * 90));
  };
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    smooth += (noise - smooth) * 0.08;
    const env = Math.sin((Math.PI * t) / seconds) ** 2;
    let v = 0;
    switch (type) {
      case "earth":
        v =
          smooth * env * 0.8 +
          noise * Math.exp(-t * 7) * 0.08 +
          (hit ? bell(t, 3.05, 740) * 0.17 : bell(t, 3.05, 150) * 0.14);
        break;
      case "sea":
        v =
          smooth * env * 1.4 +
          Math.sin(2 * Math.PI * (65 * t + 22 * t * t)) * env * 0.12 +
          noise * env * 0.04;
        break;
      case "forest":
        v =
          noise * env * 0.04 +
          bell(t, 1.05, 660) * 0.12 +
          bell(t, 1.65, 990) * 0.16 +
          bell(t, 2.1, 1320) * 0.08;
        break;
      case "ice":
        v =
          noise * Math.exp(-Math.abs(t - 4.35) * 16) * 0.13 +
          [1174, 1760, 2349].reduce(
            (n, h, j) => n + bell(t, 4.05 + j * 0.15, h, 7) * 0.13,
            0,
          );
        break;
      case "sky":
        v =
          smooth * env * 0.6 +
          Math.sin(2 * Math.PI * (180 * t + 160 * t * t)) * env * 0.09 +
          bell(t, 4.25, 1046) * 0.14;
        break;
      case "heaven":
      case "palace":
        v = [523.25, 659.25, 783.99, 1046.5].reduce(
          (n, h, j) => n + bell(t, 2.8 + j * 0.4, h, 2.8) * 0.12,
          0,
        );
        break;
      case "hell":
        v =
          smooth * env * 0.95 +
          noise * env * 0.06 +
          bell(t, 3.1, 98, 2) * 0.14 +
          bell(t, 4.25, 196, 3) * 0.12;
        break;
      case "thaw":
        v =
          noise * Math.exp(-t * 12) * 0.12 +
          bell(t, 0.08, 1568, 9) * 0.13 +
          bell(t, 0.2, 2093, 9) * 0.08;
        break;
      default:
        v =
          smooth * env * 0.25 +
          bell(t, 0.3, 523) * 0.1 +
          bell(t, 0.45, 784) * 0.08;
    }
    out[i] =
      Math.max(-0.65, Math.min(0.65, v)) *
      Math.min(1, i / 150, (out.length - 1 - i) / 200);
  }
  return out;
}
