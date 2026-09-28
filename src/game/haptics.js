/**
 * 手ごたえ(バイブ)。
 *
 * 相手の駒を取ったときに短く震わせる。**王を取ったときは別の震え方**にして、
 * 画面を見る前に「大きいことが起きた」と分かるようにする(2026-09-28 本人の指示)。
 *
 * 作り:
 * - **@capacitor/haptics** を使う(2026-09-28 に追加)。
 *   はじめは navigator.vibrate だけで書いたが、**iPhone の WebView はこれを持たない**ので
 *   iOS で何も起きなかった。プラグインなら iPhone の Taptic Engine が鳴り、
 *   Android と Web では中でその navigator.vibrate に落ちる。
 * - iPhone では「長さ(ミリ秒)」ではなく **強さと種類**で指定する。
 *   Taptic Engine は時間で震えるものではないので、長さを渡しても同じ叩き方になる。
 *     impact(Light/Medium/Heavy) … 物がぶつかった手ごたえ
 *     notification(Success/Warning/Error) … 出来事の知らせ。**3連打で、impact と明確に違う**
 * - Capacitor のプラグインは Proxy なので、**async からそのまま return / await しない**
 *   (then() がネイティブ呼び出しになって永遠に戻らない。2026-09-15 に店で踏んだ)。
 *   使うメソッドだけを包んだ then を持たない入れ物にしてから触る。
 * - 鳴らない端末(許可が無い・対応していない)でも対局は同じに進むよう、失敗しても黙って通す。
 */
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * 使うメソッドだけの薄い包み。then を持たないので、返しても await されない
 * (iap.js と同じ作り)
 */
const tap = {
  impact: (options) => Haptics.impact(options),
  notification: (options) => Haptics.notification(options),
};

/**
 * 震え方の型。
 *   kind … "impact"(ぶつかった手ごたえ)か "notification"(出来事の知らせ)
 *   arg  … その強さ・種類
 *   web  … navigator.vibrate しか無いところ向けのミリ秒の並び(検査でも読む)
 */
export const PATTERNS = Object.freeze({
  /** ふつうの駒を取った。軽く1回 */
  capture: Object.freeze({ kind: "impact", style: ImpactStyle.Light, web: 20 }),
  /** まとめて取った。中くらいの手ごたえを枚数ぶん */
  captureMany: Object.freeze({
    kind: "impact",
    style: ImpactStyle.Medium,
    repeat: 3,
    web: [30, 60, 30, 60, 30],
  }),
  /** 王を取った。**知らせ**の型にして、ふつうの取りとはっきり変える */
  king: Object.freeze({
    kind: "notification",
    type: NotificationType.Success,
    web: [35, 65, 21],
  }),
  /** 自分の王が取られた。同じ知らせでも違う型(iPhone では叩き方が変わる) */
  kingLost: Object.freeze({
    kind: "notification",
    type: NotificationType.Error,
    web: [27, 45, 50],
  }),
  /**
   * 相手が見つかった(2026-09-28 本人の指示
   * 「オンラインでマッチングした時にもバイブ通知があるように」)。
   * 待っているあいだは画面を見ていないことが多いので、**取ったときより強く**する。
   * 取りの手ごたえ(impact)ではなく知らせ(notification)の型なので、対局中の震えとも混ざらない
   */
  matchFound: Object.freeze({
    kind: "notification",
    type: NotificationType.Warning,
    web: [30, 40, 30, 50, 60],
  }),
});

/** まとめ取りで刻むときの間隔(ミリ秒) */
const REPEAT_MS = 90;

/** この端末で震わせられるか(プラグインが載っていれば、その先はプラグインが決める) */
export function canVibrate() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function")
      return true;
    // iOS のアプリ。navigator.vibrate は無いが、プラグインが鳴らす
    return !!Haptics;
  } catch {
    return false;
  }
}

/** 1回鳴らす。失敗しても黙って通す */
function fire(pattern) {
  try {
    if (pattern.kind === "notification")
      tap.notification({ type: pattern.type })?.catch?.(() => {});
    else tap.impact({ style: pattern.style })?.catch?.(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * 震わせる。pattern は PATTERNS の名前か、その中身。
 * 鳴らせない端末では何もしない(例外も投げない)
 */
export function vibrate(pattern) {
  const p = typeof pattern === "string" ? PATTERNS[pattern] : pattern;
  if (!p || !p.kind) return false;
  const ok = fire(p);
  // まとめ取りは間を置いて刻む。1回目は上で鳴らしたぶん
  if (ok && p.repeat > 1)
    for (let i = 1; i < p.repeat; i++)
      setTimeout(() => fire(p), REPEAT_MS * i);
  return ok;
}

/**
 * 駒を取った(取られた)ときの震え方を選ぶ。
 *   mine   … 取ったのが自分か
 *   king   … 取った(取られた)中に王がいたか
 *   count  … 枚数
 */
export function capturePattern({ mine = true, king = false, count = 1 } = {}) {
  if (king) return mine ? PATTERNS.king : PATTERNS.kingLost;
  return count > 1 ? PATTERNS.captureMany : PATTERNS.capture;
}

/** 駒を取った(取られた)ときに震わせる */
export function vibrateCapture(info) {
  return vibrate(capturePattern(info));
}

/**
 * 相手が見つかったときに震わせる(ランダムマッチ・練習相手の両方)。
 * 待っているあいだは画面から目を離していることが多いので、ここで知らせる
 */
export function vibrateMatchFound() {
  return vibrate("matchFound");
}
