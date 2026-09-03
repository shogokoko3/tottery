/**
 * 仮のBGMを作る。
 *
 * 本物の曲が決まるまでの置き石。音の切り替わりを耳で確かめられればよいので、
 * 場面ごとにテンポと和音だけ変えた、ごく単純なアルペジオを鳴らしている。
 * 曲として聴かせるものではない。差し替えるときは assets/audio/ の
 * 同じ名前の m4a を上書きするだけでよく、このスクリプトは要らなくなる。
 *
 *   node tools/make-placeholder-bgm.mjs
 *
 * m4a への変換には macOS の afconvert を使う。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RATE = 44100;
const OUT = "assets/audio";

/** MIDI番号を周波数に */
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

/**
 * 場面ごとの仮の曲。
 * chords は1小節ぶんの和音(MIDI番号)。step は1音の長さ(拍の割り算)。
 */
const PIECES = {
  // タイトル: ゆったり、低いところに重心
  title: { bpm: 66, step: 2, bars: 1, loop: true, chords: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]], bass: true },
  // 待機: いちばん薄く。音数を落として繰り返す
  waiting: { bpm: 60, step: 2, bars: 2, loop: true, chords: [[57, 64, 69], [55, 62, 67]], bass: false },
  // 布陣: 拍をはっきりさせて、置く手を急かさない程度に前へ
  setup: { bpm: 96, step: 1, bars: 1, loop: true, chords: [[57, 60, 64], [62, 65, 69], [55, 59, 62], [57, 60, 64]], bass: true },
  // 対局: 長く鳴るので、いちばん音数を絞る
  battle: { bpm: 84, step: 2, bars: 2, loop: true, chords: [[45, 57, 60, 64], [43, 55, 58, 62], [41, 53, 57, 60], [43, 55, 59, 62]], bass: true },
  // 終盤: 対局と同じ和音のまま、刻みだけ細かくする
  endgame: { bpm: 108, step: 0.5, bars: 2, loop: true, chords: [[45, 57, 60, 64], [43, 55, 58, 62], [41, 53, 57, 60], [43, 55, 59, 62]], bass: true },
  // 勝ち: 上がって終わる。繰り返さない
  win: { bpm: 100, step: 0.5, bars: 1, loop: false, chords: [[60, 64, 67, 72], [65, 69, 72, 77]], bass: true, tail: 1.6 },
  // 負け: 下がって終わる。繰り返さない
  lose: { bpm: 72, step: 1, bars: 1, loop: false, chords: [[57, 60, 64], [53, 56, 60]], bass: true, tail: 2.2 },
};

/** 撥弦のような1音。立ち上がりが速く、すぐ減衰する */
function pluck(buf, at, freq, dur, level) {
  const start = Math.floor(at * RATE);
  const len = Math.floor(dur * RATE);
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= buf.length) break;
    const t = i / RATE;
    const env = Math.min(1, t / 0.012) * Math.exp(-t * 3.2);
    const v =
      Math.sin(2 * Math.PI * freq * t) +
      0.28 * Math.sin(4 * Math.PI * freq * t) +
      0.1 * Math.sin(6 * Math.PI * freq * t);
    buf[idx] += v * env * level;
  }
}

/** 下でずっと鳴っている音 */
function pad(buf, at, freq, dur, level) {
  const start = Math.floor(at * RATE);
  const len = Math.floor(dur * RATE);
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= buf.length) break;
    const t = i / RATE;
    const env =
      Math.min(1, t / 0.25) * Math.min(1, (dur - t) / 0.35);
    buf[idx] += Math.sin(2 * Math.PI * freq * t) * env * level;
  }
}

function render(spec) {
  const beat = 60 / spec.bpm;
  const perChord = 4 * beat; // 1和音を1小節ぶん鳴らす
  const perBar = Math.max(1, Math.round(4 / spec.step)); // 1小節に置く音の数
  const body = spec.chords.length * perChord * spec.bars;
  const total = body + (spec.tail || 0);
  const buf = new Float64Array(Math.ceil(total * RATE) + RATE);

  let at = 0;
  for (let bar = 0; bar < spec.bars; bar++) {
    for (const chord of spec.chords) {
      if (spec.bass) pad(buf, at, hz(chord[0] - 12), perChord, 0.18);
      const notes = chord.slice(1).length ? chord.slice(1) : chord;
      for (let i = 0; i < perBar; i++) {
        const n = notes[i % notes.length] + 12 * Math.floor(i / notes.length);
        pluck(buf, at + i * spec.step * beat, hz(n), spec.step * beat * 2.4, 0.2);
      }
      at += perChord;
    }
  }

  // ループする曲は、頭とお尻がぶつからないよう端をなでておく
  const out = new Float32Array(Math.ceil(body * RATE) + Math.ceil((spec.tail || 0) * RATE));
  const edge = Math.floor(0.03 * RATE);
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
  const norm = peak > 0 ? 0.82 / peak : 1;
  for (let i = 0; i < out.length; i++) {
    let v = buf[i] * norm;
    if (i < edge) v *= i / edge;
    if (i > out.length - edge) v *= (out.length - i) / edge;
    out[i] = Math.max(-1, Math.min(1, v));
  }
  return out;
}

function writeWav(file, samples) {
  const bytes = samples.length * 2;
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + bytes, 4);
  head.write("WAVE", 8);
  head.write("fmt ", 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(bytes, 40);
  const body = Buffer.alloc(bytes);
  for (let i = 0; i < samples.length; i++)
    body.writeInt16LE(Math.round(samples[i] * 32767), i * 2);
  fs.writeFileSync(file, Buffer.concat([head, body]));
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, spec] of Object.entries(PIECES)) {
  const wav = path.join(OUT, `${name}.wav`);
  const m4a = path.join(OUT, `${name}.m4a`);
  writeWav(wav, render(spec));
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "96000", wav, m4a]);
  fs.unlinkSync(wav);
  const kb = (fs.statSync(m4a).size / 1024).toFixed(0);
  console.log(`${m4a}  ${kb}KB`);
}
console.log("\n仮のBGMです。本物が決まったら同じ名前で上書きしてください。");
