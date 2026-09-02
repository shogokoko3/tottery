import { useRef, useState } from "react";
import {
  emptyBoard,
  getLegalMoves,
  territoryRows,
  totalSlots,
} from "../game/board.js";
import { SETUP_LIMIT_MS } from "../game/reducer.js";
import { PLAYER_META, RANKS, SUITS } from "../game/constants.js";
import { useWindowWidth } from "../hooks.js";
import { ArrowLeft, Crown, Dice, Grid } from "../icons.jsx";
import { CardBack, CardFace } from "./cards.jsx";
import { CardGuide } from "./guides.jsx";

export function DiscardPanel({ cards, label, color }) {
  if (!cards || cards.length === 0) return null;
  let n = [...cards].sort((a, u) => {
    let i = RANKS.indexOf(a.rank) - RANKS.indexOf(u.rank);
    return i !== 0 ? i : SUITS.indexOf(a.suit) - SUITS.indexOf(u.suit);
  });
  return (
    <div className="discard-panel">
      <div
        className="discard-label"
        style={{
          color,
        }}
      >
        {label}({n.length}枚)
      </div>
      <div className="discard-row">
        {n.map((a) => (
          <div className="discard-card" key={a.id}>
            <CardFace rank={a.rank} suit={a.suit} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
export function MulliganHand({ hand, selected, onToggle, focus }) {
  const width = useWindowWidth();
  const wide = width >= 480;
  const size = width < 380 ? "sm" : "md";
  const sorted = [...hand].sort((a, b) => {
    const d = RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
    return d !== 0 ? d : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  });
  const Card = ({ card }) => (
    <div
      className={`hand-card ${selected.has(card.id) ? "hand-card-selected" : ""} ${
        focus && focus.cards && focus.cards.includes(card.id)
          ? "guide-target"
          : ""
      }`}
      onClick={() => onToggle(card.id)}
    >
      <CardFace rank={card.rank} suit={card.suit} size={size} />
      {selected.has(card.id) && <span className="discard-badge">✕</span>}
    </div>
  );
  return wide ? (
    <div className="hand-split">
      <div className="hand-row">
        {sorted.slice(0, 7).map((card) => (
          <Card card={card} key={card.id} />
        ))}
      </div>
      <div className="hand-row">
        {sorted.slice(7).map((card) => (
          <Card card={card} key={card.id} />
        ))}
      </div>
    </div>
  ) : (
    <div className="hand-grid">
      {sorted.map((card) => (
        <Card card={card} key={card.id} />
      ))}
    </div>
  );
}
export function WaitingWithBoard({
  text,
  hand,
  board,
  size,
  viewer,
  placement,
  player,
}) {
  let f = hand
      ? [...hand].sort((r, d) => {
          let m = RANKS.indexOf(r.rank) - RANKS.indexOf(d.rank);
          return m !== 0 ? m : SUITS.indexOf(r.suit) - SUITS.indexOf(d.suit);
        })
      : [],
    o = viewer === 1;
  return (
    <div className="setup-wrap">
      <div className="waiting-head">
        <Dice size={22} className="dim-icon spin-icon" />
        <p
          className="hint"
          style={{
            margin: 0,
          }}
        >
          {text}
        </p>
      </div>
      {board && (
        <div className="arrange-layout">
          <div
            className="mini-board"
            style={{
              gridTemplateColumns: `repeat(${size},1fr)`,
            }}
          >
            {Array.from({
              length: size,
            }).map((r, d) =>
              Array.from({
                length: size,
              }).map((m, s) => {
                let v = o ? size - 1 - d : d,
                  p = o ? size - 1 - s : s,
                  w = board[v][p],
                  z = w && w.owner === viewer;
                return (
                  <div className="mini-cell" key={`${v}-${p}`}>
                    {w && (
                      <div className="mini-piece">
                        {z ? (
                          <CardFace rank={w.rank} suit={w.suit} size="sm" />
                        ) : (
                          <CardBack
                            colorHex={PLAYER_META[w.owner].color}
                            size="sm"
                          />
                        )}
                        {z && w.isKing && (
                          <Crown size={12} className="king-badge" />
                        )}
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      )}
      {placement && player && (
        <div className="arrange-layout">
          <div
            className="mini-board"
            style={{
              gridTemplateColumns: `repeat(${size},1fr)`,
            }}
          >
            {Array.from({
              length: size,
            }).map((r, d) =>
              Array.from({
                length: size,
              }).map((m, s) => {
                let v = o ? size - 1 - d : d,
                  p = o ? size - 1 - s : s,
                  w = Object.keys(placement).find(
                    (g) => placement[g].row === v && placement[g].col === p,
                  ),
                  z = w ? player.hand.find((g) => g.id === w) : null;
                return (
                  <div className="mini-cell" key={`${v}-${p}`}>
                    {z && (
                      <div className="mini-piece">
                        <CardFace rank={z.rank} suit={z.suit} size="sm" />
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      )}
      {f.length > 0 && (
        <>
          <div
            className="tray-label"
            style={{
              marginTop: 14,
            }}
          >
            あなたの手札({f.length}枚)
          </div>
          <div className="hand-grid">
            {f.map((r) => (
              <div className="hand-card" key={r.id}>
                <CardFace rank={r.rank} suit={r.suit} size="sm" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
export function WaitingScreen({ text }) {
  return (
    <div className="center-stage">
      <Dice size={28} className="dim-icon spin-icon" />
      <p className="hint">{text}</p>
    </div>
  );
}
export function findHandCard(e, t) {
  return e.hand.find((l) => l.id === t);
}
export function territoryOwnerOf(e, t, l) {
  let n = territoryRows(l, 0),
    a = territoryRows(l, 1);
  return e >= n[0] && e <= n[1] ? 0 : e >= a[0] && e <= a[1] ? 1 : null;
}
/** 残り時間の帯。10秒を切ったら赤くする */
export function SetupTimer({ remainingMs, label, paused }) {
  if (remainingMs == null)
    return paused ? (
      <div className="setup-timer">
        <div className="setup-timer-head">
          <span>{label}</span>
          <strong>停止中</strong>
        </div>
        <div className="setup-timer-track">
          <div className="setup-timer-fill" style={{ width: "100%" }} />
        </div>
      </div>
    ) : null;
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  const ratio = Math.max(0, Math.min(1, remainingMs / SETUP_LIMIT_MS));
  return (
    <div className={`setup-timer ${sec <= 10 ? "setup-timer-urgent" : ""}`}>
      <div className="setup-timer-head">
        <span>{label}</span>
        <strong>{sec}秒</strong>
      </div>
      <div className="setup-timer-track">
        <div
          className="setup-timer-fill"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 布陣中のカードが、置いた先からどこへ動けるか。
 * 相手の駒はまだ盤に無いので、自分の布陣だけを踏まえた目安になる。
 */
function previewMoves(state, pIdx, size, placement, card, at) {
  const board = emptyBoard(size);
  Object.keys(placement).forEach((id) => {
    if (id === card.id) return;
    const c = findHandCard(state.players[pIdx], id);
    if (!c) return;
    const spot = placement[id];
    board[spot.row][spot.col] = { id, owner: pIdx, rank: c.rank };
  });
  const piece = {
    id: card.id,
    rank: card.rank,
    suit: card.suit,
    owner: pIdx,
    isKing: false,
    row: at.row,
    col: at.col,
    alive: true,
  };
  board[at.row][at.col] = piece;
  return getLegalMoves(piece, board, size, {});
}

export function SetupWaiting({ state, pIdx, size, remainingMs, text }) {
  const sec =
    remainingMs == null ? null : Math.max(0, Math.ceil(remainingMs / 1000));
  const flipped = pIdx === 1;
  const board = state.board && state.board.length ? state.board : null;
  return (
    <div className="setup-wrap">
      <div className="waiting-head">
        <Dice size={22} className="dim-icon spin-icon" />
        <p className="hint" style={{ margin: 0 }}>
          {text || "相手が布陣を決めています…"}
        </p>
      </div>
      {sec !== null && (
        <div className="setup-timer">
          <div className="setup-timer-head">
            <span>
              {sec > 0 ? "相手の残り時間" : "まもなく自動で配置されます"}
            </span>
            <strong>{sec > 0 ? `${sec}秒` : "…"}</strong>
          </div>
          <div className="setup-timer-track">
            <div
              className="setup-timer-fill"
              style={{
                width: `${Math.max(0, Math.min(1, remainingMs / SETUP_LIMIT_MS)) * 100}%`,
              }}
            />
          </div>
          {sec > 0 && (
            <p className="hint" style={{ margin: "6px 0 0" }}>
              時間内に決まらなかった分は自動で配置されます。
            </p>
          )}
        </div>
      )}
      {board && (
        <div className="arrange-layout">
          <div
            className="mini-board"
            style={{ gridTemplateColumns: `repeat(${size},1fr)` }}
          >
            {Array.from({ length: size }).map((_, r) =>
              Array.from({ length: size }).map((__, c) => {
                const row = flipped ? size - 1 - r : r;
                const col = flipped ? size - 1 - c : c;
                const piece = board[row][col];
                const mine = piece && piece.owner === pIdx;
                return (
                  <div className="mini-cell" key={`${row}-${col}`}>
                    {piece && (
                      <div className="mini-piece">
                        {mine ? (
                          <CardFace
                            rank={piece.rank}
                            suit={piece.suit}
                            size="sm"
                          />
                        ) : (
                          <CardBack
                            colorHex={PLAYER_META[piece.owner].color}
                            size="sm"
                          />
                        )}
                        {mine && piece.isKing && (
                          <Crown size={12} className="king-badge" />
                        )}
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PlaceStep({
  state,
  player,
  pIdx,
  size,
  dispatch,
  remainingMs,
  paused,
  focus,
  terse,
}) {
  const [picked, setPicked] = useState(null);
  const guideCard = (id) =>
    !!(focus && focus.cards && focus.cards.includes(id));
  const guideCell = (row, col) =>
    !!(
      focus &&
      focus.cells &&
      focus.cells.some((c) => c.row === row && c.col === col)
    );
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);
  const boardRef = useRef(null);
  const slots = totalSlots(size);
  const [lo, hi] = territoryRows(size, pIdx);
  const placement = state.setupPlacements[pIdx];
  const placedIds = new Set(Object.keys(placement));
  const placedCount = placedIds.size;
  const flipped = pIdx === 1;
  const hand = player.hand
    .filter((c) => !placedIds.has(c.id))
    .sort((a, b) => {
      const d = RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
      return d !== 0 ? d : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    });

  const cardAt = (row, col) => {
    const id = Object.keys(placement).find(
      (k) => placement[k].row === row && placement[k].col === col,
    );
    return id ? { id, card: findHandCard(player, id) } : null;
  };

  // 移動範囲のプレビュー。掴んでいるカードが優先、次に選択中の駒
  const previewFor = (() => {
    if (drag && hover) {
      const card = findHandCard(player, drag.cardId);
      if (card) return { card, at: hover };
    }
    if (picked) {
      const card = findHandCard(player, picked);
      const at = placement[picked];
      if (card && at) return { card, at };
    }
    return null;
  })();
  const preview = previewFor
    ? previewMoves(state, pIdx, size, placement, previewFor.card, previewFor.at)
    : [];
  const previewSet = new Set(preview.map((m) => `${m.row}-${m.col}`));

  function place(cardId, row, col) {
    dispatch({ type: "SETUP_PLACE_CARD", player: pIdx, cardId, row, col });
  }

  /** ポインタ位置の下にある自陣マスを拾う */
  function cellUnder(x, y) {
    const el = document.elementFromPoint(x, y);
    const cell = el && el.closest ? el.closest("[data-cell]") : null;
    if (!cell || !boardRef.current || !boardRef.current.contains(cell))
      return null;
    const [row, col] = cell.dataset.cell.split("-").map(Number);
    return row >= lo && row <= hi ? { row, col } : null;
  }

  /**
   * 指を置いたところから始める。
   * 動かさずに離したら「タップ」、動かして離したら「ドラッグ」として扱う。
   * pointerdown で既定動作を止めているので click は飛んでこない。ここで両方さばく。
   */
  function startDrag(e, cardId, from) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    setDrag({ cardId, from, x: startX, y: startY });
    setHover(null);

    const move = (ev) => {
      if (
        Math.abs(ev.clientX - startX) > 8 ||
        Math.abs(ev.clientY - startY) > 8
      )
        moved = true;
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      setHover(moved ? cellUnder(ev.clientX, ev.clientY) : null);
    };
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(null);
      setHover(null);
      if (moved) {
        const at = cellUnder(ev.clientX, ev.clientY);
        if (at) {
          place(cardId, at.row, at.col);
          setPicked(null);
        }
        return;
      }
      // 指を動かさなかった＝タップ
      if (from && picked && picked !== cardId) {
        // 手札を選んだ状態で盤上の駒をタップ＝そこへ置く(入れ替え)
        place(picked, from.row, from.col);
        setPicked(null);
        return;
      }
      setPicked(picked === cardId ? null : cardId);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function tapCell(row, col, inZone, occupantId) {
    if (!inZone) return;
    if (picked) {
      place(picked, row, col);
      setPicked(null);
      return;
    }
    if (occupantId) setPicked(occupantId);
  }

  const dragCard = drag ? findHandCard(player, drag.cardId) : null;

  return (
    <div className="setup-wrap">
      <h2 style={{ color: PLAYER_META[pIdx].color }}>
        {PLAYER_META[pIdx].name}: カードを盤面に配置してね
      </h2>
      <SetupTimer
        remainingMs={remainingMs}
        label="布陣の残り時間"
        paused={paused}
      />
      {terse ? (
        <p className="hint">
          <span className="legend-dot" />
          は動ける先
          <strong className="hint-count">
            {placedCount}/{slots}
          </strong>
        </p>
      ) : (
        <p className="hint">
          手札を自陣へドラッグ。タップで選んでからマスをタップでも置けます。
          <span className="legend-dot" />
          はその駒が動ける先です。
          <strong className="hint-count">
            {placedCount}/{slots}
          </strong>
        </p>
      )}
      <div className="arrange-layout">
        <div
          className="mini-board"
          ref={boardRef}
          style={{ gridTemplateColumns: `repeat(${size},1fr)` }}
        >
          {Array.from({ length: size }).map((_, r) =>
            Array.from({ length: size }).map((__, c) => {
              const row = flipped ? size - 1 - r : r;
              const col = flipped ? size - 1 - c : c;
              const inZone = row >= lo && row <= hi;
              const here = cardAt(row, col);
              const isHover =
                hover && hover.row === row && hover.col === col
                  ? "mini-cell-hover"
                  : "";
              const canMoveHere = previewSet.has(`${row}-${col}`)
                ? "mini-cell-reach"
                : "";
              return (
                <div
                  data-cell={`${row}-${col}`}
                  className={`mini-cell ${inZone ? "mini-cell-zone" : ""} ${
                    picked && inZone ? "mini-cell-open" : ""
                  } ${isHover} ${canMoveHere} ${
                    guideCell(row, col) ? "guide-target" : ""
                  }`}
                  onClick={() => tapCell(row, col, inZone, here && here.id)}
                  key={`${row}-${col}`}
                >
                  {here && here.card && (
                    <div
                      className={`mini-piece ${
                        picked === here.id ? "piece-selected" : ""
                      } ${drag && drag.cardId === here.id ? "mini-piece-lifted" : ""}`}
                      onPointerDown={(e) => startDrag(e, here.id, { row, col })}
                    >
                      <CardFace
                        rank={here.card.rank}
                        suit={here.card.suit}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
      {picked && placedIds.has(picked) && (
        <button
          className="btn btn-ghost"
          style={{ marginBottom: 12 }}
          onClick={() => {
            dispatch({
              type: "SETUP_UNPLACE_CARD",
              player: pIdx,
              cardId: picked,
            });
            setPicked(null);
          }}
        >
          この駒を手札に戻す
        </button>
      )}
      <div className="tray">
        <div className="tray-label">手札({hand.length}枚)</div>
        <div className="tray-row">
          {hand.length === 0 && (
            <span className="hint">手札を全て配置しました</span>
          )}
          {hand.map((card) => (
            <div
              className={`hand-card ${
                picked === card.id ? "hand-card-selected" : ""
              } ${drag && drag.cardId === card.id ? "hand-card-lifted" : ""} ${
                guideCard(card.id) ? "guide-target" : ""
              }`}
              onPointerDown={(e) => startDrag(e, card.id, null)}
              key={card.id}
            >
              <CardFace rank={card.rank} suit={card.suit} />
            </div>
          ))}
        </div>
      </div>
      <div className="setup-actions">
        <button
          className="btn btn-ghost"
          onClick={() => dispatch({ type: "SETUP_AUTO_ARRANGE", player: pIdx })}
        >
          <Grid size={16} /> 自動配置
        </button>
        <button
          className="btn btn-primary"
          disabled={placedCount !== slots}
          onClick={() =>
            dispatch({ type: "SETUP_GOTO_KING_STEP", player: pIdx })
          }
        >
          <Crown size={16} /> 王を選ぶ
        </button>
      </div>
      {drag && dragCard && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <CardFace rank={dragCard.rank} suit={dragCard.suit} size="sm" />
        </div>
      )}
    </div>
  );
}

export function KingStep({
  state,
  player,
  pIdx,
  size,
  dispatch,
  remainingMs,
  forceRank,
  paused,
  focus,
  terse,
}) {
  const placement = state.setupPlacements[pIdx];
  const pickedKing = state.setupPickKings[pIdx];
  const [lo, hi] = territoryRows(size, pIdx);
  const hasK = Object.keys(placement).some(
    (id) => findHandCard(player, id).rank === "K",
  );
  // チュートリアルで王を指定されている場合。指定の札を置いていなければ普通に選べる
  const forced =
    forceRank &&
    Object.keys(placement).some(
      (id) => findHandCard(player, id).rank === forceRank,
    )
      ? forceRank
      : null;
  const flipped = pIdx === 1;
  return (
    <div className="setup-wrap">
      <h2 style={{ color: PLAYER_META[pIdx].color }}>
        {PLAYER_META[pIdx].name}: どのカードを王にするか決めてね
      </h2>
      <SetupTimer
        remainingMs={remainingMs}
        label="布陣の残り時間"
        paused={paused}
      />
      {!terse && (
        <p className="hint">
          {hasK
            ? "Kを配置しているので、Kが王になります。"
            : forced
              ? `この話では「${forced}」を王にします。${forced}の駒をタップしてください。`
              : "配置したカードの中から王にする1枚をタップしてください。"}
        </p>
      )}
      <div className="arrange-layout">
        <div
          className="mini-board"
          style={{ gridTemplateColumns: `repeat(${size},1fr)` }}
        >
          {Array.from({ length: size }).map((_, r) =>
            Array.from({ length: size }).map((__, c) => {
              const row = flipped ? size - 1 - r : r;
              const col = flipped ? size - 1 - c : c;
              const inZone = row >= lo && row <= hi;
              const id = Object.keys(placement).find(
                (k) => placement[k].row === row && placement[k].col === col,
              );
              const card = id ? findHandCard(player, id) : null;
              const selectable =
                card &&
                (!hasK || card.rank === "K") &&
                (!forced || card.rank === forced);
              return (
                <div
                  className={`mini-cell ${inZone ? "mini-cell-zone" : ""} ${
                    focus &&
                    focus.cells &&
                    focus.cells.some((c) => c.row === row && c.col === col)
                      ? "guide-target"
                      : ""
                  }`}
                  onClick={() => {
                    if (selectable)
                      dispatch({
                        type: "SETUP_PICK_KING",
                        player: pIdx,
                        cardId: id,
                      });
                  }}
                  key={`${row}-${col}`}
                >
                  {card && (
                    <div
                      className={`mini-piece ${
                        pickedKing === id ? "piece-selected" : ""
                      } ${selectable ? "" : "mini-piece-disabled"}`}
                    >
                      <CardFace
                        rank={card.rank}
                        suit={card.suit}
                        size="sm"
                        isKing={pickedKing === id}
                      />
                      {pickedKing === id && (
                        <Crown size={12} className="king-badge" />
                      )}
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
      <div className="setup-actions">
        <button
          className="btn btn-ghost"
          onClick={() =>
            dispatch({ type: "SETUP_BACK_TO_PLACE", player: pIdx })
          }
        >
          <ArrowLeft size={16} /> 配置に戻る
        </button>
        <button
          className="btn btn-primary"
          disabled={!pickedKing}
          onClick={() => dispatch({ type: "SETUP_CONFIRM", player: pIdx })}
        >
          <Crown size={16} /> 布陣を確定
        </button>
      </div>
    </div>
  );
}

export function ReservePlacer({ state, dispatch, size, focus }) {
  let n = state.kPlacement.owner,
    [a, u] = territoryRows(size, n),
    i = n === 1;
  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <h3>予備札を配置</h3>
        <p className="hint">
          Kの効果で引いた1枚。自陣の空きマスに配置できます。
        </p>
        <CardGuide
          rank={state.kPlacement.card.rank}
          suit={state.kPlacement.card.suit}
        />
        <div
          className="mini-board"
          style={{
            gridTemplateColumns: `repeat(${size},1fr)`,
          }}
        >
          {Array.from({
            length: size,
          }).map((f, o) =>
            Array.from({
              length: size,
            }).map((r, d) => {
              let m = i ? size - 1 - o : o,
                s = i ? size - 1 - d : d,
                v = m >= a && m <= u,
                p = state.board[m][s];
              return (
                <div
                  className={`mini-cell ${v && !p ? "mini-cell-zone mini-cell-open" : ""} ${
                    focus &&
                    focus.cells &&
                    focus.cells.some((c) => c.row === m && c.col === s)
                      ? "guide-target"
                      : ""
                  }`}
                  onClick={() => {
                    v &&
                      !p &&
                      dispatch({
                        type: "PLACE_RESERVE_CARD",
                        row: m,
                        col: s,
                      });
                  }}
                  key={`${m}-${s}`}
                >
                  {p && (
                    <div className="mini-piece">
                      <CardBack
                        colorHex={PLAYER_META[p.owner].color}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
        <button
          className="btn btn-ghost"
          onClick={() =>
            dispatch({
              type: "SKIP_RESERVE_PLACEMENT",
            })
          }
        >
          今回は見送る
        </button>
      </div>
    </div>
  );
}
