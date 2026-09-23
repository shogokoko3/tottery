import { seasonTitle } from "./season.js";
/**
 * アカウントの称号。名前の横に添える飾り。
 *
 * 対戦相手にも渡して、マッチしたときに名前と一緒に見せる。
 * 手に入れ方は2通り:
 *   - 対局数・勝数・レートから自動で決まるもの(unlocked で判定)
 *   - あとから配るもの(profile.titles に id を持たせる)
 * 一覧はここのデータだけ書き足せば増える。free: true は最初から使える。
 *
 * 相手が新しい版で、こちらの知らない称号を持っていることがある。
 * そのときは何も出さない(findTitle が null を返す)。
 */
import { FOIL_MISSION_DEFS } from "./foil-missions.js";
import {
  RANKS,
  MASTERY_STEPS,
  MASTERY_TITLE_STEP,
} from "./constants.js";

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
      [1, "静寂の凪"],
      [5, "灰燼の蒐集者"],
      [10, "無銘の求道者"],
      [30, "常闇の徒"],
      [50, "虚無を統べる者"],
      [100, "無冠の帝王"],
    ],
  },
  {
    family: "freeze",
    stat: "freeze",
    what: "フリーズを引く",
    unit: "回目",
    tiers: [
      [1, "氷結の刻"],
      [5, "永氷の使徒"],
      [10, "絶対零度"],
      [30, "氷獄の支配者"],
      [50, "氷結界の主"],
      [100, "絶氷帝"],
    ],
  },
  {
    family: "foil-draw",
    stat: "foil",
    foil: true,
    what: "フォイルを引く",
    unit: "回目",
    tiers: [
      [1, "輝きの黎明"],
      [5, "金箔の求道者"],
      [10, "黄金律"],
      [30, "光輝の覇者"],
      [50, "燦然たる者"],
      [100, "黄金卿"],
    ],
  },
  {
    family: "ssr-draw",
    stat: "ssr",
    what: "SSRを引く",
    unit: "回目",
    tiers: [
      [1, "至高との邂逅"],
      [5, "頂への渇望"],
      [10, "高みの征服者"],
      [30, "至高の狩人"],
      [50, "頂点捕食者"],
      [100, "至尊の覇王"],
    ],
  },
  {
    family: "pulls",
    stat: "pulls",
    what: "ガチャを引く",
    unit: "回",
    tiers: [
      [10, "召喚者"],
      [100, "門の開拓者"],
      [300, "召喚の求道者"],
      [500, "星辰の召喚士"],
      [1000, "千召の覇者"],
      [2000, "万象の召喚士"],
      [3000, "召喚の権化"],
      [5000, "深淵の召喚王"],
      [10000, "万召を統べる者"],
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
  [2, "双星の奇跡"],
  [3, "三星の煌めき"],
  [4, "四星の伝説"],
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
  [5, "蒐集の煌めき"],
  [10, "箔を統べる者"],
  [15, "黄金聖域"],
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
  [5, "図鑑の開拓者"],
  [10, "英雄の蒐集者"],
  [15, "英雄譚の完成者"],
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

/**
 * 熟練度の称号(2026-09-22 本人の決め)。
 *
 * **その札を王に選び、王として動かした回数**で出る(2026-09-22 本人の決め)。
 * 勝敗では動かないので、負けても伸びる。1局で育つのは王にした1種類だけ。
 * 恩恵は名乗りだけ。盤の有利不利には一切効かせない(「印」の案は本人が取り下げた)。
 *
 * 名前はその札の動きをそのまま名乗る形にしてある。縦横と斜め、偶数と奇数が
 * 名前の上で対になるので、規則を覚える助けにもなる。
 */
const MASTERY_NAMES = {
  A: "乱世の奇手",
  2: "一歩の堅陣",
  3: "斜影の一歩",
  4: "双進の勇",
  5: "双斜の勇",
  6: "偶進の理",
  7: "偶斜の理",
  8: "奇進の理",
  9: "奇斜の理",
  10: "跳躍の妙",
  J: "縦横無尽",
  Q: "斜貫無尽",
  K: "王道無双",
};

const masteryNeed = MASTERY_STEPS[MASTERY_TITLE_STEP - 1];

export const MASTERY_TITLES = [
  ...RANKS.map((rank) => ({
    id: `mastery-${rank}`,
    name: MASTERY_NAMES[rank],
    how: `${rank}を王にして${masteryNeed}回動かす`,
    mastery: rank,
    unlocked: (p) => (p?.mastery?.[rank] ?? 0) >= masteryNeed,
  })),
  // 通しの褒美。13種すべてを同じ段まで使い込んだ人にだけ出る
  {
    id: "mastery-all",
    name: "十三道の使い手",
    how: `すべての札を王にして${masteryNeed}回動かす`,
    mastery: "all",
    unlocked: (p) =>
      RANKS.every((rank) => (p?.mastery?.[rank] ?? 0) >= masteryNeed),
  },
  {
    id: "mastery-master",
    name: "盤上無双",
    how: `すべての札を王にして${MASTERY_STEPS[MASTERY_STEPS.length - 1]}回動かす`,
    mastery: "all",
    unlocked: (p) =>
      RANKS.every(
        (rank) =>
          (p?.mastery?.[rank] ?? 0) >= MASTERY_STEPS[MASTERY_STEPS.length - 1],
      ),
  },
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
    how: "レート 1600",
    unlocked: (p) => p.rating >= 1600,
  },
  {
    id: "rank-sho",
    name: "将の位",
    how: "レート 1800",
    unlocked: (p) => p.rating >= 1800,
  },
  {
    id: "rank-o",
    name: "王の位",
    how: "レート 2000",
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
  // 札ごとの熟練度で自動解放される称号
  ...MASTERY_TITLES,
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
