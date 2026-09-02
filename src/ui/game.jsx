import { useEffect, useRef, useState } from "react";
import { winKingCardImg } from "../assets.js";
import { enrichAction } from "../game/actions.js";
import { getLegalMoves } from "../game/board.js";
import {
  PLAYER_META,
  playerLabel,
  shortPlayerLabel,
} from "../game/constants.js";
import { cpuAction } from "../game/cpu.js";
import { initialState, reducer } from "../game/reducer.js";
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
import { makeClientId, pushAct, readActs } from "../net/firebase.js";
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
  WaitingScreen,
  WaitingWithBoard,
  territoryOwnerOf,
} from "./setup.jsx";

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
          {!network || myIdx === 0 ? (
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
export function GameCore({ onExit, network, boardSize, cpu }) {
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
  function y(E) {
    u((U) => {
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
        }));
  }, [a.phase, boardSize]);
  let T = 1;
  ((0, useEffect)(() => {
    if (!cpu || network) return;
    let E = cpuAction(a, T);
    if (!E) return;
    let U = a.phase === "play" ? 700 : 380,
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
  let R = a.boardSize,
    P = network ? p : cpu ? 0 : a.currentTurn,
    x = network ? a.currentTurn === p : cpu ? a.currentTurn === 0 : !0,
    N = network
      ? `${p === 0 ? "host" : "guest"} acts:${g.current.size} d${a.diceIdx}[${(a.dice || []).map((E) => E ?? "-").join(",")}]`
      : null;
  if (d)
    return (
      <GameShell showRules={i} setShowRules={f} netInfo={N}>
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
      <GameShell showRules={i} setShowRules={f} netInfo={N}>
        <QuitConfirm
          network={network}
          onCancel={() => r(!1)}
          onQuit={() => {
            (r(!1), onExit());
          }}
        />
      </GameShell>
    );
  if (a.phase === "intro")
    return (
      <GameShell
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
  if (a.captureReveal && (!network || a.captureReveal.capturedBy === p))
    return (
      <GameShell
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        <CaptureRevealModal
          reveal={a.captureReveal}
          viewer={P}
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
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        <WaitingScreen text="相手が新しい王を選んでいます…" />
      </GameShell>
    ) : (
      <GameShell
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
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <DiceStage playerIdx={E} value={a.dice[E]} />
        </GameShell>
      ) : network && E !== p ? (
        <GameShell
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <DiceStage playerIdx={E} value={a.dice[E]} />
        </GameShell>
      ) : (
        <GameShell
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
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <WaitingWithBoard
            text="CPUがカードを選んでいます…"
            hand={a.players[0].hand}
            viewer={0}
            size={R}
          />
        </GameShell>
      );
    if (network && a.mulliganIdx !== p)
      return (
        <GameShell
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
          <p className="hint">
            捨てたい札をタップ(もう一度タップで取り消し)。同じ枚数を予備札から引き直します。捨て札は公開情報になります。
          </p>
          <MulliganHand
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
    if (cpu && a.setupIdx !== 0)
      return (
        <GameShell
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <WaitingWithBoard
            text="CPUが布陣を決めています…"
            hand={a.players[0].hand}
            board={a.board && a.board.length ? a.board : null}
            viewer={0}
            size={R}
          />
        </GameShell>
      );
    if (network && a.setupIdx !== p)
      return (
        <GameShell
          showRules={i}
          setShowRules={f}
          netInfo={N}
          onBack={() => r(!0)}
        >
          <WaitingWithBoard
            text="相手が布陣を決めています…"
            hand={a.players[p].hand}
            board={a.board && a.board.length ? a.board : null}
            viewer={p}
            size={R}
          />
        </GameShell>
      );
    let E = a.setupIdx,
      U = a.players[E];
    return (
      <GameShell
        showRules={i}
        setShowRules={f}
        netInfo={N}
        onBack={() => r(!0)}
      >
        {a.setupStep === "place" ? (
          <PlaceStep state={a} player={U} pIdx={E} size={R} dispatch={y} />
        ) : (
          <KingStep state={a} player={U} pIdx={E} size={R} dispatch={y} />
        )}
      </GameShell>
    );
  }
  let M = x && a.selectedId ? a.pieces[a.selectedId] : null,
    ct = M ? getLegalMoves(M, a.board, R, a.players[P].armyRankCounts) : [],
    Jl = P === 1,
    Pl = x && a.shuffleMode;
  return (
    <GameShell showRules={i} setShowRules={f} netInfo={N} onBack={() => r(!0)}>
      <div className="play-wrap">
        <TurnBar state={a} viewer={P} />
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
            <Dice size={14} className="spin-icon" /> CPUが考えています…
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
                      className={`cell ${Zt ? (Zt.capture ? "cell-capture" : "cell-move") : ""} ${Zo !== null ? `zone-${Zo}` : ""} ${S0}`}
                      onClick={() => {
                        Pl ||
                          ze ||
                          y(
                            Zt
                              ? {
                                  type: "MOVE_PIECE",
                                  row: ne,
                                  col: Me,
                                  captures: Zt.captures,
                                }
                              : {
                                  type: "CANCEL_SELECTION",
                                },
                          );
                      }}
                      key={`${ne}-${Me}`}
                    >
                      {ze && (
                        <div
                          onClick={(wl) => {
                            if ((wl.stopPropagation(), Pl)) {
                              y({
                                type: "TOGGLE_SHUFFLE_PICK",
                                id: ze.id,
                              });
                              return;
                            }
                            if (Zt && x) {
                              y({
                                type: "MOVE_PIECE",
                                row: ne,
                                col: Me,
                                captures: Zt.captures,
                              });
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
          <ReservePlacer state={a} dispatch={y} size={R} />
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
            onExit={onExit}
          />
        )}
      </div>
    </GameShell>
  );
}
