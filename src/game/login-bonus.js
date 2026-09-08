/**
 * ログインボーナス。
 *
 * 1日1回、開いた人にガチャチケットを配る。7日でひと回りする。
 *
 * 進み方は「受け取った回数」で数える。前の日から続いているかは見ない。
 * 続けて開けた人だけが得をする形にすると、1日空けただけで振り出しに戻り、
 * そこで離れてしまう。休んでも続きから受け取れるほうがいい。
 * 続けた日数(streak)は、褒美には効かせず、札に添えて出すだけにしてある。
 *
 * 7日目を厚くしてあるのは、「あと少しで大きいのが来る」を作るため。
 * ひと回りで10枚、ちょうど10連が1回引ける。
 */

/** ひと回りの日数 */
export const CYCLE = 7;

/** 何日目に何枚配るか。合計10枚 = 10連1回ぶん */
export const TICKETS = [1, 1, 1, 2, 1, 1, 3];

/**
 * いま何日目か(1〜7)。
 * taken は受け取った回数。0回なら1日目、7回なら次のひと回りの1日目。
 */
export function dayOf(taken) {
  const n = Number.isFinite(taken) && taken > 0 ? Math.floor(taken) : 0;
  return (n % CYCLE) + 1;
}

/** 何回目のひと回りか(1から) */
export function cycleOf(taken) {
  const n = Number.isFinite(taken) && taken > 0 ? Math.floor(taken) : 0;
  return Math.floor(n / CYCLE) + 1;
}

/** その日にもらえる枚数 */
export function ticketsOf(day) {
  const i = Math.floor(day) - 1;
  return TICKETS[i] || 0;
}

/** その日の褒美。手紙やミッションと同じ形にして、配り口を共通にする */
export function rewardOf(day) {
  return { type: "ticket", amount: ticketsOf(day) };
}

/** ひと回りの並び。札に7マスを出すときに使う */
export function cycleRows(taken) {
  const today = dayOf(taken);
  return TICKETS.map((amount, i) => ({
    day: i + 1,
    amount,
    // 今日より前は受け取り済み。今日は光らせる
    taken: i + 1 < today,
    today: i + 1 === today,
  }));
}

/**
 * まだ今日のぶんを受け取っていないか。
 * bonusDay は最後に受け取った日。今日と同じなら、もう配らない。
 */
export function isPending(profile, today) {
  if (!profile || !today) return false;
  return profile.bonusDay !== today;
}
