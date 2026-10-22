import { useState } from "react";
import { AREA_INFO } from "../game/areas.js";
import { alive, aliceBoard, aliceField, aliceKing, emptyCells } from "../game/alice-rules.js";
import { squareName } from "../game/board.js";
import { KING_TEXT } from "../game/constants.js";
import { byId } from "../skins/catalog.js";
import { ALICE_KING_TEXT } from "./alice-controls.jsx";
import { SkinModal } from "./skin-modal.jsx";

/** 発動の記録(state.alicePowerLog)の1件を言葉に */
function powerLogText(e) {
  if (e.kind === "king") return `王の力「${ALICE_KING_TEXT[e.rank] || e.rank}」`;
  if (e.kind === "reverse") return "A の数字逆転";
  if (e.kind === "revolution") return "革命の扉(ランダムに1体の数字逆転)";
  if (e.kind === "revive") return `王(${e.rank})の帰還`;
  if (e.kind === "field") return `盤面効果「${AREA_INFO[e.area]?.name || e.area || "?"}」`;
  if (e.kind === "recruit") return "撃破した駒を仲間にできる(ハートの王)";
  if (e.kind === "unmask") return "正体不明の駒を確定";
  return e.kind;
}

/**
 * 相手の効果の一覧(2026-10-16 本人の指示)。相手の名札の横の「?」で開く。
 * 相手の盤面効果(名前・説明・このターン発動済みか)、公開されている相手の王の力、
 * これまでに相手が発動した効果の記録(映像で見えたものだけ。伏せ札や偽の王の正体は出さない)
 */
export function FoeEffects({ state, viewer, onClose }) {
  const foe = 1 - viewer;
  const area = state.areas?.[foe];
  const log = (state.alicePowerLog || []).filter((e) => e.owner === foe);
  const kingId = state.players?.[foe]?.kingId;
  const king = kingId ? state.pieces[kingId] : null;
  // 王の力は、王の正体が公開されているか、王の力を使って映像で分かったときだけ
  const kingPublic = !!king && (king.revealed || log.some((e) => e.kind === "king"));
  const kingSkin = kingPublic ? byId(String(state.areaLoadouts?.[foe]?.[king.rank] || "").replace(/:foil$/, "")) : null;
  const kingPower = !kingPublic ? null
    : kingSkin?.id?.startsWith("alice-") ? { name: ALICE_KING_TEXT[king.rank] || kingSkin.move || "王の力", text: kingSkin.description || "" }
    : { name: `${king.rank} の王の力`, text: KING_TEXT[king.rank] || "" };
  const usedField = state.aliceUsed?.[foe]?.field === (state.turnNo || 0);
  const barrier = state.aliceBarrier?.[foe] > (state.turnNo || 0);
  return <SkinModal label="相手の効果" onClose={onClose} className="alice-area-help foe-effects">
    <h2>相手の効果</h2>
    <h3>盤面効果</h3>
    {area ? <p><b>{AREA_INFO[area.type]?.name || area.type}</b>{area.type === "alice-maze" ? "(自動)" : usedField ? "(このターン発動済み)" : ""}<br />{AREA_INFO[area.type]?.text}</p> : <p>エリアなし</p>}
    <h3>王の力</h3>
    {kingPower ? <p><b>{kingPower.name}</b>{barrier ? "(いまバリア中)" : ""}<br />{kingPower.text}</p> : <p>まだ公開されていません(王が公開されるか、王の力を使うと分かります)</p>}
    <h3>発動の記録</h3>
    {log.length ? <ul className="foe-effects-log">{[...log].reverse().map((e, i) => <li key={i}><small>{e.turnNo}手目</small> {powerLogText(e)}</li>)}</ul> : <p>相手はまだ効果を発動していません</p>}
    <button className="skin-btn skin-btn-gold" onClick={onClose}>盤面に戻る</button>
  </SkinModal>;
}

const targeted = new Set(["alice-quadrille", "alice-illusion", "alice-croquet"]);
const realId = piece => piece?.ghostOf || piece?.id;

