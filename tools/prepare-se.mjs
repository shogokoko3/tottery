/**
 * 効果音の下ごしらえ。
 *
 *   node tools/prepare-se.mjs
 *
 * assets/audio/原曲/ に置いた配布ファイルから assets/audio/se-*.m4a を作る。
 * BGM と同じで、原曲は git に入れていない。表の「出どころ」から落とせる。
 *
 * 効果音は押した瞬間に鳴ってほしいので、要らないところを削るのが要点。
 *
 * 1. 前後の無音を落とす
 * 2. take で「使うところ」だけ切り出す
 *    配布ファイルには余韻や、繰り返しが丸ごと入っていることがある。
 *    時計の針は14秒ぶん入っていて、そのうち欲しいのは1つぶんだけ
 * 3. 尻を短くなでて切る。ぶつ切りにするとプチッと鳴る
 * 4. 音量を揃える
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { SOUNDS } from "../src/audio/sounds.js";
import { normalize, readWav, slice, trimSilence, writeWav } from "./wav.mjs";

const SRC = "assets/audio/原曲";
const OUT = "assets/audio";
const TMP = ".se-tmp";

/** 揃える音量。BGM(-20dBFS)より前に出したいので、少し大きめ */
const TARGET_RMS_DB = -17;
const PEAK_CEIL_DB = -1.5;
/** 尻をなでる時間。これより短く切るとプチッと鳴る */
const TAIL_FADE = 0.02;
const BITRATE = 96000;

/**
 * 効果音の表。
 *
 * take は [開始秒, 長さ秒]。無音を落としたあとの位置で数える。
 * 省略すると全部使う。
 */
const PIECES = [
  {
    out: "se-place.m4a",
    src: "card-put1.mp3",
    title: "カードを台の上に出す / 効果音ラボ",
    from: "https://soundeffect-lab.info/sound/various/various3.html",
    take: [0, 0.2],
  },
  {
    out: "se-capture.m4a",
    src: "blow1.mp3",
    title: "打撃1 / 効果音ラボ",
    from: "https://soundeffect-lab.info/sound/battle/",
    take: [0, 0.45],
  },
  {
    out: "se-tick.m4a",
    src: "clock-hand1.mp3",
    title: "時計の針1 / 効果音ラボ",
    from: "https://soundeffect-lab.info/sound/various/various3.html",
    // 14秒のうち、針1つぶんだけ切り出す
    take: [0.08, 0.3],
  },
];

if (!fs.existsSync(SRC)) {
  console.error(`${SRC}/ が無い。表の「出どころ」から原曲を落として置いてください。`);
  process.exit(1);
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const kb = (n) => (n / 1024).toFixed(0) + "KB";
let total = 0;

for (const piece of PIECES) {
  const src = path.join(SRC, piece.src);
  if (!fs.existsSync(src)) {
    console.error(`× ${piece.src} が無い (${piece.from})`);
    process.exitCode = 1;
    continue;
  }
  const wav = path.join(TMP, piece.out.replace(/\.m4a$/, ".wav"));
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@44100", "-c", "2", src, wav]);

  let { ch, rate } = readWav(wav);
  const before = ch[0].length / rate;
  ch = trimSilence(ch, rate);

  if (piece.take) {
    const [from, len] = piece.take;
    ch = slice(ch, Math.floor(from * rate), Math.floor((from + len) * rate));
  }

  // 尻をなでる。切りっぱなしだと波形が途中で止まってプチッと鳴る
  const fade = Math.min(Math.floor(rate * TAIL_FADE), ch[0].length);
  for (let i = 0; i < fade; i++) {
    const g = 1 - i / fade;
    for (const c of ch) c[c.length - fade + i] *= g;
  }

  const level = normalize(ch, TARGET_RMS_DB, PEAK_CEIL_DB);
  writeWav(wav, ch, rate);

  const out = path.join(OUT, piece.out);
  fs.rmSync(out, { force: true });
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", String(BITRATE), wav, out]);
  const size = fs.statSync(out).size;
  total += size;

  const id = Object.keys(SOUNDS).find((k) => SOUNDS[k].file === piece.out) || "?";
  console.log(
    `${piece.out.padEnd(15)} ${(ch[0].length / rate).toFixed(2)}s ${kb(size).padStart(6)}  ${piece.title}\n` +
      `${" ".repeat(16)}${before.toFixed(2)}s から切り出し / 音量 ${level.rmsBefore.toFixed(1)}dB → ${level.rmsAfter.toFixed(1)}dB / 用途 ${id}`,
  );
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n合計 ${kb(total)}`);
