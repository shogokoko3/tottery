/**
 * 動いた伏せ札が「どの数字でありうるか」を、**見えているものだけ**から絞る
 * (2026-09-28 本人の指示「正体が判明していない動いた駒に対して、
 *  どの駒である可能性があるかをメモに表示させる」)。
 *
 * 入れてよいのは、相手にも見えている情報だけ:
 *   - 行動記録に残った「どのマスからどのマスへ動いたか」(sanitizeHistory を通したもの)
 *   - 盤の大きさ
 * **駒の rank・isKing は読まない。** 読むと、相手の伏せ札を覗いたことになる。
 *
 * 絞り方は「動き方の形」だけを見る。通り道がふさがっていたかは見ない —
 * ふさがりは可能性を**減らす**方向にしか働かないので、見ないほうが安全側
 * (ありえる数字を間違って消さない)。同じ理由で、王だったときに伸びる分や
 * 4・5 が同じ数字の枚数で伸びる分は、**いちばん伸びた場合**で見る。
 *
 * 海の引き寄せで動かされた手は、その駒の動き方ではないので数えない。
 */
import { KING_RANGE_PER_CARD } from "./board.js";
import { RANKS } from "./constants.js";

/** 4 枚まで採用できるので、伸びしろの最大はこれ */
const MAX_ADOPT = 4;
const MAX_BONUS = KING_RANGE_PER_CARD * MAX_ADOPT;

/** 行動記録の1行からマスを取り出す。「c2→c3 ➡︎ へ移動」の形 */
export function parseMoveLine(line, size) {
  if (typeof line !== "string" || !line.includes("へ移動")) return null;
  // 海の引き寄せは、その駒の動き方ではない(押し流されただけ)
  if (line.includes("引き寄せ")) return null;
  const m = line.match(/([a-z])(\d+)→([a-z])(\d+)/);
  if (!m) return null;
  const at = (fileCh, rankNum) => {
    const col = fileCh.charCodeAt(0) - 97;
    const row = size - Number(rankNum);
    return Number.isInteger(row) && row >= 0 && row < size && col >= 0 && col < size
      ? { row, col }
      : null;
  };
  const from = at(m[1], m[2]);
  const to = at(m[3], m[4]);
  return from && to ? { from, to } : null;
}

/** 見せてよい行動記録から、動きの並びを作る */
export function movesFromHistory(lines, size) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => parseMoveLine(line, size))
    .filter(Boolean);
}

const isOrth = (dr, dc) => (dr === 0) !== (dc === 0);
const isDiag = (dr, dc) => dr !== 0 && Math.abs(dr) === Math.abs(dc);
const isKnight = (dr, dc) => {
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  return (ar === 1 && ac === 2) || (ar === 2 && ac === 1);
};
const dist = (dr, dc) => Math.max(Math.abs(dr), Math.abs(dc));

/**
 * その数字で、この動きがありうるか。
 * どれも「いちばん広く見た場合」で判断する(ありえる数字を消しすぎない)
 */
export function rankCouldMove(rank, dr, dc, { asKing = true, powers = true } = {}) {
  // powers … その対局に王の力があるか(フェーズ1「駒の動きだけ」では無い)。
  //           無ければ、王でも仲間でも一切伸びず、J/Q の+1マスも無い
  const king = asKing && powers;
  if (!dr && !dc) return false;
  const d = dist(dr, dc);
  switch (rank) {
    // A は動かない
    case "A":
      return false;
    // 2・3 は1マス。**王のときだけ**同じ数字の枚数ぶん伸びる
    case "2":
      return isOrth(dr, dc) && d <= (king ? 1 + MAX_BONUS : 1);
    case "3":
      return isDiag(dr, dc) && d <= (king ? 1 + MAX_BONUS : 1);
    // 4・5 は2マス。王が同じ数字なら伸びる
    case "4":
      return isOrth(dr, dc) && d <= (powers ? 2 + MAX_BONUS : 2);
    case "5":
      return isDiag(dr, dc) && d <= (powers ? 2 + MAX_BONUS : 2);
    // 6〜9 は偶数マス・奇数マスだけ。王でも届く距離は変わらない
    case "6":
      return isOrth(dr, dc) && d % 2 === 0;
    case "7":
      return isDiag(dr, dc) && d % 2 === 0;
    case "8":
      return isOrth(dr, dc) && d % 2 === 1;
    case "9":
      return isDiag(dr, dc) && d % 2 === 1;
    // 10 は跳ぶ
    case "10":
      return isKnight(dr, dc);
    // J は縦横に果てまで。**王のときだけ**斜め1マスも
    case "J":
      return isOrth(dr, dc) || (king && isDiag(dr, dc) && d === 1);
    // Q は斜めに果てまで。**王のときだけ**縦横1マスも
    case "Q":
      return isDiag(dr, dc) || (king && isOrth(dr, dc) && d === 1);
    // K は全部できる
    case "K":
      return isOrth(dr, dc) || isDiag(dr, dc) || isKnight(dr, dc);
    default:
      return false;
  }
}

/**
 * 見えた動きの並びから、ありうる数字を返す。
 * 動きが1つも無ければ、絞れないので**全部**を返す
 */
export function rankCandidates(moves, { pool = RANKS, asKing = true, powers = true } = {}) {
  const list = Array.isArray(moves) ? moves : [];
  return pool.filter((rank) =>
    list.every(({ from, to }) =>
      rankCouldMove(rank, to.row - from.row, to.col - from.col, { asKing, powers }),
    ),
  );
}

/**
 * 画面に出すためのまとめ。
 *   lines … sanitizeHistory を通した行動記録(相手に見せてよいもの)
 *   size  … 盤の大きさ
 *   pool  … その対局で使っている数字(レベル制限で絞られることがある)
 */
export function candidatesFromHistory(lines, size, { pool = RANKS, powers = true } = {}) {
  const moves = movesFromHistory(lines, size);
  // 王の力なし(フェーズ1)の対局では、王でも仲間でも一切伸びないので、その前提で絞る
  const plain = rankCandidates(moves, { pool, asKing: false, powers });
  const ranks = powers ? rankCandidates(moves, { pool }) : plain;
  // 王でなくてもできる動きか。**王のときだけできる動きなら、その駒は王**。
  // J の斜め・Q の縦横・2/3 の長い動きがそれ。相手の王を読む手がかりになる
  const kingOnly = ranks.filter((r) => !plain.includes(r));
  return {
    moves: moves.length,
    ranks,
    // その数字なら、この駒は王だと分かる
    kingOnly,
    // 残った数字がどれも「王のときだけ」なら、**この駒は王**
    mustBeKing: ranks.length > 0 && kingOnly.length === ranks.length,
    // 1つに絞れた
    certain: moves.length > 0 && ranks.length === 1,
    // まだ一度も動いていない
    unmoved: moves.length === 0,
    excluded: pool.filter((r) => !ranks.includes(r)),
  };
}
