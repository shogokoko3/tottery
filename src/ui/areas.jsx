/**
 * 盤面エリア(src/game/areas.js)の画面。
 *
 * - AreaBar   自分と相手のエリアの名前と、使ったかどうか。自分の番なら「発動」
 * - AreaFlash 発動の瞬間に盤の上へ出す帯。lastArea.seq が変わるたびに1回だけ
 *
 * 見抜いた駒(known)・凍った駒・変身/昇格のしるしは cards.jsx の Piece が描く。
 */
import { useEffect, useState } from "react";
import { PLAYER_META } from "../game/constants.js";
import { squareName } from "../game/board.js";
import { AREA_INFO, canUseArea } from "../game/areas.js";

/** エリアの札に出す短い名前 */
export function areaLabel(area) {
  return area ? AREA_INFO[area.type].name : null;
}

export function AreaBar({
  state,
  viewer,
  myTurn,
  dispatch,
  picking,
  setPicking,
  busy,
  names,
}) {
  const areas = state.areas || [null, null];
  if (!areas[0] && !areas[1]) return null;
  const me = viewer;
  const foe = 1 - viewer;
  const mine = areas[me];
  const can = mine && myTurn && !busy ? canUseArea(state, me) : { ok: false };
  const info = mine ? AREA_INFO[mine.type] : null;
  const label = (i) =>
    names && names[i] ? names[i] : PLAYER_META[i].name;

  if (picking && mine) {
    return (
      <div className="area-bar area-bar-picking">
        <span>
          {mine.type === "sky"
            ? "10に変身させる駒を選んでください"
            : "昇格させる駒を選んでください"}
        </span>
        <button className="btn btn-ghost btn-small" onClick={() => setPicking(false)}>
          やめる
        </button>
      </div>
    );
  }
  return (
    <div className="area-bar">
      <span className={`area-chip area-chip-${mine ? mine.type : "none"}`}>
        <b>{label(me)}</b>
        {mine ? (
          <>
            {info.name}
            <small>{mine.used ? "使用済み" : "未使用"}</small>
          </>
        ) : (
          <small>エリアなし</small>
        )}
      </span>
      {mine && !mine.used && myTurn && (
        <button
          className="btn btn-primary btn-small"
          disabled={!can.ok}
          title={can.ok ? info.text : can.why}
          onClick={() => {
            if (!can.ok) return;
            if (info.needsPiece) setPicking(true);
            else dispatch({ type: "USE_AREA" });
          }}
        >
          発動
        </button>
      )}
      <span className={`area-chip area-chip-${areas[foe] ? areas[foe].type : "none"}`}>
        <b>{label(foe)}</b>
        {areas[foe] ? (
          <>
            {AREA_INFO[areas[foe].type].name}
            <small>{areas[foe].used ? "使用済み" : "未使用"}</small>
          </>
        ) : (
          <small>エリアなし</small>
        )}
      </span>
      {mine && !mine.used && myTurn && !can.ok && can.why && (
        <small className="area-why">{can.why}</small>
      )}
    </div>
  );
}

/** 発動した瞬間の帯。1.8秒で消える */
export function AreaFlash({ state, viewer, names }) {
  const last = state.lastArea;
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!last) return;
    setShown(last.seq);
    const id = setTimeout(() => setShown(null), 1800);
    return () => clearTimeout(id);
  }, [last && last.seq]);
  if (!last || shown !== last.seq) return null;
  const info = AREA_INFO[last.type];
  const who =
    names && names[last.player] ? names[last.player] : PLAYER_META[last.player].name;
  let detail = "";
  const sq = (id) => {
    const p = state.pieces[id];
    return p ? squareName(p.row, p.col, state.boardSize) : "";
  };
  switch (last.type) {
    case "earth":
      detail = last.hit
        ? last.player === viewer
          ? `${sq(last.pieceId)} の正体を見抜いた`
          : "正体を見抜かれた"
        : "読み違えた";
      break;
    case "sea":
      detail = "全ての駒が中央へ";
      break;
    case "forest":
      detail =
        last.player === viewer
          ? `${(last.pieceIds || []).map(sq).join("・")} の正体を見抜いた`
          : "駒を1体見抜かれた";
      break;
    case "ice":
      detail = `${sq(last.pieceId)} の駒が凍りついた`;
      break;
    case "sky":
      detail = `${sq(last.pieceId)} の駒が10に変身。10は全て2回動ける`;
      break;
    case "palace":
      detail = `${sq(last.pieceId)} の駒が ${last.from} → ${last.to} に昇格`;
      break;
    default:
      break;
  }
  return (
    <div className={`area-flash area-flash-${last.type}`} key={last.seq}>
      <b>
        {who}が{info.name}を発動!
      </b>
      {detail && <span>{detail}</span>}
    </div>
  );
}
