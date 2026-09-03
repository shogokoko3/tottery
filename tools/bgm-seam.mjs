/**
 * ループの継ぎ目を確かめる。
 *
 *   node tools/bgm-seam.mjs
 *
 * 曲を差し替えたあと、1周ぶん座って待たなくても継ぎ目だけ聴けるように、
 * 「終わりの数秒 → 頭の数秒」だけを繋いだ試聴用の音を .bgm-seam/ に書き出す。
 * 真ん中が折り返しの位置なので、そこで消えたり跳ねたりしなければよい。
 *
 * 併せて5つ測る。耳で聴く前に、明らかにおかしいものを弾くため。
 *
 * 音量で見るもの:
 *   段差   折り返しの前後 0.5 秒の音量差。大きいと「消えて鳴り出す」
 *   へこみ 折り返しをまたぐ1秒が、その前後より落ち込んでいないか。
 *          クロスフェードが深すぎると、ここに穴があく
 *   跳ね   波形が不連続に飛んでいないか。大きいとプチッと鳴る
 *
 * 中身で見るもの(音量が揃っていても繋ぎ目に聞こえる原因はこちら):
 *   和音   折り返しの前後で、鳴っている音の高さの分布(クロマ)がどれだけ変わるか
 *   音色   同じくスペクトルがどれだけ変わるか
 *
 * 和音と音色は「その曲の中にある全部の変わり目」と比べた上位何%かで出す。
 * ただしこれは目安にしかならない。クロスフェードで繋いだ継ぎ目は、
 * 離れた2か所を重ねているので、隣り合う窓より変化が大きくて当たり前で、
 * 80〜95%はその署名にすぎない。
 *
 * 直すかどうかを決められるのは、その下に出る**折り返しでの和音の一致**のほう。
 * 曲の終わりと頭がどれだけ同じ和音かを 0〜1 で出し、assets/audio/原曲/ に
 * 配布ファイルがあれば「もっと合う位置」も探して並べる。
 * 差が大きければ、その秒数を tools/bgm-list.mjs の end に書いて作り直せばよい。
 * 古の碑石はこれで 0.84 → 0.97 になった。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { TRACKS } from "../src/audio/tracks.js";
import { PIECES } from "./bgm-list.mjs";
import {
  N,
  RATE,
  analyse,
  averageChroma,
  decimate,
  distance,
  frameAt,
} from "./spectrum.mjs";
import { db, readWav, trimSilence, writeWav } from "./wav.mjs";

const SRC = "assets/audio";
const ORIG = "assets/audio/原曲";
const OUT = ".bgm-seam";
/** 折り返しの前後、それぞれ何秒を切り出すか */
const SPAN = 4;
/** 一致がこれだけ良くなるなら、折り返し位置を変える値打ちがある */
const WORTH = 0.05;
/** 折り返し位置を探すとき、頭と突き合わせる長さ(秒) */
const MATCH = 3;

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

/** m4a を読んで、左右を混ぜた1本にする */
function loadMono(file, tmp) {
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@44100", "-c", "2", file, tmp]);
  const { ch, rate } = readWav(tmp);
  const mono = new Float32Array(ch[0].length);
  for (let i = 0; i < mono.length; i++) {
    let s = 0;
    for (const c of ch) s += c[i];
    mono[i] = s / ch.length;
  }
  return { ch, mono, rate };
}

/** 値が、並びの中で下から何%の位置にあるか */
function percentile(values, value) {
  let below = 0;
  for (const v of values) if (v < value) below++;
  return (below / values.length) * 100;
}

/**
 * 折り返しの前後の変わりかたが、その曲のふつうの変わり目と比べてどうか。
 * chroma と spectrum のそれぞれについて、上位何%かを返す。
 */
