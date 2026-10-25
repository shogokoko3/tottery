import {aliceSkin} from "../game/alice-rules.js";
import { useEffect, useRef, useState } from "react";
import {
  emptyBoard,
  getLegalMoves,
  kingRankOf,
  squareName,
  territoryRows,
  armySlots,
  kingPowersOn,
} from "../game/board.js";

import {
  PLAYER_META,
  RANKS,
  SUITS,
  SUIT_SYMBOL,
  nameOf,
} from "../game/constants.js";
import { CHANCE_TELL } from "../game/king-power-hint.js";
import { FOE_LEGEND, MOVE_LEGEND, kingPowerCard, kingPowerTag } from "../game/king-power-text.js";
import { hasAdjudicationRules } from "../game/rule-version.js";
import { autoArrangeAction } from "../game/auto-setup.js";
// 予備札の盤で、相手の「分かっている駒」を表で見せる(本編の盤と同じ決まり)
import { isKnownTo } from "../game/areas.js";
import { useWindowWidth } from "../hooks.js";
import { ArrowLeft, Crown, Dice, Grid } from "../icons.jsx";
import { CardBack, CardFace } from "./cards.jsx";
import { CardGuide, PowerBands, PowerFigure, PowerFigurePair } from "./guides.jsx";
import { useNames } from "./names.jsx";
// 句ごとに折り返す文(iPhone の WebKit は auto-phrase を知らない。2026-10-06 見直し)
import { Phrases } from "./phrases.jsx";

