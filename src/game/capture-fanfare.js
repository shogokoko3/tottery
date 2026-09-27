/**
 * まとめて取ったときの音階(2026-09-28 本人の指示
 * 「A などで複数枚取ったら、音階を付けて複数枚取った演出をつける」)。
 *
 * 撃破札は1枚ずつめくれる。そのめくりに合わせて撃破音を鳴らし、**枚数が増えるほど
 * 音を上げていく**。上がっていくので「まだ続く」と分かり、最後の1枚で一番高くなる。
 *
 * 音は se-capture.m4a 1つを、再生速度(playbackRate)で上げ下げして作る。
 * 音源を足さずに済み、鳴らない端末でも対局は同じに進む。
 *
 * 音階は**長調の主和音まわり**(ド・ミ・ソ・ド…)にする。半音階だと不穏に聞こえ、
 * 「取れて嬉しい」場面に合わない。playbackRate は 2^(半音/12)。
 */

/**
 * 上がっていく音の半音の並び。**+12(1オクターブ上)で止める** —
 * player.js が再生速度を 0.5〜2 に丸めるので、それ以上は全部同じ音になり、
 * 「上がっていく」が伝わらなくなる。低めから始めて、最後の1枚で一番高くする
 */
export const STEPS = Object.freeze([-5, -1, 2, 5, 7, 10, 12]);

/**
 * 王をめくったときの音。**低く重くする**(上ではなく下へ外す)。
 * 上へ伸ばすと、まとめ取りの最後の1枚と同じ音になって区別が付かない。
 * 大きいことが起きたときは、軽い高音より重い低音のほうが合う
 */
export const KING_STEP = -7;

/** 半音から再生速度へ。player.js が 0.5〜2 に丸めるので、その中に収める */
export const rateOfStep = (semitones) =>
  Math.max(0.5, Math.min(2, 2 ** (semitones / 12)));

/**
 * i 枚目(0 始まり)をめくるときの再生速度。
 *   total … 何枚取ったか。1枚だけなら音は変えない(いつもの撃破音)
 *   king  … その1枚が王か
 */
export function captureRate({ index = 0, total = 1, king = false } = {}) {
  if (king) return rateOfStep(KING_STEP);
  if (total <= 1) return 1;
  return rateOfStep(STEPS[Math.min(index, STEPS.length - 1)]);
}

/**
 * まとめ取りの見せ方。枚数が増えるほど派手にする。
 *   1枚      … いつも通り
 *   2〜3枚   … 「まとめ取り」
 *   4枚以上  … 「大量まとめ取り」
 * 画面(CaptureRevealModal)はこの段をクラス名に使う
 */
export function fanfareTier(count) {
  const n = Number(count) || 0;
  return n >= 4 ? "grand" : n >= 2 ? "multi" : "single";
}

/** めくる間隔(ミリ秒)。枚数が多いほど詰めて、長く待たせない */
export function flipDelay({ index = 0, total = 1 } = {}) {
  if (index === 0) return 450;
  return total >= 6 ? 240 : total >= 4 ? 320 : 420;
}
