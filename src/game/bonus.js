/**
 * 布陣ボーナス。
 *
 * 盤に並べた札の組み合わせで、対局が始まる前に一度だけ効果が起きる。
 *
 *   ストレート … 先手と後手が入れ替わる
 *   フラッシュ … 相手の王以外の駒が公開される(5×5は1枚、9×9は3枚)
 *
 * 判定は盤に出した札すべて(5×5なら5枚、9×9なら9枚)で行う。
 */
import { RANKS } from "./constants.js";

/** A=1 … K=13 */
function value(rank) {
  return RANKS.indexOf(rank) + 1;
}

function isRun(values) {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  if (sorted.length !== values.length) return false;
  return sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
}

/**
 * 数字が途切れずに並んでいるか。
 * Aは一番弱い札だが、K の上に置く数え方(10-J-Q-K-A)も認める。
 */
export function isStraight(cards) {
  if (!cards || cards.length < 3) return false;
  const values = cards.map((c) => value(c.rank));
  if (isRun(values)) return true;
  if (!values.includes(1)) return false;
  return isRun(values.map((v) => (v === 1 ? 14 : v)));
}

/** すべて同じマークか */
export function isFlush(cards) {
  if (!cards || cards.length < 3) return false;
  return cards.every((c) => c.suit === cards[0].suit);
}

/** フラッシュで公開される枚数 */
export function revealCount(size) {
  return size >= 9 ? 3 : 1;
}

/** 文字列から数を作る。同じ文字列からは必ず同じ数が出る */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 公開する駒を選ぶ。
 *
 * 乱数を使わず、両者の布陣から決める。オンラインでは同じアクション列を
 * 両者が再生するので、ここで乱数を引くと画面がずれてしまう。相手の布陣は
 * 伏せられているから、どの駒が選ばれるかは誰にも読めない。
 */
export function pickRevealed(ids, count, seedText) {
  const rest = [...ids].sort();
  const out = [];
  let h = hash(seedText);
  while (out.length < count && rest.length) {
    h = hash(`${h}:${out.length}`);
    out.push(rest.splice(h % rest.length, 1)[0]);
  }
  return out;
}
