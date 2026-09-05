/**
 * 持ち点。
 *
 * 数えるのは **9×9のオンライン対戦だけ**。5×5は5枚で決まる短期戦で運の
 * 割合が大きく、CPU戦とチュートリアルは相手の強さが決まらない。
 *
 * ■ 足し引きしない
 *
 * 1局ごとに点をやりとりすると、勝ち負けが偶然に偏っただけで持ち点そのものが
 * さまよう。実力が互角の人どうしでも135点ぶん開き、遊ぶほど広がっていた(実測)。
 * ここでは「勝率の見積もり」だけを持ち、持ち点は毎回そこから作り直す。
 * 平均は局数が増えるほど誤差が縮むので、**遊ぶほど落ち着く**。
 *
 *   持ち点 = 実力分 + 全体分
 *     保存するのは実力分だけ。全体分は**見せるときに足す**。
 *     そうしないと、読み直すたびに全体分の古い値と食い違う
 *     実力分 = 400 × log10( w / (1-w) )
 *     全体分 = 40 × ln(1 + 全体の総対局数 ÷ 50)
 *
 *   w(勝率の見積もり)は1局ごとの移動平均:
 *     a = 1 / (min(対局数, 200) + 32)
 *     w = w + a × (結果 - w)        結果は 勝ち1 / 引分0.5 / 負け0
 *
 * ■ 相手の持ち点を読まない
 *
 * 審判役のサーバーが無いので、相手の持ち点は相手の言い値でしかない。
 * 以前は共謀(片方が4000と名乗ってわざと負ける)で20局に+391点も稼げた。
 * **この式には相手の値が一度も現れない。** 4000と名乗られても0と名乗られても
 * 1ミリも動かない(共謀20連勝＝正直な20連勝、利ざや0点で実測)。
 *
 * ■ 全体の総対局数で、みんなが少しずつ上がる
 *
 * 遊ばれるほど全員が上がる。対数なので暴走しない
 * (100局で+44、1万局で+212、10万局で+304)。
 *
 * ■ 書き換えに強い
 *
 * 保存の rating は毎回 w から引き直す。localStorage の rating だけを
 * 2500 に書き換えても、次に読んだ時点で元へ戻る。
 */

/** 始めの持ち点 */
export const START_RATING = 1500;

/** ここより下がらない */
export const MIN_RATING = 100;

/** 五分(0.5)を何局ぶんの重石として置くか。序盤の暴れを抑える */
const PRIOR = 32;
/** 記憶の長さ。ここで1局の重みが下げ止まる */
const WINDOW = 200;
/** 勝率100点ぶんの目盛り */
const SLOPE = 400;
/** 勝率の見積もりを丸める端。持ち点の天井と床を決める */
const EDGE = 0.055;
/** 全体分の大きさと、効きはじめの早さ */
const WORLD = 40;
const WORLD_SOFT = 50;

const num = (v, fallback) =>
  Number.isFinite(Number(v)) ? Number(v) : fallback;

/** 全体の総対局数から、みんなに乗る分 */
export function worldPart(worldGames) {
  return WORLD * Math.log(1 + Math.max(0, num(worldGames, 0)) / WORLD_SOFT);
}

/** 勝率の見積もりから、実力の分 */
export function skillPart(wr) {
  const w = Math.min(1 - EDGE, Math.max(EDGE, num(wr, 0.5)));
  return SLOPE * Math.log10(w / (1 - w));
}

/**
 * 実力の持ち点。保存するのはこれ。毎回 wr から作り直す。
 * 全体分は入っていない
 */
export function displayRating(wr) {
  return Math.max(MIN_RATING, Math.round(START_RATING + skillPart(wr)));
}

/**
 * 見せるときの持ち点。実力の持ち点に、全体の伸びを足す。
 *
 * 足すのは**見せるときだけ**。保存に混ぜると、読み直したときに
 * その時点の全体の対局数と食い違って値がずれる
 */
export function ratingWithWorld(rating, worldGames) {
  return Math.max(
    MIN_RATING,
    Math.round(
      (Number.isFinite(rating) ? rating : START_RATING) + worldPart(worldGames),
    ),
  );
}

/** その1局の重み。遊ぶほど小さくなる */
export function weightOf(rated) {
  return 1 / (Math.min(Math.max(0, num(rated, 0)), WINDOW) + PRIOR);
}

/**
 * 1局終えたあとの勝率の見積もり。
 * won は true が勝ち、false が負け、null が引き分け。
 * **相手の持ち点は受け取らない。**
 */
export function nextRating(wr, rated, won) {
  const score = won === null ? 0.5 : won ? 1 : 0;
  const before = Math.min(1, Math.max(0, num(wr, 0.5)));
  const n = Math.max(0, Math.round(num(rated, 0)));
  const after = before + weightOf(n) * (score - before);
  return {
    // 保存と読み直しで値がぶれないよう、ここで丸める
    wr: Math.round(after * 1e6) / 1e6,
    rated: n + 1,
  };
}

/**
 * 古い保存から勝率の見積もりを作る。
 *
 * 持ち点の作りを入れ替えたので、前の持ち点からは実力を復元できない
 * (前のものは遊んだ量で伸びる作りだった)。勝率が分かるならそれを使い、
 * 分からなければ五分から始め直す。
 */
export function wrFromProfile(saved) {
  if (!saved || typeof saved !== "object") return 0.5;
  if (Number.isFinite(Number(saved.wr)))
    return Math.min(1, Math.max(0, Number(saved.wr)));
  const rated = num(saved.rated, 0);
  const wins = num(saved.ratedWins, NaN);
  const draws = num(saved.ratedDraws, 0);
  if (rated > 0 && Number.isFinite(wins))
    return Math.min(1, Math.max(0, (wins + draws * 0.5) / rated));
  return 0.5;
}

/**
 * 段位のような呼び名。
 *
 * **全体分は入れない。** 全体分はみんなに等しく乗るので、入れると
 * 遊ばれた年数だけで段位が上がってしまう。実力の分だけで決める。
 * 数局の勝ち運で上がらないよう、局数の下限も置く。
 */
export function rankTitle(rating, rated) {
  const n = Math.max(0, num(rated, 0));
  if (n < 10) return "見習い";
  // 渡ってくるのは実力の持ち点(全体分は入っていない)
  const skill = num(rating, START_RATING);
  if (skill >= 1750 && n >= 50) return "王";
  if (skill >= 1650 && n >= 20) return "将";
  if (skill >= 1550) return "士";
  if (skill >= 1450) return "兵";
  return "見習い";
}