function contentJump(mono) {
  const x = decimate(mono);
  if (x.length < N * 4) return null;

  // 継ぎ目は「曲の終わりの1窓」→「曲の頭の1窓」そのもの。
  // またぐ窓どうしを比べると、どちらにも継ぎ目が入ってしまって前後にならない
  const before = frameAt(x, x.length - N);
  const after = frameAt(x, 0);
  const seamChroma = distance(after.chroma, before.chroma);
  const seamMag = distance(after.mag, before.mag);

  // ふつうの変わり目も、同じ条件(重ならない隣り合う窓)で数える
  const whole = analyse(x, N);
  if (whole.chromas.length < 4) return null;
  const normalChroma = [];
  const normalMag = [];
  for (let i = 1; i < whole.chromas.length; i++) {
    normalChroma.push(distance(whole.chromas[i], whole.chromas[i - 1]));
    normalMag.push(distance(whole.mags[i], whole.mags[i - 1]));
  }

  return {
    chroma: percentile(normalChroma, seamChroma),
    timbre: percentile(normalMag, seamMag),
  };
}

/**
 * 配布ファイルを、prepare-bgm と同じ形(前後の無音を落とす)まで整えて開く。
 */
function loadOriginal(piece, tmpDir) {
  const src = path.join(ORIG, piece.src);
  if (!fs.existsSync(src)) return null;
  const tmp = path.join(tmpDir, "orig.wav");
  const { ch, rate } = loadMono(src, tmp);
  const trimmed = trimSilence(ch, rate);
  const mono = new Float32Array(trimmed[0].length);
  for (let i = 0; i < mono.length; i++) {
    let s = 0;
    for (const c of trimmed) s += c[i];
    mono[i] = s / trimmed.length;
  }
  fs.rmSync(tmp, { force: true });
  return decimate(mono);
}

/**
 * その位置で折り返したときの、頭との和音の一致(0〜1)。
 *
 * 折り返しの直前 MATCH 秒と、曲の頭 MATCH 秒のクロマを突き合わせる。
 * 「そこで頭へ戻ったら、同じ和音のまま続くか」を見ている。
 */
function matchAt(x, head, endSec) {
  const to = Math.floor(endSec * RATE);
  const from = to - Math.floor(RATE * MATCH);
  if (from < 0 || to > x.length) return null;
  return 1 - distance(averageChroma(x.subarray(from, to)), head);
}

/**
 * 頭といちばん合う折り返し位置。終わりの4割の中から探す。
 *
 * 和音の一致がほぼ並ぶ候補が複数あるときは、音量の揃うほうを取る。
 * 和音が合っていても音量が段違いだと、そこで「持ち上がった」ように聞こえる。
 */
function findLoopPoint(x, head, headRms) {
  const dur = x.length / RATE;
  const found = [];
  for (let end = dur * 0.6; end < dur; end += 0.25) {
    const to = Math.floor(end * RATE);
    const seg = x.subarray(to - Math.floor(RATE * MATCH), to);
    if (seg.length < RATE) continue;
    let sum = 0;
    for (const v of seg) sum += v * v;
    const level = Math.abs(db(Math.sqrt(sum / seg.length)) - db(headRms));
    // 音量が離れすぎているところは、和音が合っていても繋がらない
    if (level > 4) continue;
    const sim = matchAt(x, head, end);
    if (sim != null) found.push({ sim, end, level });
  }
  if (found.length === 0) return null;
  const top = Math.max(...found.map((f) => f.sim));
  // 一致が横一線(0.01以内)の中から、音量のいちばん揃うものを選ぶ
  return found
    .filter((f) => f.sim >= top - 0.01)
    .sort((a, b) => a.level - b.level)[0];
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const head = ["曲", "段差", "へこみ", "跳ね", "和音", "音色"];
console.log(
  `${head[0].padEnd(10)}${head[1].padStart(7)}${head[2].padStart(8)}${head[3].padStart(8)}${head[4].padStart(7)}${head[5].padStart(7)}`,
);

const rows = [];
for (const [id, track] of Object.entries(TRACKS)) {
  if (!track.loop) continue;
  const src = path.join(SRC, track.file);
  if (!fs.existsSync(src)) continue;
  const wav = path.join(OUT, `${id}.wav`);
  const { ch, mono, rate } = loadMono(src, wav);
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
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "96000", wav, path.join(OUT, `継ぎ目-${id}.m4a`)]);
  fs.rmSync(wav);

  const half = Math.floor(rate * 0.5);
  const step = Math.abs(db(rms(ch, n - half, half)) - db(rms(ch, 0, half)));

  const sec = rate;
  const across = db(
    Math.sqrt((rms(ch, n - sec / 2, sec / 2) ** 2 + rms(ch, 0, sec / 2) ** 2) / 2),
  );
  const dip =
    db(Math.sqrt((rms(ch, n - sec * 2, sec) ** 2 + rms(ch, sec, sec) ** 2) / 2)) -
    across;

  let jump = 0;
  let typical = 0;
  for (let c = 0; c < ch.length; c++) {
    jump += Math.abs(ch[c][0] - ch[c][n - 1]);
    let d = 0;
    for (let i = 1; i < ch[c].length; i++) d += Math.abs(ch[c][i] - ch[c][i - 1]);
    typical += d / (ch[c].length - 1);
  }
  const jumpRatio = typical > 0 ? jump / typical : 0;

  const content = contentJump(mono);
  const ch1 = content ? `${content.chroma.toFixed(0)}%` : "-";
  const ch2 = content ? `${content.timbre.toFixed(0)}%` : "-";

  console.log(
    `${id.padEnd(10)}${step.toFixed(1).padStart(5)}dB${dip.toFixed(1).padStart(6)}dB${jumpRatio.toFixed(1).padStart(6)}倍${ch1.padStart(7)}${ch2.padStart(7)}`,
  );
  rows.push({ id });
}

