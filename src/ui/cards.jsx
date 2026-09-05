import { CAPTAIN_CARD_ART, NORMAL_CARD_ART, cardBackImg } from "../assets.js";
import { PLAYER_META, SUIT_SYMBOL } from "../game/constants.js";
import { useSeats } from "./names.jsx";
import { byId } from "../skins/catalog.js";
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
export function CardFace({
  rank,
  suit,
  size = "md",
  isKing = !1,
  owner,
  skinId,
}) {
  const seats = useSeats();
  const selected = byId(skinId || seats.skins?.[owner]?.[rank]);
  const skin = selected?.rank === String(rank) ? selected : null;
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
      className={`card-face ${isKing ? "card-captain" : ""} ${skin ? "card-skinned" : ""}`}
      data-size={size}
      data-skin={skin?.id}
      style={{
        width: a.w,
        height: a.h,
      }}
    >
      <img
        src={skin?.boardCard || skin?.card || cardArtSrc(rank, suit, isKing)}
        alt={`${rank}${SUIT_SYMBOL[suit]}${skin ? " · " + skin.name : ""}`}
        draggable="false"
      />
      {skin && (
        <span
          aria-hidden="true"
          className={`skin-card-mark ${suit === "heart" || suit === "diamond" ? "red-suit" : ""}`}
        >
          {rank}
          <small>{SUIT_SYMBOL[suit]}</small>
        </span>
      )}
      {skin && isKing && (
        <span className="skin-king-mark" aria-label="王">
          ♛
        </span>
      )}
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
export function Piece({
  piece,
  viewer,
  isSelected,
  isPickable,
  isGuided,
  justRevealed,
  size = "md",
}) {
  let u = PLAYER_META[piece.owner],
    // フラッシュで公開された駒と、王を討って名乗りを上げた駒は、
    // 持ち主でなくても表向きに見える
    i = piece.owner === viewer || !!piece.revealed;
  return (
    <div
      className={`piece-wrap ${isSelected ? "piece-selected" : ""} ${isPickable ? "piece-pickable" : ""} ${isGuided ? "guide-target" : ""} ${justRevealed ? "piece-unveiled" : ""}`}
    >
      {i ? (
        <CardFace
          owner={piece.owner}
          rank={piece.rank}
          suit={piece.suit}
          size={size}
          isKing={piece.isKing}
        />
      ) : (
        <CardBack colorHex={u.color} size={size} />
      )}
      {piece.revealed && <span className="revealed-badge">公開</span>}
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
