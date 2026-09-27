/**
 * 手ごたえ(バイブ)。
 *
 * 相手の駒を取ったときに短く震わせる。**王を取ったときは別の震え方**にして、
 * 画面を見る前に「大きいことが起きた」と分かるようにする(2026-09-28 本人の指示)。
 *
 * 作り:
 * - 使うのは `navigator.vibrate` だけ。Capacitor の Haptics プラグインは入れていない
 *   (プラグインを1つ増やすと iOS の SPM と審査の申告が増える)。
 * - **iOS の WebView は navigator.vibrate を持たない。** そこでは何も起きない。
 *   鳴らない端末でも対局は同じに進むよう、失敗しても黙って通す。
 *   iOS で震わせたくなったら、ここだけを Haptics プラグインに差し替えればよい。
 * - 音と同じで、設定の「音を鳴らさない」とは別。震えは音ではないので連動させない。
 */

/** 震え方の型(ミリ秒の並び。数値1つなら、その長さで1回) */
export const PATTERNS = Object.freeze({
  /** ふつうの駒を取った。短く1回 */
  capture: 35,
  /** まとめて取った。枚数ぶん、軽く刻む */
  captureMany: [30, 60, 30, 60, 30],
  /** 王を取った。長め→間→長めで、ふつうの取りと聞き分けられる */
  king: [90, 70, 160],
  /** 自分の王が取られた。王と同じ重さだが、間を詰めて慌ただしくする */
  kingLost: [140, 60, 60, 60, 140],
});

/** この端末で震やせるか */
export function canVibrate() {
  try {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  } catch {
    return false;
  }
}

/**
 * 震わせる。pattern は PATTERNS の名前か、ミリ秒の並び。
 * 鳴らせない端末では何もしない(例外も投げない)
 */
export function vibrate(pattern) {
  const p = typeof pattern === "string" ? PATTERNS[pattern] : pattern;
  if (p === undefined || p === null) return false;
  if (!canVibrate()) return false;
  try {
    return navigator.vibrate(p) !== false;
  } catch {
    return false;
  }
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
