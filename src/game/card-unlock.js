/**
 * プレイヤーレベルで開く札。
 *
 * 手元の対局(CPU戦・同じ端末)で配る札を、レベルに応じて絞る。
 * 段はチュートリアルと同じ(第4話で 6〜9、第6話で 10、第7話で J・Q、
 * 第8話で K、第9話で A)。各話は同じ番号のレベルで開くので、
 * 「話を終えて次のレベルに上がると、その話で覚えた札が対局でも使える」になる。
 *
 * オンライン(ランダムマッチ・ルーム)は絞らない。相手と同じ山札を使うので、
 * 片方のレベルで山札を変えるわけにいかない。ランダムマッチは第8話まで
 * 終えないと開かず(レベル9)、そのときには全部の札が開いている。
 */
import { CARD_POOLS } from "./constants.js";

/** レベルごとに加わる札。上から順に、そのレベル以上なら開く */
export const CARD_UNLOCKS = Object.freeze([
  { level: 1, pool: "basic", adds: ["2", "3", "4", "5"], label: "2〜5" },
  { level: 4, pool: "mid", adds: ["6", "7", "8", "9"], label: "6〜9" },
  { level: 6, pool: "numbers", adds: ["10"], label: "10" },
  { level: 7, pool: "high", adds: ["J", "Q"], label: "J・Q" },
  { level: 8, pool: "court", adds: ["K"], label: "K" },
  { level: 9, pool: "full", adds: ["A"], label: "A" },
]);

/** すべての札が開くレベル */
export const ALL_CARDS_LEVEL = CARD_UNLOCKS[CARD_UNLOCKS.length - 1].level;

/** 9×9 が開くレベル。2〜5 の16枚では 9枚×2人の手札が作れない */
export const BOARD9_LEVEL = 4;

function lv(level) {
  const n = Number(level);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** そのレベルで開いている段 */
export function cardUnlockFor(level) {
  const n = lv(level);
  let cur = CARD_UNLOCKS[0];
  for (const u of CARD_UNLOCKS) if (u.level <= n) cur = u;
  return cur;
}

/** そのレベルで配る札。全部開いていれば null(絞らない) */
export function poolForLevel(level) {
  const u = cardUnlockFor(level);
  return u.pool === "full" ? null : CARD_POOLS[u.pool];
}

/**
 * そのレベルで配る手札の枚数。null なら盤の決まりのまま。
 * 2〜5 の16枚だけのときは、手札5枚では並べ方に選びようが無いので
 * チュートリアルと同じ6枚にする(2人で12枚、予備札は4枚)
 */
export function handSizeForLevel(level) {
  return cardUnlockFor(level).pool === "basic" ? 6 : null;
}

/** 次に開く段。全部開いていれば null */
export function nextCardUnlock(level) {
  const n = lv(level);
  return CARD_UNLOCKS.find((u) => u.level > n) || null;
}

/** その盤の大きさで遊べるか */
export function boardOpen(size, level) {
  return size === 9 ? lv(level) >= BOARD9_LEVEL : true;
}

/** そのレベルで開いている札を、ルール設定に出す文 */
export function cardUnlockText(level) {
  const pool = poolForLevel(level);
  const next = nextCardUnlock(level);
  if (!pool) return "すべての札を使えます";
  // 開いている札は 2 から続きの並びなので「2〜9」のように詰める
  const have = `${pool[0]}〜${pool[pool.length - 1]}`;
  return next
    ? `使える札は ${have}。Lv${next.level} で ${next.label} が加わります`
    : `使える札は ${have}`;
}
