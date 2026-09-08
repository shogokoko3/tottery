/**
 * Elo レーティング。9×9のオンライン対戦で、対戦前の両者の点数から計算する。
 * 初期1500、K=32、期待勝率 = 1 / (1 + 10 ** ((相手 - 自分) / 400))。
 * 同格なら勝ち+16・負け-16。引き分けは結果0.5。全体の対戦数による加点はしない。
 * 参考: https://assets.pokemon.com/assets/cms/pdf/op/tournaments/2011/Pokemon_Ratings_and_Rankings_FAQ.pdf
 */
export const START_RATING = 1500;
export const MIN_RATING = 100;
export const MAX_RATING = 4000;
export const RATING_VERSION = 2;
export const ELO_K = 32;
const num = (value, fallback) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
export const normalizeRating = (value) =>
  Math.max(
    MIN_RATING,
    Math.min(MAX_RATING, Math.round(num(value, START_RATING))),
  );

export function expectedScore(rating, opponentRating) {
  return (
    1 /
    (1 +
      10 ** ((normalizeRating(opponentRating) - normalizeRating(rating)) / 400))
  );
}
export function nextRating(rating, opponentRating, won) {
  const before = normalizeRating(rating),
    opponent = normalizeRating(opponentRating);
  const expected = expectedScore(before, opponent);
  const score = won === null ? 0.5 : won ? 1 : 0;
  // 負のちょうど半分も対称に丸め、両者の増減を一致させる。
  const raw = ELO_K * (score - expected);
  const rounded = Math.sign(raw) * Math.round(Math.abs(raw));
  const delta = Math.max(
    MIN_RATING - before,
    opponent - MAX_RATING,
    Math.min(MAX_RATING - before, opponent - MIN_RATING, rounded),
  );
  return { rating: before + delta, delta: delta || 0, expected };
}

/** 古い表示呼び出しとの互換。全体加点は廃止。 */
export const worldPart = () => 0;
export const ratingWithWorld = (rating) => normalizeRating(rating);

/** 旧保存を初めて読み込む際だけ、共通加点を含まない旧点数を引き継ぐ。 */
export function displayRating(wr) {
  const w = Math.min(0.945, Math.max(0.055, num(wr, 0.5)));
  return normalizeRating(START_RATING + 400 * Math.log10(w / (1 - w)));
}
export function ratingFromProfile(saved) {
  return saved?.ratingVersion === RATING_VERSION
    ? normalizeRating(saved.rating)
    : displayRating(wrFromProfile(saved));
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

/** 判定・シーズン報酬・段位一覧で同じ到達条件を使う。 */
export const RANK_TIERS = [
  { name: "見習い", rating: 0 },
  { name: "兵", rating: 1450 },
  { name: "士", rating: 1550 },
  { name: "将", rating: 1650 },
  { name: "王", rating: 1750 },
];
export function rankTitle(rating) {
  const score = num(rating, START_RATING);
  for (let i = RANK_TIERS.length - 1; i > 0; i--) {
    const tier = RANK_TIERS[i];
    if (score >= tier.rating) return tier.name;
  }
  return RANK_TIERS[0].name;
}
