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
export function PlayerIcon({ icon, name, side, frame, size = "md" }) {
  const chosen = findIcon(icon);
  const color =
    side === void 0 || side === null ? null : PLAYER_META[side].color;
  return (
    <span
      className={`player-icon player-icon-${size} ${frame === "gold-laurel" ? "player-icon-laurel" : ""}`}
      style={color ? { "--who": color } : void 0}
      aria-hidden="true"
    >
      {chosen.mark || (name || "?").slice(0, 1)}
      {frame === "gold-laurel" && (
        <svg className="player-laurel" viewBox="0 0 64 64" aria-hidden="true">
          <g fill="#e6ca7d" stroke="#b08b3c" strokeWidth=".5">
            {[false, true].map((flip) => (
              <g
                key={String(flip)}
                transform={flip ? "translate(64 0) scale(-1 1)" : undefined}
              >
                <path
                  d="M27 58 C3 51 1 25 14 7"
                  fill="none"
                  stroke="#d4b462"
                  strokeWidth="1.4"
                />
                {[
                  [11, 13, -24],
                  [7, 23, -6],
                  [7, 34, 14],
                  [12, 44, 37],
                  [21, 53, 55],
                ].map(([x, y, angle]) => (
                  <g
                    key={y}
                    transform={`translate(${x} ${y}) rotate(${angle})`}
                  >
                    <ellipse cx="-3" cy="0" rx="2.4" ry="5.2" />
                    <ellipse
                      cx="3"
                      cy="3"
                      rx="2.4"
                      ry="5.2"
                      transform="rotate(48 3 3)"
                    />
                  </g>
                ))}
              </g>
            ))}
          </g>
        </svg>
      )}
    </span>
  );
}
