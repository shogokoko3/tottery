/**
 * ログイン処理の見張り(2026-11-04)。
 *
 * アプリを開いたとき・裏から戻ったとき・開いたまま日本時間0時をまたいだときに、
 * サーバーへ「今日のログイン」を問い合わせる。受け取れるかどうかはサーバーが決める。
 *
 * 次の0時は、サーバーが返した時刻から数える。端末の時計がずれていても、
 * 「サーバーの0時まであと何ミリ秒」を端末の時計に足すだけなので、ずれは効かない。
 * 裏に回っている間に端末の時計を動かされた場合に備えて、時計が戻ったときと、
 * 前の確認から30分たったときにも問い合わせ直す。
 */

const DAY = 24 * 60 * 60 * 1000;
const JST = 9 * 60 * 60 * 1000;

/** 0時をまたいでいなくても、念のため問い合わせ直す間隔 */
export const LOGIN_RECHECK = 30 * 60 * 1000;
/** 通信に失敗したとき、次に問い合わせるまで */
export const LOGIN_RETRY = 60 * 1000;

/** サーバー時刻 at から見た、次の日本時間0時(ログイン報酬の切り替わり) */
export function nextLoginDayAt(at) {
  return Math.floor((at + JST) / DAY) * DAY + DAY - JST;
}

/**
 * onCheck(force) は、問い合わせたらサーバー時刻(ミリ秒)で解決する Promise を返す。
 * 札を出している間など、いま問い合わせない時は null を返す(何も進めない)。
 * 戻り値の check(true) は、手で「もう一度確認する」を押したときに使う。問い合わせが終わるまで待てる。
 */
const quiet = { hidden: false, addEventListener() {}, removeEventListener() {} };
// 画面の無いところ(検査)でも動くようにし、待ちの時計でプロセスを引き止めない
const sleep = (fn, ms) => {
  const id = setTimeout(fn, ms);
  id?.unref?.();
  return id;
};

export function watchLoginDay(onCheck, {
  now = Date.now, page = globalThis.document || quiet, host = globalThis.window || quiet,
  later = sleep, cancel = clearTimeout,
} = {}) {
  let closed = false, busy = false, last = null, due = 0, timer;
  // 札を出している間や裏にいる間は、0時を過ぎていても1分おきに見るだけにする
  const schedule = (wait = due - now()) => {
    cancel(timer);
    if (closed || busy) return;
    timer = later(() => check(), Math.max(20, Math.min(60000, wait + 20)));
  };
  const check = (force = false) => {
    if (closed || busy) return;
    const at = now();
    const needed = force || last === null || at >= due || at < last || at - last >= LOGIN_RECHECK;
    const pending = needed && !page.hidden ? onCheck(force) : null;
    if (pending == null) return void schedule(needed ? 60000 : undefined);
    busy = true;
    cancel(timer);
    return Promise.resolve(pending).then(
      (serverNow) => {
        const back = now();
        last = back;
        due = Number.isFinite(serverNow)
          ? back + (nextLoginDayAt(serverNow) - serverNow)
          : nextLoginDayAt(back);
      },
      () => {
        last = now();
        due = last + LOGIN_RETRY;
      },
    ).finally(() => {
      busy = false;
      schedule();
    });
  };
  const wake = () => check();
  const audioState = (event) => {
    if ((event.status || event.detail?.status) === "active") check();
  };
  page.addEventListener("visibilitychange", wake);
  for (const name of ["focus", "pageshow"]) host.addEventListener(name, wake);
  host.addEventListener("tottery-audio-state", audioState);
  check();
  return {
    check,
    stop() {
      closed = true;
      cancel(timer);
      page.removeEventListener("visibilitychange", wake);
      for (const name of ["focus", "pageshow"]) host.removeEventListener(name, wake);
      host.removeEventListener("tottery-audio-state", audioState);
    },
  };
}
