/**
 * 手ごたえ(バイブ)。
 *
 * 相手の駒を取ったときに短く震わせる。**王を取ったときは別の震え方**にして、
 * 王専用の振動は、最後に正体が見えてから鳴らす。溜めの途中では王だと知らせない。
 *
 * 作り:
 * - **@capacitor/haptics** を使う(2026-09-28 に追加)。
 *   はじめは navigator.vibrate だけで書いたが、**iPhone の WebView はこれを持たない**ので
 *   iOS で何も起きなかった。プラグインなら iPhone の Taptic Engine が鳴り、
 *   Android はネイティブの振動、Web は navigator.vibrate を使う。
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
import { hapticsEnabled, subscribeHaptics } from "./haptic-settings.js";

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
  /** 中央の裏面が砕ける瞬間。王の正体によって変えない。 */
  captureBreak: Object.freeze({ kind: "impact", style: ImpactStyle.Medium, web: 43 }),
  captureLast: Object.freeze({ kind: "impact", style: ImpactStyle.Medium, web: 43 }),
  gateTouch: Object.freeze({ kind: "impact", style: ImpactStyle.Light, web: 20 }),
  gateOpen: Object.freeze({ kind: "impact", style: ImpactStyle.Medium, web: 43 }),
  raritySR: Object.freeze({
    kind: "impact", style: ImpactStyle.Medium, web: 43,
    group: "summon", priority: 1,
  }),
  raritySSR: Object.freeze({
    kind: "impact", style: ImpactStyle.Light, web: [20, 80, 61],
    followUp: ImpactStyle.Heavy, delay: 100,
    group: "summon", priority: 2,
  }),
  foil: Object.freeze({
    kind: "impact", style: ImpactStyle.Light, web: [20, 80, 61],
    followUp: ImpactStyle.Heavy, delay: 100,
    group: "summon", priority: 3,
  }),
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
const pending = new Set();
const groups = new Map();

function allowed() {
  return hapticsEnabled() && !(typeof document !== "undefined" && document.hidden);
}

/** OFFやバックグラウンド移行時は、連続振動の残りも捨てる。 */
export function cancelHaptics() {
  for (const cancel of [...pending]) cancel();
  groups.clear();
}
subscribeHaptics(() => {
  if (!hapticsEnabled()) cancelHaptics();
});
globalThis.document?.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelHaptics();
});

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
  if (!allowed()) return false;
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
  return !!playHaptic(pattern);
}

/** 演出を閉じる際に、2段階の振動の残りも止められる。 */
export function playHaptic(pattern) {
  const p = typeof pattern === "string" ? PATTERNS[pattern] : pattern;
  if (!p || !p.kind || !allowed()) return null;
  // 10連をまとめて開いても同じ振動を重ねない。SSR・フォイルを優先。
  const previous = p.group && groups.get(p.group);
  if (previous && Date.now() - previous.at < 160) {
    if (previous.priority >= p.priority) return null;
    previous.cancel();
  }
  const timers = new Set();
  const cancel = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    pending.delete(cancel);
  };
  const ok = fire(p);
  if (!ok) return null;
  const later = (delay, pulse) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fire(pulse);
      if (!timers.size) pending.delete(cancel);
    }, delay);
    timers.add(timer);
    pending.add(cancel);
  };
  if (p.group) groups.set(p.group, { at: Date.now(), priority: p.priority, cancel });
  if (p.followUp) later(p.delay, { kind: "impact", style: p.followUp });
  // まとめ取りは間を置いて刻む。1回目は上で鳴らしたぶん
  if (ok && p.repeat > 1)
    for (let i = 1; i < p.repeat; i++)
      later(REPEAT_MS * i, p);
  return cancel;
}

/** 公開した札だけを参照。1枚ごとに鳴らし、王は専用通知に任せる。 */
export function captureRevealPattern({ index, total, king = false, mine = true }) {
  if (!mine || king || total < 2 || index < 0 || index >= total) return null;
  if (index === total - 1) return PATTERNS.captureLast;
  return PATTERNS.capture;
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
