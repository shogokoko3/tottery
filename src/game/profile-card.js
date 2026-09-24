/**
 * プロフィールの飾り(2026-09-23 本人の指示「プロフィールをカスタマイズできるように」)。
 *
 * 選べるのは3つ:
 *  - 背景(bg): 標準か、ホームの着せ替えと同じ7エリア(同じフォイルの対応で解放。src/skins/home-themes.js)
 *  - 記録のアピール(showcase): SHOWCASE から 3 つまで。数字はプロフィールに大きく出す
 *  - 固定の称号(pinnedTitle): 持っている称号から1つ。対局で見せる称号(profile.title)とは別に、
 *    プロフィールの真ん中に据える
 *
 * 選択は profile.card に持つ(端末)。フレンドが見る写しは buildProfileCard で作ってサーバーへ送る
 * (src/net/friends.js publishProfileCard)。サーバー側の見張りは src/server/friends.js sanitizeProfileCard。
 */
import { HOME_THEMES, unlockedHomeThemes, DEFAULT_HOME_THEME } from "../skins/home-themes.js";
import { hasTitle, ownedTitles, titleOf } from "./titles.js";
import { levelOfXp } from "./level.js";
import { sanitizeTsumeProgress } from "./tsume-daily.js";
import { MASTERY_SKINS } from "./constants.js";

export const STANDARD_BG = "standard";
export const SHOWCASE_MAX = 3;
/** フレンド申請の入口(サーバーの REQUEST_SOURCES と同じ)。入口ごとに受け付けるかを決める(2026-09-24 本人の指示) */
export const REQUEST_SOURCES = Object.freeze([
  { id: "code", label: "フレンド ID で", note: "ID を伝えた相手からの申請" },
  { id: "match", label: "対戦した相手から", note: "ランダムマッチで当たった相手が、終局の画面から" },
  { id: "rank", label: "ランキングから", note: "ランキングで名前を押した人から" },
]);
export function normalizeAccept(raw) {
  const a = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(REQUEST_SOURCES.map((s) => [s.id, a[s.id] !== false]));
}

/**
 * 観戦の受付(2026-09-24 本人の指示)。フレンドが自分の対戦を観戦できるか、対戦の種類ごとに決める。
 * - friend: フレンド対戦。既定オン(呼んだ相手に見せる前提)。審判視点(全部見える)
 * - online: ランダムマッチ。**既定オフ**。オンにするとフレンドが観戦できる。観戦した席の駒だけ見える
 */
export const SPECTATE_MODES = Object.freeze([
  { id: "friend", label: "フレンド対戦", note: "フレンドが観戦できます(盤の両側が見えます)", def: true },
  { id: "online", label: "ランダムマッチ", note: "オンにするとフレンドが観戦できます(あなたの駒だけ見えます)", def: false },
]);
export function normalizeSpectate(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(SPECTATE_MODES.map((m) => [m.id, m.id in s ? s[m.id] !== false : m.def]));
}

/** 背景の候補。標準はいつでも。7エリアはホームの着せ替えと同じ解放条件 */
export const PROFILE_BACKGROUNDS = Object.freeze([
  { id: STANDARD_BG, label: "標準", condition: "いつでも使えます" },
  ...HOME_THEMES.map((t) => ({ id: t.id, label: t.title, area: t.label, condition: t.condition })),
]);

export function unlockedBackgrounds(collection) {
  const themes = unlockedHomeThemes(collection).map((id) => (id === DEFAULT_HOME_THEME ? STANDARD_BG : id));
  return PROFILE_BACKGROUNDS.filter((b) => themes.includes(b.id)).map((b) => b.id);
}

/**
 * アピールできる記録。value は写し(card + サーバーが足す rating/place)から数字を出す。
 * 「勝率」だけは割合。無いものは null(表示は「—」)
 */
