/**
 * WAV の読み書き。音の下ごしらえをする道具が共通で使う。
 *
 * afconvert は拡張フォーマット(WAVE_FORMAT_EXTENSIBLE)で書くことがあるので、
 * 素直に決め打ちで読まずにチャンクを辿る。
 */
import fs from "node:fs";

export function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error(`RIFFではない: ${file}`);
  let pos = 12;
  let fmt = null;
  let data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt ")
      fmt = {
        channels: buf.readUInt16LE(pos + 10),
        rate: buf.readUInt32LE(pos + 12),
        bits: buf.readUInt16LE(pos + 22),
      };
    else if (id === "data") data = buf.subarray(pos + 8, pos + 8 + size);
    pos += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`中身が読めない: ${file}`);
  if (fmt.bits !== 16) throw new Error(`16bit ではない: ${file}`);
  const frames = Math.floor(data.length / (2 * fmt.channels));
  const ch = [];
  for (let c = 0; c < fmt.channels; c++) ch.push(new Float32Array(frames));
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < fmt.channels; c++)
      ch[c][i] = data.readInt16LE((i * fmt.channels + c) * 2) / 32768;
  return { ch, rate: fmt.rate };
}

export function writeWav(file, ch, rate) {
  const frames = ch[0].length;
  const channels = ch.length;
  const bytes = frames * channels * 2;
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + bytes, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * channels * 2, 28);
  head.writeUInt16LE(channels * 2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(bytes, 40);
  const body = Buffer.alloc(bytes);
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < channels; c++)
      body.writeInt16LE(
        Math.round(Math.max(-1, Math.min(1, ch[c][i])) * 32767),
        (i * channels + c) * 2,
      );
  fs.writeFileSync(file, Buffer.concat([head, body]));
}

export const db = (x) => (x <= 1e-9 ? -99 : 20 * Math.log10(x));
export const fromDb = (d) => Math.pow(10, d / 20);

/** 10ms ごとの実効音量。無音やフェード、打点の位置を測るのに使う */
export function envelope(ch, rate) {
  const win = Math.floor(rate * 0.01);
  const n = Math.floor(ch[0].length / win);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let c = 0; c < ch.length; c++)
      for (let j = 0; j < win; j++) {
        const v = ch[c][i * win + j];
        sum += v * v;
      }
    env[i] = Math.sqrt(sum / (win * ch.length));
  }
  return { env, win };
}

export function slice(ch, from, to) {
  return ch.map((c) => c.slice(Math.max(0, from), Math.max(0, to)));
}

/** 前後の無音を落とす */
export function trimSilence(ch, rate, thresholdDb = -50) {
  const { env, win } = envelope(ch, rate);
  const thr = fromDb(thresholdDb);
  let head = 0;
  let tail = env.length - 1;
  while (head < env.length && env[head] <= thr) head++;
  while (tail > head && env[tail] <= thr) tail--;
  return slice(ch, head * win, Math.min(ch[0].length, (tail + 1) * win));
}

/** 音量を揃える。上げすぎて割れないよう、頭を打つ */
export function normalize(ch, targetRmsDb, peakCeilDb) {
  let sum = 0;
  let count = 0;
  let peak = 0;
  for (const c of ch)
    for (const v of c) {
      sum += v * v;
      count++;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
  const rms = Math.sqrt(sum / count);
  let gain = fromDb(targetRmsDb) / rms;
  if (peak * gain > fromDb(peakCeilDb)) gain = fromDb(peakCeilDb) / peak;
  for (const c of ch) for (let i = 0; i < c.length; i++) c[i] *= gain;
  return { gain, rmsBefore: db(rms), rmsAfter: db(rms * gain) };
}
