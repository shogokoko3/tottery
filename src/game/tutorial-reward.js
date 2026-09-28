/**
 * チュートリアルを終えたときの褒美(2026-09-28 本人の指示
 * 「チュートリアルクリア報酬をガチャチケットにする。1章をクリアする毎に10枚」)。
 *
 * チュートリアルには章の区切りが無く、**第1話〜第12話の12話**しかないので、
 * 「1章」は「1話」として数える。1話ごとに TUTORIAL_TICKETS 枚。
 * 12話ぜんぶで 120 枚(＝10連が12回ぶん)。**枚数を変えるならここの1つだけ**。
 *
 * 経験値(profile.js の skipTutorials)はこれまで通り配る。
 * レベルで使える札と盤の大きさが開く作りなので、止めると先へ進めなくなる。
 * チケットは、その上に乗せる「目に見える褒美」。
 *
 * 二度は配らない。配るのは**その回に新しく終えた話**だけで、
 * skipTutorials が返す skipped(今回はじめて終えた id)をそのまま渡す。
 */

/** 1話終えるごとに配るガチャチケットの枚数 */
export const TUTORIAL_TICKETS = 10;

/**
 * 今回はじめて終えた話に対して配る枚数。
 * cleared は id の並び(skipTutorials の skipped)
 */
export function ticketsForCleared(cleared) {
  const ids = Array.isArray(cleared) ? cleared.filter((id) => Number.isInteger(id)) : [];
  // 同じ id が重なっても一度だけ数える
  return new Set(ids).size * TUTORIAL_TICKETS;
}

/** 画面に出す一言。0 枚なら null(何も出さない) */
export function ticketRewardLabel(count) {
  const n = Number(count) || 0;
  return n > 0 ? `ガチャチケット ${n}枚` : null;
}

/** 台帳に送るときの目印。同じ話の褒美を二度積まない */
export const rewardEventId = (uid, id) => `tutorial:${uid || "local"}:${id}`;

/**
 * 今回はじめて終えた話のぶんを配る。
 * 端末の財布(giveGift)とサーバーの台帳(earnTickets)の両方へ。
 * どちらも失敗しても対局は止めない。
 *
 * cleared … 今回はじめて終えた id の並び
 * 返り値は配った枚数(0 なら何もしていない)
 */
export async function grantTutorialTickets(cleared, { uid = null } = {}) {
  const ids = [...new Set((Array.isArray(cleared) ? cleared : []).filter(Number.isInteger))];
  if (!ids.length) return 0;
  const amount = ids.length * TUTORIAL_TICKETS;
  const { giveGift } = await import("./gifts.js");
  const { earnTickets } = await import("../net/wallet.js");
  await giveGift({ type: "ticket", amount }).catch(() => {});
  // 台帳は話ごとに送る(途中で止まっても、送れたぶんは残る)
  for (const id of ids)
    await earnTickets(rewardEventId(uid, id), TUTORIAL_TICKETS).catch(() => {});
  return amount;
}
