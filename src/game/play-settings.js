/**
 * 対局中の操作の設定。端末の localStorage にだけ持つ。
 *
 * audio/settings.js と同じで、読めない環境(プライベートブラウズなど)でも
 * 遊べるほうを優先する。保存できなければ既定値のまま動く。
 */

const KEY = "tottery.play.v1";

/**
 * 既定値。
 *
 * confirmMove: 駒を動かす前に「ここに動かしますか」を挟む。**既定は on**
 *   (2026-09-28 本人の指示)。指の滑りで意図しないマスへ動くのを防ぐ。
 *   相手の駒を取る手は、この設定に関わらず前から確認を挟んでいる(取ると正体が公開されるため)。
 */
const DEFAULT = Object.freeze({ confirmMove: true });

export function loadPlaySettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const saved = JSON.parse(raw);
    return {
      // 保存に無い項目は既定値で補う(あとから設定が増えても古い保存を読める)
      confirmMove:
        typeof saved.confirmMove === "boolean"
          ? saved.confirmMove
          : DEFAULT.confirmMove,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function savePlaySettings(next) {
  const value = { confirmMove: !!next.confirmMove };
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // 保存できなくても、その場のあいだは効かせる
  }
  // 開いている対局の画面にも、その場で伝える
  try {
    window.dispatchEvent(new CustomEvent("tottery:play-settings", { detail: value }));
  } catch {
    /* window が無いところ(検査)では何もしない */
  }
  return value;
}

/** 駒を動かす前に確認を挟むか */
export function confirmMoveOn() {
  return loadPlaySettings().confirmMove;
}

export { DEFAULT as PLAY_DEFAULTS, KEY as PLAY_SETTINGS_KEY };
