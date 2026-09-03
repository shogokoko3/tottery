import { useEffect, useRef, useState } from "react";
import { useGameBgm } from "../audio/index.js";
import { winKingCardImg } from "../assets.js";
import { enrichAction } from "../game/actions.js";
import { getLegalMoves, squareName } from "../game/board.js";
import {
  PLAYER_META,
  nameOf,
  playerLabel,
  shortPlayerLabel,
} from "../game/constants.js";
import { cpuAction } from "../game/cpu.js";
import {
  autoArrange,
  autoPickKing,
  initialState,
  reducer,
  CLOCK_INITIAL_MS,
  KING_LIMIT_MS,
  setupLimitMs,
} from "../game/reducer.js";
import {
  ArrowRight,
  Check,
  Close,
  Crown,
  Dice,
  Flag,
  Info,
  RotateCcw,
  Shuffle,
  Sparkle,
} from "../icons.jsx";
import {
  deleteRoom,
  makeClientId,
  pushAct,
  readActs,
} from "../net/firebase.js";
import { LOCAL_ONLY_ACTIONS, withLocalContext } from "../net/sync.js";
import { CardFace, Piece } from "./cards.jsx";
import { useNames, useSeats } from "./names.jsx";
import { PlayerIcon } from "./playericon.jsx";
import { DIE_SETTLE_MS, DiceStage, DiceStep, Die } from "./dice.jsx";
import {
  CaptureRevealModal,
  Interstitial,
  KingChoiceInterstitial,
  LogViewer,
  QuitConfirm,
  ResignConfirm,
  SetupEffectsModal,
} from "./overlays.jsx";
import { GameShell } from "./screens.jsx";
import {
  DiscardPanel,
  KingStep,
  MulliganHand,
  PlaceStep,
  ReservePlacer,
  SetupWaiting,
  WaitingScreen,
  WaitingWithBoard,
  territoryOwnerOf,
} from "./setup.jsx";
import { CaptureConfirm } from "./overlays.jsx";
import { TutorialSheet } from "./tutorial.jsx";
import {
  FREE_ACTIONS,
  currentStepIndex,
  foeAction,
  matchesNeed,
  upcomingNeedStep,
} from "../game/tutorial.js";
import { isTestPlay, recordGame } from "../game/profile.js";
import { titleNameOf } from "../game/titles.js";
import { publishRank } from "../net/ranking.js";

