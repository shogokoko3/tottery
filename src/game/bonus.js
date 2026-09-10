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
import { territoryRows } from "./board.js";

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

/* ---------------------------- 隅の要塞 ---------------------------- */

/**
 * 隅の要塞。9×9で、自陣の隅の 3×3 を自分の9体で埋め、王をいちばん奥の隅に
 * 置いた布陣。効果は無く、組んだ本人にだけ演出と称号「要塞の主」を出す
 * (相手に知らせると王の位置が漏れるので、state にも記録にも載せない)。
 *
 * 組んだ隅の左端の列(0 か size-3)を返す。要塞でなければ null。
 */
export function fortressCorner(pieces, size, player) {
  if (size < 9) return null;
  const mine = Object.values(pieces || {}).filter(
    (p) => p.owner === player && p.alive,
  );
  if (mine.length !== 9) return null;
  const [lo, hi] = territoryRows(size, player);
  const back = player === 0 ? hi : lo;
  const king = mine.find((p) => p.isKing);
  if (!king) return null;
  for (const col0 of [0, size - 3]) {
    const inBlock = mine.every(
      (p) => p.row >= lo && p.row <= hi && p.col >= col0 && p.col < col0 + 3,
    );
    if (!inBlock) continue;
    const cornerCol = col0 === 0 ? 0 : size - 1;
    return king.row === back && king.col === cornerCol ? col0 : null;
  }
  return null;
}

export function isFortress(pieces, size, player) {
  return fortressCorner(pieces, size, player) !== null;
}

/* ---------------------------- 双翼の陣 ---------------------------- */

/**
 * 双翼の陣。空のエリア(10 の王にフォイル)で、10・10・J・J・Q・Q・4・2・8 を
 * 決まった形に組んだ布陣。実測(reports/fortress-tactics)で空の最適解だった形。
 *
 *   前列  Q  J  J  Q
 *   中列  8  2  4  .  10
 *   後列  .  .  [10]         ← 王
 *
 * 左右対称(鏡写し)と横のずらしは同じ形と見なす。効果は無く、組んだ本人にだけ
 * 演出と称号「双翼の将」を出す(相手に知らせると王の位置が漏れる)。
 * cells は [前列からの深さ, 左端からの列, ランク, 王か]。
 */
export const TWIN_WINGS = Object.freeze({
  counts: { 10: 2, J: 2, Q: 2, 4: 1, 2: 1, 8: 1 },
  width: 5,
  cells: [
    [0, 0, "Q"],
    [0, 1, "J"],
    [0, 2, "J"],
    [0, 3, "Q"],
    [1, 0, "8"],
    [1, 1, "2"],
    [1, 2, "4"],
    [1, 4, "10"],
    [2, 2, "10", true],
  ],
});

/** 双翼の陣なら { mirror, dx } を、違えば null を返す */
export function twinWingsMatch(state, player) {
  const size = state?.boardSize;
  if (!size || size < 9) return null;
  if (state.areas?.[player]?.type !== "sky") return null;
  const mine = Object.values(state.pieces || {}).filter(
    (p) => p.owner === player && p.alive,
  );
  if (mine.length !== 9) return null;
  const counts = {};
  for (const p of mine) counts[p.rank] = (counts[p.rank] || 0) + 1;
  for (const [rank, n] of Object.entries(TWIN_WINGS.counts))
    if (counts[rank] !== n) return null;
  const [lo, hi] = territoryRows(size, player);
  const front = player === 0 ? lo : hi;
  const dir = player === 0 ? 1 : -1;
  for (const mirror of [false, true])
    for (let dx = 0; dx + TWIN_WINGS.width <= size; dx++) {
      const ok = TWIN_WINGS.cells.every(([depth, c, rank, king]) => {
        const col = mirror ? size - 1 - (c + dx) : c + dx;
        const row = front + depth * dir;
        const p = mine.find((q) => q.row === row && q.col === col);
        return !!p && p.rank === rank && !!p.isKing === !!king;
      });
      if (ok) return { mirror, dx };
    }
  return null;
}
