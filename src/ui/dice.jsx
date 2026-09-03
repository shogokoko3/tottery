import { useEffect, useState } from "react";
import { dieImg } from "../assets.js";
import { PLAYER_META, playerLabel } from "../game/constants.js";
import { ArrowRight } from "../icons.jsx";
import { useNames, useSeats } from "./names.jsx";
import { PlayerIcon } from "./playericon.jsx";
import { shortPlayerLabel } from "../game/constants.js";
import { titleNameOf } from "../game/titles.js";

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
/** 3×3 の目。面ごとに使い回す */
function DieGrid({ value, color }) {
  let pips = DIE_PIPS[value] || DIE_PIPS[1];
  return (
    <div className="die-grid">
      {Array.from({ length: 9 }).map((u, i) => {
        let f = Math.floor(i / 3),
          o = i % 3,
          r = pips.some(([d, m]) => d === f && m === o);
        return (
          <span
            className={r ? "pip pip-on" : "pip"}
            style={r ? { background: color } : void 0}
            key={i}
          />
        );
      })}
    </div>
  );
}

/**
 * 立方体の6面。向かい合う面の和が7になる本物の並び。
 * 前=1 / 後=6 / 右=3 / 左=4 / 上=2 / 下=5
 */
const CUBE_FACES = [
  { value: 1, pos: "front" },
  { value: 6, pos: "back" },
  { value: 3, pos: "right" },
  { value: 4, pos: "left" },
  { value: 2, pos: "top" },
  { value: 5, pos: "bottom" },
];

/** その目を正面に向けるための、立方体の回し方 */
const FACE_TURN = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  2: [-90, 0],
  5: [90, 0],
};

/** 転がりが収まるまでの時間(ms)。CSS の transition と同じ長さ */
export const DIE_SETTLE_MS = 1150;

/**
 * 転がる立体のサイコロ。
 *
 * rolling の間は CSS のアニメーションで跳ねながら回り続ける。
 * 止めるときは、出目を正面にする角度に「余分な2回転」を足した向きへ
 * transition で回す。回転が減速しながら出目でぴたりと止まって見える。
 * 余分な回転は 360 の倍数なので、最後の向きは変わらない。
 */
export function DieCube({ value, rolling, color }) {
  let [fx, fy] = FACE_TURN[value] || FACE_TURN[1];
  // 止まるときの回り方は CSS の die-settle が担う。transition にすると、
  // 転がりの途中の向き(行列)から補間されて最短経路で回り、余分な回転が消える
  let toX = `${fx + 720}deg`,
    toY = `${fy + 720}deg`;
  return (
    <div
      className={`die-cube-wrap ${rolling ? "is-rolling" : "is-settled"}`}
      style={{ "--die-accent": color || "var(--gold)" }}
    >
      <div
        className="die-cube"
        style={
          rolling
            ? void 0
            : {
                "--to-x": toX,
                "--to-y": toY,
                transform: `rotateX(${toX}) rotateY(${toY})`,
              }
        }
      >
        {CUBE_FACES.map((f) => (
          <div className={`die-face die-face-${f.pos}`} key={f.pos}>
            <DieGrid value={f.value} color={color} />
          </div>
        ))}
      </div>
      <div className="die-shadow" />
    </div>
  );
}

/** 出目が決まってから、転がりが収まるまで待つ */
function useSettled(value, rolling) {
  let [settled, setSettled] = (0, useState)(false);
  (0, useEffect)(() => {
    if (value == null || rolling) {
      setSettled(false);
      return;
    }
    let t = setTimeout(() => setSettled(true), DIE_SETTLE_MS);
    return () => clearTimeout(t);
  }, [value, rolling]);
  return settled;
}

/**
 * 対戦の顔ぶれ。マッチした相手の名前と称号を、最初のサイコロの場面で見せる。
 * 称号が渡ってこない対局(CPU・同じ端末)では何も出さない。
 */
export function MatchupBar({ viewer }) {
  let { names, icons, titles } = useSeats();
  // 相手が古い版で称号を持っていなくても、自分の称号があれば顔ぶれは出す
  if (!names || !titles || !titles.some(Boolean)) return null;
  let side = (idx) => (
    <div className="matchup-side">
      <PlayerIcon
        icon={icons && icons[idx]}
        name={names[idx]}
        side={idx}
        size="sm"
      />
      <div className="matchup-who">
        <b style={{ color: PLAYER_META[idx].color }}>
          {shortPlayerLabel(idx, viewer, names)}
        </b>
        {titleNameOf(titles[idx]) && (
          <em className="seat-title">{titleNameOf(titles[idx])}</em>
        )}
      </div>
    </div>
  );
  let [me, foe] = viewer === 1 ? [1, 0] : [0, 1];
  return (
    <div className="matchup">
      {side(me)}
      <span className="matchup-vs">vs</span>
      {side(foe)}
    </div>
  );
}

export function DiceStage({ playerIdx, value }) {
  let names = useNames(),
    l = PLAYER_META[playerIdx],
    u = value != null,
    settled = useSettled(value, !u);
  return (
    <div className="center-stage">
      <MatchupBar viewer={1 - playerIdx} />
      <h2
        style={{
          color: l.color,
        }}
      >
        {playerLabel(playerIdx, 1 - playerIdx, names)}のサイコロ
      </h2>
      <div className="die-stage">
        <DieCube value={u ? value : 1} rolling={!u} color={l.color} />
      </div>
      {u && settled ? (
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
  );
}
export function DiceStep({ playerIdx, value, onRoll, onNext }) {
  let names = useNames();
  let [a, u] = (0, useState)(!1),
    o = PLAYER_META[playerIdx];
  // 押してから 900ms 転がして、それから出目を決める。決まると止まりはじめる
  (0, useEffect)(() => {
    if (!a) return;
    let m = setTimeout(() => {
      (u(!1), onRoll());
    }, 900);
    return () => clearTimeout(m);
  }, [a]);
  let rolling = a || value === null,
    settled = useSettled(value, rolling),
    r = value !== null && !a && settled;
  return (
    <div className="center-stage">
      <MatchupBar viewer={playerIdx} />
      <h2
        style={{
          color: o.color,
        }}
      >
        {playerLabel(playerIdx, playerIdx, names)}のサイコロ
      </h2>
      <div className="die-stage">
        <DieCube
          value={value === null ? 1 : value}
          rolling={a}
          color={o.color}
        />
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
        <button
          className="btn btn-primary"
          disabled={a || (value !== null && !settled)}
          onClick={() => u(!0)}
        >
          {a || (value !== null && !settled)
            ? "転がしています…"
            : "サイコロを振る"}
        </button>
      )}
    </div>
  );
}