/** 持ち時間の表示。自分の時計は下、相手の時計は上に置く */
export function ClockBar({ clocks, currentTurn, viewer }) {
  const { names, icons, titles } = useSeats();
  const fmt = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };
  const order = viewer === 1 ? [0, 1] : [1, 0];
  return (
    <div className="clock-bar">
      {order.map((idx) => {
        const active = currentTurn === idx;
        const ms = clocks[idx];
        return (
          <div
            className={`clock-cell ${active ? "clock-active" : ""} ${
              ms <= 30000 ? "clock-low" : ""
            }`}
            style={{ "--pc": PLAYER_META[idx].color }}
            key={idx}
          >
            <span className="clock-who">
              <PlayerIcon
                icon={icons && icons[idx]}
                name={names && names[idx]}
                side={idx}
                size="sm"
              />
              {shortPlayerLabel(idx, viewer, names)}({PLAYER_META[idx].name})
              {titles && titleNameOf(titles[idx]) && (
                <em className="seat-title">{titleNameOf(titles[idx])}</em>
              )}
            </span>
            <strong className="clock-time">{fmt(ms)}</strong>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 対局の記録の1行。
 * 「青が赤のA♦を撃破!」のように色名が2つ出るので、
 * それぞれその色で書いて、どちらが何をしたのか読み取れるようにする。
 */
/** 記録の中の色名(赤/青)を、分かっていればプレイヤー名に置き換える */
export function withNames(text, names) {
  if (!text || !names) return text;
  return PLAYER_META.reduce(
    (out, meta, idx) =>
      names[idx] ? out.split(meta.name).join(names[idx]) : out,
    text,
  );
}

export function LogLine({ text, index, active, onPick }) {
  // 記録は色(赤/青)で書かれている。名前が分かっている対局では、
  // 書き換えずに表示のときだけ名前へ置き換える。
  // 記録そのものを名前で作ると、オンラインで再生がずれてしまう
  const names = useNames();
  const colors = PLAYER_META.map((p) => p.name);
  const parts = text.split(new RegExp(`(${colors.join("|")})`));
  const first = parts.find((p) => colors.includes(p));
  const actor = first ? PLAYER_META[colors.indexOf(first)] : null;
  return (
    <li
      className={`log-row ${onPick ? "log-row-tap" : ""} ${active ? "log-row-active" : ""}`}
      style={actor ? { "--who": actor.color } : void 0}
      onClick={onPick ? () => onPick(index) : void 0}
    >
      {parts.map((part, i) => {
        const idx = colors.indexOf(part);
        return idx >= 0 ? (
          <b
            className="log-who"
            style={{ color: PLAYER_META[idx].soft }}
            key={i}
          >
            {nameOf(idx, names)}
          </b>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
      {onPick && <span className="log-peek">盤面</span>}
    </li>
  );
}

export function TurnBar({ state, viewer }) {
  const names = useNames();
  let l = PLAYER_META[state.currentTurn],
    n = state.currentTurn === viewer,
    // 撃破の札を開くまでは、勝敗を先に漏らさない
    hold = !!state.captureReveal,
    log = hold
      ? [...state.log]
          .reverse()
          .find(
            (line) =>
              !line.includes("勝利") &&
              !line.includes("王が倒された") &&
              !line.includes("新しい王"),
          )
      : state.log[state.log.length - 1];
  return (
    <div className="turn-bar">
      <span
        className="turn-dot"
        style={{
          background: l.color,
        }}
      />
      <span
        style={{
          color: l.color,
          fontWeight: 700,
        }}
      >
        {playerLabel(state.currentTurn, viewer, names)}の番です
      </span>
      <span className="turn-log">{withNames(log, names)}</span>
    </div>
  );
}
export function CapturedRow({ players, dispatch, viewer }) {
  const names = useNames();
  let [n, a] = (0, useState)(!1),
    u = players.some((i) => i.discard && i.discard.length > 0);
  return (
    <>
      <div className="captured-row">
        {players.map((i, f) => (
          <div className="captured-col" key={f}>
            <div
              className="captured-label"
              style={{
                color: PLAYER_META[f].color,
              }}
            >
              {shortPlayerLabel(f, viewer, names)}({PLAYER_META[f].name}
              )が失った駒
            </div>
            <div className="captured-cards">
              {i.capturedOwn
                .filter((o) => !o.alive)
                .map((o) => (
                  <div
                    className="captured-card"
                    onClick={() =>
                      dispatch({
                        type: "VIEW_LOG",
                        id: o.id,
                      })
                    }
                    key={o.id}
                  >
                    <CardFace rank={o.rank} suit={o.suit} size="sm" />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      {u && (
        <div className="discard-toggle-wrap">
          <button className="btn btn-ghost" onClick={() => a((i) => !i)}>
            {n ? "引き直しの捨て札を隠す" : "引き直しの捨て札を見る"}
          </button>
          {n && (
            <div className="discard-both">
              {players.map((i, f) => (
                <DiscardPanel
                  cards={i.discard}
                  label={`${shortPlayerLabel(f, viewer, names)}(${PLAYER_META[f].name})が捨てたカード`}
                  color={PLAYER_META[f].color}
                  key={f}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
export function GameView({
  state,
  network,
  myIdx,
  size,
  viewer,
  dispatch,
  onExit,
  tutorial,
  youAre,
  rating,
}) {
  const names = useNames();
  let [f, o] = (0, useState)(!1),
    // 記録のどの行を選んでいるか。null なら最終盤面
    [at, setAt] = (0, useState)(null),
    // 動きの再生。押すたびに数が増え、それを鍵に演出をやり直させる
    [playSeq, setPlaySeq] = (0, useState)(0),
    [playing, setPlaying] = (0, useState)(!1),
    r = PLAYER_META[state.winner],
    // 1台で交互に指しているときは「あなた」が決まらないので、色名で伝える
    lost = youAre !== null && youAre !== void 0 && state.winner !== youAre,
    won = youAre !== null && youAre !== void 0 && state.winner === youAre;
  // 記録の行を選んだら、その手の動きを再生する
  (0, useEffect)(() => {
    if (!f || at === null) return;
    setPlaying(!0);
    const entry = (state.replay || [])[at];
    const mark = entry && entry.mark;
    const dist =
      mark && mark.from && mark.to
        ? Math.max(
            Math.abs(mark.from.row - mark.to.row),
            Math.abs(mark.from.col - mark.to.col),
          )
        : 0;
    const taken = mark && mark.taken ? mark.taken.length : 0;
    const ms = (dist + 1) * 190 + 1400 + Math.max(0, taken - 1) * 440;
    const id = setTimeout(() => setPlaying(!1), ms);
    return () => clearTimeout(id);
  }, [f, at, playSeq]);

  if (f) {
    let d = viewer === 1,
      // 倒れた駒の演出を、味方と相手で色分けするための基準
      mySide = youAre !== null && youAre !== void 0 ? youAre : viewer,
      replay = state.replay || [],
      shownBoard = at !== null && replay[at] ? replay[at].board : state.board,
      // 選んだ記録の「どこから・どこへ・どこが倒れたか」
      mark = at !== null && replay[at] ? replay[at].mark : null,
      hit = (list, row, col) =>
        !!(
          list &&
          list.some &&
          list.some((c) => c.row === row && c.col === col)
        ),
      // その手の動きを1マスずつ再生する。live の盤と同じ見せ方
      stepOf = (row, col) => {
        if (!playing || !mark || !mark.from || !mark.to) return null;
        if (mark.to.row !== row || mark.to.col !== col) return null;
        const dc = mark.from.col - mark.to.col;
        const dr = mark.from.row - mark.to.row;
        const knight =
          (Math.abs(dr) === 1 && Math.abs(dc) === 2) ||
          (Math.abs(dr) === 2 && Math.abs(dc) === 1);
        const n = knight ? 1 : Math.max(Math.abs(dr), Math.abs(dc));
        if (!n) return null;
        return {
          sx: d ? -dc : dc,
          sy: d ? -dr : dr,
          stops: n + 1,
          // 立ち寄る場所ごとに 190ms 留まる
          ms: (n + 1) * 190,
        };
      },
      // 倒れたマスを光らせる。まとめ取りは手前から順に
      fxAt = (row, col) => {
        if (!playing || !mark || !mark.taken) return -1;
        return mark.taken.findIndex((c) => c.row === row && c.col === col);
      },
      traceOf = (row, col) => {
        if (!mark) return "";
        let out = "";
        if (mark.from && mark.from.row === row && mark.from.col === col)
          out += " trace-from";
        // 動いている間は着地のしるしを伏せる。先に動きを見せ、
        // 止まってから「ここへ動いて、ここを取った」と示す
        if (playing) return out;
        if (mark.to && mark.to.row === row && mark.to.col === col)
          out += " trace-to";
        if (hit(mark.taken, row, col)) out += " trace-taken";
        return out;
      },
      m = state.log.filter(
        (s) =>
          s.includes("撃破") ||
          s.includes("王が倒された") ||
          s.includes("道連れ") ||
          s.includes("新しい王") ||
          s.includes("入れ替えた") ||
          s.includes("投入") ||
          s.includes("降参"),
      );
    return (
      <div className="modal-overlay">
        <div className="modal-panel review-panel">
          <div className="modal-head">
            <h3
              style={{
                color: r.color,
              }}
            >
              {network
                ? state.winner === myIdx
                  ? "あなたの勝ち!"
                  : "あなたの負け…"
                : `${r.name}の勝利!`}
            </h3>
            <button className="icon-btn" onClick={() => o(!1)}>
              <Close size={18} />
            </button>
          </div>
          {state.resignedBy !== null && state.resignedBy !== void 0 && (
            <p
              className="hint"
              style={{
                color: "var(--gold-soft)",
              }}
            >
              {nameOf(state.resignedBy, names)}の降参により決着しました。
            </p>
          )}
          <p className="hint">
            {at === null
              ? "最終盤面(すべての駒を公開)。駒をタップすると、その駒の動きを追えます。"
              : `${at + 1}番目の出来事の直後の盤面です。`}
          </p>
          <div className="side-legend">
            {state.players.map((s, v) => (
              <span
                className="side-key"
                style={{ "--who": PLAYER_META[v].color }}
                key={v}
              >
                {playerLabel(v, youAre, names)}
              </span>
            ))}
          </div>
          {at !== null && mark && (
            <div className="trace-legend">
              <span className="trace-key trace-key-from">動く前</span>
              <span className="trace-key trace-key-to">動いた先</span>
              {mark.taken && mark.taken.length > 0 && (
                <span className="trace-key trace-key-taken">取られた駒</span>
              )}
            </div>
          )}
          {at !== null && (
            <div className="review-controls">
              {mark && mark.from && mark.to && (
                <button
                  className="btn btn-ghost"
                  onClick={() => setPlaySeq((n) => n + 1)}
                >
                  <Sparkle size={14} /> もう一度見る
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setAt(null)}>
                最終盤面に戻る
              </button>
            </div>
          )}
          <div className="board-outer">
            <div
              className="board-grid"
              style={{
                gridTemplateColumns: `repeat(${size},1fr)`,
              }}
            >
              {Array.from({
                length: size,
              }).map((s, v) =>
                Array.from({
                  length: size,
                }).map((p, w) => {
                  let z = d ? size - 1 - v : v,
                    g = d ? size - 1 - w : w,
                    A = shownBoard[z][g],
                    b = territoryOwnerOf(z, g, size);
                  return (
                    <div
                      className={`cell ${b !== null ? `zone-${b}` : ""}${traceOf(z, g)}`}
                      onClick={() => {
                        // 過去の盤面には駒の来歴が無いので、最終盤面のときだけ追える
                        A &&
                          A.id &&
                          dispatch({
                            type: "VIEW_LOG",
                            id: A.id,
                          });
                      }}
                      key={`${z}-${g}`}
                    >
                      {!playing &&
                        mark &&
                        mark.to &&
                        mark.to.row === z &&
                        mark.to.col === g && (
                          <span className="trace-pin trace-pin-to">着</span>
                        )}
                      {!playing && hit(mark && mark.taken, z, g) && (
                        <span className="trace-pin trace-pin-taken">×</span>
                      )}
                      {(() => {
                        const gone = fxAt(z, g);
                        if (gone < 0) return null;
                        const c = mark.taken[gone];
                        return (
                          <span
                            key={`fx${playSeq}-${gone}`}
                            style={{ "--i": gone }}
                            className={`fx-defeat ${
                              c.owner === mySide
                                ? "fx-defeat-mine"
                                : "fx-defeat-foe"
                            }`}
                          />
                        );
                      })()}
                      {A &&
                        (() => {
                          const step = stepOf(z, g);
                          return (
                            <div
                              className={`piece-slot ${step ? "piece-stepping" : ""}`}
                              key={step ? `mv${playSeq}` : "piece"}
                              style={
                                step
                                  ? {
                                      "--sx": step.sx,
                                      "--sy": step.sy,
                                      "--stops": step.stops,
                                      "--ms": `${step.ms}ms`,
                                    }
                                  : void 0
                              }
                            >
                              <div
                                className="piece-wrap side-ring"
                                style={{ "--who": PLAYER_META[A.owner].color }}
                              >
                                <CardFace
                                  rank={A.rank}
                                  suit={A.suit}
                                  size={size >= 9 ? "xs" : "md"}
                                  isKing={A.isKing}
                                />
                                {A.isKing && (
                                  <Crown
                                    size={size >= 9 ? 10 : 16}
                                    className="king-badge"
                                    style={{
                                      color: PLAYER_META[A.owner].color,
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })()}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
          <div className="review-lost">
            {state.players.map((s, v) => (
              <div className="captured-col" key={v}>
                <div
                  className="captured-label"
                  style={{
                    color: PLAYER_META[v].color,
                  }}
                >
                  {shortPlayerLabel(v, viewer, names)}({PLAYER_META[v].name}
                  )が失った駒
                </div>
                <div className="captured-cards">
                  {s.capturedOwn
                    .filter((p) => !p.alive)
                    .map((p) => (
                      <div
                        className="captured-card"
                        onClick={() =>
                          dispatch({
                            type: "VIEW_LOG",
                            id: p.id,
                          })
                        }
                        key={p.id}
                      >
                        <CardFace rank={p.rank} suit={p.suit} size="sm" />
                      </div>
                    ))}
                  {s.capturedOwn.filter((p) => !p.alive).length === 0 && (
                    <span className="hint">なし</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="review-log">
            <div className="tray-label">対局の記録</div>
            <ol className="log-list">
              {m.length ? (
                m.map((s, v) => (
                  <LogLine
                    text={s}
                    index={v}
                    active={at === v}
                    onPick={replay[v] ? setAt : void 0}
                    key={v}
                  />
                ))
              ) : (
                <li>特筆すべき出来事はありませんでした</li>
              )}
            </ol>
          </div>
          <div className="setup-actions">
            <button className="btn btn-ghost" onClick={() => o(!1)}>
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="modal-overlay">
      <div
        className={`modal-panel gameover-panel ${lost ? "defeat-panel" : ""}`}
      >
        {lost ? (
          <Flag size={34} className="defeat-mark" />
        ) : (
          <Crown
            size={34}
            style={{
              color: "var(--gold)",
            }}
          />
        )}
        <h2
          className={lost ? "defeat-title" : ""}
          style={lost ? void 0 : { color: r.color }}
        >
          {won ? "あなたの勝ち!" : lost ? "敗北" : `${r.name}の勝利!`}
        </h2>
        {lost && (
          <p className="defeat-lead">
            {state.timeoutBy === youAre
              ? "持ち時間を使い切りました"
              : state.resignedBy === youAre
                ? "降参しました"
                : "王を討たれました"}
          </p>
        )}
        {state.resignedBy !== null && state.resignedBy !== void 0 && (
          <p
            className="hint"
            style={{
              marginTop: -6,
            }}
          >
            {nameOf(state.resignedBy, names)}が降参しました
          </p>
        )}
        <div className={`king-card ${lost ? "lose-card" : "win-card"}`}>
          <img src={winKingCardImg} alt="" />
        </div>
        {rating && (
          <div className="rating-change">
            <span className="rating-label">レーティング</span>
            <span className="rating-nums">
              {rating.before}
              <span className="rating-arrow">→</span>
              <b>{rating.rating}</b>
              <span
                className={`rating-delta ${rating.delta >= 0 ? "up" : "down"}`}
              >
                {rating.delta >= 0 ? `+${rating.delta}` : rating.delta}
              </span>
            </span>
          </div>
        )}
        <div
          className="setup-actions"
          style={{
            marginTop: 16,
          }}
        >
          <button className="btn btn-primary" onClick={() => o(!0)}>
            <Info size={16} /> 対局を振り返る
          </button>
        </div>
        <div
          className="setup-actions"
          style={{
            marginTop: 10,
          }}
        >
          {/* チュートリアルは同じ台本をなぞるだけなので、もう一度は出さない */}
          {tutorial ? null : !network || myIdx === 0 ? (
            <button
              className="btn btn-ghost"
              onClick={() =>
                dispatch({
                  type: "NEW_GAME",
                })
              }
            >
              <RotateCcw size={16} /> もう一度遊ぶ
            </button>
          ) : (
            <p className="hint">ホストがもう一度遊ぶか選んでいます…</p>
          )}
          {onExit && (
            <button className="btn btn-ghost" onClick={onExit}>
              タイトルに戻る
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
/**
 * 相手(CPUや台本)が次の手を指すまでの間。
 *
 * サイコロの場面だけは動きに合わせる。振るまでに少し転がして見せ、
 * 出目が決まったら、減速して止まり「N が出ました」が読めるまで待つ。
 * それ以外は、対局中は考えているふうに長め、布陣などは短め。
 */
function foeWait(state, act, playMs) {
  if (act.type === "ROLL_DICE_SINGLE") return 900;
  if (act.type === "NEXT_DICE_STEP") return DIE_SETTLE_MS + 900;
  return state.phase === "play" ? playMs : 400;
}

export function GameCore({ onExit, network, boardSize, cpu, tutorial }) {
  const names = useNames();
  let [a, u] = (0, useState)(initialState),
    [i, f] = (0, useState)(!1),
    [o, r] = (0, useState)(!1),
    [d, m] = (0, useState)(!1),
    [s, v] = (0, useState)(null),
    p = network ? network.myPlayerIndex : null,
    w = (0, useRef)(makeClientId()),
    z = (0, useRef)(0),
    g = (0, useRef)(new Set()),
    [A, b] = (0, useState)(0);
  // --- 修正3: 布陣の制限時間と、対局の持ち時間 ---
  let [nowMs, setNowMs] = (0, useState)(() => Date.now()),
    turnStartRef = (0, useRef)(Date.now()),
    turnKeyRef = (0, useRef)(null),
    setupStartRef = (0, useRef)(null),
    setupPhaseStartRef = (0, useRef)(null),
    [pendingCapture, setPendingCapture] = (0, useState)(null),
    [holdFx, setHoldFx] = (0, useState)(!1),
    [tutStep, setTutStep] = (0, useState)(0),
    // 台本にない手を指したときに、帯へ返す一言。
    // 黙って握りつぶすと「押しても何も起きない=壊れている」と読まれる
    [tutNudge, setTutNudge] = (0, useState)(null),
    foeIdxRef = (0, useRef)(0),
    recordedRef = (0, useRef)(!1),
    [ratingResult, setRatingResult] = (0, useState)(null),
    // テストプレイ中は、布陣の1分も対局の持ち時間も止める
    testPlay = (0, useRef)(isTestPlay()).current;
  // チュートリアルは時間に追われずに読ませたいので、どちらの時計も動かさない
  let noLimit = !!tutorial || testPlay;
  // 案内の位置は、押した回数ではなく盤面から引き直す。
  // どんな触り方をされても画面とずれない
  let tutIdx = tutorial ? currentStepIndex(tutorial, a, tutStep) : -1;
  function y(E) {
    // どの駒を動かすかをアクション自身に持たせる。
    // 台本の照合にも、通信で相手へ送るときにも要る
    if (E.type === "MOVE_PIECE" && !E.pieceId && a.selectedId)
      E = { ...E, pieceId: a.selectedId };
    // 台本にない操作は受け付けない。指示された1手だけが通る。
    // ただし、その台本の場面がまだ来ていないあいだは何も止めない。
    // 進めるのは盤面のほうで、ここでは数えない
    if (tutorial && !E.__foe) {
      let step = tutorial.steps[tutIdx];
      if (step && step.at && !step.at(a)) step = null;
      // 説明だけの札を見ているあいだも、この先の操作は受け付ける。
      // 「次へ」を押さずに指しても案内が追いつくが、台本にない手は通さない
      if (step && !step.need) step = upcomingNeedStep(tutorial, tutIdx, a);
      if (
        step &&
        step.need &&
        !FREE_ACTIONS.has(E.type) &&
        !matchesNeed(step.need, E)
      ) {
        // 取る手は確認が先に出てしまうので、ここで閉じる。
        // 出しっぱなしにすると「取るを押したのに何も起きない」になる
        setPendingCapture(null);
        setTutNudge(
          "その手はいまは指せません。光っているところを操作してください。",
        );
        return;
      }
      setTutNudge(null);
    }
    let E0 =
      E.elapsedMs == null
        ? {
            ...E,
            elapsedMs: noLimit
              ? 0
              : Math.max(0, Date.now() - turnStartRef.current),
          }
        : E;
    E = E0;
    u((U) => {
      // チュートリアルでは、サイコロの目も引く札も台本どおりにする
      if (tutorial) {
        if (
          E.type === "ROLL_DICE_SINGLE" &&
          (E.value === undefined || E.value === null)
        )
          E = { ...E, value: tutorial.dice[U.diceIdx] || 1 };
        if (E.type === "CONFIRM_MULLIGAN" && !E.reserveOrder)
          E = { ...E, reserveOrder: [...tutorial.reserveOrder] };
        // 入れ替えの並び順も固定する。乱数のままだと毎回ちがう配置になる
        if (E.type === "CONFIRM_SHUFFLE" && !E.order && tutorial.shuffleOrder)
          E = { ...E, order: [...tutorial.shuffleOrder] };
      }
      if (network && LOCAL_ONLY_ACTIONS.has(E.type)) return reducer(U, E);
      let be = network ? enrichAction(withLocalContext(E, U), U) : E;
      if (network) {
        let at = `${w.current}-${++z.current}`,
          ne = {
            ...be,
            __id: at,
          };
        return (
          g.current.add(at),
          queueMicrotask(() => {
            pushAct(network.code, ne).then(async (Me) => {
              if (Me.ok) v(null);
              else {
                await new Promise((Zt) => setTimeout(Zt, 700));
                let ze = await pushAct(network.code, ne);
                v(ze.ok ? null : ze.error);
              }
            });
          }),
          reducer(U, ne)
        );
      }
      return reducer(U, be);
    });
  }
  (0, useEffect)(() => {
    a.phase === "intro" &&
      ((network && p !== 0) ||
        y({
          type: "START_SETUP",
          size: boardSize || 5,
          setupMode: network || cpu ? "simultaneous" : "sequential",
          ...(tutorial
            ? {
                deck: tutorial.deck.map((c) => ({ ...c })),
                pool: tutorial.pool,
                handSize: tutorial.handSize,
                // 布陣ボーナスを教える回だけは、効果を働かせる
                scripted: !tutorial.bonus,
              }
            : null),
        }));
  }, [a.phase, boardSize]);
  // チュートリアルの相手は考えない。台本の手だけをそのまま指す。
  //
  // CPU に肩代わりさせない。1手でも CPU が指すと、そこから先は
  // 毎回ちがう盤面になってしまう。案内は決まった盤面を前提に書いてあるので、
  // 噛み合わなくなる。台本が足りているかは check-tutorial が見張っている
  (0, useEffect)(() => {
    if (!tutorial || network) return;
    let act = foeAction(a, tutorial, foeIdxRef.current, (piece) =>
      getLegalMoves(piece, a.board, a.boardSize, a.players[1].armyRankCounts),
    );
    if (!act) return;
    let id = setTimeout(
      () => {
        if (act.type === "MOVE_PIECE") foeIdxRef.current += 1;
        if (act.type === "__CPU_SHUFFLE") {
          y({ type: "SELECT_PIECE", id: act.aceId, __foe: !0 });
          y({ type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[0], __foe: !0 });
          y({ type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[1], __foe: !0 });
          y({ type: "CONFIRM_SHUFFLE", __foe: !0 });
          return;
        }
        y({ ...act, __foe: !0 });
      },
      foeWait(a, act, 1200),
    );
    return () => clearTimeout(id);
  }, [a, tutorial, network]);

  let T = 1;
  ((0, useEffect)(() => {
    if (!cpu || network || tutorial) return;
    let E = cpuAction(a, T);
    if (!E) return;
    let U = foeWait(a, E, 1000),
      be = setTimeout(() => {
        E.type === "__CPU_SHUFFLE"
          ? (y({
              type: "SELECT_PIECE",
              id: E.aceId,
            }),
            y({
              type: "TOGGLE_SHUFFLE_PICK",
              id: E.pickIds[0],
            }),
            y({
              type: "TOGGLE_SHUFFLE_PICK",
              id: E.pickIds[1],
            }),
            y({
              type: "CONFIRM_SHUFFLE",
            }))
          : y(E);
      }, U);
    return () => clearTimeout(be);
  }, [a, cpu, network]),
    (0, useEffect)(() => {
      if (!network) return;
      let E = !1,
        U = setInterval(async () => {
          let be = await readActs(network.code);
          if (E) return;
          if (!be.ok) {
            v(be.error);
            return;
          }
          let at = be.list.filter(
            (ne) => ne && ne.__id && !g.current.has(ne.__id),
          );
          at.length !== 0 &&
            (at.forEach((ne) => g.current.add(ne.__id)),
            u((ne) => at.reduce((Me, ze) => reducer(Me, ze), ne)),
            b(be.list.length));
        }, 700);
      return () => {
        ((E = !0), clearInterval(U));
      };
    }, [network]));
  // 駒が倒れたら、盤の上で演出を見せてから結果の札を開く
  (0, useEffect)(() => {
    if (!a.lastDefeat) return;
    setHoldFx(!0);
    let n = a.lastDefeat.cells.length;
    let id = setTimeout(() => setHoldFx(!1), 1500 + (n - 1) * 440);
    return () => clearTimeout(id);
  }, [a.lastDefeat ? a.lastDefeat.seq : 0]);

  // 1秒未満の刻みで残り時間を描き替える
  ((0, useEffect)(() => {
    if (a.phase !== "play" && a.phase !== "setup") return;
    let id = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(id);
  }, [a.phase]),
    void 0);

  let handoff = !!a.interstitial && !network && !cpu,
    // 布陣中に操作している側
    setupSide = network ? p : cpu ? 0 : a.setupIdx,
    // 駒を並べる時間と、王を選ぶ時間は別に数える
    setupStep = a.setupSteps ? a.setupSteps[setupSide] : "place",
    setupLimit =
      setupStep === "king" ? KING_LIMIT_MS : setupLimitMs(a.boardSize),
    setupRunning = a.phase === "setup" && !handoff && !a.setupDone[setupSide],
    // その時計が「いまの段階のために始めた」ものかを見る。
    // 段階が変わった直後に、前の時計で判定してしまうのを防ぐ
    setupClock = setupStartRef.current,
    setupRemaining =
      setupRunning &&
      !noLimit &&
      setupClock &&
      setupClock.step === setupStep &&
      setupClock.side === setupSide
        ? setupLimit - (nowMs - setupClock.at)
        : null;

  ((0, useEffect)(() => {
    if (!setupRunning) {
      setupStartRef.current = null;
      return;
    }
    setupStartRef.current = {
      at: Date.now(),
      step: setupStep,
      side: setupSide,
    };
    setNowMs(Date.now());
  }, [setupRunning, setupSide, setupStep]),
    // 時間切れ。置く段階なら残りを自動で埋めて王選びへ、
    // 王を選ぶ段階なら自動で選んで確定する
    (0, useEffect)(() => {
      if (!setupRunning || setupRemaining === null || setupRemaining > 0)
        return;
      if (setupStep === "place") {
        y({ type: "SETUP_AUTO_ARRANGE", player: setupSide, keep: !0 });
        y({ type: "SETUP_GOTO_KING_STEP", player: setupSide });
        return;
      }
      let placement = a.setupPlacements[setupSide],
        kingId =
          a.setupPickKings[setupSide] || autoPickKing(a, setupSide, placement);
      if (kingId)
        y({
          type: "SETUP_CONFIRM",
          player: setupSide,
          placement,
          kingId,
        });
    }, [setupRunning, setupRemaining, setupStep]));

  // 同時配置では両者いっせいに始まるので、相手の残りも同じ時計で測れる
  (0, useEffect)(() => {
    if (a.phase !== "setup") {
      setupPhaseStartRef.current = null;
      return;
    }
    if (setupPhaseStartRef.current === null)
      setupPhaseStartRef.current = Date.now();
  }, [a.phase]);
  let opponentSetupRemaining =
    a.phase === "setup" &&
    !noLimit &&
    a.setupMode === "simultaneous" &&
    setupPhaseStartRef.current !== null
      ? setupLimitMs(a.boardSize) +
        KING_LIMIT_MS -
        (nowMs - setupPhaseStartRef.current)
      : null;

  // 手番が始まった時刻。端末の受け渡し画面を閉じた時点から計る。
  // 効果ではなく描画時に更新する(効果だと最初の1フレームだけ古い値で判定してしまう)
  let turnKey = `${a.phase}|${a.currentTurn}|${a.interstitial ? 1 : 0}`;
  if (turnKeyRef.current !== turnKey) {
    turnKeyRef.current = turnKey;
    turnStartRef.current = Date.now();
  }

  let clockRunning =
      a.phase === "play" &&
      !noLimit &&
      (a.winner === null || a.winner === undefined) &&
      !handoff,
    clockSpent = clockRunning ? Math.max(0, nowMs - turnStartRef.current) : 0,
    liveClocks = a.clocks.map((ms, idx) =>
      clockRunning && idx === a.currentTurn ? Math.max(0, ms - clockSpent) : ms,
    );

  (0, useEffect)(() => {
    if (!clockRunning) return;
    let left =
      a.clocks[a.currentTurn] - Math.max(0, Date.now() - turnStartRef.current);
    if (left > 0) return;
    // 秒読みは無し。時計を持っている側の端末が自分で負けを申告する
    if (network && a.currentTurn !== p) return;
    y({
      type: "CLOCK_TIMEOUT",
      player: a.currentTurn,
    });
  }, [clockRunning, nowMs, a.currentTurn]);

  /**
   * 対局を抜ける。使い終わった部屋はここで消しておく。
   *
   * 部屋には手番の列がまるごと入っている。対局が終わったら要らないので、
   * 残さない。途中で抜けたときも同じで、ホストが居なくなった部屋は
   * 誰も使えない。
   *
   * 消すのはホストだけ。「もう一度遊ぶ」を選べるのはホストなので、
   * ゲストが先に抜けて部屋を消すと、ホストの再戦が壊れる。
   */
  function leaveGame() {
    if (network && p === 0) deleteRoom(network.code);
    onExit();
  }

  // 取る手は必ず一度確認する
  function tryMove(row, col, mv) {
    if (mv.capture) {
      setPendingCapture({
        row,
        col,
        captures: mv.captures,
        count: mv.captures ? mv.captures.length : 1,
      });
      return;
    }
    y({
      type: "MOVE_PIECE",
      row,
      col,
      captures: mv.captures,
    });
  }

  // 対局が終わったら1局ぶん記録する。レベルの元になる。
  // オンラインで相手の持ち点が分かっていれば、レーティングもここで動かす
  (0, useEffect)(() => {
    if (a.phase !== "gameover" || recordedRef.current) return;
    recordedRef.current = !0;
    const won = a.winner === (network ? p : 0);
    const foeRating =
      network && network.ratings ? network.ratings[1 - p] : null;
    const after = recordGame(
      won,
      typeof foeRating === "number" ? { foeRating } : void 0,
    );
    setRatingResult(after.delta === null ? null : after);
    if (after.delta !== null) publishRank(after);
  }, [a.phase, a.winner]);

  // 進んだところまでを覚えておく。
  // これが無いと、同じ駒を2度動かす台本で前の指示へ戻ってしまう
  (0, useEffect)(() => {
    if (tutorial && tutIdx > tutStep) setTutStep(tutIdx);
  }, [tutIdx, tutStep, tutorial]);

  // 案内が次へ進んだら、指せない手への一言は用済み
  (0, useEffect)(() => {
    setTutNudge(null);
  }, [tutIdx]);

  // 次に触る場所が説明の帯に隠れないよう、画面をそこまで送る
  (0, useEffect)(() => {
    if (!tutorial) return;
    let id = setTimeout(() => {
      let el =
        document.querySelector(".guide-target") ||
        document.querySelector(
          ".focus-button .btn-primary:not(.tutorial-next)",
        );
      if (!el || !el.scrollIntoView) return;
      let still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({
        block: "center",
        behavior: still ? "auto" : "smooth",
      });
    }, 140);
    return () => clearTimeout(id);
  }, [tutIdx, tutorial, a.phase]);

  // 台本は一本道。いまの1枚だけを出し、場面が来ていなければ何も出さない
  let tutStepObj =
      tutorial && tutIdx < tutorial.steps.length
        ? tutorial.steps[tutIdx]
        : null,
    tutActive =
      tutStepObj && (!tutStepObj.at || tutStepObj.at(a)) ? tutStepObj : null,
    tutFocus = tutActive ? tutActive.focus : null,
    // 盤や手札の上に「ここを触る」印が出ていないときは、
    // 画面を進めるボタンが押してほしいもの。読まなくても分かるように光らせる
    tutHasTarget = !!(
      tutFocus &&
      (tutFocus.cards || tutFocus.cells || tutFocus.pieces)
    ),
    tutButton =
      !!tutorial &&
      !(tutActive && tutActive.end) &&
      (!!pendingCapture || !tutHasTarget),
    focusCell = (row, col) =>
      !!(
        tutFocus &&
        tutFocus.cells &&
        tutFocus.cells.some((c) => c.row === row && c.col === col)
      ),
    focusPiece = (id) =>
      !!(tutFocus && tutFocus.pieces && tutFocus.pieces.includes(id)),
    // 案内の出番でない場面(サイコロの結果・撃破の確認など)でも、
    // 何をすればよいかは必ず出す。読む人が迷わないように
    tutHold =
      tutorial && !tutActive && tutIdx < tutorial.steps.length
        ? {
            hold: !0,
            text:
              a.phase === "play" &&
              a.currentTurn === 1 &&
              !pendingCapture &&
              !a.captureReveal
                ? "相手の番です。少し待ってください。"
                : "光っているボタンを押して進めてください。",
          }
        : null,
    tutSheet = tutActive ? (
      <TutorialSheet
        step={tutActive}
        index={tutIdx}
        total={tutorial.steps.length}
        nudge={tutNudge}
        // 読んでから決める回では、説明だけの札を前面に出して先に読ませる
        front={!tutActive.need}
        onNext={tutActive.end ? onExit : () => setTutStep(tutIdx + 1)}
      />
    ) : tutHold ? (
      <TutorialSheet
        step={tutHold}
        index={tutIdx - 1}
        total={tutorial.steps.length}
      />
    ) : null;

  let R = a.boardSize,
    P = network ? p : cpu ? 0 : a.currentTurn,
    x = network ? a.currentTurn === p : cpu ? a.currentTurn === 0 : !0,
    N = network
      ? `${p === 0 ? "host" : "guest"} acts:${g.current.size} d${a.diceIdx}[${(a.dice || []).map((E) => E ?? "-").join(",")}]`
      : null;

  // 場面に合った曲へ。勝敗のジングルは「自分」がいる対局だけ勝ち負けを分ける。
  // 1台で交互に指す対戦はどちらも自分なので、いつも勝ちの側で鳴らす
  useGameBgm({
    state: a,
    clocks: liveClocks,
    self: network ? p : cpu ? 0 : null,
    tutorial,
  });

  if (d)
    return (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
      >
        <ResignConfirm
          viewer={P}
          onCancel={() => m(!1)}
          onResign={() => {
            (m(!1),
              y({
                type: "RESIGN",
                player: P,
              }));
          }}
        />
      </GameShell>
    );
  if (o)
    return (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
      >
        <QuitConfirm
          network={network}
          onCancel={() => r(!1)}
          onQuit={() => {
            (r(!1), leaveGame());
          }}
        />
      </GameShell>
    );
  if (a.phase === "intro")
    return (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        <WaitingScreen
          text={
            network && p !== 0
              ? "相手の準備を待っています…"
              : "対局の準備をしています…"
          }
        />
      </GameShell>
    );
  if (a.captureReveal && !holdFx)
    return (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        <CaptureRevealModal
          reveal={a.captureReveal}
          viewer={P}
          final={
            a.phase === "gameover" ||
            (a.winner !== null && a.winner !== undefined)
          }
          onClose={() =>
            y({
              type: "DISMISS_CAPTURE",
            })
          }
        />
      </GameShell>
    );
  if (a.pendingKingChoice)
    return network && a.pendingKingChoice.owner !== p ? (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        <WaitingScreen text="相手が新しい王を選んでいます…" />
      </GameShell>
    ) : (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        <KingChoiceInterstitial state={a} size={R} dispatch={y} />
      </GameShell>
    );
  // 布陣ボーナスは対局が始まる前に、どのモードでも必ず知らせる
  if (a.setupEffects)
    return (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        <SetupEffectsModal
          effects={a.setupEffects}
          viewer={network || cpu ? P : void 0}
          onClose={() =>
            y({
              type: "DISMISS_SETUP_EFFECTS",
            })
          }
        />
      </GameShell>
    );
  if (a.interstitial && !network && !cpu)
    return (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        <Interstitial
          forPlayer={a.interstitial.forPlayer}
          kind={a.interstitial.kind}
          onReady={() =>
            y({
              type: "DISMISS_INTERSTITIAL",
            })
          }
        />
      </GameShell>
    );
  if (a.phase === "dice") {
    if (a.diceIdx === 3)
      return (
        <GameShell
          sheet={tutSheet}
          focusButton={tutButton}
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <div className="center-stage">
            <h2>同じ目でした</h2>
            <div className="dice-result-row">
              {[0, 1].map((U) => (
                <div className="dice-result-item" key={U}>
                  <span
                    style={{
                      color: PLAYER_META[U].color,
                    }}
                  >
                    {shortPlayerLabel(U, P, names)}({PLAYER_META[U].name})
                  </span>
                  <Die value={a.dice[U]} color={PLAYER_META[U].color} />
                </div>
              ))}
            </div>
            <p className="hint">
              先手・後手が決まらないため、もう一度振り直します。
            </p>
            {!network || p === 0 ? (
              <button
                className="btn btn-primary"
                onClick={() =>
                  y({
                    type: "REROLL_DICE",
                  })
                }
              >
                <RotateCcw size={16} /> 振り直す
              </button>
            ) : (
              <p className="hint">ホストが振り直しを開始します…</p>
            )}
          </div>
        </GameShell>
      );
    let E = a.diceIdx >= 2 ? null : a.diceIdx;
    return E !== null ? (
      cpu && E !== 0 ? (
        <GameShell
          sheet={tutSheet}
          focusButton={tutButton}
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <DiceStage playerIdx={E} value={a.dice[E]} />
        </GameShell>
      ) : network && E !== p ? (
        <GameShell
          sheet={tutSheet}
          focusButton={tutButton}
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <DiceStage playerIdx={E} value={a.dice[E]} />
        </GameShell>
      ) : (
        <GameShell
          sheet={tutSheet}
          focusButton={tutButton}
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <DiceStep
            playerIdx={E}
            value={a.dice[E]}
            onRoll={() =>
              y({
                type: "ROLL_DICE_SINGLE",
                playerIdx: E,
              })
            }
            onNext={() =>
              y({
                type: "NEXT_DICE_STEP",
              })
            }
          />
        </GameShell>
      )
    ) : (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        <div className="center-stage">
          <h2>結果発表</h2>
          <div className="dice-result-row">
            {[0, 1].map((U) => (
              <div
                className={`dice-result-item ${a.firstPlayer === U ? "dice-winner" : ""}`}
                key={U}
              >
                <span
                  style={{
                    color: PLAYER_META[U].color,
                  }}
                >
                  {shortPlayerLabel(U, P, names)}({PLAYER_META[U].name})
                </span>
                <Die value={a.dice[U]} color={PLAYER_META[U].color} />
              </div>
            ))}
          </div>
          <p
            style={{
              color: PLAYER_META[a.firstPlayer].color,
              fontWeight: 700,
            }}
          >
            {playerLabel(a.firstPlayer, P, names)}が先手です
          </p>
          {!network || p === 0 ? (
            <button
              className="btn btn-primary"
              onClick={() =>
                y({
                  type: "GOTO_MULLIGAN",
                })
              }
            >
              手札を確認する <ArrowRight size={16} />
            </button>
          ) : (
            <p className="hint">ホストが次に進めます…</p>
          )}
        </div>
      </GameShell>
    );
  }
  if (a.phase === "mulligan") {
    if (cpu && a.mulliganIdx !== 0)
      return (
        <GameShell
          sheet={tutSheet}
          focusButton={tutButton}
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <WaitingWithBoard
            text={
              tutorial
                ? "相手がカードを選んでいます…"
                : "CPUがカードを選んでいます…"
            }
            hand={a.players[0].hand}
            viewer={0}
            size={R}
          />
        </GameShell>
      );
    if (network && a.mulliganIdx !== p)
      return (
        <GameShell
          sheet={tutSheet}
          focusButton={tutButton}
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <WaitingWithBoard
            text="相手が交換するカードを選んでいます…"
            hand={a.players[p].hand}
            viewer={p}
            size={R}
          />
        </GameShell>
      );
    let E = a.mulliganIdx,
      U = a.players[E],
      be = new Set(U._mulliganSelected || []);
    return (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        <div className="setup-wrap">
          <h2
            style={{
              color: PLAYER_META[E].color,
            }}
          >
            {playerLabel(E, P, names)}: 交換するカードを選んでね
          </h2>
          {!tutorial && (
            <p className="hint">
              捨てたい札をタップ(もう一度タップで取り消し)。同じ枚数を予備札から引き直します。捨て札は公開情報になります。
            </p>
          )}
          <MulliganHand
            focus={tutFocus}
            hand={U.hand}
            selected={be}
            onToggle={(at) =>
              y({
                type: "TOGGLE_MULLIGAN_CARD",
                cardId: at,
              })
            }
          />
          <DiscardPanel
            cards={a.players[1 - E].discard}
            label={`${shortPlayerLabel(1 - E, P, names)}(${PLAYER_META[1 - E].name})が捨てたカード`}
            color={PLAYER_META[1 - E].color}
          />
          <button
            className="btn btn-primary"
            onClick={() =>
              y({
                type: "CONFIRM_MULLIGAN",
              })
            }
          >
            {be.size}枚 引き直して確定 <Check size={16} />
          </button>
        </div>
      </GameShell>
    );
  }
  if (a.phase === "setup") {
    let me = setupSide,
      mine = a.players[me];
    // 自分は置き終わった。相手の残り時間をそのまま見せて待つ
    if (a.setupDone[me])
      return (
        <GameShell
          sheet={tutSheet}
          focusButton={tutButton}
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <SetupWaiting
            state={a}
            pIdx={me}
            size={R}
            remainingMs={opponentSetupRemaining}
            limitMs={setupLimitMs(a.boardSize) + KING_LIMIT_MS}
            text={
              cpu && !tutorial
                ? "CPUが布陣を決めています…"
                : "相手が布陣を決めています…"
            }
          />
        </GameShell>
      );
    return (
      <GameShell
        sheet={tutSheet}
        focusButton={tutButton}
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        {a.setupSteps[me] === "place" ? (
          <PlaceStep
            state={a}
            player={mine}
            pIdx={me}
            size={R}
            dispatch={y}
            remainingMs={setupRemaining}
            limitMs={setupLimit}
            paused={testPlay && !tutorial}
            focus={tutFocus}
            terse={!!tutorial}
          />
        ) : (
          <KingStep
            state={a}
            player={mine}
            pIdx={me}
            size={R}
            dispatch={y}
            remainingMs={setupRemaining}
            limitMs={setupLimit}
            forceRank={tutorial ? tutorial.forceKingRank : null}
            paused={testPlay && !tutorial}
            focus={tutFocus}
            terse={!!tutorial}
          />
        )}
      </GameShell>
    );
  }

  let M = x && a.selectedId ? a.pieces[a.selectedId] : null,
    ct = M ? getLegalMoves(M, a.board, R, a.players[P].armyRankCounts) : [],
    Jl = P === 1,
    Pl = x && a.shuffleMode;
  return (
    <GameShell
      sheet={tutSheet}
      focusButton={tutButton}
      showRules={i}
      setShowRules={f}
      netInfo={N}
      onBack={() => r(!0)}
    >
      <div className="play-wrap">
        {!tutorial && (
          <ClockBar
            clocks={liveClocks}
            currentTurn={a.currentTurn}
            viewer={P}
          />
        )}
        <TurnBar state={a} viewer={P} />
        {pendingCapture && (
          <CaptureConfirm
            count={pendingCapture.count}
            squares={(
              pendingCapture.captures || [
                { row: pendingCapture.row, col: pendingCapture.col },
              ]
            ).map((sq) => squareName(sq.row, sq.col, R))}
            onCancel={() => setPendingCapture(null)}
            onConfirm={() => {
              y({
                type: "MOVE_PIECE",
                row: pendingCapture.row,
                col: pendingCapture.col,
                captures: pendingCapture.captures,
              });
              setPendingCapture(null);
            }}
          />
        )}
        {s && (
          <p
            className="hint"
            style={{
              textAlign: "center",
              color: "#e2896f",
            }}
          >
            {s}
          </p>
        )}
        {network && !x && (
          <p
            className="hint"
            style={{
              textAlign: "center",
            }}
          >
            相手の手番です
          </p>
        )}
        {cpu && !x && (
          <p
            className="hint"
            style={{
              textAlign: "center",
            }}
          >
            <Dice size={14} className="spin-icon" />{" "}
            {tutorial ? "相手の番です" : "CPUが考えています…"}
          </p>
        )}
        <div className="board-outer">
          <div
            className="board-frame"
            style={{
              "--n": R,
            }}
          >
            <div className="rank-labels">
              {Array.from({
                length: R,
              }).map((E, U) => {
                let be = Jl ? R - 1 - U : U;
                return <span key={U}>{R - be}</span>;
              })}
            </div>
            <div
              className="board-grid"
              style={{
                gridTemplateColumns: `repeat(${R},1fr)`,
              }}
            >
              {Array.from({
                length: R,
              }).map((E, U) =>
                Array.from({
                  length: R,
                }).map((be, at) => {
                  let ne = Jl ? R - 1 - U : U,
                    Me = Jl ? R - 1 - at : at,
                    ze = a.board[ne][Me],
                    Zt = ct.find((wl) => wl.row === ne && wl.col === Me),
                    Zo = territoryOwnerOf(ne, Me, R),
                    Vt = a.lastMove,
                    Vo = Vt && Vt.from.row === ne && Vt.from.col === Me,
                    Go = Vt && Vt.to.row === ne && Vt.to.col === Me,
                    Oi = a.lastSwap,
                    Lo =
                      Oi &&
                      Oi.cells.some((wl) => wl.row === ne && wl.col === Me),
                    fxIdx = a.lastDefeat
                      ? a.lastDefeat.cells.findIndex(
                          (wl) => wl.row === ne && wl.col === Me,
                        )
                      : -1,
                    fx = fxIdx >= 0 ? a.lastDefeat.cells[fxIdx] : null,
                    // 直前に動いた駒。1マスずつ進んで見えるようにする
                    stepIn =
                      Go && Vt && ze && Vt.from
                        ? (() => {
                            const dc = Vt.from.col - Vt.to.col;
                            const dr = Vt.from.row - Vt.to.row;
                            const knight =
                              (Math.abs(dr) === 1 && Math.abs(dc) === 2) ||
                              (Math.abs(dr) === 2 && Math.abs(dc) === 1);
                            const n = knight
                              ? 1
                              : Math.max(Math.abs(dr), Math.abs(dc));
                            if (!n) return null;
                            return {
                              sx: Jl ? -dc : dc,
                              sy: Jl ? -dr : dr,
                              stops: n + 1,
                              // 立ち寄る場所ごとに 190ms 留まる
                              ms: (n + 1) * 190,
                              seq: Vt.seq || 0,
                            };
                          })()
                        : null,
                    S0 = Vo
                      ? "cell-from"
                      : Go
                        ? "cell-to"
                        : Lo
                          ? "cell-swap"
                          : "";
                  return (
                    <div
                      style={
                        Vt && (Vo || Go)
                          ? {
                              "--lm": PLAYER_META[Vt.owner].color,
                            }
                          : Lo
                            ? {
                                "--lm": PLAYER_META[Oi.owner].color,
                              }
                            : void 0
                      }
                      className={`cell ${Zt ? (Zt.capture ? "cell-capture" : "cell-move") : ""} ${Zo !== null ? `zone-${Zo}` : ""} ${S0} ${focusCell(ne, Me) ? "guide-target" : ""}`}
                      onClick={() => {
                        Pl ||
                          ze ||
                          (Zt
                            ? tryMove(ne, Me, Zt)
                            : y({
                                type: "CANCEL_SELECTION",
                              }));
                      }}
                      key={`${ne}-${Me}`}
                    >
                      {fx && (
                        <span
                          key={`fx${a.lastDefeat.seq}`}
                          style={{ "--i": fxIdx }}
                          className={`fx-defeat ${
                            fx.owner === P ? "fx-defeat-mine" : "fx-defeat-foe"
                          } ${
                            a.lastDefeat.via === "surround"
                              ? "fx-defeat-surround"
                              : ""
                          } ${fx.wasKing ? "fx-defeat-king" : ""}`}
                        />
                      )}
                      {ze && (
                        <div
                          className={`piece-slot ${stepIn ? "piece-stepping" : ""}`}
                          key={stepIn ? `mv${stepIn.seq}` : "piece"}
                          style={
                            stepIn
                              ? {
                                  "--sx": stepIn.sx,
                                  "--sy": stepIn.sy,
                                  "--stops": stepIn.stops,
                                  "--ms": `${stepIn.ms}ms`,
                                }
                              : void 0
                          }
                          onClick={(wl) => {
                            if ((wl.stopPropagation(), Pl)) {
                              y({
                                type: "TOGGLE_SHUFFLE_PICK",
                                id: ze.id,
                              });
                              return;
                            }
                            if (Zt && x) {
                              tryMove(ne, Me, Zt);
                              return;
                            }
                            if (ze.owner === P && x) {
                              y({
                                type: "SELECT_PIECE",
                                id: ze.id,
                              });
                              return;
                            }
                            y({
                              type: "VIEW_LOG",
                              id: ze.id,
                            });
                          }}
                        >
                          <Piece
                            piece={ze}
                            viewer={P}
                            size={R >= 9 ? "xs" : "md"}
                            isSelected={
                              (!!M && a.selectedId === ze.id) ||
                              (Pl &&
                                (a.shuffleMode.aId === ze.id ||
                                  a.shuffleMode.picks.includes(ze.id)))
                            }
                            isPickable={!!Pl && ze.id !== a.shuffleMode.aId}
                            isGuided={focusPiece(ze.id)}
                          />
                        </div>
                      )}
                    </div>
                  );
                }),
              )}
            </div>
            <div className="file-labels">
              {Array.from({
                length: R,
              }).map((E, U) => {
                let be = Jl ? R - 1 - U : U;
                return <span key={U}>{String.fromCharCode(97 + be)}</span>;
              })}
            </div>
          </div>
        </div>
        {Pl && (
          <div className="action-bar">
            <span>
              入れ替える駒を2つ選択({a.shuffleMode.picks.length}/2)
              <br />
              味方だけを選ぶと、囲んだ相手を取れます
            </span>
            <button
              className="btn btn-primary"
              disabled={a.shuffleMode.picks.length !== 2}
              onClick={() =>
                y({
                  type: "CONFIRM_SHUFFLE",
                })
              }
            >
              シャッフル実行 <Shuffle size={14} />
            </button>
            <button
              className="btn btn-ghost"
              onClick={() =>
                y({
                  type: "CANCEL_SELECTION",
                })
              }
            >
              やめる
            </button>
          </div>
        )}
        {!Pl && x && a.selectedId && (
          <div className="action-bar">
            <button
              className="btn btn-ghost"
              onClick={() =>
                y({
                  type: "VIEW_LOG",
                  id: a.selectedId,
                })
              }
            >
              この駒の行動ログを見る
            </button>
          </div>
        )}
        {!Pl &&
          x &&
          a.extraMoveFor &&
          (() => {
            let E = a.pieces[a.extraMoveFor],
              U = E && E.rank === "A";
            return (
              <div className="action-bar">
                <span>
                  {U
                    ? "王(A)はもう一度入れ替えられます"
                    : "王(10)はもう一度動けます"}
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    y({
                      type: "SKIP_EXTRA_ACTION",
                    })
                  }
                >
                  使わず手番を終える
                </button>
              </div>
            );
          })()}
        {/* 何がどこで取られたか分かってから、予備札を置かせる。
            撃破の札より先に出てしまうと、状況が分からないまま置くことになる */}
        {a.kPlacement && a.kPlacement.owner === P && !a.captureReveal && (
          <ReservePlacer state={a} dispatch={y} size={R} focus={tutFocus} />
        )}
        <CapturedRow players={a.players} dispatch={y} viewer={P} />
        <div className="resign-row">
          <button className="btn btn-ghost btn-resign" onClick={() => m(!0)}>
            <Flag size={16} /> 降参する
          </button>
        </div>
        {a.logViewerId && a.pieces[a.logViewerId] && (
          <LogViewer
            piece={a.pieces[a.logViewerId]}
            viewer={P}
            revealAll={a.phase === "gameover"}
            onClose={() =>
              y({
                type: "CLOSE_LOG",
              })
            }
          />
        )}
        {/* 撃破の札を閉じるまでは、勝敗の画面を出さない */}
        {a.phase === "gameover" && !a.captureReveal && (
          <GameView
            state={a}
            network={network}
            myIdx={p}
            size={R}
            viewer={P}
            dispatch={y}
            onExit={leaveGame}
            tutorial={tutorial}
            youAre={network ? p : cpu ? 0 : null}
            rating={ratingResult}
          />
        )}
      </div>
    </GameShell>
  );
}
