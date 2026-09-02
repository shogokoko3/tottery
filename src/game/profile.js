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

const KEY = "tottery.account.v1";
/** 名前を持たなかった頃の保存先。1度だけ読み込んで引き継ぐ */
const OLD_KEY = "tottery.profile.v1";

/** 名前の長さの上限 */
export const MAX_NAME_LEN = 10;

/** 最高レベル */
export const MAX_LEVEL = 10;

/** レベルが1つ上がるのに要るポイント */
export const LEVEL_STEP = 3;

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

const EMPTY = { id: null, name: "", plays: 0, wins: 0 };

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
    plays: Number(saved.plays) || 0,
    wins: Number(saved.wins) || 0,
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

/** 1局終えた記録をつけて、更新後のプロフィールを返す */
export function recordGame(won) {
  const profile = loadProfile();
  const next = {
    ...profile,
    plays: profile.plays + 1,
    wins: profile.wins + (won ? 1 : 0),
  };
  saveProfile(next);
  return next;
}

/** 経験の合計。勝った対局は2局ぶんとして数える */
export function pointsOf(profile) {
  return profile.plays + profile.wins;
}

/** レベル。3ポイントごとに1つ上がる */
export function levelOf(profile) {
  if (TEST_BUILD) return MAX_LEVEL;
  return Math.min(MAX_LEVEL, 1 + Math.floor(pointsOf(profile) / LEVEL_STEP));
}

/** 次のレベルまでに必要なポイント。最高レベルなら null */
export function toNextLevel(profile) {
  if (TEST_BUILD || levelOf(profile) >= MAX_LEVEL) return null;
  return LEVEL_STEP - (pointsOf(profile) % LEVEL_STEP);
}
