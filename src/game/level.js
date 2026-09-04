/**
 * プレイヤーレベルと経験値。
 *
 * 経験値は貯まる一方で、減らない。レベルはその総量から毎回導くので、
 * 保存するのは経験値だけでよく、古い保存からの引き継ぎも足し算で済む。
 *
 * 曲線は2段。レベル10までは +200 ずつ増える手が届く坂で、そこから先は
 * 緩やかに増やして、対戦だけなら約5000戦でレベル100(上限)に届く。
 */

/** 上限 */
export const MAX_LEVEL = 100;

/**
 * レベル1→2 … 9→10 に要る経験値。
 *
 * 元の指示では 5→6 の行が抜けていたので、+200 ずつの等差として補ってある
 * (100・300・500・700・900・1100・1300・1500・1700)。ここを直せば、
 * チュートリアルの配分も検査(tools/check-level.mjs)がまとめて確かめ直す。
 */
export const EARLY_STEPS = [100, 300, 500, 700, 900, 1100, 1300, 1500, 1700];

/** レベル10以降の増え方。10→11 が 1800 で、1つ上がるごとに 20 ずつ重くなる */
const LATE_BASE = 1800;
const LATE_GROWTH = 20;

/** そのレベルから次へ上がるのに要る経験値 */
export function stepFor(level) {
  if (level < 1 || level >= MAX_LEVEL) return 0;
  if (level < EARLY_STEPS.length + 1) return EARLY_STEPS[level - 1];
  return LATE_BASE + LATE_GROWTH * (level - EARLY_STEPS.length - 1);
}

/** そのレベルに達するのに要る経験値の累計 */
export function totalFor(level) {
  let sum = 0;
  for (let lv = 1; lv < Math.min(level, MAX_LEVEL); lv++) sum += stepFor(lv);
  return sum;
}

/** 経験値の総量からレベルを出す */
export function levelOfXp(xp) {
  const have = Number.isFinite(xp) && xp > 0 ? xp : 0;
  let level = 1;
  let need = stepFor(1);
  let spent = 0;
  while (level < MAX_LEVEL && have - spent >= need) {
    spent += need;
    level++;
    need = stepFor(level);
  }
  return level;
}

/**
 * いまのレベルの中での進み具合。
 * 上限に達していれば done を立て、次までの数は null にする。
 */
export function progressOfXp(xp) {
  const have = Number.isFinite(xp) && xp > 0 ? xp : 0;
  const level = levelOfXp(have);
  if (level >= MAX_LEVEL)
    return { level, xp: have, into: 0, need: 0, left: null, ratio: 1, done: true };
  const base = totalFor(level);
  const need = stepFor(level);
  const into = have - base;
  return {
    level,
    xp: have,
    into,
    need,
    left: need - into,
    ratio: need ? into / need : 0,
    done: false,
  };
}

/** 経験値の入り口。ここに無いものは経験値を配らない */
export const XP = {
  /** 対戦を1局終える(勝ち負けは問わない) */
  BATTLE: 50,
  /** 有償のガチャを1回引く。いまは無料のテスト版なので、まだ配られない */
  PAID_GACHA: 150,
};
