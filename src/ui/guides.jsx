import { useState } from "react";
import { emptyBoard, getLegalMoves } from "../game/board.js";
import { KING_TEXT, MOVE_TEXT, RANKS } from "../game/constants.js";
import { Close } from "../icons.jsx";
import { CardFace } from "./cards.jsx";

export function MoveDiagram({ rank, isKing = !1, gridSize = 7 }) {
  // 4・5 の王は自分ではなく「王以外の同じ数字」を伸ばす。
  // 王の欄では、その伸びた駒のほうを描く(王自身は素の動きのままなので、
  // 王として描くと通常の欄と同じ図になり、何が変わったのか読めない)
  const growsOthers = rank === "4" || rank === "5";
  const drawAsKing = isKing && !growsOthers;
  let n = Math.floor(gridSize / 2),
    a = emptyBoard(gridSize),
    u = {
      id: "me",
      rank,
      suit: "spade",
      owner: 0,
      isKing: drawAsKing,
      row: n,
      col: n,
      alive: !0,
      history: [],
    };
  if (((a[n][n] = u), drawAsKing && ["6", "7", "8", "9"].includes(rank)))
    for (let o = 0; o < gridSize; o++)
      for (let r = 0; r < gridSize; r++)
        (o === n && r === n) ||
          (a[o][r] = {
            id: `e${o}-${r}`,
            rank: "2",
            suit: "heart",
            owner: 1,
            isKing: !1,
            row: o,
            col: r,
            alive: !0,
            history: [],
          });
  let i =
      rank === "A"
        ? []
        : getLegalMoves(u, a, gridSize, { [rank]: 1 }, isKing ? rank : null),
    f = new Set(i.map((o) => `${o.row},${o.col}`));
  return (
    <div
      className="move-diagram"
      style={{
        gridTemplateColumns: `repeat(${gridSize},1fr)`,
      }}
    >
      {Array.from({
        length: gridSize,
      }).map((o, r) =>
        Array.from({
          length: gridSize,
        }).map((d, m) => {
          let s = r === n && m === n,
            v = f.has(`${r},${m}`);
          return (
            <span
              className={`md-cell ${s ? "md-me" : ""} ${v ? "md-reach" : ""}`}
              key={`${r}-${m}`}
            />
          );
        }),
      )}
    </div>
  );
}
export function CardGuide({ rank, suit, isKing = !1, compact = !1 }) {
  return (
    <div className={`card-guide ${compact ? "card-guide-compact" : ""}`}>
      <div className="cg-head">
        {suit ? (
          <CardFace rank={rank} suit={suit} />
        ) : (
          <div className="cg-rank">{rank}</div>
        )}
        <MoveDiagram rank={rank} isKing={isKing} />
      </div>
      <p className="cg-text">{MOVE_TEXT[rank]}</p>
      {isKing && <p className="cg-king">王の効果: {KING_TEXT[rank]}</p>}
    </div>
  );
}
export function RulesPanel({ onClose }) {
  let [t, l] = (0, useState)(!1);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(n) => n.stopPropagation()}>
        <div className="modal-head">
          <h3>カード早見表</h3>
          <button className="icon-btn" onClick={onClose}>
            <Close size={18} />
          </button>
        </div>
        <div className="rule-toggle">
          <button
            className={`btn ${t ? "btn-ghost" : "btn-primary"}`}
            onClick={() => l(!1)}
          >
            通常の動き
          </button>
          <button
            className={`btn ${t ? "btn-primary" : "btn-ghost"}`}
            onClick={() => l(!0)}
          >
            王にした時
          </button>
        </div>
        <p
          className="hint"
          style={{
            marginBottom: 14,
          }}
        >
          {t
            ? "王にした時に加わる効果です。図は同じ数字を1枚だけ採用した場合。"
            : "金色のマスが動ける先です。"}
        </p>
        <div className="rule-grid">
          {RANKS.map((n) => (
            <div className="rule-row" key={n}>
              <div className="rule-diagram">
                <div className="rule-rank">{n}</div>
                <MoveDiagram rank={n} isKing={t} />
              </div>
              <div className="rule-desc">{t ? KING_TEXT[n] : MOVE_TEXT[n]}</div>
            </div>
          ))}
        </div>
        {/* 表になる場面は2つしかないので、早見表の足元に添えておく */}
        <p className="hint rule-foot">
          駒が表になるのは3つの場面です。布陣が<b>フラッシュ</b>で相手に公開された
          とき、<b>相手の王を討った</b>とき（その駒はその場で名乗りを上げます）、
          そして<b>Kの王の予備札</b>から出たとき。表になった駒は、相手にも
          正体が見えます。
        </p>
      </div>
    </div>
  );
}
