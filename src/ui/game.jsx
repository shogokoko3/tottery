import { useEffect, useRef, useState } from "react";
import { winKingCardImg } from "../assets.js";
import { enrichAction } from "../game/actions.js";
import { getLegalMoves, squareName } from "../game/board.js";
import {
  PLAYER_META,
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
  SETUP_LIMIT_MS,
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
} from "../icons.jsx";
import {
  deleteRoom,
  makeClientId,
  pushAct,
  readActs,
} from "../net/firebase.js";
import { LOCAL_ONLY_ACTIONS, withLocalContext } from "../net/sync.js";
import { CardFace, Piece } from "./cards.jsx";
import { DiceStage, DiceStep, Die } from "./dice.jsx";
import {
  CaptureRevealModal,
  Interstitial,
  KingChoiceInterstitial,
  LogViewer,
  QuitConfirm,
  ResignConfirm,
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

/** 持ち時間の表示。自分の時計は下、相手の時計は上に置く */
export function ClockBar({ clocks, currentTurn, viewer }) {
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
              {shortPlayerLabel(idx, viewer)}({PLAYER_META[idx].name})
            </span>
            <strong className="clock-time">{fmt(ms)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function TurnBar({ state, viewer }) {
  let l = PLAYER_META[state.currentTurn],
    n = state.currentTurn === viewer;
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
        {n ? `あなた(${l.name})の番です` : `相手(${l.name})の番です`}
      </span>
      <span className="turn-log">{state.log[state.log.length - 1]}</span>
    </div>
  );
}
export function CapturedRow({ players, dispatch, viewer }) {
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
              {shortPlayerLabel(f, viewer)}({PLAYER_META[f].name})が失った駒
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
                  label={`${shortPlayerLabel(f, viewer)}(${PLAYER_META[f].name})が捨てたカード`}
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
}) {
  let [f, o] = (0, useState)(!1),
    r = PLAYER_META[state.winner];
  if (f) {
    let d = viewer === 1,
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
              {PLAYER_META[state.resignedBy].name}の降参により決着しました。
            </p>
          )}
          <p className="hint">
            最終盤面(すべての駒を公開)。駒をタップすると、その駒の動きを追えます。
          </p>
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
                    A = state.board[z][g],
                    b = territoryOwnerOf(z, g, size);
                  return (
                    <div
                      className={`cell ${b !== null ? `zone-${b}` : ""}`}
                      onClick={() => {
                        A &&
                          dispatch({
                            type: "VIEW_LOG",
                            id: A.id,
                          });
                      }}
                      key={`${z}-${g}`}
                    >
                      {A && (
                        <div className="piece-wrap">
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
                      )}
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
                  {shortPlayerLabel(v, viewer)}({PLAYER_META[v].name})が失った駒
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
                m.map((s, v) => <li key={v}>{s}</li>)
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
      <div className="modal-panel gameover-panel">
        <Crown
          size={34}
          style={{
            color: "var(--gold)",
          }}
        />
        <h2
          style={{
            color: r.color,
          }}
        >
          {network
            ? state.winner === myIdx
              ? "あなたの勝ち!"
              : "あなたの負け…"
            : `${r.name}の勝利!`}
        </h2>
        {state.resignedBy !== null && state.resignedBy !== void 0 && (
          <p
            className="hint"
            style={{
              marginTop: -6,
            }}
          >
            {PLAYER_META[state.resignedBy].name}が降参しました
          </p>
        )}
        <div className="king-card win-card">
          <img src={winKingCardImg} alt="" />
        </div>
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
export function GameCore({ onExit, network, boardSize, cpu, tutorial }) {
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
    foeIdxRef = (0, useRef)(0),
    recordedRef = (0, useRef)(!1),
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
      )
        return;
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
              }
            : null),
        }));
  }, [a.phase, boardSize]);
  // チュートリアルの相手は考えない。台本の手をそのまま指す。
  // 台本を使い切ったあとは CPU が引き継ぐので、相手の番で止まることはない
  (0, useEffect)(() => {
    if (!tutorial || network) return;
    let scripted = foeAction(a, tutorial, foeIdxRef.current, (piece) =>
        getLegalMoves(piece, a.board, a.boardSize, a.players[1].armyRankCounts),
      ),
      act =
        scripted ||
        (a.phase === "play" && a.currentTurn === 1 && !a.captureReveal
          ? cpuAction(a, 1)
          : null);
    if (!act) return;
    let id = setTimeout(
      () => {
        if (scripted && act.type === "MOVE_PIECE") foeIdxRef.current += 1;
        if (act.type === "__CPU_SHUFFLE") {
          y({ type: "SELECT_PIECE", id: act.aceId, __foe: !0 });
          y({ type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[0], __foe: !0 });
          y({ type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[1], __foe: !0 });
          y({ type: "CONFIRM_SHUFFLE", __foe: !0 });
          return;
        }
        y({ ...act, __foe: !0 });
      },
      a.phase === "play" ? 1200 : 420,
    );
    return () => clearTimeout(id);
  }, [a, tutorial, network]);

  let T = 1;
  ((0, useEffect)(() => {
    if (!cpu || network || tutorial) return;
    let E = cpuAction(a, T);
    if (!E) return;
    let U = a.phase === "play" ? 1000 : 380,
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
    setupRunning = a.phase === "setup" && !handoff && !a.setupDone[setupSide],
    setupRemaining =
      setupRunning && !noLimit && setupStartRef.current !== null
        ? SETUP_LIMIT_MS - (nowMs - setupStartRef.current)
        : null;

  ((0, useEffect)(() => {
    if (!setupRunning) {
      setupStartRef.current = null;
      return;
    }
    setupStartRef.current = Date.now();
    setNowMs(Date.now());
  }, [setupRunning, setupSide]),
    // 時間切れ。置いた分は残し、残りを自動配置して確定する
    (0, useEffect)(() => {
      if (!setupRunning || setupRemaining === null || setupRemaining > 0)
        return;
      let placement = autoArrange(
          a,
          setupSide,
          null,
          null,
          a.setupPlacements[setupSide],
        ),
        kingId = autoPickKing(a, setupSide, placement);
      if (kingId)
        y({
          type: "SETUP_CONFIRM",
          player: setupSide,
          placement,
          kingId,
        });
    }, [setupRunning, setupRemaining]));

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
      ? SETUP_LIMIT_MS - (nowMs - setupPhaseStartRef.current)
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
   * 対局を抜ける。決着がついていれば、使い終わった部屋を消しておく。
   *
   * 消すのはホストだけ。「もう一度遊ぶ」を選べるのはホストなので、
   * ゲストが先に抜けて部屋を消すと、ホストの再戦が壊れる。
   */
  function leaveGame() {
    let finished =
      a.phase === "gameover" || (a.winner !== null && a.winner !== undefined);
    if (network && p === 0 && finished) deleteRoom(network.code);
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

  // 対局が終わったら1局ぶん記録する。レベルの元になる
  (0, useEffect)(() => {
    if (a.phase !== "gameover" || recordedRef.current) return;
    recordedRef.current = !0;
    recordGame(a.winner === (network ? p : 0));
  }, [a.phase, a.winner]);

  // 進んだところまでを覚えておく。
  // これが無いと、同じ駒を2度動かす台本で前の指示へ戻ってしまう
  (0, useEffect)(() => {
    if (tutorial && tutIdx > tutStep) setTutStep(tutIdx);
  }, [tutIdx, tutStep, tutorial]);

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
  if (
    a.captureReveal &&
    !holdFx &&
    (!network || a.captureReveal.capturedBy === p)
  )
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
                    {shortPlayerLabel(U, P)}({PLAYER_META[U].name})
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
                  {shortPlayerLabel(U, P)}({PLAYER_META[U].name})
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
            {a.firstPlayer === P ? "あなた" : "相手"}(
            {PLAYER_META[a.firstPlayer].name})が先手です
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
            {playerLabel(E, P)}: 交換するカードを選んでね
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
            label={`${shortPlayerLabel(1 - E, P)}(${PLAYER_META[1 - E].name})が捨てたカード`}
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
        {a.kPlacement && a.kPlacement.owner === P && (
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
        {a.phase === "gameover" && (
          <GameView
            state={a}
            network={network}
            myIdx={p}
            size={R}
            viewer={P}
            dispatch={y}
            onExit={leaveGame}
            tutorial={tutorial}
          />
        )}
      </div>
    </GameShell>
  );
}
