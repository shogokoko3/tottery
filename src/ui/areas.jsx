/**
 * 盤面エリア(src/game/areas.js)の画面。
 *
 * - AreaBar   自分と相手のエリアの名前と、使ったかどうか。海・空・宮殿の自分の番なら「発動」
 * 発動の演出は area-effects.jsx が担当する。
 *
 * 見抜いた駒(known)・凍った駒・変身/昇格のしるしは cards.jsx の Piece が描く。
 */
import { PLAYER_META, SUIT_SYMBOL } from "../game/constants.js";
import { L, Lx } from "../i18n/index.js";
import { isAutomaticArea } from "../game/area-presentation.js";
import { AliceAreaBar } from "./alice-areas.jsx";
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
  aliceArea = null,
  // 「発動」を光らせる(貸し出しのエリアが使える番。ストーリーのフェーズ3。2026-10-26)
  glow = false,
}) {
  const areas = state.areas || [null, null];
  if (!areas[0] && !areas[1]) return null;
  const me = viewer;
  const foe = 1 - viewer;
  const mine = areas[me];
  if (mine?.type?.startsWith("alice-") || (!mine && areas[foe]?.type?.startsWith("alice-")))
    return <AliceAreaBar state={state} viewer={viewer} controller={aliceArea} />;
  const can = mine && myTurn && !busy ? canUseArea(state, me) : { ok: false };
  const info = mine
    ? {
        ...AREA_INFO[mine.type],
        ...(areaUsesTurn(state, mine.type)
          ? { text: L("ターンを使い、自分の駒1体を1段昇格させる(Kまで・公開)") }
          : {}),
      }
    : null;
  if (
    mine?.type === "palace" &&
    state.ruleVersion < 9 &&
    !areaUsesTurn(state, mine.type)
  )
    info.text = L("自分の駒1体を1段昇格させる(Kまで・公開)。昇格後も駒を動かせる");
  const doubleLeft = palaceDoubleRemaining(state, me);
  const doubleTargets =
    mine?.type === "palace" ? palaceCandidates(state, me, 2) : [];
  const label = (i) => (names && names[i] ? names[i] : Lx(PLAYER_META[i].name));
  // 選んだ駒の札(太字)を文の途中に入れる。英語は語順が違うので、文ごと引いて {piece} で切る
  const chosenText = !chosen
    ? null
    : mine?.type === "sky"
      ? L("{piece} を 10 に変身させます(公開されます)")
      : picking === 2
        ? L("{piece} を2段階昇格させます({from} → {to}、公開されます)", {
            from: chosen.rank,
            to: palacePromotionRank(state, chosen, 2) || "?",
          })
        : L("{piece} を1段階昇格させます({from} → {to}、公開されます)", {
            from: chosen.rank,
            to: palacePromotionRank(state, chosen, 1) || "?",
          });
  const [chosenPre, chosenPost] = chosenText ? chosenText.split("{piece}") : ["", ""];

  if (picking && mine) {
    return (
      <div
        className="area-bar area-bar-picking"
        role="group"
        aria-label={L("エリアの対象選択")}
      >
        {mine.type === "palace" && state.ruleVersion >= 9 && (
          <div
            className="area-promotion-options"
            role="group"
            aria-label={L("昇格する段階")}
          >
            <button
              className={`btn btn-small ${picking !== 2 ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={picking !== 2}
              onClick={() => setPicking(1)}
            >
              {L("1段階昇格")}
            </button>
            <button
              className={`btn btn-small ${picking === 2 ? "btn-primary" : "btn-ghost"}`}
              aria-pressed={picking === 2}
              disabled={!doubleLeft || !doubleTargets.length}
              title={
                !doubleLeft
                  ? L("この局の2段階昇格は使用済みです")
                  : !doubleTargets.length
                    ? L("2段階昇格できる駒がありません")
                    : L("1局に1回だけ使えます")
              }
              onClick={() => setPicking(2)}
            >
              {L("2段階昇格")}
              <small>{doubleLeft ? L("残り{n}回", { n: doubleLeft }) : L("使用済み")}</small>
            </button>
          </div>
        )}
        {chosen ? (
          <>
            <span className="area-pick-instruction">
              {chosenPre}
              <b>
                {chosen.rank}
                {SUIT_SYMBOL[chosen.suit]}
              </b>
              {chosenPost}
            </span>
            <button
              className={`btn btn-primary btn-small ${focusFire ? "guide-target" : ""}`}
              onClick={onConfirm}
            >
              {L("確定")}
            </button>
            <button className="btn btn-ghost btn-small" onClick={onUnchoose}>
              {L("選び直す")}
            </button>
          </>
        ) : (
          <span className="area-pick-instruction">
            {mine.type === "sky"
              ? L("10に変身させる駒を選んでください")
              : picking === 2
                ? L("2段階昇格させる駒を選んでください")
                : L("1段階昇格させる駒を選んでください")}
          </span>
        )}
        <button
          className="btn btn-ghost btn-small"
          onClick={() => setPicking(false)}
        >
          {L("やめる")}
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
                ? L("毎ターン")
                : mine.used
                  ? L("使用済み")
                  : L("未使用")}
            </small>
            {mine.type === "palace" && state.ruleVersion >= 9 && (
              <small>
                {L("2段階：{left}", { left: doubleLeft ? L("残り{n}回", { n: doubleLeft }) : L("使用済み") })}
              </small>
            )}
          </>
        ) : (
          <small>{L("エリアなし")}</small>
        )}
      </span>
      {/* 「発動」の枠は相手の番でも残す(見えなくするだけ)。出たり消えたりで帯の幅と高さが変わり、
          盤が上下していた(2026-09-23 本人の指示)。自動のエリア(海など)は釦そのものが無い */}
      {mine && !isAutomaticArea(state, mine.type) && (
        <button
          className={`btn btn-primary btn-small ${focusFire ? "guide-target" : ""}${glow && can.ok ? " kp-glow-btn" : ""}`}
          style={!mine.used && myTurn ? undefined : { visibility: "hidden" }}
          disabled={!can.ok || mine.used || !myTurn}
          title={can.ok ? info.text : can.why}
          onClick={() => {
            if (!can.ok) return;
            if (info.needsPiece) setPicking(true);
            else dispatch({ type: "USE_AREA" });
          }}
        >
          {L("発動")}
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
                ? L("毎ターン")
                : areas[foe].used
                  ? L("使用済み")
                  : L("未使用")}
            </small>
            {areas[foe].type === "palace" && state.ruleVersion >= 9 && (
              <small>
                {L("2段階：{left}", { left: palaceDoubleRemaining(state, foe) ? L("残り1回") : L("使用済み") })}
              </small>
            )}
          </>
        ) : (
          <small>{L("エリアなし")}</small>
        )}
      </span>
      {onHelp && (
        <button
          className="icon-btn area-help"
          onClick={onHelp}
          aria-label={L("盤面エリアの説明を見る")}
          title={L("盤面エリアの説明")}
        >
          ?
        </button>
      )}
      {/* 但し書きの行も常に1行ぶん取っておく(無いときは空白)。高さが変わらない */}
      <small className="area-why">
        {mine &&
        !isAutomaticArea(state, mine.type) &&
        !mine.used &&
        myTurn &&
        !can.ok &&
        can.why
          ? can.why
          : mine?.type === "sea" && state.ruleVersion >= 10 && myTurn && can.ok
            ? L("発動は任意です。使わずに駒を動かせます。")
            : " "}
      </small>
    </div>
  );
}
