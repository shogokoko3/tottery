import { seasonTitle } from "./season.js";
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
import { FOIL_MISSION_DEFS } from "./foil-missions.js";

// ガチャの結果で自動解放される称号(2026-09-21 本人の指示)。
// 各家系(family)は段階(tier)を持つ。一覧には3段目までを目標として掲載し、
// 4段目以降はシステムに組み込んでおいて、達成した時だけ姿を見せる(account.jsx が絞る)。
// 判定は profile.gacha(collection.gachaStatsOf の写し)。獲得した称号は
// recordGachaStats が profile.titles に焼き付けるので、表示・共有はそれだけで効く。
const GACHA_FAMILIES = [
  {
    family: "all-r",
    stat: "allR",
    what: "10連がすべてRになる",
    unit: "回目",
    tiers: [
      [1, "無風の召喚"],
      [5, "石ころ集め"],
      [10, "常人の極み"],
      [30, "徹底した平凡"],
      [50, "奇跡の凡才"],
      [100, "R百連の主"],
    ],
  },
  {
    family: "freeze",
    stat: "freeze",
    what: "フリーズを引く",
    unit: "回目",
    tiers: [
      [1, "氷結の一瞬"],
      [5, "凍える幸運"],
      [10, "氷華の使い手"],
      [30, "極寒の寵児"],
      [50, "絶氷の支配者"],
      [100, "永久凍土の王"],
    ],
  },
  {
    family: "foil-draw",
    stat: "foil",
    foil: true,
    what: "フォイルを引く",
    unit: "回目",
    tiers: [
      [1, "初めての輝き"],
      [5, "箔集めの手"],
      [10, "煌めきの収集家"],
      [30, "輝きの探求者"],
      [50, "箔光の匠"],
      [100, "黄金の眼"],
    ],
  },
  {
    family: "ssr-draw",
    stat: "ssr",
    what: "SSRを引く",
    unit: "回目",
    tiers: [
      [1, "最高位との邂逅"],
      [5, "SSRの寵児"],
      [10, "高みの常連"],
      [30, "SSR狩人"],
      [50, "至高の収集家"],
      [100, "SSR百の覇者"],
    ],
  },
  {
    family: "pulls",
    stat: "pulls",
    what: "ガチャを引く",
    unit: "回",
    tiers: [
      [10, "召喚の入口"],
      [100, "門を開く者"],
      [300, "召喚の常連"],
      [500, "門番"],
      [1000, "千召喚の証"],
      [2000, "二千の召喚者"],
      [3000, "召喚の達人"],
      [5000, "召喚の権化"],
      [10000, "万召喚の主"],
    ],
  },
];

const gachaTiered = ({ family, stat, what, unit, tiers, foil }) =>
  tiers.map(([n, name], i) => ({
    id: `gacha-${family}-${n}`,
    name,
    how: `${what}（累計${n}${unit}）`,
    family,
    tier: i + 1,
    ...(foil ? { foil: true } : {}),
    unlocked: (p) => (p?.gacha?.[stat] ?? 0) >= n,
  }));

// 1回の10連でSSR複数枚(bestTenSsr=これまでの最高枚数で判定)
const GACHA_MULTI_SSR = [
  [2, "二輝の奇跡"],
  [3, "三輝の奇跡"],
  [4, "四輝の伝説"],
].map(([n, name], i) => ({
  id: `gacha-multi-ssr-${n}`,
  name,
  how: `1回の10連でSSRを${n}枚引く`,
  family: "multi-ssr",
  tier: i + 1,
  unlocked: (p) => (p?.gacha?.bestTenSsr ?? 0) >= n,
}));

// フォイルのコンプ度(そろえたフォイルの種類数)
const GACHA_FOIL_COMPLETE = [
  [5, "箔集めの初"],
  [10, "箔の蒐集家"],
  [15, "箔の大全"],
].map(([n, name], i) => ({
  id: `gacha-foil-complete-${n}`,
  name,
  how: `フォイルを${n}種そろえる`,
  family: "foil-complete",
  tier: i + 1,
  foil: true,
  unlocked: (p) => (p?.gacha?.foilsOwned ?? 0) >= n,
}));