export function DiscardPanel({ cards, label, color, owner }) {
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
            <CardFace owner={owner} rank={a.rank} suit={a.suit} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
/**
 * 引き直しの1枚。**MulliganHand の外に置く**(2026-09-23 本人の報告「カードが小刻みに震える」)。
 * 描画のたびに中で部品を作り直すと React が毎回張り替え、残り時間の刻み(200ms)ごとに
 * 札が描き直されて震えて見えた。部品の型を固定すれば、同じ札はそのまま残る
 */
function MulliganCard({ card, selected, focus, onToggle, owner, size }) {
  const picked = selected.has(card.id);
  return (
    <div
      className={`hand-card ${picked ? "hand-card-selected" : ""} ${
        focus && focus.cards && focus.cards.includes(card.id)
          ? "guide-target"
          : ""
      }`}
      onClick={() => onToggle(card.id)}
    >
      <CardFace owner={owner} rank={card.rank} suit={card.suit} size={size} />
      {picked && <span className="discard-badge">✕</span>}
    </div>
  );
}

export function MulliganHand({ hand, selected, onToggle, focus, owner }) {
  const width = useWindowWidth();
  const wide = width >= 480;
  const size = width < 380 ? "sm" : "md";
  const sorted = [...hand].sort((a, b) => {
    const d = RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
    return d !== 0 ? d : SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  });
  const card = (c) => (
    <MulliganCard
      card={c}
      selected={selected}
      focus={focus}
      onToggle={onToggle}
      owner={owner}
      size={size}
      key={c.id}
    />
  );
  return wide ? (
    <div className="hand-split">
      <div className="hand-row">{sorted.slice(0, 7).map(card)}</div>
      <div className="hand-row">{sorted.slice(7).map(card)}</div>
    </div>
  ) : (
    <div className="hand-grid">{sorted.map(card)}</div>
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
                          <CardFace
                            owner={w.owner}
                            rank={w.rank}
                            suit={w.suit}
                            size="sm"
                          />
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
                        <CardFace
                          owner={viewer}
                          rank={z.rank}
                          suit={z.suit}
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
                <CardFace
                  owner={viewer}
                  rank={r.rank}
                  suit={r.suit}
                  size="sm"
                />
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
/**
 * 布陣中に、自分が先攻か後攻かを示す(2026-09-23 本人の指示)。
 * サイコロで決まった順。布陣ボーナス(ストレート)で入れ替わることがあるので「サイコロの結果」と添える。
 * plain は導入の一局(はじめの一局と、ストーリー2つ目の手当ての局)。言葉を導入の調子にそろえ
 * (です・ます調の決まり文句を避ける。2026-10-05 見直し)、「あなたが先に動かします。」の一行だけにする
 * (2026-10-06 見直し。札「あなたは先攻」と横の文が同じことを二度言い、サイコロと引き直しの「先手」と
 * 「先攻」が混ざっていた。サイコロは手当ての局でも直前に見ているので、「サイコロの結果、」も要らない)。
 * 札は折り返さない。横の文は句ごとに折り返す(320 幅で「あなたは後/攻」「…先に動き/ます」と割れた)
 */
export function SetupOrderNote({ state, pIdx, plain = false }) {
  const first = state && state.firstPlayer;
  if (first !== 0 && first !== 1) return null;
  const mine = first === pIdx;
  if (plain)
    return (
      <p className={`setup-order setup-order-plain ${mine ? "setup-order-first" : "setup-order-second"}`}>
        <span>
          <Phrases text={mine ? "あなたが先に動かします。" : "相手が先に動かします。"} />
        </span>
      </p>
    );
  return (
    <p className={`setup-order ${mine ? "setup-order-first" : "setup-order-second"}`}>
      <b>{mine ? "あなたは先攻" : "あなたは後攻"}</b>
      <span>
        <Phrases text={mine ? "サイコロの結果、先に動きます" : "サイコロの結果、相手が先に動きます"} />
      </span>
    </p>
  );
}

/** 残り時間の帯。10秒を切ったら赤くする */
export function SetupTimer({ remainingMs, label, paused, limitMs }) {
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
  const limit = limitMs || 60 * 1000;
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  const ratio = Math.max(0, Math.min(1, remainingMs / limit));
  // 15秒しかない場面で「残り10秒」から赤くしても意味がないので、割合でも見る
  const urgent = remainingMs <= Math.min(10000, limit * 0.3);
  return (
    <div className={`setup-timer ${urgent ? "setup-timer-urgent" : ""}`}>
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
  // 布陣中はまだ王が決まっていない。伸びる前の素の動きを出す
  return getLegalMoves(piece, board, size, {}, null);
}

export function SetupWaiting({
  state,
  pIdx,
  size,
  remainingMs,
  limitMs,
  text,
}) {
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
                width: `${Math.max(0, Math.min(1, remainingMs / (limitMs || 60 * 1000))) * 100}%`,
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
                            owner={piece.owner}
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
  limitMs,
  paused,
  focus,
  terse,
  // 並べ直しを止める台本(はじめの一局)。「この駒を手札に戻す」を出さない(関門でも止まる)
  lockPlacement = false,
  // 見出しの代わりに帯へ置く一言(ストーリー2つ目の手当て「伏せた一枚に、策がある。」)。無ければ見出しのまま
  note = null,
  // 先後の一行を導入の言い方にする(ストーリー2つ目の手当ての局。SetupOrderNote の plain。2026-10-06 見直し)
  orderPlain = false,
}) {
  const names = useNames();
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
  const slots = armySlots(state);
  const [lo, hi] = territoryRows(size, pIdx);
  const placement = state.setupPlacements[pIdx];
  const placedIds = new Set(Object.keys(placement));
  const placedCount = placedIds.size;
  const adoptionTotal = player.hand
    .filter((c) => placedIds.has(c.id))
    .reduce((sum, c) => sum + RANKS.indexOf(c.rank) + 1, 0);
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

  function unplace(cardId) {
    dispatch({ type: "SETUP_UNPLACE_CARD", player: pIdx, cardId });
    setPicked((p) => (p === cardId ? null : p));
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
        // 盤の外へ運んだら手札に戻す。9×9のマスは小さいので、
        // 指がわずかに動いただけでも「運んだ」ことになる。
        // 出発したマスに戻ってきただけなら、タップと同じに扱う
        if (from && !at) {
          unplace(cardId);
          return;
        }
        if (!at) return;
        if (from && at.row === from.row && at.col === from.col) {
          setPicked(picked === cardId ? null : cardId);
          return;
        }
        place(cardId, at.row, at.col);
        setPicked(null);
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
    <div className="setup-wrap setup-wrap-compact">
      {/* 見出し・先攻後攻・残り時間は1つの帯にまとめ、スクロールしても上に貼り付く。
          盤と手札を1画面に収め、配置しながら残り時間を見られるようにする(2026-09-23 本人の指示) */}
      <div className="setup-head">
        {/* 一言があれば見出しの代わりに帯へ置く(ストーリー2つ目の手当て)。帯の下に足すと、
            375×667 の端末で「王を選ぶ」が画面の下へ押し出された */}
        {note || (
          <h2 style={{ color: PLAYER_META[pIdx].color }}>
            {nameOf(pIdx, names)}: カードを盤面に配置してね
          </h2>
        )}
        <SetupOrderNote state={state} pIdx={pIdx} plain={orderPlain} />
        <SetupTimer
          remainingMs={remainingMs}
          label="布陣の残り時間"
          paused={paused}
          limitMs={limitMs}
        />
      </div>
      {/* 絵札に偏って盤に並べきれない手札は、数字の札で配り直している。
          黙って差し替えると「引いた札と違う」と読まれるので、必ず伝える */}
      {state.handRescued && state.handRescued[pIdx] && (
        <p className="setup-rescue">
          手札が絵札（J・Q・K）に偏っていて、盤に並べきれませんでした。
          <br />
          手札と捨て札を予備札に戻し、数字の札だけで配り直しています。引き直しはできません。
        </p>
      )}
      {/* 案内は1行に絞る(長い説明が盤を画面の下へ押し出していた)。
          配置の数と採用合計は同じ行に並べる */}
      <p className="hint setup-hint-line">
        {terse ? (
          <>
            <span className="legend-dot" />
            は動ける先
          </>
        ) : (
          <>
            タップかドラッグで置く。
            <span className="legend-dot" />
            は動ける先
          </>
        )}
        <strong className="hint-count">
          {placedCount}/{slots}
        </strong>
        {hasAdjudicationRules(state.ruleVersion) && !terse && (
          <span className="setup-adoption-total">
            採用合計 <strong>{adoptionTotal}</strong>
          </span>
        )}
      </p>
      {/* K を置くと王は必ず K(王を選ぶ画面で初めて知ると遅い。置く前に知らせる。AI プレイヤーの評価 12〜15回目) */}
      {!terse && player.hand.some((c) => c.rank === "K") && (
        <p className="setup-k-note">Kを置くと、Kが必ず王になる。</p>
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
                        owner={pIdx}
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
      {picked && placedIds.has(picked) && !lockPlacement && (
        <button
          className="btn btn-ghost"
          style={{ marginBottom: 12 }}
          onClick={() => unplace(picked)}
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
              {/* 9×9 の13枚は2段(7枚×2)に収める。5×5 はこれまでの大きさ */}
              <CardFace
                owner={pIdx}
                rank={card.rank}
                suit={card.suit}
                size={hand.length > 10 || slots > 5 ? "tray" : undefined}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="setup-actions">
        <button
          className="btn btn-ghost"
          onClick={() => dispatch(autoArrangeAction(state, pIdx))}
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
          <CardFace
            owner={pIdx}
            rank={dragCard.rank}
            suit={dragCard.suit}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}

/**
 * 王を選ぶ画面の「王の力」(2026-10-25 本人の指示「王の力とはなにか説明が出るように」)。
 * 王の力がある対局(フェーズ2 以降・その席に力がある)だけ出す。盤のすぐ下に置き、タップで中身が変わっても盤は動かない。
 * AI プレイヤー3人で話し合って決めた形(design-v2): タップした駒1つ分だけを、どの数字でも同じ形で見せる
 * (見出し → ふつう/王の図 → 太字の1行 → この盤だけの1行 → 読まれやすさの1行 → くわしく)。
 * 選ぶ前は、盤の駒ごとの力の一言を並べて比べられるようにする。文と図は src/game/king-power-text.js。
 * シーズン2 のスキンの王はスキンの力の文
 */
function kingPowerBoard(state, pIdx, player, placement) {
  if (!kingPowersOn(state, pIdx) || state.scripted) return null;
  const cards = Object.keys(placement || {})
    .map((id) => findHandCard(player, id))
    .filter(Boolean);
  if (!cards.length) return null;
  const counts = {};
  for (const c of cards) counts[c.rank] = (counts[c.rank] || 0) + 1;
  return { counts, hasJQ: !!(counts.J || counts.Q), size: state.boardSize };
}

function KingPowerCard({ state, pIdx, player, pickedKing, info }) {
  const picked = pickedKing ? findHandCard(player, pickedKing) : null;
  if (!picked) {
    // 選ぶ前から、盤の駒ごとの力の一言を並べる(タップしないと比べられなかった。評価 14・15回目)。
    // 力の起きない数字は灰色で最後に
    const rows = Object.keys(info.counts)
      .sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b))
      .map((rank) => {
        const skin = aliceSkin(state, pIdx, rank);
        if (skin) return { rank, text: skin.move || skin.description, active: true, fig: null };
        // 駒ごとに、王にしたときの小さな図(カードの右の図と同じ。図の無い数字は空き)
        const fig = kingPowerCard(rank, info.counts[rank], info.size, info.hasJQ).figs?.[1] || null;
        return { rank, ...kingPowerTag(rank, info.counts[rank], info.size, info.hasJQ), fig };
      });
    const ordered = [...rows.filter((r) => r.active), ...rows.filter((r) => !r.active)];
    return (
      <section className="kp-card is-empty" role="note" aria-live="polite">
        <b className="kp-head">王にすると、こうなる</b>
        {/* 王の力の代償は選ぶ前に一度だけ(王を選ぶときに知りたい、と言われた。評価 12・13回目)。
            カードのいちばん下だと下に留めた釦に隠れた(評価 18回目)ので、見出しのすぐ下に */}
        <p className="kp-tell"><Phrases text={CHANCE_TELL} /></p>
        <ul className="kp-tags">
          {ordered.map((r) => (
            <li key={r.rank} className={r.active ? "" : "is-idle"}>
              <span className="kp-list-rank">{r.rank}</span>
              {r.fig && r.active ? <PowerFigure spec={r.fig} caption={false} mini /> : <span className="kp-mini-none" aria-hidden="true" />}
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
        <p><Phrases text="駒をタップすると、図でくわしく見られる。" /></p>
      </section>
    );
  }
  const skin = aliceSkin(state, pIdx, picked.rank);
  if (skin)
    return (
      <section className="kp-card" role="note" aria-live="polite">
        <b className="kp-head">{picked.rank}を王にすると</b>
        <p className="kp-bold">{skin.description}</p>
      </section>
    );
  const card = kingPowerCard(picked.rank, info.counts[picked.rank], info.size, info.hasJQ);
  return (
    <section className="kp-card" role="note" aria-live="polite">
      <b className="kp-head">{card.head}</b>
      {card.figs && <p className="kp-legend-short"><Phrases text={card.figs.some((f) => f.foes.length) ? FOE_LEGEND : MOVE_LEGEND} /></p>}
      {card.figs && <PowerFigurePair figs={card.figs} />}
      {card.bands && <PowerBands kind={card.bands} />}
      {card.bold && <p className="kp-bold"><Phrases text={card.bold} /></p>}
      {card.plain && <p className="kp-plain"><Phrases text={card.plain} /></p>}
      {card.board && <p className="kp-board"><Phrases text={card.board} /></p>}
      {/* 細かい決まり・使うときの注意は、対局中に力を使える場面で光と一言で出す(2026-10-25 本人の指示「王を選ぶ画面は短く」) */}
    </section>
  );
}

export function KingStep({
  state,
  player,
  pIdx,
  size,
  dispatch,
  remainingMs,
  limitMs,
  forceRank,
  paused,
  focus,
  terse,
  // 見出し「○○: 王にするカードを決めてね」を出さない。台本の札が同じことを言う(はじめの一局)
  quiet = false,
  // 並べ直し(「配置に戻る」)を出さない。台本の盤から外れて1手目が指せなくなる(はじめの一局)
  lockPlacement = false,
  // 確定済みの相手の並びを伏せ札で薄く描く。台本の一局だけ(本番の同時布陣では並びも見せない)
  showFoe = false,
  // 先後の一行を導入の言い方にする(ストーリー2つ目の手当ての局。はじめの一局は quiet で同じになる)
  orderPlain = false,
}) {
  const names = useNames();
  const placement = state.setupPlacements[pIdx];
  const pickedKing = state.setupPickKings[pIdx];
  const foePlacement =
    showFoe && state.setupDone[1 - pIdx] ? state.setupPlacements[1 - pIdx] || {} : {};
  const [lo, hi] = territoryRows(size, pIdx);
  const hasK = Object.keys(placement).some(
    (id) => findHandCard(player, id).rank === "K",
  );
  // 詳細設定「公開する駒を自分で選ぶ」: 王を決めたあと、公開する駒を revealWant 枚タップで選ぶ
  const custom = state.custom;
  const revealWant =
    custom && custom.reveal.choose
      ? Math.min(custom.reveal.count, Object.keys(placement).length - 1)
      : 0;
  const [reveals, setReveals] = useState([]);
  const [revealMode, setRevealMode] = useState(false);
  const chosenReveals = reveals.filter((id) => placement[id] && id !== pickedKing);
  const revealReady = revealWant === 0 || chosenReveals.length === revealWant;
  const toggleReveal = (id) =>
    setReveals((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length >= revealWant
          ? cur
          : [...cur, id],
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
  const powerInfo = kingPowerBoard(state, pIdx, player, placement);
  return (
    <div className={`setup-wrap setup-wrap-compact${quiet ? " first-game-setup" : ""}${powerInfo ? " has-king-power" : ""}`}>
      <div className="setup-head">
        {!quiet && (
          <h2 style={{ color: PLAYER_META[pIdx].color }}>
            {nameOf(pIdx, names)}: 王にする駒を決めてね
          </h2>
        )}
        <SetupOrderNote state={state} pIdx={pIdx} plain={quiet || orderPlain} />
        <SetupTimer
          remainingMs={remainingMs}
          label="王を選ぶ残り時間"
          paused={paused}
          limitMs={limitMs}
        />
      </div>
      {!terse && (
        <p className="hint setup-hint-line">
          {revealMode
            ? `相手に公開する駒を${revealWant}枚タップで選んでください(王は選べません)。残り${revealWant - chosenReveals.length}枚`
            : hasK
              ? (kingPowersOn(state,pIdx) && aliceSkin(state,pIdx,"K") && Object.keys(placement).some(id=>player.hand.find(c=>c.id===id)?.rank==="A") ? "ハートの王はAと一緒に編成できません。配置に戻ってAを外してください。" : "Kを置いているので、Kが王になる。")
              : forced
                ? `この話では「${forced}」を王にします。${forced}の駒をタップしてください。`
                : (
                  // 句の塊で出す(2026-10-06 見直し。文は変えない)。行を釣り合わせる折り返し(.hint の balance)で、
                  // 320 幅だと「…王にす/る1枚を…」と語の途中で割れた。句は1つの span に包む
                  // (案内の行は flex なので、句を直に並べると句ごとに離れた箱になる)
                  <span>
                    <Phrases text={["盤のあなたの駒を", "1つタップすると、", "その駒が王になる。", "何度でも選び直せる。"]} />
                  </span>
                )}
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
              const foeHere =
                !inZone &&
                Object.values(foePlacement).some((at) => at.row === row && at.col === col);
              const selectable =
                card &&
                (!hasK || card.rank === "K") && !(kingPowersOn(state,pIdx) && aliceSkin(state,pIdx,card.rank) && ["J","Q","K"].includes(card.rank) && Object.keys(placement).some(id=>player.hand.find(c=>c.id===id)?.rank==="A")) &&
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
                    if (revealMode) {
                      if (card && id !== pickedKing) toggleReveal(id);
                      return;
                    }
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
                        pickedKing === id || (revealMode && chosenReveals.includes(id)) ? "piece-selected" : ""
                      } ${(revealMode ? id !== pickedKing : selectable) ? "" : "mini-piece-disabled"}`}
                    >
                      <CardFace
                        owner={pIdx}
                        rank={card.rank}
                        suit={card.suit}
                        size="sm"
                        isKing={pickedKing === id}
                      />
                      {pickedKing === id && (
                        <Crown size={12} className="king-badge" />
                      )}
                      {chosenReveals.includes(id) && (
                        <span className="revealed-badge">公開</span>
                      )}
                    </div>
                  )}
                  {foeHere && (
                    <div className="mini-piece mini-piece-foe">
                      <CardBack colorHex={PLAYER_META[1 - pIdx].color} size="sm" />
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
      {powerInfo && !revealMode && (
        <KingPowerCard state={state} pIdx={pIdx} player={player} pickedKing={pickedKing} info={powerInfo} />
      )}
      {/* 王の力の説明があるときは、釦を画面の下に留める(説明は画面ごと送って読む。欄の中だけを送る形はやめた。design-v2) */}
      <div className={`setup-actions ${revealWant > 0 ? "setup-actions-wrap" : ""}${powerInfo ? " setup-actions-stick" : ""}`}>
        {!lockPlacement && (
          <button
            className="btn btn-ghost"
            onClick={() =>
              dispatch({ type: "SETUP_BACK_TO_PLACE", player: pIdx })
            }
          >
            <ArrowLeft size={16} /> 配置に戻る
          </button>
        )}
        {revealWant > 0 && !revealMode && (
          <button
            className="btn btn-primary"
            disabled={!pickedKing}
            onClick={() => setRevealMode(true)}
          >
            公開する駒を選ぶ({revealWant}枚)
          </button>
        )}
        {revealWant > 0 && revealMode && (
          <button className="btn btn-ghost" onClick={() => setRevealMode(false)}>
            王を選び直す
          </button>
        )}
        {(revealWant === 0 || revealMode) && (
          <button
            className="btn btn-primary"
            disabled={!pickedKing || !revealReady}
            onClick={() =>
              dispatch({
                type: "SETUP_CONFIRM",
                player: pIdx,
                ...(revealWant > 0 ? { revealIds: chosenReveals } : null),
              })
            }
          >
            <Crown size={16} /> 布陣を確定
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Kの予備札を盤に出す。置き場所はタップかドラッグで決め、仮置きを見てから「ここに置く」で確定する
 * (以前はマスをタップした瞬間に置いていた。2026-09-11 本人の指摘で確認を挟む)
 */
/** 予備札を指でつかむまでの長押し(ms)。これより前に動かすと画面送り */
const LONG_PRESS_MS = 220;

/** その要素を送っている(縦に溢れて overflow が auto/scroll の)いちばん近い親。無ければ null */
function scrollParentOf(el) {
  let n = el && el.parentElement;
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    if (
      n.scrollHeight > n.clientHeight + 1 &&
      /(auto|scroll)/.test(cs.overflowY)
    )
      return n;
    n = n.parentElement;
  }
  return null;
}

/**
 * 自陣の空きマスに札を1枚置く画面。
 * もとは K の王が引いた予備札の置き場(kPlacement)。ハートの J・Q・K で撃破した駒を仲間にする
 * 置き場も、同じ画面・同じ決まり(自陣の空きマス)にする(2026-10-15 本人の指示)。
 *   placement … { owner, cards }。無ければ state.kPlacement
 *   onPlace(card, row, col) / onSkip … 置く・見送るの手。無ければ予備札の手(PLACE_RESERVE_CARD / SKIP_RESERVE_PLACEMENT)
 *   title / hint / skipLabel … 見出し・説明・見送る釦の言葉
 *   addsCount … 置くと採用枚数が増える(予備札)。仲間にした駒は増えない
 */
export function ReservePlacer({
  state,
  dispatch,
  size,
  focus,
  placement = null,
  onPlace = null,
  onSkip = null,
  title = "予備札を配置",
  hint = null,
  skipLabel = "今回は見送る",
  addsCount = true,
}) {
  const slot = placement || state.kPlacement;
  let n = slot.owner,
    [a, u] = territoryRows(size, n),
    i = n === 1;
  // JとQが同じ手で倒れると2枚めくれる。どちらから置くかを選べるようにする
  const cards = slot.cards;
  const [pick, setPick] = (0, useState)(0);
  // 仮置きの升。確定するまで盤には出ない
  const [target, setTarget] = (0, useState)(null);
  const [drag, setDrag] = (0, useState)(null);
  const [hover, setHover] = (0, useState)(null);
  const boardRef = useRef(null);
  // 説明が長いぶん、開いた直後は盤が画面の下に隠れていることがある。
  // 置く相手は盤なので、開いたら盤が見える位置まで送っておく(2026-09-18)
  useEffect(() => {
    // 絵が出そろってから送る(出す前だと高さが決まっておらず動かない)
    const id = requestAnimationFrame(() => {
      const board = boardRef.current;
      if (!board || !board.scrollIntoView) return;
      // チュートリアルで置き先が決まっているときは、その升を真ん中に
      const el = board.querySelector(".guide-target") || board;
      el.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const chosen = cards[Math.min(pick, cards.length - 1)];
  const open = (row, col) => row >= a && row <= u && !state.board[row][col];
  const cellUnder = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const cell = el && el.closest ? el.closest("[data-cell]") : null;
    if (!cell || !boardRef.current || !boardRef.current.contains(cell))
      return null;
    const [row, col] = cell.dataset.cell.split("-").map(Number);
    return open(row, col) ? { row, col } : null;
  };
  /** 指が盤(mini-board)の上にあるか */
  const overBoard = (x, y) => {
    const b = boardRef.current && boardRef.current.getBoundingClientRect();
    return !!b && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  };
  /**
   * 盤の上に仮置きした駒を掴んで置き直す(盤の外の札からは始めない)。
   * 指(タッチ)では長押しでつかむ。長押しの前に動かしたら画面送り(スクロール)、
   * 動かさず離せば何もしない。マウスはすぐつかむ。
   * 駒は touch-action:none のままなので、画面送りは自分で scrollTop を動かす
   */
  function startDrag(e, idx, fromTarget) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX,
      startY = e.clientY;
    const touch = e.pointerType !== "mouse";
    const scroller = scrollParentOf(e.currentTarget);
    const scrollTop0 = scroller ? scroller.scrollTop : 0;
    let moved = false;
    // wait: 長押し待ち / scroll: 画面送り / drag: つかんでいる
    let mode = touch ? "wait" : "drag";
    if (idx !== pick) {
      setPick(idx);
      setTarget(null);
    }
    const lift = () => {
      mode = "drag";
      setDrag({
        x: startX,
        y: startY,
        idx,
        onBoard: overBoard(startX, startY),
      });
    };
    const timer = touch ? setTimeout(lift, LONG_PRESS_MS) : null;
    if (!touch) lift();
    const move = (ev) => {
      const dx = ev.clientX - startX,
        dy = ev.clientY - startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
      if (mode === "wait") {
        if (!moved) return;
        clearTimeout(timer);
        mode = "scroll";
      }
      if (mode === "scroll") {
        if (scroller) scroller.scrollTop = scrollTop0 - dy;
        return;
      }
      // つかんだ札の絵は、指が盤の上に来てから出す(盤の外に札が出ない。本人の指摘 2026-09-15)
      const onBoard = overBoard(ev.clientX, ev.clientY);
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY, onBoard } : d));
      setHover(moved ? cellUnder(ev.clientX, ev.clientY) : null);
    };
    // 指が離れた合図は pointerup だけに頼らない。iOS で届かないことがあり、つかんだ状態
    // (札の絵)が残った(本人の指摘 2026-09-15)。touchend/touchcancel・画面の切り替えでも必ず解く
    let done = false;
    const up = (ev) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      for (const [t, f] of listeners) window.removeEventListener(t, f);
      document.removeEventListener("visibilitychange", up);
      setDrag(null);
      setHover(null);
      // 画面送り、または長押し前のタップ(選ぶだけ)、または合図の取りこぼし
      if (mode !== "drag" || !moved || !ev || ev.type !== "pointerup") return;
      const at = cellUnder(ev.clientX, ev.clientY);
      // 仮置きの駒を盤の外へ運んだら置き直し
      if (!at) {
        if (fromTarget) setTarget(null);
        return;
      }
      setTarget(at);
    };
    const listeners = [
      ["pointermove", move],
      ["pointerup", up],
      ["pointercancel", up],
      ["touchend", () => setTimeout(() => up(null), 0)],
      ["touchcancel", () => up(null)],
      ["blur", () => up(null)],
    ];
    for (const [t, f] of listeners) window.addEventListener(t, f);
    document.addEventListener("visibilitychange", up);
  }
  const confirm = () => {
    if (!target || !open(target.row, target.col)) return;
    if (onPlace) onPlace(chosen, target.row, target.col);
    else
      dispatch({
        type: "PLACE_RESERVE_CARD",
        row: target.row,
        col: target.col,
        cardId: chosen.id,
      });
    setTarget(null);
  };
  const focusCell = (row, col) =>
    !!(
      focus &&
      focus.cells &&
      focus.cells.some((c) => c.row === row && c.col === col)
    );
  const targetOk = !!target && open(target.row, target.col);
  // 動ける先のガイド(布陣と同じ)。掴んで升の上にいるときはその升、決めた後は仮置きの升から
  const previewAt = drag && hover ? hover : targetOk ? target : null;
  const reach = new Set();
  if (previewAt) {
    const board = state.board.map((r) => [...r]);
    const piece = {
      id: chosen.id,
      rank: chosen.rank,
      suit: chosen.suit,
      owner: n,
      isKing: false,
      row: previewAt.row,
      col: previewAt.col,
      alive: true,
    };
    board[previewAt.row][previewAt.col] = piece;
    // 置くと採用枚数が1枚増える(4・5 の王なら同じ数字の射程が伸びる)
    const counts = {
      ...state.players[n].armyRankCounts,
      [chosen.rank]:
        (state.players[n].armyRankCounts[chosen.rank] || 0) + (addsCount ? 1 : 0),
    };
    for (const m of getLegalMoves(
      piece,
      board,
      size,
      counts,
      kingRankOf(state, n),
    ))
      reach.add(`${m.row}-${m.col}`);
  }
  return (
    <div className="modal-overlay">
      <div className="modal-panel modal-panel-reserve">
        {/* 釦の帯は下に固定し、盤と説明だけを送る。貼り付け(sticky)だと帯が盤の下の段を
            覆って、置きたいマスに触れないことがあった(2026-09-18) */}
        <div className="reserve-scroll">
        <h3>{title}</h3>
        <p className="hint">
          {hint ||
            (cards.length > 1
              ? `Kの効果で引いた${cards.length}枚。置く札を選び、自陣の空きマスをタップして置き場所を決めます。`
              : "Kの効果で引いた1枚。自陣の空きマスをタップして置き場所を決めます。")}
          置いた駒はドラッグで動かせます。置き場所を決めてから「ここに置く」で確定します。
          <span className="legend-dot" aria-hidden="true" />
          はその駒が動ける先です。
        </p>
        {/* 盤の外(説明の札)は触っても画面送りだけ。つかむのは盤の上に仮置きした駒だけ
            (本人の指摘 2026-09-15「盤面外はスクロール以外できない」) */}
        {cards.length > 1 ? (
          <div className="reserve-picks">
            {cards.map((c, idx) => (
              <button
                key={c.id}
                className={`reserve-pick ${chosen.id === c.id ? "reserve-pick-on" : ""}`}
                onClick={() => {
                  if (idx !== pick) {
                    setPick(idx);
                    setTarget(null);
                  }
                }}
              >
                <CardGuide rank={c.rank} suit={c.suit} placing />
              </button>
            ))}
          </div>
        ) : (
          <div className="reserve-source">
            <CardGuide rank={chosen.rank} suit={chosen.suit} placing />
          </div>
        )}
        <div
          className="mini-board"
          ref={boardRef}
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
                v = open(m, s),
                p = state.board[m][s],
                isTarget = !!target && target.row === m && target.col === s,
                isHover = !!hover && hover.row === m && hover.col === s;
              return (
                <div
                  className={`mini-cell ${v ? "mini-cell-zone mini-cell-open" : ""} ${isTarget ? "mini-cell-target" : ""} ${isHover ? "mini-cell-hover" : ""} ${reach.has(`${m}-${s}`) ? "mini-cell-reach" : ""} ${
                    focusCell(m, s) && !target ? "guide-target" : ""
                  }`}
                  data-cell={`${m}-${s}`}
                  onPointerDown={
                    isTarget ? (e) => startDrag(e, pick, true) : undefined
                  }
                  onClick={() => {
                    if (!v) return;
                    // 同じ升をもう一度タップしても仮置きのまま
                    setTarget({ row: m, col: s });
                  }}
                  key={`${m}-${s}`}
                >
                  {p && (
                    // 自分の駒は表で見せる。どこに空きがあるか、
                    // 何を置き足すかを判断できないと配置場所を選べない。
                    // 相手の駒も、公開・見抜きで分かっているものは本編の盤と同じに表で見せる
                    // (2026-09-17 本人の指示。伏せたままの駒は裏のまま)
                    <div className="mini-piece">
                      {p.owner === n || isKnownTo(state, n, p) ? (
                        <>
                          <CardFace
                            owner={p.owner}
                            rank={p.rank}
                            suit={p.suit}
                            size="sm"
                          />
                          {p.isKing && (
                            <Crown size={12} className="king-badge" />
                          )}
                          {p.owner !== n && (
                            <span
                              className="mini-foe-face"
                              style={{ "--who": PLAYER_META[p.owner].color }}
                              aria-label="相手の分かっている駒"
                            />
                          )}
                        </>
                      ) : (
                        <CardBack
                          colorHex={PLAYER_META[p.owner].color}
                          size="sm"
                        />
                      )}
                    </div>
                  )}
                  {isTarget && !p && (
                    // 仮置き。確定するまで盤には出ない
                    <div
                      className={`mini-piece mini-piece-preview ${drag && drag.idx === pick ? "mini-piece-lifted" : ""}`}
                    >
                      <CardFace
                        owner={n}
                        rank={chosen.rank}
                        suit={chosen.suit}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
        <p className="hint reserve-status">
          {targetOk
            ? `${chosen.rank}${SUIT_SYMBOL[chosen.suit]} を ${squareName(target.row, target.col, size)} に置きます。別のマスをタップするか、駒をドラッグすると置き直せます。`
            : "まだ置き場所が決まっていません。"}
        </p>
        </div>
        <div className="reserve-actions">
          <button
            className={`btn btn-primary ${focus && targetOk ? "guide-target" : ""}`}
            disabled={!targetOk}
            onClick={confirm}
          >
            ここに置く
          </button>
          {targetOk && (
            <button className="btn btn-ghost" onClick={() => setTarget(null)}>
              置き直す
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={() =>
              onSkip
                ? onSkip()
                : dispatch({
                    type: "SKIP_RESERVE_PLACEMENT",
                  })
            }
          >
            {skipLabel}
          </button>
        </div>
      </div>
      {drag && drag.onBoard && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <CardFace
            owner={n}
            rank={cards[Math.min(drag.idx, cards.length - 1)].rank}
            suit={cards[Math.min(drag.idx, cards.length - 1)].suit}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
