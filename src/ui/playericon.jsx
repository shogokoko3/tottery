/**
 * プレイヤーのアイコン。
 *
 * 設定の札と、対局中の時計の欄に出す。
 * 対局中のスタンプは、この印のそばに出す想定で置いている。
 */
import { PLAYER_META } from "../game/constants.js";
import { findIcon } from "../game/icons.js";

/**
 * icon はアイコンの id、name は頭文字を出すときに使う名前。
 * side を渡すと、その席の色で縁取る。
 */
export function PlayerIcon({ icon, name, side, size = "md" }) {
  const chosen = findIcon(icon);
  const color =
    side === void 0 || side === null ? null : PLAYER_META[side].color;
  return (
    <span
      className={`player-icon player-icon-${size}`}
      style={color ? { "--who": color } : void 0}
      aria-hidden="true"
    >
      {chosen.mark || (name || "?").slice(0, 1)}
    </span>
  );
}
