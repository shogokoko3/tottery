/**
 * 持ち点。
 *
 * 数えるのは **9×9のオンライン対戦だけ**。5×5は5枚で決まる短期戦で運の
 * 割合が大きく、CPU戦とチュートリアルは相手の強さが決まらない。
 *
 * ■ 足し引きではなく、功績値から導く
 *
 * 1局ごとに持ち点を直接足し引きすると、勝ち負けが偶然に偏っただけで
 * 大きく上下する。実力が互角の人どうしでも 135点ぶん開いていた(実測)。
 * ここでは裏に「功績値」を貯め、見える持ち点はそこから**曲線で**導く。
 * 功績値が増えるほど1局あたりの伸びが鈍るので、遊ぶほど落ち着く。
 *
 *   持ち点 = 1500 + 個人分 + 全体分
 *     個人分 = 30 × √功績値
 *     全体分 = 40 × ln(1 + 全体の総対局数 ÷ 50)
 *
 * ■ 全体の総対局数で、みんなが少しずつ上がる
 *
 * 遊ばれるほど全員の持ち点が上がる。対数なので暴走しない
 * (100局で+44、1万局で+216、10万局で+304)。
 *
 * ■ 功績値の貯まり方
 *
 *   積み上げ  勝ち +4 / 引き分け +1.5 / 負け 0
 *             相手が「世界の平均」より強いほど重い(±300に丸め、0.8〜1.2倍)
 *   下支え    対局数 × 1.0（勝てなくても、遊べば少しは上がる）
 *   功績値 = 積み上げ と 下支え の大きいほう
 *
 * 重みを「自分との差」で測ってはいけない。持ち点が上がるほど重みが下がり、
 * 全員が同じ値に吸い寄せられて実力の差が消える(実測で確かめた)。
 */

/** 始めの持ち点 */
export const START_RATING = 1500;

/** ここより下がらない */
export const MIN_RATING = 100;

/** 個人分の大きさ */
const SELF = 30;
/** 全体分の大きさと、効きはじめの早さ */
const WORLD = 40;
const WORLD_SOFT = 50;
/** 勝てなくても遊べば貯まる下支え(1局あたり) */
const FLOOR = 1.0;
/** 相手の強さの重みの、効き方と上限 */
const SLOPE = 1600;
const CLAMP = 300;
/** 1局で貯まる点 */
const WIN = 4;
const DRAW = 1.5;
const LOSS = 0;

/** 全体の総対局数から、みんなに乗る分 */
export function worldPart(worldGames) {
  const g = Number.isFinite(worldGames) ? Math.max(0, worldGames) : 0;
  return WORLD * Math.log(1 + g / WORLD_SOFT);
}

/** その時点の「世界の平均」。相手の強さはここと比べる */
export function worldAverage(worldGames) {
  return START_RATING + worldPart(worldGames);
}

/** 功績値と全体の対局数から、見える持ち点を出す */
export function displayRating(score, worldGames) {
  const s = Number.isFinite(score) ? Math.max(0, score) : 0;
  return Math.max(
    MIN_RATING,
    Math.round(START_RATING + SELF * Math.sqrt(s) + worldPart(worldGames)),
  );
}

/** 見える持ち点から功績値へ戻す。古い保存を引き継ぐときに使う */
export function scoreFromRating(rating, worldGames) {
  const base = START_RATING + worldPart(worldGames);
  const personal = Math.max(0, (Number(rating) || START_RATING) - base);
  return Math.pow(personal / SELF, 2);
}

/**
 * 1局ぶん貯まる功績値。
 * won は true が勝ち、false が負け、null が引き分け。
 */
export function scoreGain(foeRating, won, worldGames) {
  const base = won === null ? DRAW : won ? WIN : LOSS;
  if (base === 0) return 0;
  const avg = worldAverage(worldGames);
  const foe = Number.isFinite(foeRating) ? foeRating : avg;
  const diff = Math.max(-CLAMP, Math.min(CLAMP, foe - avg));
  return base * (1 + diff / SLOPE);
}

/**
 * 1局終えたあとの功績値。
 * earned は積み上げた点、rated はそれまでの対局数。
 */
export function nextScore(earned, rated, foeRating, won, worldGames) {
  const nextEarned =
    (Number(earned) || 0) + scoreGain(foeRating, won, worldGames);
  const nextRated = (Number(rated) || 0) + 1;
  return {
    earned: nextEarned,
    rated: nextRated,
    // 勝てなくても、遊べば少しは上がる
    score: Math.max(nextRated * FLOOR, nextEarned),
  };
}

/**
 * 段位のような呼び名。
 *
 * **持ち点そのものからは出さない。** 持ち点は遊ぶほど伸びる作りなので、
 * そこから段位を出すと「たくさん遊んだ人」が上位になる。
 * ここでは「1局あたりどれだけ積み上げたか」で決める。遊んだ量では動かず、
 * 勝ち越しているかどうかだけで決まる。
 *
 *   1局あたり 4.0 … 全勝に近い
 *              2.0 … 勝率5割
 *              1.0 … 下支えだけ(ほとんど勝てていない)
 */
export function rankTitle(rating, rated, worldGames) {
  const n = Number(rated) || 0;
  if (n < 1) return "見習い";
  const per = scoreFromRating(rating, worldGames) / n;
  // 数局の勝ち運で上の段位に届かないよう、局数の下限を置く
  if (per >= 3.2 && n >= 50) return "王";
  if (per >= 2.6 && n >= 20) return "将";
  if (per >= 2.2 && n >= 10) return "士";
  if (per >= 1.6) return "兵";
  return "見習い";
}
