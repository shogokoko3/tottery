/**
 * 盤面エリア(src/game/areas.js)の画面。
 *
 * - AreaBar   自分と相手のエリアの名前と、使ったかどうか。海・空・宮殿の自分の番なら「発動」
 * 発動の演出は area-effects.jsx が担当する。
 *
 * 見抜いた駒(known)・凍った駒・変身/昇格のしるしは cards.jsx の Piece が描く。
 */
import { PLAYER_META, SUIT_SYMBOL } from "../game/constants.js";
import { isAutomaticArea } from "../game/area-presentation.js";
import {
  AREA_INFO,
  canUseArea,
  recurringArea,
  areaUsesTurn,
  palaceCandidates,
  palaceDoubleRemaining,
  palacePromotionRank,
} from "../game/areas.js";

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
  onHelp,
  focusFire = false,
  // 選んだ駒(空: 変身、宮殿: 昇格)。ワンタップで確定せず、ここで「確定」を押してもらう
  chosen = null,
  onConfirm = null,
  onUnchoose = null,
}) {
  const areas = state.areas || [null, null];
  if (!areas[0] && !areas[1]) return null;
  const me = viewer;
  const foe = 1 - viewer;
  const mine = areas[me];
  const can = mine && myTurn && !busy ? canUseArea(state, me) : { ok: false };
  const info = mine
    ? {
        ...AREA_INFO[mine.type],
        ...(areaUsesTurn(state, mine.type)
          ? { text: "手番を使い、自分の駒1体を1段昇格させる(Kまで・公開)" }
          : {}),
      }
    : null;
  if (
    mine?.type === "palace" &&
    state.ruleVersion < 9 &&
    !areaUsesTurn(state, mine.type)
  )
    info.text = "自分の駒1体を1段昇格させる(Kまで・公開)。昇格後も駒を動かせる";
  const doubleLeft = palaceDoubleRemaining(state, me);
  const doubleTargets =
    mine?.type === "palace" ? palaceCandidates(state, me, 2) : [];
  const label = (i) => (names && names[i] ? names[i] : PLAYER_META[i].name);

  if (picking && mine) {
    return (
      <div
        className="area-bar area-bar-picking"
        role="group"
        aria-label="エリアの対象選択"
      >
        {mine.type === "palace" && state.ruleVersion >= 9 && (
          <div
            className="area-promotion-options"
            role="group"
            aria-label="昇格する段階"
          >
            <button
              className={`btn btn-small ${picking !== 2 ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={picking !== 2}
              onClick={() => setPicking(1)}
            >
              1段階昇格
            </button>
            <button
              className={`btn btn-small ${picking === 2 ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={picking === 2}
              disabled={!doubleLeft || !doubleTargets.length}
              title={
                !doubleLeft
                  ? "この試合の2段階昇格は使用済みです"
                  : !doubleTargets.length
                    ? "2段階昇格できる駒がありません"
                    : "1試合に1回だけ使えます"
              }
              onClick={() => setPicking(2)}
            >
              2段階昇格
              <small>{doubleLeft ? `残り${doubleLeft}回` : "使用済み"}</small>
            </button>
          </div>
        )}
        {chosen ? (
          <>
            <span className="area-pick-instruction">
              <b>
                {chosen.rank}
                {SUIT_SYMBOL[chosen.suit]}
              </b>
              {mine.type === "sky"
                ? " を 10 に変身させます(公開されます)"
                : ` を${picking === 2 ? "2段階" : "1段階"}昇格させます(${chosen.rank} → ${palacePromotionRank(state, chosen, picking === 2 ? 2 : 1) || "?"}、公開されます)`}
            </span>
            <button
              className={`btn btn-primary btn-small ${focusFire ? "guide-target" : ""}`}
              onClick={onConfirm}
            >
              確定
            </button>
            <button className="btn btn-ghost btn-small" onClick={onUnchoose}>
              選び直す
            </button>
          </>
        ) : (
          <span className="area-pick-instruction">
            {mine.type === "sky"
              ? "10に変身させる駒を選んでください"
              : `${picking === 2 ? "2段階" : "1段階"}昇格させる駒を選んでください`}
          </span>
        )}
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
              {recurringArea(state, mine.type)
                ? "毎手番"
                : mine.used
                  ? "使用済み"
                  : "未使用"}
            </small>
            {mine.type === "palace" && state.ruleVersion >= 9 && (
              <small>
                2段階：{doubleLeft ? `残り${doubleLeft}回` : "使用済み"}
              </small>
            )}
          </>
        ) : (
          <small>エリアなし</small>
        )}
      </span>
      {mine && !isAutomaticArea(state, mine.type) && !mine.used && myTurn && (
        <button
          className={`btn btn-primary btn-small ${focusFire ? "guide-target" : ""}`}
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
              {recurringArea(state, areas[foe].type)
                ? "毎手番"
                : areas[foe].used
                  ? "使用済み"
                  : "未使用"}
            </small>
            {areas[foe].type === "palace" && state.ruleVersion >= 9 && (
              <small>
                2段階：
                {palaceDoubleRemaining(state, foe) ? "残り1回" : "使用済み"}
              </small>
            )}
          </>
        ) : (
          <small>エリアなし</small>
        )}
      </span>
      {onHelp && (
        <button
          className="icon-btn area-help"
          onClick={onHelp}
          aria-label="盤面エリアの説明を見る"
          title="盤面エリアの説明"
        >
          ?
        </button>
      )}
      {mine &&
        !isAutomaticArea(state, mine.type) &&
        !mine.used &&
        myTurn &&
        !can.ok &&
        can.why && <small className="area-why">{can.why}</small>}
      {mine?.type === "sea" && state.ruleVersion >= 10 && myTurn && can.ok && (
        <small className="area-why">
          発動は任意です。使わずに駒を動かせます。
        </small>
      )}
    </div>
  );
}
