/**
 * ループの継ぎ目を確かめる。
 *
 *   node tools/bgm-seam.mjs
 *
 * 曲を差し替えたあと、1周ぶん座って待たなくても継ぎ目だけ聴けるように、
 * 「終わりの数秒 → 頭の数秒」だけを繋いだ試聴用の音を .bgm-seam/ に書き出す。
 * 真ん中が折り返しの位置なので、そこで消えたり跳ねたりしなければよい。
 *
 * 併せて3つ測る。数字が出るのは、耳で聴く前に明らかにおかしいものを弾くため。
 *
 *   段差   折り返しの前後 0.5 秒の音量差。大きいと「消えて鳴り出す」
 *   へこみ 折り返しをまたぐ1秒が、その前後より落ち込んでいないか。
 *          クロスフェードが深すぎると、ここに穴があく
 *   跳ね   波形が不連続に飛んでいないか。大きいとプチッと鳴る
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TRACKS } from "../src/audio/tracks.js";
import { db, readWav, writeWav } from "./wav.mjs";

const SRC = "assets/audio";
const OUT = ".bgm-seam";
/** 折り返しの前後、それぞれ何秒を切り出すか */
const SPAN = 4;

/** from から len サンプルぶんの実効音量 */
function rms(ch, from, len) {
  let sum = 0;
  let n = 0;
  for (const c of ch)
    for (let i = Math.max(0, from); i < Math.min(c.length, from + len); i++) {
      sum += c[i] * c[i];
      n++;
    }
  return n ? Math.sqrt(sum / n) : 0;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

console.log(`${"曲".padEnd(10)}${"段差".padStart(8)}${"へこみ".padStart(9)}${"跳ね".padStart(9)}`);
let worst = null;

for (const [id, track] of Object.entries(TRACKS)) {
  if (!track.loop) continue;
  const src = path.join(SRC, track.file);
  if (!fs.existsSync(src)) continue;
  const wav = path.join(OUT, `${id}.wav`);
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@44100", "-c", "2", src, wav]);
  const { ch, rate } = readWav(wav);
  const n = ch[0].length;
  const span = Math.min(Math.floor(rate * SPAN), Math.floor(n / 2));

  // 折り返しをまたぐ音を作る。前半が曲の終わり、後半が曲の頭
  const out = ch.map((c) => {
    const a = new Float32Array(span * 2);
    a.set(c.slice(n - span), 0);
    a.set(c.slice(0, span), span);
    return a;
  });
  writeWav(wav, out, rate);
  const m4a = path.join(OUT, `継ぎ目-${id}.m4a`);
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "96000", wav, m4a]);
  fs.rmSync(wav);

  const half = Math.floor(rate * 0.5);
  const step = Math.abs(db(rms(ch, n - half, half)) - db(rms(ch, 0, half)));

  // 折り返しをまたぐ1秒と、その前後1秒ずつを比べる
  const sec = rate;
  const across = db(
    Math.sqrt(
      (rms(ch, n - sec / 2, sec / 2) ** 2 + rms(ch, 0, sec / 2) ** 2) / 2,
    ),
  );
  const around = db(
    Math.sqrt((rms(ch, n - sec * 2, sec) ** 2 + rms(ch, sec, sec) ** 2) / 2),
  );
  const dip = around - across;

  let jump = 0;
  let typical = 0;
  for (let c = 0; c < ch.length; c++) {
    jump += Math.abs(ch[c][0] - ch[c][n - 1]);
    let d = 0;
    for (let i = 1; i < ch[c].length; i++) d += Math.abs(ch[c][i] - ch[c][i - 1]);
    typical += d / (ch[c].length - 1);
  }
  const jumpRatio = typical > 0 ? jump / typical : 0;

  const line = `${id.padEnd(10)}${step.toFixed(1).padStart(6)}dB${dip.toFixed(1).padStart(7)}dB${jumpRatio.toFixed(1).padStart(7)}倍`;
  console.log(line);
  if (!worst || step > worst.step) worst = { id, step };
}

console.log(`\n${OUT}/ に試聴用の音を書き出しました。真ん中が折り返しです。`);
if (worst) console.log(`いちばん段差が大きいのは ${worst.id} (${worst.step.toFixed(1)}dB)。`);
