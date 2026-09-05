/**
 * レーティング。
 *
 * 仕組みは Elo。勝ちは1点、負けは0点、引き分けは0.5点として更新する。
 * 強い相手に勝つほど大きく上がり、弱い相手に負けるほど大きく下がる。
 *
 * 数えるのはオンライン対戦だけ。CPU戦とチュートリアルは相手の強さが
 * 決まっていないので、勝っても負けても動かさない。
 */

/** 始めの持ち点 */
export const START_RATING = 1500;

/** ここより下がらない */
export const MIN_RATING = 100;

/** 何局までを「まだ実力が分からない」とみなすか */
export const PROVISIONAL_GAMES = 10;

/** 1局で動く幅。慣れるまでは大きく動かして、早く実力の位置に寄せる */
export function kFactor(ratedGames) {
  return ratedGames < PROVISIONAL_GAMES ? 40 : 20;
}

/** 自分が勝つと見込まれる割合。持ち点の差だけで決まる */
export function expectedScore(mine, theirs) {
  return 1 / (1 + Math.pow(10, (theirs - mine) / 400));
}

/**
 * 1局ぶんの増減。
 * won は true が勝ち、false が負け、null が引き分け。
 * ratedGames はそれまでに数えた対局数。
 */
export function ratingDelta(mine, theirs, won, ratedGames) {
  const k = kFactor(ratedGames);
  const draw = won === null;
  const score = draw ? 0.5 : won ? 1 : 0;
  const gained = Math.round(k * (score - expectedScore(mine, theirs)));
  // 同格との引き分けは動かさない。丸めで生じる-0も0にそろえる。
  if (draw) return gained || 0;
  // 差がつきすぎて増減が0になると、勝っても何も起きない。1は動かす
  if (gained === 0) return won ? 1 : -1;
  return gained;
}

/** 増減を足したあとの持ち点 */
export function applyRating(mine, theirs, won, ratedGames) {
  const next = mine + ratingDelta(mine, theirs, won, ratedGames);
  return Math.max(MIN_RATING, next);
}

/** 持ち点から段位のような呼び名を出す。ランキングの見出しに使う */
export function rankTitle(rating) {
  if (rating >= 2000) return "王";
  if (rating >= 1800) return "将";
  if (rating >= 1600) return "士";
  if (rating >= 1400) return "兵";
  return "見習い";
}
