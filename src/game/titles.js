import { seasonTitle } from "./season.js";
import { L, Lx, fmtDate } from "../i18n/index.js";
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
  MASTERY_SKINS,
  MASTERY_SKIN_RANK,
  MASTERY_SERIES,
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
    how: (n) => L("10連がすべてRになる（累計{n}回目）", { n }),
    tiers: [
      [1, L("静寂の凪")],
      [5, L("灰燼の蒐集者")],
      [10, L("無銘の求道者")],
      [30, L("常闇の徒")],
      [50, L("虚無を統べる者")],
      [100, L("無冠の帝王")],
    ],
  },
  {
    family: "freeze",
    stat: "freeze",
    how: (n) => L("フリーズを引く（累計{n}回目）", { n }),
    tiers: [
      [1, L("氷結の刻")],
      [5, L("永氷の使徒")],
      [10, L("絶対零度")],
      [30, L("氷獄の支配者")],
      [50, L("氷結界の主")],
      [100, L("絶氷帝")],
    ],
  },
  {
    family: "foil-draw",
    stat: "foil",
    foil: true,
    how: (n) => L("フォイルを引く（累計{n}回目）", { n }),
    tiers: [
      [1, L("輝きの黎明")],
      [5, L("金箔の求道者")],
      [10, L("黄金律")],
      [30, L("光輝の覇者")],
      [50, L("燦然たる者")],
      [100, L("黄金卿")],
    ],
  },
  {
    family: "ssr-draw",
    stat: "ssr",
    how: (n) => L("SSRを引く（累計{n}回目）", { n }),
    tiers: [
      [1, L("至高との邂逅")],
      [5, L("頂への渇望")],
      [10, L("高みの征服者")],
      [30, L("至高の狩人")],
      [50, L("頂点捕食者")],
      [100, L("至尊の覇王")],
    ],
  },
  {
    family: "pulls",
    stat: "pulls",
    how: (n) => L("ガチャを引く（累計{n}回）", { n }),
    tiers: [
      [10, L("召喚者")],
      [100, L("門の開拓者")],
      [300, L("召喚の求道者")],
      [500, L("星辰の召喚士")],
      [1000, L("千召の覇者")],
      [2000, L("万象の召喚士")],
      [3000, L("召喚の権化")],
      [5000, L("深淵の召喚王")],
      [10000, L("万召を統べる者")],
    ],
  },
];

const gachaTiered = ({ family, stat, how, tiers, foil }) =>
  tiers.map(([n, name], i) => ({
    id: `gacha-${family}-${n}`,
    name,
    how: how(n),
    family,
    tier: i + 1,
    ...(foil ? { foil: true } : {}),
    unlocked: (p) => (p?.gacha?.[stat] ?? 0) >= n,
  }));

// 1回の10連でSSR複数枚(bestTenSsr=これまでの最高枚数で判定)
const GACHA_MULTI_SSR = [
  [2, L("双星の奇跡")],
  [3, L("三星の煌めき")],
  [4, L("四星の伝説")],
].map(([n, name], i) => ({
  id: `gacha-multi-ssr-${n}`,
  name,
  how: L("1回の10連でSSRを{n}枚引く", { n }),
  family: "multi-ssr",
  tier: i + 1,
  unlocked: (p) => (p?.gacha?.bestTenSsr ?? 0) >= n,
}));

// フォイルのコンプ度(そろえたフォイルの種類数)
const GACHA_FOIL_COMPLETE = [
  [5, L("蒐集の煌めき")],
  [10, L("箔を統べる者")],
  [15, L("黄金聖域")],
].map(([n, name], i) => ({
  id: `gacha-foil-complete-${n}`,
  name,
  how: L("フォイルを{n}種そろえる", { n }),
  family: "foil-complete",
  tier: i + 1,
  foil: true,
  unlocked: (p) => (p?.gacha?.foilsOwned ?? 0) >= n,
}));

