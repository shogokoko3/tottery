/**
 * アカウントの称号。名前の横に添える飾り。
 *
 * 対戦相手にも渡して、マッチしたときに名前と一緒に見せる。
 * 手に入れ方は2通り:
 *   - 対局数・勝数・持ち点から自動で決まるもの(unlocked で判定)
 *   - あとから配るもの(profile.titles に id を持たせる)
 * 一覧はここのデータだけ書き足せば増える。free: true は最初から使える。
 *
 * 相手が新しい版で、こちらの知らない称号を持っていることがある。
 * そのときは何も出さない(findTitle が null を返す)。
 */
export const TITLES = [
  { id: "novice", name: "見習い", how: "最初から", free: true },
  { id: "first", name: "初陣", how: "1局遊ぶ", unlocked: (p) => p.plays >= 1 },
  {
    id: "ten",
    name: "十戦の兵",
    how: "10局遊ぶ",
    unlocked: (p) => p.plays >= 10,
  },
  {
    id: "fifty",
    name: "五十戦の将",
    how: "50局遊ぶ",
    unlocked: (p) => p.plays >= 50,
  },
  {
    id: "win10",
    name: "十勝の勇",
    how: "10勝する",
    unlocked: (p) => p.wins >= 10,
  },
  {
    id: "win30",
    name: "三十勝の猛者",
    how: "30勝する",
    unlocked: (p) => p.wins >= 30,
  },
  {
    id: "rated",
    name: "腕試し",
    how: "オンラインで1局遊ぶ",
    unlocked: (p) => p.rated >= 1,
  },
  {
    id: "rank-shi",
    name: "士の位",
    how: "持ち点 1600",
    unlocked: (p) => p.rating >= 1600,
  },
  {
    id: "rank-sho",
    name: "将の位",
    how: "持ち点 1800",
    unlocked: (p) => p.rating >= 1800,
  },
  {
    id: "rank-o",
    name: "王の位",
    how: "持ち点 2000",
    unlocked: (p) => p.rating >= 2000,
  },
];

/** 既定の称号 */
export const DEFAULT_TITLE = "novice";

/** id から称号を引く。知らない id なら null */
export function findTitle(id) {
  return TITLES.find((t) => t.id === id) || null;
}

/** その人が使える称号か */
export function hasTitle(profile, id) {
  const t = findTitle(id);
  if (!t) return false;
  if (t.free) return true;
  if (t.unlocked && t.unlocked(profile)) return true;
  const granted = (profile && profile.titles) || [];
  return granted.includes(id);
}

/** いま使える称号の一覧 */
export function ownedTitles(profile) {
  return TITLES.filter((t) => hasTitle(profile, t.id));
}

/**
 * 実際に出す称号。
 * 使えないものが設定されていたら、既定に戻す。
 */
export function titleOf(profile) {
  const id = (profile && profile.title) || DEFAULT_TITLE;
  return hasTitle(profile, id) ? findTitle(id) : findTitle(DEFAULT_TITLE);
}

/** 相手から受け取った id を、画面に出す名前へ。知らなければ null */
export function titleNameOf(id) {
  const t = id ? findTitle(id) : null;
  return t ? t.name : null;
}

/** before から after で新しく使えるようになった称号 */
export function newlyEarned(before, after) {
  const had = new Set(ownedTitles(before).map((t) => t.id));
  return ownedTitles(after).filter((t) => !had.has(t.id));
}