export const SHOWCASE = Object.freeze([
  { id: "rating", label: "レート", unit: "", value: (c) => c.rating ?? null },
  { id: "battles", label: "対局数", unit: "局", value: (c) => c.stats.battles },
  { id: "wins", label: "勝利数", unit: "勝", value: (c) => c.stats.wins },
  {
    id: "winRate",
    label: "勝率",
    unit: "%",
    value: (c) => (c.stats.battles > 0 ? Math.round((c.stats.wins / c.stats.battles) * 100) : null),
  },
  { id: "rated", label: "ランダムマッチ", unit: "局", value: (c) => c.stats.rated },
  { id: "titles", label: "称号の数", unit: "個", value: (c) => c.stats.titles },
  { id: "level", label: "レベル", unit: "", value: (c) => c.level },
  { id: "streak", label: "連続ログイン", unit: "日", value: (c) => c.stats.streak },
  { id: "days", label: "遊んだ日数", unit: "日", value: (c) => c.stats.days },
  { id: "mastery", label: "熟練度の合計点", unit: "点", value: (c) => c.stats.mastery },
  { id: "tsume", label: "詰めトッタリー", unit: "問", value: (c) => c.stats.tsume },
  { id: "bestPlace", label: "月間の最高順位", unit: "位", value: (c) => c.stats.bestPlace || c.bestPlace || null },
]);
export const SHOWCASE_IDS = SHOWCASE.map((s) => s.id);
export const findShowcase = (id) => SHOWCASE.find((s) => s.id === id) || null;

/** 端末に持つ選択を決まった形に */
export function normalizeCard(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  return {
    bg: typeof c.bg === "string" && c.bg ? c.bg : STANDARD_BG,
    showcase: Array.isArray(c.showcase)
      ? [...new Set(c.showcase.filter((id) => SHOWCASE_IDS.includes(id)))].slice(0, SHOWCASE_MAX)
      : [],
    pinnedTitle: typeof c.pinnedTitle === "string" && c.pinnedTitle ? c.pinnedTitle : null,
    accept: normalizeAccept(c.accept),
    spectate: normalizeSpectate(c.spectate),
  };
}

/** 詰めトッタリーで解いた日数 */
export function tsumeClearedCount(collection) {
  return Object.values(sanitizeTsumeProgress(collection?.tsume).days).filter((d) => d.cleared).length;
}

/** 熟練度の合計点(全スキン)。鍵はスキン id(2026-09-24 でスキンごとに変更 → constants.js の MASTERY_SKINS) */
export function masteryTotal(profile) {
  const m = (profile && profile.mastery) || {};
  return MASTERY_SKINS.reduce((s, id) => s + (Number(m[id]) || 0), 0);
}

/**
 * フレンドが見る写しを作る。持っていない称号・解放していない背景はここで落とす
 * (サーバーは所持を知らないので、端末が正直に落とすのが第一の線。サーバーは桁と長さだけ見張る)。
 * extra: { bestPlace, since } は台帳や players から分かるときだけ
 */
export function buildProfileCard(profile, collection, extra = {}) {
  const card = normalizeCard(profile && profile.card);
  const bgs = unlockedBackgrounds(collection);
  return {
    name: (profile && profile.name) || "",
    icon: (profile && profile.icon) || "",
    title: titleOf(profile).id,
    pinnedTitle: card.pinnedTitle && hasTitle(profile, card.pinnedTitle) ? card.pinnedTitle : "",
    bg: bgs.includes(card.bg) ? card.bg : STANDARD_BG,
    frame: (collection && collection.season && collection.season.frame) || "",
    level: levelOfXp((profile && profile.xp) || 0),
    showcase: card.showcase,
    accept: card.accept,
    stats: {
      battles: (profile && profile.battles) || 0,
      wins: (profile && profile.battleWins) || 0,
      draws: (profile && profile.battleDraws) || 0,
      rated: (profile && profile.rated) || 0,
      titles: ownedTitles(profile).length,
      streak: (profile && profile.streak) || 0,
      days: (profile && profile.days) || 0,
      mastery: masteryTotal(profile),
      tsume: tsumeClearedCount(collection),
      bestPlace: Number(extra.bestPlace) || 0,
      since: Number(extra.since) || 0,
    },
  };
}

/** 写し(サーバーから来たもの)の数字を、画面に出す文字へ */
export function showcaseText(id, view) {
  const def = findShowcase(id);
  if (!def) return { label: "", text: "—" };
  const v = def.value(view);
  if (v === null || v === undefined) return { label: def.label, text: "—" };
  return { label: def.label, text: `${Number(v).toLocaleString("ja-JP")}${def.unit}` };
}