// 通常版カードのコンプ(そろえた通常版の種類数)
const GACHA_NORMAL_COMPLETE = [
  [5, "図鑑の芽生え"],
  [10, "蒐集家の道"],
  [15, "英雄大全"],
].map(([n, name], i) => ({
  id: `gacha-normal-complete-${n}`,
  name,
  how: `通常版カードを${n}種そろえる`,
  family: "normal-complete",
  tier: i + 1,
  unlocked: (p) => (p?.gacha?.normalsOwned ?? 0) >= n,
}));

export const GACHA_TITLES = [
  ...GACHA_FAMILIES.flatMap(gachaTiered),
  ...GACHA_MULTI_SSR,
  ...GACHA_FOIL_COMPLETE,
  ...GACHA_NORMAL_COMPLETE,
];

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
  // 布陣の褒美。氷のエリアで隅の要塞(src/game/bonus.js の fortressCorner)を組んで
  // CPU戦かオンライン対戦を始めると、その場で配られる。組み方は伏せて「○○のエリアで獲得」とだけ書く
  {
    id: "fortress",
    foil: true,
    name: "堅牢な要塞",
    how: "氷のエリアで獲得",
  },
  // 空のエリアで双翼の陣(src/game/bonus.js の twinWingsMatch)を組んで対局を始めると配られる
  {
    id: "twin-wings",
    foil: true,
    name: "双翼の将",
    how: "空のエリアで獲得",
  },
  // 土「継承の狩り」・森「消去法の詰め」(src/game/bonus.js の FORMATIONS)も同じ扱い
  {
    id: "heir-hunt",
    foil: true,
    name: "軌跡の追跡者",
    how: "土のエリアで獲得",
  },
  {
    id: "elimination",
    foil: true,
    name: "静寂な狩人",
    how: "森のエリアで獲得",
  },
  {
    id: "kamikaze",
    foil: true,
    name: "荒波の航海士",
    how: "海のエリアで獲得",
  },
  {
    id: "royal-road",
    foil: true,
    name: "覇道",
    how: "宮殿のエリアで獲得",
  },
  // シークレットミッションの褒美
  {
    id: "court-heavy",
    name: "国士無双",
    how: "シークレット「手札が絵札に偏りすぎて配り直された」",
    secret: true,
  },
  // ミッションの褒美。条件では自動で開かず、受け取ったときに配られる
  { id: "regular", name: "常連", how: "ミッション「3日あそぶ」" },
  { id: "devoted", name: "皆勤の士", how: "ミッション「30日あそぶ」" },
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
  // Ownership completes a mission; only its explicit reward claim grants a title.
  ...FOIL_MISSION_DEFS.map((entry) => ({
    id: entry.titleId,
    name: entry.titleName,
    foil: true,
    how: `${entry.missionName}\n（ミッション報酬を受け取る）`,
  })),
  // ガチャの結果で自動解放される称号(段階つき)。一覧の絞り込みは account.jsx。
  ...GACHA_TITLES,
];

/**
 * foil: true の称号は、フォイルを1枚も持たないうちは一覧に出さない(手に入れたものは出す)。
 * フォイルもエリアも、初めてフォイルを引くまでは存在を見せない決まり(src/skins/collection.js の foilRevealed)
 */

/** 既定の称号 */
export const DEFAULT_TITLE = "novice";

/** id から称号を引く。知らない id なら null */
export function findTitle(id) {
  return TITLES.find((t) => t.id === id) || seasonTitle(id);
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
  return availableTitles(profile).filter((t) => hasTitle(profile, t.id));
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

export function availableTitles(profile) {
  return [
    ...TITLES,
    ...[...new Set(profile?.titles || [])].map(seasonTitle).filter(Boolean),
  ];
}
