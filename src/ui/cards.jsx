import { NORMAL_CARD_ART, cardBackImg } from "../assets.js";
import { PLAYER_META, SUIT_SYMBOL } from "../game/constants.js";
import { useSeats } from "./names.jsx";
import { byId } from "../skins/catalog.js";
import { Crown } from "../icons.jsx";
import { FoilArtwork } from "./foil-artwork.jsx";
import { PROMOTION_ARROW_PATH } from "./card-status.js";

export const SUIT_CODE = {
  spade: "S",
  heart: "H",
  diamond: "D",
  club: "C",
};
export function cardArtSrc(rank, suit) {
  return NORMAL_CARD_ART[rank + SUIT_CODE[suit]];
}
export function CardFace({
  rank,
  suit,
  size = "md",
  isKing = !1,
  owner,
  skinId,
  animated = true,
  mark,
  originalRank,
}) {
  const seats = useSeats();
  // false selects the embedded normal art while a remote skin is unavailable.
  const selected =
    skinId === false ? null : byId(skinId || seats.skins?.[owner]?.[rank]);
  const skin = selected?.rank === String(rank) ? selected : null;
  // 王になっても同じ人物。通常キャラ全13種を金色の縁で区別する。
  const kingFrame = isKing && !skin;
  const promoted = mark === "palace";
  const promotionLabel = promoted
    ? ` · 昇格${originalRank ? `（元は${originalRank}${SUIT_SYMBOL[suit]}）` : ""}`
    : "";
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
        : size === "tray"
          ? // 布陣の手札置き場。9×9 の13枚を 7枚×2段 で1画面に収める(幅 375px の端末まで)
            {
              w: 40,
              h: 53,
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
      className={`card-face ${isKing ? "card-captain" : ""} ${kingFrame ? "card-captain-fallback" : ""} ${skin ? "card-skinned" : "card-standard"}`}
      data-size={size}
      data-skin={skin?.id}
      style={{
        width: a.w,
        height: a.h,
      }}
    >
      <FoilArtwork
        skin={skin}
        src={skin?.boardCard || skin?.card || cardArtSrc(rank, suit)}
        alt={`${rank}${SUIT_SYMBOL[suit]}${skin ? " · " + skin.name : ""}${isKing ? " · 王" : ""}${promotionLabel}`}
        animated={animated}
      />
      <span
        aria-hidden="true"
        className={`card-index ${skin ? "skin-card-mark" : ""} ${suit === "heart" || suit === "diamond" ? "red-suit" : ""}`}
      >
        {rank}
        {promoted ? (
          <small className="card-suit-promoted" title="昇格">
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d={PROMOTION_ARROW_PATH} fill="currentColor" />
            </svg>
          </small>
        ) : (
          <small>{SUIT_SYMBOL[suit]}</small>
        )}
      </span>
      {skin && isKing && (
        <span className="skin-king-mark" aria-label="王">
          ♛
        </span>
      )}
    </div>
  );
}
/** 撃破履歴は戦闘時の強さを保持し、捨て札の絵は物理カードの元の数字に戻す。 */
export function CapturedCardFace({ piece, size = "sm" }) {
  const rank = piece.originalRank || piece.rank;
  const changed = rank !== piece.rank;
  return (
    <div
      className="captured-card-face"
      title={
        changed
          ? `元のカード ${rank}${SUIT_SYMBOL[piece.suit]} ／ 撃破時 ${piece.rank}${SUIT_SYMBOL[piece.suit]}`
          : undefined
      }
    >
      <CardFace owner={piece.owner} rank={rank} suit={piece.suit} size={size} />
      {changed && (
        <small className="captured-card-note">撃破時 {piece.rank}</small>
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
  frozenTurns = 0,
  skyBonus = false,
  extraReady = false,
  // 観戦の審判視点(フレンド戦)。両者の伏せ札まで表向きに見せる
  revealAll = false,
  size = "md",
}) {
  let u = PLAYER_META[piece.owner],
    // フラッシュで公開された駒と、王を討って名乗りを上げた駒は、
    // 持ち主でなくても表向きに見える。土・森で見抜いた駒は自分だけに。
    // 審判視点の観戦(revealAll)では全部表向き
    i = revealAll || piece.owner === viewer || !!piece.revealed || !!known;
  const skyMark = i && piece.mark === "sky";
  // 陣営は公開情報。表裏・絵柄・王の正体に依存しない同じ枠を使う。
  const own = piece.owner === viewer;
  const spectator = viewer == null;
  const factionLabel = spectator
    ? `${u.name}陣営`
    : own
      ? "自分の駒"
      : "相手の駒";
  const factionMark = spectator ? u.name : own ? "自" : "敵";
  return (
    <div
      className={`piece-wrap ${isSelected ? "piece-selected" : ""} ${isPickable ? "piece-pickable" : ""} ${isGuided ? "guide-target" : ""} ${justRevealed ? "piece-unveiled" : ""} ${frozen ? "piece-frozen" : ""} piece-faction faction-${piece.owner} ${!spectator && !own ? "piece-enemy" : "piece-ally"}`}
      style={{ "--who": u.color }}
      data-size={size}
      data-faction={piece.owner}
      aria-label={`${factionLabel}・${u.name}陣営`}
    >
      {i ? (
        <CardFace
          owner={piece.owner}
          rank={piece.rank}
          suit={piece.suit}
          size={size}
          isKing={piece.isKing}
          mark={piece.mark}
          originalRank={piece.originalRank}
        />
      ) : (
        <CardBack colorHex={u.color} size={size} owner={piece.owner} />
      )}
      <span className="piece-faction-mark" aria-hidden="true">
        {factionMark}
      </span>
      {piece.revealed && !piece.mark && (
        <span className="revealed-badge" aria-label="公開された駒">
          {size === "xs" ? "公" : "公開"}
        </span>
      )}
      {skyMark && (
        <span className="mark-badge mark-sky" aria-label="空のエリアで変身">
          空
        </span>
      )}
      {known && !piece.revealed && piece.owner !== viewer && (
        <span className="known-badge" aria-label="見抜いた駒">
          {size === "xs" ? "見" : "見抜"}
        </span>
      )}
      {frozen && (
        <span
          className="frozen-badge"
          aria-label={`凍結・残り${frozenTurns}ターン`}
        >
          ❄<b>{frozenTurns || ""}</b>
        </span>
      )}
      {skyBonus && i && (
        <span
          className={`sky-action-badge ${extraReady ? "sky-action-ready" : ""}`}
          aria-label={extraReady ? "追加行動・残り1回" : "空の力・2回行動"}
        >
          {extraReady ? "あと1" : "×2"}
        </span>
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
