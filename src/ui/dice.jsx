import { useEffect, useState } from "react";
import { dieImg } from "../assets.js";
import { PLAYER_META, playerLabel } from "../game/constants.js";
import { ArrowRight } from "../icons.jsx";
import { useNames, useSeats } from "./names.jsx";
import { PlayerIcon } from "./playericon.jsx";
import { shortPlayerLabel } from "../game/constants.js";
import { TitleFrame } from "./title-frame.jsx";

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
      </div>
      <TitleFrame id={titles[idx]} size="compact" />
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

/**
 * 版18以降: 両者が同時に振るサイコロ(2026-09-23 本人の指示)。
 * 左に自分、右に相手。自分は釦で振る(20秒で自動)。相手の目は届いた瞬間に転がして止まる。
 *   dice     … [席0の目, 席1の目](null は未)
 *   me       … 自分の席
 *   onRoll   … 自分の目を振る
 *   remainingMs / limitMs … 残り時間の帯(両者同じ時計)
 *   settledAll … 両方そろって先手が決まったか(結果の文言を出す)
 */
export function DiceDuo({
  dice,
  me,
  onRoll,
  remainingMs,
  limitMs,
  firstPlayer,
  tie = false,
}) {
  const names = useNames();
  const [pressed, setPressed] = useState(false);
  // 押してから 900ms 転がして、それから出目を決める(1人用の DiceStep と同じ手触り)
  useEffect(() => {
    if (!pressed) return;
    const t = setTimeout(() => {
      setPressed(false);
      onRoll();
    }, 900);
    return () => clearTimeout(t);
  }, [pressed]);
  const foe = 1 - me;
  const mineRolling = pressed || dice[me] === null;
  const mineSettled = useSettled(dice[me], mineRolling);
  const foeSettled = useSettled(dice[foe], dice[foe] === null);
  const both = dice[0] !== null && dice[1] !== null;
  const side = (idx, rolling, settled) => {
    const meta = PLAYER_META[idx];
    const v = dice[idx];
    return (
      <div
        className={`dice-duo-side ${idx === me ? "dice-duo-me" : ""} ${both && !tie && firstPlayer === idx ? "dice-winner" : ""}`}
      >
        <b style={{ color: meta.color }}>{playerLabel(idx, me, names)}</b>
        <div className="die-stage die-stage-small">
          <DieCube value={v === null ? 1 : v} rolling={rolling && !settled ? true : v === null ? false : !settled} color={meta.color} />
        </div>
        <small className="dice-duo-status" style={{ color: meta.color }}>
          {v === null
            ? idx === me
              ? pressed
                ? "転がしています…"
                : "まだ振っていません"
              : "相手が振るのを待っています…"
            : settled
              ? `${v} が出ました`
              : "転がしています…"}
        </small>
      </div>
    );
  };
  return (
    <div className="center-stage dice-duo">
      <MatchupBar viewer={me} />
      <h2>サイコロで先手を決めます</h2>
      {remainingMs != null && (
        <div className={`setup-timer ${remainingMs <= 5000 ? "setup-timer-urgent" : ""}`}>
          <div className="setup-timer-head">
            <span>振る残り時間</span>
            <strong>{Math.max(0, Math.ceil(remainingMs / 1000))}秒</strong>
          </div>
          <div className="setup-timer-track">
            <div
              className="setup-timer-fill"
              style={{ width: `${Math.max(0, Math.min(1, remainingMs / (limitMs || 20000))) * 100}%` }}
            />
          </div>
        </div>
      )}
      <div className="dice-duo-sides">
        {side(me, mineRolling, mineSettled)}
        <span className="matchup-vs" aria-hidden="true">
          vs
        </span>
        {side(foe, dice[foe] === null, foeSettled)}
      </div>
      {dice[me] === null ? (
        <button
          className="btn btn-primary"
          disabled={pressed}
          onClick={() => setPressed(true)}
        >
          {pressed ? "転がしています…" : "サイコロを振る"}
        </button>
      ) : both && mineSettled && foeSettled ? (
        tie ? (
          <p className="hint">同じ目でした。もう一度振ります…</p>
        ) : (
          <p style={{ color: PLAYER_META[firstPlayer].color, fontWeight: 700 }}>
            {playerLabel(firstPlayer, me, names)}が先手です
          </p>
        )
      ) : (
        <p className="hint">相手のサイコロを待っています…</p>
      )}
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
