/**
 * プレイヤーのアカウント。
 *
 * 名前・対局数・勝数を端末に持つ。名前は対戦相手にも渡して、
 * 「どちらの手番か」「誰が指したのか」を色だけでなく名前でも分かるようにする。
 * レベルは対局数と勝数から決まり、チュートリアルの開放条件になる。
 *
 * 保存先は端末の localStorage だけ。サーバーには置いていない。
 * レーティングやランキングを入れるときは、ここに rating を足したうえで、
 * 端末を替えても続く本物のアカウント(サーバー側の識別)が別に要る。
 * いまの id は端末ごとの目印で、作り直せてしまう。
 */

import { hasIcon } from "./icons.js";
import { hasTitle, newlyEarned } from "./titles.js";
import { MAX_LEVEL, XP, levelOfXp, progressOfXp } from "./level.js";

export { MAX_LEVEL };
import { START_RATING, applyRating } from "./rating.js";

const KEY = "tottery.account.v1";
/** 名前を持たなかった頃の保存先。1度だけ読み込んで引き継ぐ */
const OLD_KEY = "tottery.profile.v1";

/** 名前の長さの上限 */
export const MAX_NAME_LEN = 10;

/**
 * テストプレイ環境では全プレイヤーをレベル10として扱う。
 * 配信時に false へ戻すと、実際のプレイ数でレベルが上がるようになる。
 */
export const TEST_BUILD = true;

/**
 * テストプレイ用モード。URL に ?test=1 を付けたときだけ有効になる。
 * 布陣の1分と対局の持ち時間を止めて、画面をゆっくり確かめられるようにする。
 * TEST_BUILD が false の配信ビルドでは、何を付けても有効にならない。
 */
export function isTestPlay() {
  if (!TEST_BUILD) return false;
  try {
    return new URLSearchParams(location.search).has("test");
  } catch {
    return false;
  }
}

const EMPTY = {
  id: null,
  name: "",
  icon: null,
  icons: [],
  // 選んでいる称号と、あとから配られた称号。対局数などで決まるものは
  // titles.js が profile から判定するので、ここには持たない
  title: null,
  titles: [],
  plays: 0,
  // 対戦だけの数(チュートリアルを含めない)。ミッションの条件に使う
  battles: 0,
  wins: 0,
  // 経験値。レベルはここから毎回導くので、レベルは保存しない
  xp: 0,
  // レーティングと、その対象になった対局数(オンラインだけ)
  rating: START_RATING,
  rated: 0,
};

/** 端末ごとの目印。名前が同じ人と区別するために持つ */
function makeId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // プライベートブラウズなどで読めないことがある
    return null;
  }
}

export function loadProfile() {
  const saved = read(KEY) || read(OLD_KEY);
  if (!saved) return { ...EMPTY };
  return {
    id: typeof saved.id === "string" && saved.id ? saved.id : null,
    name: normalizeName(saved.name || ""),
    // 選んでいるアイコンと、手に入れたアイコン。今後増やしていく
    icon: typeof saved.icon === "string" ? saved.icon : null,
    icons: Array.isArray(saved.icons)
      ? saved.icons.filter((x) => typeof x === "string")
      : [],
    title: typeof saved.title === "string" ? saved.title : null,
    titles: Array.isArray(saved.titles)
      ? saved.titles.filter((x) => typeof x === "string")
      : [],
    plays: Number(saved.plays) || 0,
    battles:
      Number(Number.isFinite(saved.battles) ? saved.battles : saved.plays) || 0,
    wins: Number(saved.wins) || 0,
    // 経験値を持たない古い保存は、それまでの対局数ぶんを配って引き継ぐ
    xp:
      Number(
        Number.isFinite(saved.xp)
          ? saved.xp
          : (Number(saved.plays) || 0) * XP.BATTLE,
      ) || 0,
    rating: Number(saved.rating) || START_RATING,
    rated: Number(saved.rated) || 0,
  };
}

/** 名前を決めたかどうか。決まるまで対局に入れない */
export function hasName(profile) {
  return !!(profile || loadProfile()).name;
}

/**
 * 入力された名前を整える。
 * 前後の空白を落とし、途中の空白は1つにまとめ、長すぎる分は切る。
 */
export function normalizeName(raw) {
  return String(raw == null ? "" : raw)
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_NAME_LEN);
}

/**
 * 名前と端末の目印を捨てて、決め直しの画面へ戻す。
 * 運営に使用停止にされたときに使う。対局数などの記録も一緒に消える
 */
export function resetAccount() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {
    // 消せなくても次で上書きされる
  }
  return { ...EMPTY };
}

