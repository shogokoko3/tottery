/**
 * 音の設定。端末の localStorage にだけ持つ。
 *
 * profile.js と同じで、読めない環境(プライベートブラウズなど)でも
 * 遊べるほうを優先する。保存できなければ既定値のまま鳴らす。
 */

const KEY = "tottery.audio.v1";

/**
 * 既定値。初めて遊ぶ人にいきなり大きな音を出さない程度。
 * 効果音は BGM より少し前に出す。操作に返ってくる音なので、
 * 埋もれると押した手応えが無くなる。
 */
const DEFAULT = { bgm: 0.6, se: 0.75, muted: false };

/** 音量として通す範囲 */
function clamp(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export function loadAudioSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const saved = JSON.parse(raw);
    // se を持たなかった頃の保存を読んだときは、既定値で補う
    return {
      bgm: clamp(saved.bgm, DEFAULT.bgm),
      se: clamp(saved.se, DEFAULT.se),
      muted: !!saved.muted,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveAudioSettings(next) {
  const value = {
    bgm: clamp(next.bgm, DEFAULT.bgm),
    se: clamp(next.se, DEFAULT.se),
    muted: !!next.muted,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // 保存できなくても、その場のあいだは効かせる
  }
  return value;
}
