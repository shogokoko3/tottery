import { CAPTAIN_CARD_ART, NORMAL_CARD_ART, cardBackImg } from "../assets.js";
import { PLAYER_META, SUIT_SYMBOL } from "../game/constants.js";
import { useSeats } from "./names.jsx";
import { byId } from "../skins/catalog.js";
import { Crown } from "../icons.jsx";
import { FoilArtwork } from "./foil-artwork.jsx";

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
  animated = true,
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
      <FoilArtwork
        skin={skin}
        src={skin?.boardCard || skin?.card || cardArtSrc(rank, suit, isKing)}
        alt={`${rank}${SUIT_SYMBOL[suit]}${skin ? " · " + skin.name : ""}`}
        animated={animated}
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
export function CardBack({ colorHex, size = "md", backId, owner }) {
  const seats = useSeats();
  const moon = (backId ?? seats.backs?.[owner]) === "moon-crest";
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
      className={moon ? "card-back card-back-moon" : "card-back"}
      style={{
        width: l.w,
        height: l.h,
        "--pc": colorHex,
      }}
    >
      {moon ? (
        <span className="moon-crest-art" aria-hidden="true">
          <i>✦</i>
          <b>☾</b>
          <i>✦</i>
        </span>
      ) : (
        <img src={cardBackImg} alt="" draggable="false" />
      )}
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
  // 盤面エリア(src/game/areas.js): 見抜いた駒は自分にだけ表向き、凍った駒は青く
  known = false,
  frozen = false,
  size = "md",
}) {
  let u = PLAYER_META[piece.owner],
    // フラッシュで公開された駒と、王を討って名乗りを上げた駒は、
    // 持ち主でなくても表向きに見える。土・森で見抜いた駒は自分だけに
    i = piece.owner === viewer || !!piece.revealed || !!known;
  const mark = piece.mark === "sky" ? "空" : piece.mark === "palace" ? "宮" : null;
  return (
    <div
      className={`piece-wrap ${isSelected ? "piece-selected" : ""} ${isPickable ? "piece-pickable" : ""} ${isGuided ? "guide-target" : ""} ${justRevealed ? "piece-unveiled" : ""} ${frozen ? "piece-frozen" : ""}`}
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
        <CardBack colorHex={u.color} size={size} owner={piece.owner} />
      )}
      {piece.revealed && !mark && <span className="revealed-badge">公開</span>}
      {mark && (
        <span className={`mark-badge mark-${piece.mark}`} aria-label={piece.mark === "sky" ? "空のエリアで変身" : "宮殿で昇格"}>
          {mark}
        </span>
      )}
      {known && !piece.revealed && piece.owner !== viewer && (
        <span className="known-badge">見抜</span>
      )}
      {frozen && <span className="frozen-badge" aria-label="凍結">❄</span>}
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
