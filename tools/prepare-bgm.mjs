/**
 * BGM の下ごしらえ。
 *
 *   node tools/prepare-bgm.mjs
 *
 * assets/audio/原曲/ に置いた配布ファイルを読んで、assets/audio/*.m4a を作る。
 * 原曲は容量が大きいので git には入れていない。下の表の「出どころ」から
 * 落として 原曲/ に置けば、いつでも同じものを作り直せる。
 *
 * やっていること。
 *
 * 1. 前後の無音を落とす
 *    配布ファイルには頭に0.5秒、尻に3〜4秒の無音が付いている。
 *    そのまま繰り返すと、1周ごとに数秒の空白ができる
 * 2. 終わりのフェードを切って、頭とクロスフェードで繋ぐ
 *    どれも「終わる曲」として作られていて、終端は30dB以上フェードしている。
 *    切らずに繰り返すと、消えていきなり鳴り出す
 * 3. 音量を揃える
 *    出どころが違うと大きさが揃わない。同じ RMS に合わせておくと、
 *    tracks.js の gain を「その場面をどれだけ静かにしたいか」だけに使える
 *
 * 変換には macOS の afconvert を使う。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  db,
  envelope,
  fromDb,
  normalize,
  readWav,
  slice,
  trimSilence,
  writeWav,
} from "./wav.mjs";

const SRC = "assets/audio/原曲";
const OUT = "assets/audio";
const TMP = ".bgm-tmp";

/** 揃える音量(RMS)。-20dBFS あたりが BGM として素直 */
const TARGET_RMS_DB = -20;
/** どんなに音量を上げても、ここは超えさせない */
const PEAK_CEIL_DB = -1.5;
/** 出力の音質。BGMなのでこれで足りる */
const BITRATE = 80000;

/**
 * 曲の表。
 *
 * cut は「終わりのフェードを切ってよい上限(全体に対する割合)」。
 * 曲によって終わり方が違うので、切りすぎないよう頭打ちにしてある。
 * fade はクロスフェードの秒数。長いほど繋ぎ目は目立たないが、
 * 拍のある曲は輪郭がぼやける。
 */
const PIECES = [
  {
    out: "title.m4a",
    src: "inishienohiseki.mp3",
    title: "古の碑石 / 甘茶の音楽工房",
    from: "https://amachamusic.chagasi.com/music_inishienohiseki.html",
    loop: true,
    cut: 0.15,
    fade: 5,
  },
  {
    out: "waiting.m4a",
    src: "janegreynoshouzou.mp3",
    title: "ジェーン・グレイの肖像 / 甘茶の音楽工房",
    from: "https://amachamusic.chagasi.com/music_janegreynoshouzou.html",
    loop: true,
    cut: 0.15,
    fade: 4,
  },
  {
    out: "setup.m4a",
    src: "fukaiyaminookude.mp3",
    title: "深い闇の奥で / 甘茶の音楽工房",
    from: "https://amachamusic.chagasi.com/music_fukaiyaminookude.html",
    loop: true,
    cut: 0.15,
    fade: 3,
  },
  {
    out: "battle.m4a",
    src: "shatou.mp3",
    title: "斜塔 / 甘茶の音楽工房",
    from: "https://amachamusic.chagasi.com/music_shatou.html",
    loop: true,
    cut: 0.12,
    fade: 4,
  },
  {
    out: "endgame.m4a",
    src: "kiheisen.mp3",
    title: "騎兵戦 / 甘茶の音楽工房",
    from: "https://amachamusic.chagasi.com/music_kiheisen.html",
    loop: true,
    // 行進の曲は、長く重ねると拍がぼやける
    cut: 0.12,
    fade: 2,
  },
  {
    out: "win.m4a",
    src: "j01.m4a",
    title: "ジングル01 / 魔王魂",
    from: "https://maou.audio/game_jingle01/",
    loop: false,
  },
  {
    out: "lose.m4a",
    src: "j07.m4a",
    title: "ジングル07 / 魔王魂",
    from: "https://maou.audio/game_jingle07/",
    loop: false,
  },
];

/**
 * 終わりのフェードを切る。
 *
 * 曲の「普段の音量」を 75 パーセンタイルで測り、そこから 6dB 下がったところより
 * 下がりっぱなしになる手前で切る。切りすぎないよう maxRatio で頭打ちにする。
 */
function cutFadeOut(ch, rate, maxRatio) {
  const { env, win } = envelope(ch, rate);
  const sorted = Float32Array.from(env).sort();
  const ref = sorted[Math.floor(sorted.length * 0.75)];
  const thr = ref * fromDb(-6);
  let end = env.length - 1;
  while (end > 0 && env[end] < thr) end--;
  const keep = Math.max(
    Math.floor(env.length * (1 - maxRatio)),
    Math.min(env.length, end + 1),
  );
  return { ch: slice(ch, 0, keep * win), cutSec: ((env.length - keep) * win) / rate };
}

/**
 * 繋ぎ目のないループにする。
 *
 * 末尾の fade 秒を、頭の fade 秒に重ねて混ぜ、重ねたぶんを前から詰める。
 * こうすると、最後のサンプルの次が最初のサンプルとして自然に続く。
 */
function loopify(ch, rate, fadeSec) {
  const n = ch[0].length;
  const x = Math.min(Math.floor(rate * fadeSec), Math.floor(n / 3));
  const out = slice(ch, 0, n - x);
  for (let i = 0; i < x; i++) {
    // 等パワーで混ぜる。直線で混ぜると重なりの真ん中がへこむ
    const t = i / x;
    const outGain = Math.cos((t * Math.PI) / 2);
    const inGain = Math.sin((t * Math.PI) / 2);
    for (let c = 0; c < ch.length; c++)
      out[c][i] = ch[c][n - x + i] * outGain + ch[c][i] * inGain;
  }
  return { ch: out, fadeSec: x / rate };
}

/* ---------- 本体 ---------- */

if (!fs.existsSync(SRC)) {
  console.error(`${SRC}/ が無い。表の「出どころ」から原曲を落として置いてください。\n`);
  for (const p of PIECES) console.error(`  ${p.src.padEnd(24)} ${p.title}\n  ${" ".repeat(24)} ${p.from}`);
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
  const trimmed = ch[0].length / rate;

  let note = "";
  if (piece.loop) {
    const cut = cutFadeOut(ch, rate, piece.cut);
    ch = cut.ch;
    const looped = loopify(ch, rate, piece.fade);
    ch = looped.ch;
    note = `終わりを${cut.cutSec.toFixed(1)}s切って${looped.fadeSec.toFixed(1)}sで繋いだ`;
  } else {
    note = "ジングルなので繋がない";
  }

  const level = normalize(ch, TARGET_RMS_DB, PEAK_CEIL_DB);
  writeWav(wav, ch, rate);

  const out = path.join(OUT, piece.out);
  fs.rmSync(out, { force: true });
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", String(BITRATE), wav, out]);
  const size = fs.statSync(out).size;
  total += size;

  const secs = ch[0].length / rate;
  console.log(
    `${piece.out.padEnd(12)} ${secs.toFixed(1)}s ${kb(size).padStart(7)}  ` +
      `${piece.title}\n${" ".repeat(13)}${before.toFixed(1)}s → 無音を落として ${trimmed.toFixed(1)}s → ${note}\n` +
      `${" ".repeat(13)}音量 ${level.rmsBefore.toFixed(1)}dB → ${level.rmsAfter.toFixed(1)}dB (×${level.gain.toFixed(2)})`,
  );
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n合計 ${kb(total)}`);
