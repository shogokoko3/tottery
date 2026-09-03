/**
 * 音を「どの高さの音が鳴っているか」に開く。
 *
 * ループの継ぎ目が耳につくかどうかは、音量が揃っているかでは分からない。
 * 前後で鳴っている**和音が変わる**と、揃っていても繋ぎ目に聞こえる。
 * それを測るために、ここでスペクトルとクロマ(12音階に畳んだ分布)を出す。
 *
 * 外の道具には頼らない。FFT も下に書いてある。
 */

/** 解析に使う標本化周波数。元の 44100Hz を1/4に間引く */
export const RATE = 11025;
/** 1回の窓の長さ。11025Hz で 2.7Hz きざみになり、低いほうの音も分けられる */
export const N = 4096;
/** 窓をずらす幅 */
export const HOP = 2048;

/**
 * 1/4に間引く。4つの平均を1つにするので、粗いローパスも兼ねる。
 * 5.5kHz より上は畳まれるが、和音を見るのに要るのは 4kHz までなので困らない。
 */
export function decimate(x) {
  const out = new Float32Array(Math.floor(x.length / 4));
  for (let i = 0; i < out.length; i++) {
    const j = i * 4;
    out[i] = (x[j] + x[j + 1] + x[j + 2] + x[j + 3]) / 4;
  }
  return out;
}

/** 反復型の FFT(基数2)。re/im を直に書き換える */
function fft(re, im) {
  const n = re.length;
  // ビット反転で並べ替える
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

const hann = new Float64Array(N);
for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);

/**
 * 各ビンをどの音名に割り当てるか(A440)。
 * 低すぎ・高すぎるところは和音を読むのに邪魔なので外す。
 */
const pitchClass = new Int8Array(N / 2 + 1).fill(-1);
for (let k = 0; k <= N / 2; k++) {
  const f = (k * RATE) / N;
  if (f <= 55 || f >= 4000) continue;
  pitchClass[k] = ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
}

/** x の at から1窓ぶんだけ開く */
export function frameAt(x, at) {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    re[i] = (x[at + i] || 0) * hann[i];
    im[i] = 0;
  }
  fft(re, im);
  const mag = new Float64Array(N / 2 + 1);
  const chroma = new Float64Array(12);
  for (let k = 0; k <= N / 2; k++) {
    const m = Math.hypot(re[k], im[k]);
    mag[k] = m;
    if (pitchClass[k] >= 0) chroma[pitchClass[k]] += m;
  }
  return { mag, chroma };
}

/**
 * 窓ごとのスペクトルとクロマを返す。
 * mags[i] はその窓の振幅、chromas[i] は12音への配分。
 *
 * hop に N を渡すと窓が重ならない。「隣り合う窓どうしがどれだけ違うか」を
 * 継ぎ目と同じ条件で数えたいときは、重ねないほうを使う。
 */
export function analyse(x, hop = HOP) {
  const count = Math.max(0, 1 + Math.floor((x.length - N) / hop));
  const mags = [];
  const chromas = [];
  for (let f = 0; f < count; f++) {
    const { mag, chroma } = frameAt(x, f * hop);
    mags.push(mag);
    chromas.push(chroma);
  }
  return { mags, chromas };
}

/** 向きの違い。0 なら同じ、1 に近いほど違う */
export function distance(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d < 1e-12 ? 1 : 1 - dot / d;
}

/** 全体を1つにまとめたクロマ。区間どうしを比べるのに使う */
export function averageChroma(x) {
  const { chromas } = analyse(x);
  const acc = new Float64Array(12);
  for (const c of chromas) for (let i = 0; i < 12; i++) acc[i] += c[i];
  return acc;
}