/** 名前として使えるか。使えないときは理由を返す */
export function nameError(raw) {
  const name = normalizeName(raw);
  if (!name) return "名前を入力してください";
  if (String(raw).trim().length > MAX_NAME_LEN)
    return `名前は${MAX_NAME_LEN}文字までです`;
  return null;
}

/** 名前を決める。はじめて決めたときに id も作る */
export function saveName(raw) {
  const name = normalizeName(raw);
  if (!name) return loadProfile();
  const profile = loadProfile();
  const next = { ...profile, name, id: profile.id || makeId() };
  saveProfile(next);
  return next;
}

function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // 保存できなくても遊べる方を優先する
  }
}

/** 使うアイコンを選ぶ。持っていないものは受け付けない */
export function saveIcon(id) {
  const profile = loadProfile();
  if (!hasIcon(profile, id)) return profile;
  const next = { ...profile, icon: id };
  saveProfile(next);
  return next;
}

/** 使う称号を選ぶ。持っていないものは受け付けない */
export function saveTitle(id) {
  const profile = loadProfile();
  if (!hasTitle(profile, id)) return profile;
  const next = { ...profile, title: id };
  saveProfile(next);
  return next;
}

/** 称号を配る。対局数などで決まらない、催しなどの褒美の想定 */
export function grantTitle(id) {
  const profile = loadProfile();
  if (profile.titles.includes(id)) return profile;
  const next = { ...profile, titles: [...profile.titles, id] };
  saveProfile(next);
  return next;
}

/** アイコンを手に入れる。対局の褒美として配る想定 */
export function grantIcon(id) {
  const profile = loadProfile();
  if (profile.icons.includes(id)) return profile;
  const next = { ...profile, icons: [...profile.icons, id] };
  saveProfile(next);
  return next;
}

/**
 * 1局終えた記録をつけて、更新後のプロフィールを返す。
 *
 * opts.foeRating を渡した対局だけレーティングが動く。オンライン対戦で
 * 相手の持ち点が分かっているときだけ渡す。増減は戻り値の delta に入る。
 * opts.xp を渡すと、対戦ぶんの代わりにその経験値を配る(チュートリアル)。
 * opts.tutorial を立てた対局は、対戦の数に数えない。
 */
export function recordGame(won, opts) {
  const profile = loadProfile();
  const foeRating = opts && opts.foeRating;
  const rated = typeof foeRating === "number";
  const before = profile.rating;
  const after = rated
    ? applyRating(before, foeRating, won, profile.rated)
    : before;
  const gained =
    opts && Number.isFinite(opts.xp) && opts.xp >= 0 ? opts.xp : XP.BATTLE;
  const levelBefore = levelOf(profile);
  const next = {
    ...profile,
    plays: profile.plays + 1,
    battles: profile.battles + (opts && opts.tutorial ? 0 : 1),
    wins: profile.wins + (won ? 1 : 0),
    xp: profile.xp + gained,
    rating: after,
    rated: profile.rated + (rated ? 1 : 0),
  };
  // この1局で新しく使えるようになった称号。画面で知らせる。
  // 持ち点で決まるものは、あとで持ち点が下がっても失わないように焼き付ける
  const earned = newlyEarned(profile, next);
  next.titles = [
    ...next.titles,
    ...earned.map((t) => t.id).filter((id) => !next.titles.includes(id)),
  ];
  saveProfile(next);
  const levelAfter = levelOf(next);
  return {
    ...next,
    delta: rated ? after - before : null,
    before,
    earned,
    gained,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
  };
}

/** レベル。経験値の総量から決まる */
export function levelOf(profile) {
  if (TEST_BUILD) return MAX_LEVEL;
  return levelOfXp((profile || EMPTY).xp);
}

/** いまのレベルの中での進み具合。帯や「あと◯」の表示に使う */
export function levelProgress(profile) {
  const p = progressOfXp((profile || EMPTY).xp);
  if (!TEST_BUILD) return p;
  // テストビルドでは全員が上限。帯は満杯にしておく
  return { ...p, level: MAX_LEVEL, ratio: 1, left: null, done: true };
}

/** 次のレベルまでに必要な経験値。最高レベルなら null */
export function toNextLevel(profile) {
  return levelProgress(profile).left;
}

/** 経験値を足す。対局以外(有償ガチャなど)から呼ぶ */
export function addXp(amount) {
  const profile = loadProfile();
  const gained = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  if (!gained) return { ...profile, gained: 0, leveledUp: false };
  const levelBefore = levelOf(profile);
  const next = { ...profile, xp: profile.xp + gained };
  saveProfile(next);
  const levelAfter = levelOf(next);
  return {
    ...next,
    gained,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
  };
}
