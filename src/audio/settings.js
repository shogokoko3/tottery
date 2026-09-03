/**
 * 音の設定。端末の localStorage にだけ持つ。
 *
 * profile.js と同じで、読めない環境(プライベートブラウズなど)でも
 * 遊べるほうを優先する。保存できなければ既定値のまま鳴らす。
 */

const KEY = "tottery.audio.v1";

/** 既定値。初めて遊ぶ人にいきなり大きな音を出さない程度 */
const DEFAULT = { bgm: 0.6, muted: false };

/** 音量として通す範囲 */
function clamp(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT.bgm;
  return Math.min(1, Math.max(0, n));
}

export function loadAudioSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const saved = JSON.parse(raw);
    return { bgm: clamp(saved.bgm), muted: !!saved.muted };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveAudioSettings(next) {
  const value = { bgm: clamp(next.bgm), muted: !!next.muted };
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // 保存できなくても、その場のあいだは効かせる
  }
  return value;
}