// Selection stays local; only the confirmed ALICE_ACTION enters the replay.
export function useAliceArea(state, viewer, { myTurn, busy, dispatch }) {
  const [selection, setSelection] = useState(null);
  const type = state.phase === "play" && (viewer === 0 || viewer === 1)
    ? aliceField(state, viewer) : null;
  const king = type ? aliceKing(state, viewer) : null;
  const own = type ? alive(state, viewer) : [];
  // Use the visible board: neither concealed ranks nor illusion locations leak into choices.
  const visible = type ? aliceBoard(state, viewer) : null;
  const foe = visible ? visible.flat().filter(p => p && p.owner !== viewer && !p.barrier) : [];
  const sources = type === "alice-quadrille" ? own.filter(p => !p.isKing && !p.tea && p.rank !== "A")
    : type === "alice-croquet" ? own.filter(p => p.soldier && Math.max(Math.abs(p.row - king.row), Math.abs(p.col - king.col)) <= 2)
      : own;
  const used = state.aliceUsed?.[viewer]?.field === (state.turnNo || 0);
  let why = "";
  if (!type) why = "対応するフォイルを王に装備すると使えます";
  else if (type === "alice-maze") why = "相手の手番に自動で働きます";
  else if (state.winner != null) why = "対局は終了しています";
  else if (used) why = "このターンは発動済みです";
  else if (state.currentTurn !== viewer) why = "相手の番です";
  else if (state.aliceRevive || state.aliceRecruit?.length || state.pendingKingChoice || state.kPlacement || state.extraMoveFor) why = "現在の操作を終えてください";
  else if (state.selectedId || state.shuffleMode) why = "駒の選択を解除してから発動できます";
  else if (busy || !myTurn) why = "演出が終わると発動できます";
  else if (type === "alice-quadrille" && (!sources.length || !foe.length)) why = "選べる味方と相手の駒が必要です";
  else if (type === "alice-illusion" && own.length < 2) why = "味方が2体必要です";
  else if (type === "alice-croquet" && !sources.length) why = "王の周囲5×5にトランプ兵が必要です";
  else if (type === "alice-tea" && alive(state).length >= 18) why = "盤面に18体以上いるため配置できません";
  else if (type === "alice-tea" && !emptyCells(state, viewer).length) why = "自陣に空きマスがありません";
  const canUse = !why;
  const key = `${viewer}:${state.turnNo || 0}:${type}`;
  const picking = !!(canUse && selection?.key === key);
  const ids = picking ? selection.ids : [];
  const aim = picking ? selection.aim : null;
  const aiming = picking && type === "alice-croquet" && ids.length === 1;
  const candidates = !picking ? [] : type === "alice-quadrille" && ids.length ? foe
    : type === "alice-illusion" ? own.filter(p => !ids.includes(p.id)) : sources;
  const ready = picking && (type === "alice-croquet" ? !!aim && ids.length === 1 : ids.length === 2);
  const fire = (pickIds = [], cell = null) => {
    if (!canUse) return;
    dispatch({ type: "ALICE_ACTION", kind: "field", player: viewer, pickIds, ...(cell || {}) });
    setSelection(null);
  };
  const start = () => {
    if (!canUse) return;
    if (!targeted.has(type)) fire();
    else setSelection({ key, ids: [], aim: null });
  };
  const pickCell = (piece, row, col) => {
    if (!picking) return false;
    if (aiming) setSelection({ key, ids, aim: { row, col } });
    else if (piece && candidates.some(p => realId(p) === realId(piece))) {
      const id = realId(piece);
      setSelection({ key, ids: type === "alice-croquet" ? [id] : [...ids.slice(0, 1), id], aim: null });
    }
    return true;
  };
  let instruction = type === "alice-quadrille" ? (ids.length ? "相手1体を選択" : "味方1体を選択")
    : type === "alice-croquet" ? (aiming ? "着地点を選択" : "トランプ兵を選択")
      : `味方2体を選択（${ids.length}/2）`;
  if (ready) instruction = "内容を確認して確定";
  const detail = ids.map(id => {
    const piece = [...own, ...foe].find(p => realId(p) === id);
    return piece ? squareName(piece.row, piece.col, state.boardSize) : "";
  }).filter(Boolean).join("・") + (aim ? ` → ${squareName(aim.row, aim.col, state.boardSize)}` : "");
  return {
    type, used, why, canUse, picking, aiming, ids, aim, ready, instruction, detail, start, pickCell,
    confirm: () => ready && fire(ids, aim),
    reset: () => setSelection({ key, ids: [], aim: null }),
    cancel: () => setSelection(null),
    isSelected: piece => picking && ids.includes(realId(piece)),
    isPickable: piece => picking && !aiming && candidates.some(p => realId(p) === realId(piece)),
    // マスの枠。選んだ駒は太い枠(alice-area-selected)、選べる駒は細い枠(alice-area-candidate)、
    // 着地点は的の枠(alice-area-aim)と隣の4マス(alice-area-landing)。どれを選んでいるかが一目で分かるように(2026-10-16 本人の指摘)
    cellClass: (row, col) => {
      if (!picking) return "";
      const here = realId(visible?.[row]?.[col]);
      const selected = !!here && ids.includes(here);
      let cls = selected ? " alice-area-selected" : "";
      if (!aiming) {
        if (!selected && here && candidates.some(p => realId(p) === here)) cls += " alice-area-candidate";
        return cls;
      }
      if (aim?.row === row && aim?.col === col) cls += " alice-area-aim";
      else if (aim && Math.abs(aim.row - row) + Math.abs(aim.col - col) === 1) cls += " alice-area-landing";
      return cls;
    },
  };
}

