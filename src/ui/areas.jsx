/**
 * 盤面エリア(src/game/areas.js)の画面。
 *
 * - AreaBar   自分と相手のエリアの名前と、使ったかどうか。空・宮殿の自分の番なら「発動」
 * 発動の演出は area-effects.jsx が担当する。
 *
 * 見抜いた駒(known)・凍った駒・変身/昇格のしるしは cards.jsx の Piece が描く。
 */
import { PLAYER_META } from "../game/constants.js";
import { AUTO_AREAS } from "../game/area-presentation.js";
import { AREA_INFO, canUseArea, recurringIce } from "../game/areas.js";

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
  const label = (i) => (names && names[i] ? names[i] : PLAYER_META[i].name);

  if (picking && mine) {
    return (
      <div className="area-bar area-bar-picking">
        <span>
          {mine.type === "sky"
            ? "10に変身させる駒を選んでください"
            : "昇格させる駒を選んでください"}
        </span>
        <button
          className="btn btn-ghost btn-small"
          onClick={() => setPicking(false)}
        >
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
            <small>
              {mine.type === "ice" && recurringIce(state)
                ? "毎手番"
                : mine.used
                  ? "使用済み"
                  : "未使用"}
            </small>
          </>
        ) : (
          <small>エリアなし</small>
        )}
      </span>
      {mine && !AUTO_AREAS.has(mine.type) && !mine.used && myTurn && (
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
      <span
        className={`area-chip area-chip-${areas[foe] ? areas[foe].type : "none"}`}
      >
        <b>{label(foe)}</b>
        {areas[foe] ? (
          <>
            {AREA_INFO[areas[foe].type].name}
            <small>
              {areas[foe].type === "ice" && recurringIce(state)
                ? "毎手番"
                : areas[foe].used
                  ? "使用済み"
                  : "未使用"}
            </small>
          </>
        ) : (
          <small>エリアなし</small>
        )}
      </span>
      {mine &&
        !AUTO_AREAS.has(mine.type) &&
        !mine.used &&
        myTurn &&
        !can.ok &&
        can.why && <small className="area-why">{can.why}</small>}
    </div>
  );
}