console.log(`\n${OUT}/ に試聴用の音を書き出しました。真ん中が折り返しです。`);

if (!fs.existsSync(ORIG)) {
  console.log(
    `\n${ORIG}/ に配布ファイルを置くと、折り返し位置が適当かどうかも見ます。`,
  );
  console.log(`出どころは tools/bgm-list.mjs の表にあります。`);
} else {
  console.log(
    `\n折り返しでの和音の一致(曲の頭と、折り返す直前の3秒。1に近いほど繋がる):`,
  );
  let advised = false;
  for (const { id } of rows) {
    const piece = PIECES.find((p) => p.out === TRACKS[id].file);
    if (!piece) continue;
    const x = loadOriginal(piece, OUT);
    if (!x) {
      console.log(`  ${id.padEnd(9)} 原曲が無いので測れません (${piece.src})`);
      continue;
    }
    const headSeg = x.subarray(0, Math.floor(RATE * MATCH));
    const head = averageChroma(headSeg);
    let sum = 0;
    for (const v of headSeg) sum += v * v;
    const headRms = Math.sqrt(sum / headSeg.length);

    // いまの折り返し位置。end を書いていなければ、終わり際で折り返している
    const nowEnd = piece.end != null ? piece.end : x.length / RATE - 0.5;
    const now = matchAt(x, head, nowEnd);
    const best = findLoopPoint(x, head, headRms);
    if (now == null || !best) continue;

    const gain = best.sim - now;
    const line = `  ${id.padEnd(9)} いま ${nowEnd.toFixed(1)}秒 ${now.toFixed(3)}`;
    if (gain >= WORTH) {
      console.log(
        `${line}  ★ ${best.end.toFixed(1)}秒なら ${best.sim.toFixed(3)} (音量差 ${best.level.toFixed(1)}dB)`,
      );
      advised = true;
    } else if (best.sim <= now) {
      console.log(`${line}  (これ以上に合う位置は無い)`);
    } else {
      console.log(
        `${line}  (いちばん良くて ${best.sim.toFixed(3)}。変える値打ちはない)`,
      );
    }
  }
  if (advised)
    console.log(
      `\n★ の秒数を tools/bgm-list.mjs の end に書いて、` +
        `node tools/prepare-bgm.mjs を走らせ直してください。\n` +
        `曲は短くなります。繰り返し聞こえる継ぎ目と、どちらを取るかで決めてください。`,
    );
}
