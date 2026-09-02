/**
 * プレイヤーレベル。
 * 対局した回数と勝った回数で上がり、チュートリアルの開放条件になる。
 * 保存先は端末の localStorage だけで、サーバーには送らない。
 */

const KEY = "tottery.profile.v1";

/** 最高レベル */
export const MAX_LEVEL = 10;

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

const EMPTY = { plays: 0, wins: 0 };

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const saved = JSON.parse(raw);
    return {
      plays: Number(saved.plays) || 0,
      wins: Number(saved.wins) || 0,
    };
  } catch {
    // プライベートブラウズなどで読めないことがある。既定値で進める
    return { ...EMPTY };
  }
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
  return Math.min(MAX_LEVEL, 1 + Math.floor(pointsOf(profile) / 3));
}

/** 次のレベルまでに必要なポイント。最高レベルなら null */
export function toNextLevel(profile) {
  if (TEST_BUILD || levelOf(profile) >= MAX_LEVEL) return null;
  return 3 - (pointsOf(profile) % 3);
}
