import { CAPTAIN_CARD_ART, NORMAL_CARD_ART, cardBackImg } from "../assets.js";
import { PLAYER_META, SUIT_SYMBOL } from "../game/constants.js";
import { Crown } from "../icons.jsx";

export const SUIT_CODE = {
  spade: "S",
  heart: "H",
  diamond: "D",
  club: "C",
};
export function cardArtSrc(e, t, l) {
  let n = e + SUIT_CODE[t];
  return (l && CAPTAIN_CARD_ART[n]) || NORMAL_CARD_ART[n];
}
export function CardFace({ rank, suit, size = "md", isKing = !1 }) {
  let a =
    size === "xs"
      ? {
          w: 26,
          h: 35,
        }
      : size === "sm"
        ? {
            w: 38,
            h: 51,
          }
        : size === "lg"
          ? {
              w: 78,
              h: 104,
            }
          : {
              w: 50,
              h: 67,
            };
  return (
    <div
      className={`card-face ${isKing ? "card-captain" : ""}`}
      style={{
        width: a.w,
        height: a.h,
      }}
    >
      <img
        src={cardArtSrc(rank, suit, isKing)}
        alt={`${rank}${SUIT_SYMBOL[suit]}`}
        draggable="false"
      />
    </div>
  );
}
export function CardBack({ colorHex, size = "md" }) {
  let l =
    size === "xs"
      ? {
          w: 26,
          h: 35,
        }
      : size === "sm"
        ? {
            w: 38,
            h: 51,
          }
        : size === "lg"
          ? {
              w: 78,
              h: 104,
            }
          : {
              w: 50,
              h: 67,
            };
  return (
    <div
      className="card-back"
      style={{
        width: l.w,
        height: l.h,
        "--pc": colorHex,
      }}
    >
      <img src={cardBackImg} alt="" draggable="false" />
    </div>
  );
}
export function Piece({ piece, viewer, isSelected, isPickable, size = "md" }) {
  let u = PLAYER_META[piece.owner],
    i = piece.owner === viewer;
  return (
    <div
      className={`piece-wrap ${isSelected ? "piece-selected" : ""} ${isPickable ? "piece-pickable" : ""}`}
    >
      {i ? (
        <CardFace
          rank={piece.rank}
          suit={piece.suit}
          size={size}
          isKing={piece.isKing}
        />
      ) : (
        <CardBack colorHex={u.color} size={size} />
      )}
      {piece.isKing && i && (
        <Crown
          size={size === "xs" ? 10 : size === "sm" ? 12 : 16}
          className="king-badge"
          style={{
            color: u.color,
          }}
        />
      )}
    </div>
  );
}