export function AliceAreaBar({ state, viewer, controller }) {
  // help: 自分の盤面効果の説明(自分の名札を押す)。foe: 相手の効果の一覧(相手の横の「?」。2026-10-16 本人の指示)
  const [help, setHelp] = useState(false);
  const [foeOpen, setFoeOpen] = useState(false);
  const mine = state.areas?.[viewer], foe = state.areas?.[1 - viewer];
  const type = mine?.type || foe?.type;
  const c = controller;
  const automatic = mine?.type === "alice-maze";
  const name = area => area ? AREA_INFO[area.type].name : "エリアなし";
  return <>
    {c?.picking ? (
      <div className="area-bar alice-area-bar alice-area-picking" role="group" aria-label={`${name(mine)}の対象選択`}>
        <span className="alice-area-instruction" role="status">{c.instruction}<small>{c.detail || "光る駒をタップ"}</small></span>
        <button className="btn btn-primary btn-small" disabled={!c.ready} onClick={c.confirm}>確定</button>
        <button className="btn btn-ghost btn-small" onClick={c.reset}>選び直す</button>
        <button className="btn btn-ghost btn-small" onClick={c.cancel}>やめる</button>
      </div>
    ) : (
      <div className="area-bar alice-area-bar" role="group" aria-label="盤面のエリア効果">
        <span className={`area-chip area-chip-${mine?.type || "none"}`} title={mine ? `${AREA_INFO[mine.type].text}(押すと説明)` : undefined} role={mine ? "button" : undefined} tabIndex={mine ? 0 : undefined} onClick={() => mine && setHelp(true)} onKeyDown={(e) => mine && (e.key === "Enter" || e.key === " ") && setHelp(true)}>
          <b>自</b><span className="alice-area-name">{name(mine)}</span>
          {mine && <small>{automatic ? "自動" : c?.used ? "発動済み" : "毎ターン1回"}</small>}
        </span>
        {mine && !automatic && <button className="btn btn-primary btn-small" disabled={!c?.canUse} title={c?.why || "手番を消費せずに発動"} onClick={c?.start} aria-label={`${name(mine)}を発動`}>{c?.used ? "発動済み" : "発動"}</button>}
        <span className={`area-chip area-chip-${foe?.type || "none"}`} title={foe && AREA_INFO[foe.type].text}><b>敵</b><span className="alice-area-name">{name(foe)}</span></span>
        <button className="icon-btn area-help" onClick={() => setFoeOpen(true)} aria-label="相手の効果を見る" title="相手の盤面効果・公開された王の力・発動の記録">?</button>
      </div>
    )}
    {help && mine && <SkinModal label={AREA_INFO[mine.type].name} onClose={() => setHelp(false)} className="alice-area-help">
      <h2>{AREA_INFO[mine.type].name}</h2>
      <p>{AREA_INFO[mine.type].text}</p>
      <button className="skin-btn skin-btn-gold" onClick={() => setHelp(false)}>盤面に戻る</button>
    </SkinModal>}
    {foeOpen && <FoeEffects state={state} viewer={viewer} onClose={() => setFoeOpen(false)} />}
  </>;
}