// 通常版カードのコンプ(そろえた通常版の種類数)
const GACHA_NORMAL_COMPLETE = [
  [5, L("図鑑の開拓者")],
  [10, L("英雄の蒐集者")],
  [15, L("英雄譚の完成者")],
].map(([n, name], i) => ({
  id: `gacha-normal-complete-${n}`,
  name,
  how: L("通常版カードを{n}種そろえる", { n }),
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
 * **その札を王に選んでためた点**で出る(2026-09-22 本人の決め。2026-09-24 に点数へ)。
 * 勝敗では動かないので、負けても伸びる。1局で育つのは王にした1種類だけ。
 * 恩恵は名乗りだけ。盤の有利不利には一切効かせない(「印」の案は本人が取り下げた)。
 *
 * 名前はその札の動きをそのまま名乗る形にしてある。縦横と斜め、偶数と奇数が
 * 名前の上で対になるので、規則を覚える助けにもなる。
 */
/**
 * 熟練度の称号(2026-09-24 本人の指示で、札ごと→**所持スキンごと**に付け直した)。
 * そのスキンを装備して王にし、点をためると出る。スキンを持っていなければ解放されない(カード画面で鎖)。
 * 名前はスキンのキャラ(絵柄)に合わせてある。J/Q/K・10 はスキンが複数あり、それぞれ別の称号。
 * 恩恵は名乗りだけ。盤の有利不利には一切効かせない。
 */
const MASTERY_NAMES = {
  "genie-magician": L("千夜の魔導師"), // A ランプのマジシャン
  "zombie-male": L("不滅の墓守"), // 2 墓守のレヴナント
  "zombie-female": L("黄昏の亡姫"), // 3 黄昏のレヴナント
  "pirate-male": L("黒潮の覇者"), // 4 黒潮の船長
  "pirate-female": L("紅帆の女帝"), // 5 紅帆の船長
  "elf-male": L("翠風の狙撃手"), // 6 翠樹の射手
  "elf-female": L("銀月の狙撃姫"), // 7 月影の射手
  "viking-male": L("北海の覇王"), // 8 北海の戦斧
  "viking-female": L("氷牙の戦姫"), // 9 霜狼の戦斧
  "dragon-knight": L("天翔ける竜王"), // 10 焔翼の竜騎士
  "pegasus-knight": L("蒼天の天馬騎士"), // 10 白翼の天馬騎士
  "angel-j": L("黎明の告使"), // J 告天使 ガブリエル
  "demon-j": L("奸智の魔公"), // J 魔公 アスタロト
  "angel-q": L("慈光の癒使"), // Q 癒天使 ラファエル
  "demon-q": L("夜を統べる魔后"), // Q 夜后 リリス
  "angel-k": L("熾天の大天使"), // K 熾天使 ミカエル
  "demon-k": L("奈落の堕天王"), // K 堕天王 ルシファー
  "alice-A-alice": L("扉を拓く少女"),
  "alice-2-dodo": L("帰還の先導者"),
  "alice-3-bill": L("不屈の小さな使者"),
  "alice-4-hatter": L("永遠の茶会の主"),
  "alice-5-march-hare": L("奇想の茶会の客人"),
  "alice-6-gryphon": L("海辺の舞踏家"),
  "alice-7-mock-turtle": L("涙のカドリール"),
  "alice-8-white-rabbit": L("時を駆ける案内人"),
  "alice-9-caterpillar": L("迷いの森の賢者"),
  "alice-10-cheshire-cat": L("幻影の微笑み"),
  "alice-J-knave": L("紅心の近衛"),
  "alice-Q-queen": L("紅心の女帝"),
  "alice-K-king": L("紅心の君主"),
};

const masteryNeed = MASTERY_STEPS[MASTERY_TITLE_STEP - 1];
const masteryTop = MASTERY_STEPS[MASTERY_STEPS.length - 1];

export const MASTERY_TITLES = [
  ...MASTERY_SKINS.map((skin) => ({
    id: `mastery-${skin}`,
    name: MASTERY_NAMES[skin],
    how: L("{rank}のスキンを使って{n}点ためる", {
      rank: MASTERY_SKIN_RANK[skin],
      n: masteryNeed,
    }),
    mastery: skin,
    unlocked: (p) => (p?.mastery?.[skin] ?? 0) >= masteryNeed,
  })),
  // 既存の17英雄の条件・IDは保ち、新シリーズ追加で取得条件を増やさない。
  ...MASTERY_SERIES.flatMap((series) => [
    {
      id: series.id === "heroes" ? "mastery-all" : `mastery-${series.id}-all`,
      name: series.id === "heroes" ? L("十七英雄の主") : L("不思議の国の主"),
      how: L("{series}の全{count}種類で{n}点ずつためる", {
        series: Lx(series.name),
        count: series.skins.length,
        n: masteryNeed,
      }),
      mastery: "all",
      masterySeries: series.id,
      unlocked: (p) => series.skins.every((skin) => (p?.mastery?.[skin] ?? 0) >= masteryNeed),
    },
    {
      id: series.id === "heroes" ? "mastery-master" : `mastery-${series.id}-master`,
      name: series.id === "heroes" ? L("盤上無双") : L("ワンダーランド・マスター"),
      how: L("{series}の全{count}種類で{n}点ずつためる", {
        series: Lx(series.name),
        count: series.skins.length,
        n: masteryTop,
      }),
      mastery: "all",
      masterySeries: series.id,
      unlocked: (p) => series.skins.every((skin) => (p?.mastery?.[skin] ?? 0) >= masteryTop),
    },
  ]),
];

export const TITLES = [
  { id: "novice", name: L("見習い"), how: L("最初から"), free: true },
  { id: "first", name: L("初陣"), how: L("1局遊ぶ"), unlocked: (p) => p.plays >= 1 },
  {
    id: "ten",
    name: L("十戦の兵"),
    how: L("10局遊ぶ"),
    unlocked: (p) => p.plays >= 10,
  },
  {
    id: "fifty",
    name: L("五十戦の将"),
    how: L("50局遊ぶ"),
    unlocked: (p) => p.plays >= 50,
  },
  {
    id: "win10",
    name: L("十勝の勇"),
    how: L("10勝する"),
    unlocked: (p) => p.wins >= 10,
  },
  {
    id: "win30",
    name: L("三十勝の猛者"),
    how: L("30勝する"),
    unlocked: (p) => p.wins >= 30,
  },
  {
    id: "rated",
    name: L("腕試し"),
    how: L("オンラインで1局遊ぶ"),
    unlocked: (p) => p.rated >= 1,
  },
  // 布陣の褒美。氷のエリアで隅の要塞(src/game/bonus.js の fortressCorner)を組んで
  // CPU戦かオンライン対戦を始めると、その場で配られる。組み方は伏せて「○○のエリアで獲得」とだけ書く
  {
    id: "fortress",
    foil: true,
    name: L("堅牢な要塞"),
    how: L("氷のエリアで獲得"),
  },
  // 空のエリアで双翼の陣(src/game/bonus.js の twinWingsMatch)を組んで対局を始めると配られる
  {
    id: "twin-wings",
    foil: true,
    name: L("双翼の将"),
    how: L("空のエリアで獲得"),
  },
  // 土「継承の狩り」・森「消去法の詰め」(src/game/bonus.js の FORMATIONS)も同じ扱い
  {
    id: "heir-hunt",
    foil: true,
    name: L("軌跡の追跡者"),
    how: L("土のエリアで獲得"),
  },
  {
    id: "elimination",
    foil: true,
    name: L("静寂な狩人"),
    how: L("森のエリアで獲得"),
  },
  {
    id: "kamikaze",
    foil: true,
    name: L("荒波の航海士"),
    how: L("海のエリアで獲得"),
  },
  {
    id: "royal-road",
    foil: true,
    name: L("覇道"),
    how: L("宮殿のエリアで獲得"),
  },
  // シークレットミッションの褒美
  {
    id: "court-heavy",
    name: L("国士無双"),
    how: L("シークレット「手札が絵札に偏りすぎて配り直された」"),
    secret: true,
  },
  // ミッションの褒美。条件では自動で開かず、受け取ったときに配られる
  { id: "regular", name: L("常連"), how: L("ミッション「3日あそぶ」") },
  { id: "devoted", name: L("皆勤の士"), how: L("ミッション「30日あそぶ」") },
  {
    id: "rank-shi",
    name: L("士の位"),
    how: L("レート 1600"),
    unlocked: (p) => p.rating >= 1600,
  },
  {
    id: "rank-sho",
    name: L("将の位"),
    how: L("レート 1800"),
    unlocked: (p) => p.rating >= 1800,
  },
  {
    id: "rank-o",
    name: L("王の位"),
    how: L("レート 2000"),
    unlocked: (p) => p.rating >= 2000,
  },
  // Ownership completes a mission; only its explicit reward claim grants a title.
  ...FOIL_MISSION_DEFS.map((entry) => ({
    id: entry.titleId,
    name: Lx(entry.titleName),
    foil: true,
    how: L("{mission}\n（ミッション報酬を受け取る）", {
      mission: Lx(entry.missionName),
    }),
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

/**
 * 獲得日時(2026-10-15 本人の指示「称号の獲得日が確認できるように」)。
 * profile.titleAt に { 称号id: 時刻(ms) } で持つ(src/game/profile.js が保存のたびに控える)。
 * 記録が始まる前に取った称号には無い(null)。最初から使えるもの(free)も無い
 */
export function titleEarnedAt(profile, id) {
  const at = profile?.titleAt?.[id];
  return Number.isFinite(at) && at > 0 ? at : null;
}

/** 獲得日の言い方。「2026/10/15 に獲得」「最初から」「獲得日の記録なし」 */
export function titleEarnedLabel(profile, title) {
  if (!title) return "";
  if (title.free) return L("最初から");
  const at = titleEarnedAt(profile, title.id);
  if (!at) return L("獲得日の記録なし");
  return L("{date} に獲得", {
    date: fmtDate(at, { year: "numeric", month: "numeric", day: "numeric" }),
  });
}

/**
 * 獲得した順(古い順)に並べ替える(2026-10-15 本人の指示)。
 * 最初から使えるもの・記録が始まる前に取ったものは、どれより先に取っているので先頭(一覧の順のまま)。
 * 同じ時刻なら一覧の順を保つ
 */
/**
 * 獲得順に並べる。古い順が基本(記録なし・最初からが先頭、同時刻は一覧の順)。
 * newestFirst で新しい順(記録なし・最初からが末尾。同時刻は一覧の順のまま。2026-10-16 本人の指示)
 */
export function sortTitlesByEarned(list, profile, { newestFirst = false } = {}) {
  return list
    .map((t, i) => ({ t, i, at: t.free ? 0 : titleEarnedAt(profile, t.id) || 0 }))
    .sort((a, b) => (newestFirst ? b.at - a.at : a.at - b.at) || a.i - b.i)
    .map((x) => x.t);
}
/** 並びの設定(useTitleOrder の値)で称号を並べる。"list" はそのまま */
export function orderTitles(list, profile, order) {
  if (order === "earned") return sortTitlesByEarned(list, profile);
  if (order === "newest") return sortTitlesByEarned(list, profile, { newestFirst: true });
  return list;
}

export function availableTitles(profile) {
  return [
    ...TITLES,
    ...[...new Set(profile?.titles || [])].map(seasonTitle).filter(Boolean),
  ];
}
