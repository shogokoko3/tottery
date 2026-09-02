import { useEffect, useState } from "react";
import { dieImg } from "../assets.js";
import { PLAYER_META } from "../game/constants.js";
import { ArrowRight } from "../icons.jsx";

export const DIE_PIPS = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  5: [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  6: [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
};
export function Die({ value, rolling, color, big }) {
  let a = DIE_PIPS[value] || DIE_PIPS[1];
  return rolling && big ? (
    <div
      className="die3d die-rolling"
      style={{
        "--die-accent": color || "var(--gold)",
      }}
    >
      <img src={dieImg} alt="" draggable="false" />
    </div>
  ) : (
    <div
      className={`die ${rolling ? "die-rolling" : ""}`}
      style={{
        "--die-accent": color || "var(--gold)",
      }}
    >
      <div className="die-grid">
        {Array.from({
          length: 9,
        }).map((u, i) => {
          let f = Math.floor(i / 3),
            o = i % 3,
            r = a.some(([d, m]) => d === f && m === o);
          return (
            <span
              className={r ? "pip pip-on" : "pip"}
              style={
                r
                  ? {
                      background: color,
                    }
                  : void 0
              }
              key={i}
            />
          );
        })}
      </div>
    </div>
  );
}
export function DiceStage({ playerIdx, value }) {
  let l = PLAYER_META[playerIdx],
    [n, a] = (0, useState)(1),
    u = value != null;
  return (
    (0, useEffect)(() => {
      if (u) {
        a(value);
        return;
      }
      let i = setInterval(() => a(1 + Math.floor(Math.random() * 6)), 140);
      return () => clearInterval(i);
    }, [u, value]),
    (
      <div className="center-stage">
        <h2
          style={{
            color: l.color,
          }}
        >
          相手({l.name})のサイコロ
        </h2>
        <div className="die-stage">
          <Die value={n} rolling={!u} color={l.color} big={!0} />
        </div>
        {u ? (
          <>
            <p
              className="die-result"
              style={{
                color: l.color,
              }}
            >
              {value} が出ました
            </p>
            <p className="hint">相手が次に進むのを待っています…</p>
          </>
        ) : (
          <p className="hint">相手が振っています…</p>
        )}
      </div>
    )
  );
}
export function DiceStep({ playerIdx, value, onRoll, onNext }) {
  let [a, u] = (0, useState)(!1),
    [i, f] = (0, useState)(1),
    o = PLAYER_META[playerIdx];
  ((0, useEffect)(() => {
    if (!a) return;
    let d = setInterval(() => f(1 + Math.floor(Math.random() * 6)), 70),
      m = setTimeout(() => {
        (u(!1), onRoll());
      }, 900);
    return () => {
      (clearInterval(d), clearTimeout(m));
    };
  }, [a]),
    (0, useEffect)(() => {
      value !== null && !a && f(value);
    }, [value, a]));
  let r = value !== null && !a;
  return (
    <div className="center-stage">
      <h2
        style={{
          color: o.color,
        }}
      >
        あなた({o.name})のサイコロ
      </h2>
      <div className="die-stage">
        <Die value={i} rolling={a} color={o.color} big={!0} />
      </div>
      {r ? (
        <>
          <p
            className="die-result"
            style={{
              color: o.color,
            }}
          >
            {value} が出ました
          </p>
          <button className="btn btn-primary" onClick={onNext}>
            次へ <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <button className="btn btn-primary" disabled={a} onClick={() => u(!0)}>
          {a ? "転がしています…" : "サイコロを振る"}
        </button>
      )}
    </div>
  );
}
