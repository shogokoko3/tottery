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
 *
 * サーバーの台帳では **earn(1日30枚)とは別の道**(kind=tutorial)に積む(2026-09-30 本人の指示)。
 * 話の数が有限なので、上限は「話ごとに一度」で足りる(1人あたり最大 13×10 枚)
 */

/** 1話終えるごとに配るガチャチケットの枚数 */
export const TUTORIAL_TICKETS = 10;

/**
 * 褒美のある話の番号の上限(= いちばん大きい話の id。番外の第13話も含む)。**サーバーもこれを見る**。
 * 台帳の「tutorial」の道は、この番号までしか受け付けない(1人あたり最大 13×10 枚で打ち止め)。
 * 話を増やしたら、ここも増やす(tools/check-first-pull.mjs が ALL_TUTORIALS の最大 id と照らす)
 */
export const TUTORIAL_REWARD_MAX_ID = 13;

/** 話の番号として正しいか(1〜TUTORIAL_REWARD_MAX_ID の整数) */
export const isRewardChapter = (id) =>
  Number.isInteger(id) && id >= 1 && id <= TUTORIAL_REWARD_MAX_ID;

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

/**
 * 台帳の出来事 id。同じ話の褒美を二度積まない。
 * **組むのはサーバー**(認証済みの uid から)。端末は「何話」だけ送る。
 * 端末で組むと、圏外で uid が取れないとき `tutorial:local:N` になって全員で衝突していた(2026-09-30)
 */
export const rewardEventId = (uid, id) => `tutorial:${uid}:${id}`;

/** 古い端末が earn の道に流してくる `tutorial:<uid>:<話>` から、話の番号だけ取り出す(合わなければ null) */
export function chapterFromLegacyId(id) {
  const m = typeof id === "string" ? /^tutorial:[^:]*:(\d{1,3})$/.exec(id) : null;
  if (!m) return null;
  const n = Number(m[1]);
  return isRewardChapter(n) ? n : null;
}

/**
 * 今回はじめて終えた話のぶんを配る。
 * 端末の財布(giveGift)とサーバーの台帳(earnTickets)の両方へ。
 * どちらも失敗しても対局は止めない。
 *
 * cleared … 今回はじめて終えた id の並び
 * 返り値は配った枚数(0 なら何もしていない)
 */
export async function grantTutorialTickets(cleared, { uid = null } = {}) {
  void uid; // 以前は id を端末で組んでいた名残。いまはサーバーが組むので使わない
  const ids = [...new Set((Array.isArray(cleared) ? cleared : []).filter(isRewardChapter))];
  if (!ids.length) return 0;
  const amount = ids.length * TUTORIAL_TICKETS;
  const { giveGift } = await import("./gifts.js");
  const { earnTutorialTicket } = await import("../net/wallet.js");
  await giveGift({ type: "ticket", amount }).catch(() => {});
  // 台帳は話ごとに送る(途中で止まっても、送れたぶんは残る)。
  // 1日の上限がある earn ではなく、話ごとに一度きりの tutorial の道へ
  for (const id of ids) await earnTutorialTicket(id).catch(() => {});
  return amount;
}

/** 一度だけ送り直したことの控え(端末ごと) */
export const BACKFILL_KEY = "tottery.tutorial-reward.backfill.v1";

/**
 * すでに終えた話の褒美を、もう一度サーバーへ送る(2026-09-30)。
 *
 * 別枠にする前の版では、一気に飛ばすと earn の1日上限で4話目からが捨てられ、
 * 端末の保留列からも消えていた。サーバーは話ごとに冪等なので、
 * profile.cleared にある話を全部送り直しても二重には積まれない。
 * 端末の財布(giveGift)には足さない(以前に足したぶんは mirror で戻されている。残高はサーバーに合わせる)。
 * 端末ごとに一度きり。返り値は送った話の数
 */
export async function backfillTutorialRewards() {
  let done = false;
  try {
    done = localStorage.getItem(BACKFILL_KEY) === "1";
  } catch {
    /* 読めなければ一度送る */
  }
  if (done) return 0;
  const { loadProfile } = await import("./profile.js");
  const { earnTutorialTicket } = await import("../net/wallet.js");
  const cleared = [...new Set((loadProfile().cleared || []).filter(isRewardChapter))];
  for (const id of cleared) await earnTutorialTicket(id).catch(() => {});
  try {
    localStorage.setItem(BACKFILL_KEY, "1");
  } catch {
    /* 控えられなければ次も送る(冪等なので害はない) */
  }
  return cleared.length;
}
