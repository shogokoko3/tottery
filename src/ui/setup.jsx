import { useState } from "react";
import { territoryRows, totalSlots } from "../game/board.js";
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
export function MulliganHand({ hand, selected, onToggle }) {
  let n = useWindowWidth(),
    a = n >= 480,
    u = n < 380 ? "sm" : "md",
    i = [...hand].sort((o, r) => {
      let d = RANKS.indexOf(o.rank) - RANKS.indexOf(r.rank);
      return d !== 0 ? d : SUITS.indexOf(o.suit) - SUITS.indexOf(r.suit);
    }),
    f = ({ c: o }) => (
      <div
        className={`hand-card ${selected.has(o.id) ? "hand-card-selected" : ""}`}
        onClick={() => onToggle(o.id)}
      >
        <CardFace rank={o.rank} suit={o.suit} size={u} />
        {selected.has(o.id) && <span className="discard-badge">✕</span>}
      </div>
    );
  return a ? (
    <div className="hand-split">
      <div className="hand-row">
        {i.slice(0, 7).map((o) => (
          <f c={o} key={o.id} />
        ))}
      </div>
      <div className="hand-row">
        {i.slice(7, 13).map((o) => (
          <f c={o} key={o.id} />
        ))}
      </div>
    </div>
  ) : (
    <div className="hand-grid">
      {i.map((o) => (
        <f c={o} key={o.id} />
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
export function PlaceStep({ state, player, pIdx, size, dispatch }) {
  let [u, i] = (0, useState)(null),
    f = totalSlots(size),
    [o, r] = territoryRows(size, pIdx),
    d = state.setupPlacement,
    m = new Set(Object.keys(d)),
    s = m.size,
    v = player.hand
      .filter((z) => !m.has(z.id))
      .sort((z, g) => {
        let A = RANKS.indexOf(z.rank) - RANKS.indexOf(g.rank);
        return A !== 0 ? A : SUITS.indexOf(z.suit) - SUITS.indexOf(g.suit);
      }),
    p = pIdx === 1;
  function w(z, g, A, b) {
    A &&
      (u
        ? (dispatch({
            type: "SETUP_PLACE_CARD",
            cardId: u,
            row: z,
            col: g,
          }),
          i(null))
        : b && i(b));
  }
  return (
    <div className="setup-wrap">
      <h2
        style={{
          color: PLAYER_META[pIdx].color,
        }}
      >
        {PLAYER_META[pIdx].name}: カードを盤面に配置してね
      </h2>
      <p className="hint">
        手札(または盤上の駒)をタップして選び、自陣のマスをタップして置いてください。ちょうど
        {f}
        枚を配置します({s}/{f})。
      </p>
      <div className="arrange-layout">
        <div
          className="mini-board"
          style={{
            gridTemplateColumns: `repeat(${size},1fr)`,
          }}
        >
          {Array.from({
            length: size,
          }).map((z, g) =>
            Array.from({
              length: size,
            }).map((A, b) => {
              let y = p ? size - 1 - g : g,
                T = p ? size - 1 - b : b,
                R = y >= o && y <= r,
                P = Object.keys(d).find(
                  (N) => d[N].row === y && d[N].col === T,
                ),
                x = P ? findHandCard(player, P) : null;
              return (
                <div
                  className={`mini-cell ${R ? "mini-cell-zone" : ""} ${u && R ? "mini-cell-open" : ""}`}
                  onClick={() => w(y, T, R, P)}
                  key={`${y}-${T}`}
                >
                  {x && (
                    <div
                      className={`mini-piece ${u === P ? "piece-selected" : ""}`}
                    >
                      <CardFace rank={x.rank} suit={x.suit} size="sm" />
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
      {u && m.has(u) && (
        <button
          className="btn btn-ghost"
          style={{
            marginBottom: 12,
          }}
          onClick={() => {
            (dispatch({
              type: "SETUP_UNPLACE_CARD",
              cardId: u,
            }),
              i(null));
          }}
        >
          この駒を手札に戻す
        </button>
      )}
      <div className="tray">
        <div className="tray-label">手札({v.length}枚)</div>
        <div className="tray-row">
          {v.length === 0 && (
            <span className="hint">手札を全て配置しました</span>
          )}
          {v.map((z) => (
            <div
              className={`hand-card ${u === z.id ? "hand-card-selected" : ""}`}
              onClick={() => i(u === z.id ? null : z.id)}
              key={z.id}
            >
              <CardFace rank={z.rank} suit={z.suit} />
            </div>
          ))}
        </div>
      </div>
      <div className="setup-actions">
        <button
          className="btn btn-ghost"
          onClick={() =>
            dispatch({
              type: "SETUP_AUTO_ARRANGE",
            })
          }
        >
          <Grid size={16} /> 自動配置
        </button>
        <button
          className="btn btn-primary"
          disabled={s !== f}
          onClick={() =>
            dispatch({
              type: "SETUP_GOTO_KING_STEP",
            })
          }
        >
          <Crown size={16} /> 王を選ぶ
        </button>
      </div>
    </div>
  );
}
export function KingStep({ state, player, pIdx, size, dispatch }) {
  let u = state.setupPlacement,
    [i, f] = territoryRows(size, pIdx),
    o = Object.keys(u).some((d) => findHandCard(player, d).rank === "K"),
    r = pIdx === 1;
  return (
    <div className="setup-wrap">
      <h2
        style={{
          color: PLAYER_META[pIdx].color,
        }}
      >
        {PLAYER_META[pIdx].name}: どのカードを王にするか決めてね
      </h2>
      <p className="hint">
        {o
          ? "Kを配置しているので、Kが王になります。"
          : "配置したカードの中から王にする1枚をタップしてください。"}
      </p>
      <div className="arrange-layout">
        <div
          className="mini-board"
          style={{
            gridTemplateColumns: `repeat(${size},1fr)`,
          }}
        >
          {Array.from({
            length: size,
          }).map((d, m) =>
            Array.from({
              length: size,
            }).map((s, v) => {
              let p = r ? size - 1 - m : m,
                w = r ? size - 1 - v : v,
                z = p >= i && p <= f,
                g = Object.keys(u).find(
                  (y) => u[y].row === p && u[y].col === w,
                ),
                A = g ? findHandCard(player, g) : null,
                b = A && (!o || A.rank === "K");
              return (
                <div
                  className={`mini-cell ${z ? "mini-cell-zone" : ""}`}
                  onClick={() => {
                    b &&
                      dispatch({
                        type: "SETUP_PICK_KING",
                        cardId: g,
                      });
                  }}
                  key={`${p}-${w}`}
                >
                  {A && (
                    <div
                      className={`mini-piece ${state.setupPickKing === g ? "piece-selected" : ""} ${b ? "" : "mini-piece-disabled"}`}
                    >
                      <CardFace
                        rank={A.rank}
                        suit={A.suit}
                        size="sm"
                        isKing={state.setupPickKing === g}
                      />
                      {state.setupPickKing === g && (
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
            dispatch({
              type: "SETUP_BACK_TO_PLACE",
            })
          }
        >
          <ArrowLeft size={16} /> 配置に戻る
        </button>
        <button
          className="btn btn-primary"
          disabled={!state.setupPickKing}
          onClick={() =>
            dispatch({
              type: "SETUP_CONFIRM",
            })
          }
        >
          <Crown size={16} /> 布陣を確定
        </button>
      </div>
    </div>
  );
}
export function ReservePlacer({ state, dispatch, size }) {
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
                  className={`mini-cell ${v && !p ? "mini-cell-zone mini-cell-open" : ""}`}
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
