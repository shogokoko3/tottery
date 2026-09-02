import { useEffect, useRef, useState } from "react";
import { titleBgImg } from "../assets.js";
import { VERSION } from "../game/constants.js";
import {
  ArrowLeft,
  ArrowRight,
  Book,
  Check,
  Crown,
  Dice,
  DoorIn,
  DoorOut,
  Globe,
  Info,
  Play,
  Settings,
  Users,
} from "../icons.jsx";
import {
  LOBBY_TTL,
  deleteLobbyPath,
  deleteRoom,
  generateRoomCode,
  makeClientId,
  readLobby,
  readLobbyPath,
  readRoom,
  writeLobby,
  writeRoom,
} from "../net/firebase.js";
import { GameCore } from "./game.jsx";
import { RulesPanel } from "./guides.jsx";
import { SettingsModal } from "./overlays.jsx";
import { TutorialSelect } from "./tutorial.jsx";
import { hasName, isTestPlay, loadProfile } from "../game/profile.js";
import { NameEditModal, NameSetupScreen } from "./account.jsx";
import { NamesProvider } from "./names.jsx";
import STYLES from "../styles.css";

/** いま端末に登録されている自分の名前。まだ決めていなければ null */
function myName() {
  return loadProfile().name || null;
}

export function GameShell({
  children,
  showRules,
  setShowRules,
  netInfo,
  onBack,
  title,
  sheet,
  focusButton,
}) {
  let [i, f] = (0, useState)(!1);
  return (
    <div className={`tottery-root ${focusButton ? "focus-button" : ""}`}>
      <style>{STYLES}</style>
      <header className="top-bar">
        <div className="top-left">
          {onBack ? (
            <button
              className="icon-btn plain"
              onClick={onBack}
              aria-label="戻る"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <Crown
              size={20}
              style={{
                color: "var(--gold)",
              }}
            />
          )}
        </div>
        <span className="brand">{title || "トッタリー"}</span>
        <div className="top-right">
          <button
            className="icon-btn"
            onClick={() => setShowRules(!0)}
            aria-label="カード早見表"
          >
            <Info size={18} />
          </button>
          <button className="icon-btn" onClick={() => f(!0)} aria-label="設定">
            <Settings size={18} />
          </button>
        </div>
      </header>
      {i && <SettingsModal onClose={() => f(!1)} />}
      {isTestPlay() && (
        <div className="test-badge">テストプレイ中 · 時間制限なし</div>
      )}
      <main className={`stage ${sheet ? "stage-with-sheet" : ""}`}>
        {children}
      </main>
      {sheet}
      {showRules && <RulesPanel onClose={() => setShowRules(!1)} />}
      <div className="build-tag">
        {netInfo && <span className="net-tag">{netInfo} · </span>}build:{" "}
        {VERSION}
      </div>
    </div>
  );
}
export function HomeScreen({ onStart }) {
  return (
    <div className="intro title-hero">
      <img className="title-bg" src={titleBgImg} alt="" draggable="false" />
      <button
        className="btn btn-primary btn-large intro-start"
        onClick={onStart}
      >
        ゲームスタート <ArrowRight size={18} />
      </button>
    </div>
  );
}
export function MatchingScreen({ onOnline, onFriend, onCpu, onTutorial }) {
  return (
    <div className="center-stage">
      <h2>対戦相手を選ぶ</h2>
      <div className="nav-stack">
        <button className="btn btn-primary btn-choice" onClick={onOnline}>
          <Globe size={30} />
          <span className="choice-label">
            オンラインでマッチする<small>世界中のプレイヤーと対戦</small>
          </span>
        </button>
        <button className="btn btn-friend btn-choice" onClick={onFriend}>
          <Users size={30} />
          <span className="choice-label">
            フレンドとマッチする<small>友達とルーム対戦</small>
          </span>
        </button>
        <button className="btn btn-teal btn-choice" onClick={onCpu}>
          <Crown size={30} />
          <span className="choice-label">
            CPUと対戦する<small>ひとりで練習・腕試し</small>
          </span>
        </button>
        <button className="btn btn-scroll btn-choice" onClick={onTutorial}>
          <Book size={30} />
          <span className="choice-label">
            チュートリアル<small>ルールとカードの効果を学ぶ</small>
          </span>
        </button>
      </div>
    </div>
  );
}
export function RandomMatchScreen({ onBack, onRoomReady }) {
  let [l, n] = (0, useState)("searching"),
    [a, u] = (0, useState)(""),
    i = (0, useRef)(makeClientId()),
    f = (0, useRef)(null),
    o = (0, useRef)(!1);
  return (
    (0, useEffect)(() => {
      if (l !== "waiting") return;
      let r = setInterval(async () => {
        let d = f.current;
        if (!d) return;
        let m = await readLobbyPath(`/${d}/guest`);
        if (!o.current && m.ok && m.data) {
          clearInterval(r);
          let s = f.current,
            // 相手の名前は、参加時に部屋へ書き込まれている
            g = await readRoom(s);
          if (o.current) return;
          (deleteLobbyPath(`/${d}`),
            onRoomReady({
              code: s,
              myPlayerIndex: 0,
              names: [myName(), (g.data && g.data.guestName) || null],
            }));
        }
      }, 1500);
      return () => clearInterval(r);
    }, [l]),
    (0, useEffect)(
      () => () => {
        ((o.current = !0), f.current && deleteLobbyPath(`/${f.current}`));
      },
      [],
    ),
    (0, useEffect)(() => {
      (async () => {
        let r = i.current,
          d = await readLobby();
        if (o.current) return;
        if (!d.ok) {
          (u(d.error), n("error"));
          return;
        }
        let m = Date.now(),
          s = Object.entries(d.data || {})
            .filter(
              ([z, g]) =>
                g &&
                !g.guest &&
                g.host !== r &&
                m - (g.createdAt || 0) < LOBBY_TTL,
            )
            .sort((z, g) => (g[1].createdAt || 0) - (z[1].createdAt || 0));
        for (let [z] of s) {
          let g = await writeLobby(`/${z}/guest`, r);
          if (o.current) return;
          if (!g.ok) continue;
          let A = await readLobbyPath(`/${z}/guest`);
          if (o.current) return;
          if (A.ok && A.data === r) {
            let b = await readRoom(z);
            if (o.current) return;
            if (!b.ok) {
              (u(b.error), n("error"));
              return;
            }
            if (
              (await writeRoom(z, {
                ...(b.data || {}),
                guestPresent: !0,
                guestName: myName(),
              }),
              o.current)
            )
              return;
            onRoomReady({
              code: z,
              myPlayerIndex: 1,
              names: [(b.data && b.data.hostName) || null, myName()],
            });
            return;
          }
        }
        let v = generateRoomCode() + generateRoomCode(),
          p = await writeRoom(v, {
            guestPresent: !1,
            gameState: null,
            hostName: myName(),
          });
        if (o.current) return;
        if (!p.ok) {
          (u(p.error), n("error"));
          return;
        }
        let w = await writeLobby(`/${v}`, {
          host: r,
          guest: null,
          createdAt: Date.now(),
        });
        if (!o.current) {
          if (!w.ok) {
            (u(w.error), n("error"));
            return;
          }
          ((f.current = v), n("waiting"));
        }
      })();
    }, []),
    l === "error" ? (
      <div className="center-stage">
        <h2>マッチングできませんでした</h2>
        <p
          className="hint"
          style={{
            color: "#e2896f",
          }}
        >
          {a}
        </p>
        <button className="btn btn-ghost" onClick={onBack}>
          マッチング画面に戻る
        </button>
      </div>
    ) : (
      <div className="center-stage">
        <Dice size={32} className="dim-icon spin-icon" />
        <h2>
          {l === "searching"
            ? "対戦相手を探しています…"
            : "対戦相手を待っています…"}
        </h2>
        <p className="hint">
          {l === "searching"
            ? "待機中のプレイヤーがいないか確認しています。"
            : "あなたは待機中です。誰かが参加すると自動的に始まります。"}
        </p>
        <button
          className="btn btn-ghost"
          style={{
            marginTop: 18,
          }}
          onClick={onBack}
        >
          やめる
        </button>
      </div>
    )
  );
}
export function RulesSelectScreen({ onStart, onBack, backLabel, note }) {
  let [a, u] = (0, useState)(5);
  return (
    <div className="setup-wrap">
      <h2>ルール設定</h2>
      <div className="rule-section">
        <div className="rule-section-label">ルール</div>
        <div className="nav-stack">
          <button className="btn btn-primary btn-choice" disabled={!0}>
            <Check size={18} />
            <span className="choice-label">
              クラシック<small>基本ルールで対戦します</small>
            </span>
          </button>
          <button className="btn btn-ghost" disabled={!0} title="開発中">
            詳細設定(開発中)
          </button>
        </div>
      </div>
      <div className="rule-section">
        <div className="rule-section-label">盤面のサイズ</div>
        <div className="size-choices">
          {[5, 9].map((i) => (
            <button
              className={`board-choice ${a === i ? "active" : ""}`}
              onClick={() => u(i)}
              key={i}
            >
              <div
                className="board-choice-grid"
                style={{
                  gridTemplateColumns: `repeat(${i},1fr)`,
                }}
              >
                {Array.from({
                  length: i * i,
                }).map((f, o) => (
                  <span key={o} />
                ))}
              </div>
              <span>
                {i}×{i}
              </span>
              <small>{i === 5 ? "5枚で戦う短期戦" : "9枚で戦う本格戦"}</small>
            </button>
          ))}
        </div>
      </div>
      {note && <p className="hint">{note}</p>}
      <div className="setup-actions">
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={18} /> {backLabel}
        </button>
        <button className="btn btn-primary" onClick={() => onStart(a)}>
          <Play size={16} /> ゲームを始める
        </button>
      </div>
    </div>
  );
}
export function RoomScreen({
  onOfflineLocal,
  onRoomReady,
  onBackToMatching,
  onBeforeRoom,
  autoCreate,
}) {
  let [u, i] = (0, useState)(null),
    [f, o] = (0, useState)(""),
    [r, d] = (0, useState)(""),
    [m, s] = (0, useState)(""),
    [v, p] = (0, useState)(!1),
    [w, z] = (0, useState)("checking"),
    [g, A] = (0, useState)("");
  (0, useEffect)(() => {
    let P = !1;
    return (
      (async () => {
        let x = `diag${Date.now()}`,
          N = await writeRoom(x, {
            test: !0,
          });
        if (P) return;
        if (!N.ok) {
          (z("fail"), A(N.error));
          return;
        }
        let M = await readRoom(x);
        if (!P) {
          if (!M.ok) {
            (z("fail"), A(M.error));
            return;
          }
          (deleteRoom(x), z("ok"));
        }
      })(),
      () => {
        P = !0;
      }
    );
  }, []);
  let b = (0, useRef)(!1);
  ((0, useEffect)(() => {
    !autoCreate || b.current || w !== "ok" || ((b.current = !0), y());
  }, [autoCreate, w]),
    (0, useEffect)(() => {
      if (u !== "waitingHost") return;
      let P = !1,
        x = setInterval(async () => {
          let N = await readRoom(f);
          if (!P) {
            if (!N.ok) {
              s(N.error);
              return;
            }
            N.data &&
              N.data.guestPresent &&
              (clearInterval(x),
              onRoomReady({
                code: f,
                myPlayerIndex: 0,
                names: [myName(), N.data.guestName || null],
              }));
          }
        }, 1200);
      return () => {
        ((P = !0), clearInterval(x));
      };
    }, [u, f]));
  async function y() {
    (p(!0), s(""));
    let P = generateRoomCode(),
      x = await writeRoom(P, {
        guestPresent: !1,
        gameState: null,
        hostName: myName(),
      });
    if ((p(!1), !x.ok)) {
      s(x.error);
      return;
    }
    (o(P), i("waitingHost"));
  }
  async function T() {
    let P = r.trim().toUpperCase();
    if (P.length < 4) {
      s("4桁のコードを入力してください");
      return;
    }
    (p(!0), s(""));
    let x = await readRoom(P);
    if (!x.ok) {
      (p(!1), s(x.error));
      return;
    }
    if (!x.data) {
      (p(!1), s("そのコードのルームは見つかりませんでした"));
      return;
    }
    if (x.data.guestPresent) {
      (p(!1), s("このルームは既に対戦相手が参加済みです"));
      return;
    }
    let N = await writeRoom(P, {
      ...x.data,
      guestPresent: !0,
      guestName: myName(),
    });
    if ((p(!1), !N.ok)) {
      s(N.error);
      return;
    }
    onRoomReady({
      code: P,
      names: [x.data.hostName || null, myName()],
      myPlayerIndex: 1,
    });
  }
  function R() {
    (f && deleteRoom(f), o(""), s(""), i(null));
  }
  return u === "waitingHost" ? (
    <div className="center-stage">
      <Users size={28} className="dim-icon" />
      <h2>ルームを作成しました</h2>
      <div className="room-code">{f}</div>
      <p className="hint">
        この4桁のコードを相手に伝えてください。相手が参加すると自動的に始まります。
      </p>
      <Dice size={22} className="dim-icon spin-icon" />
      {m && (
        <p
          className="hint"
          style={{
            color: "#e2896f",
          }}
        >
          {m}
        </p>
      )}
      <div
        className="nav-stack"
        style={{
          marginTop: 20,
        }}
      >
        <button className="btn btn-ghost" onClick={R}>
          ルームを取り消す
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            (R(), onBackToMatching());
          }}
        >
          マッチング画面に戻る
        </button>
      </div>
    </div>
  ) : (
    <div className="setup-wrap friend-wrap">
      <div className="friend-head">
        <Users
          size={44}
          style={{
            color: "var(--gold)",
          }}
        />
        <h2
          style={{
            margin: "10px 0 8px",
          }}
        >
          フレンド対戦
        </h2>
        <p
          className="hint"
          style={{
            margin: 0,
          }}
        >
          ルームを作成して合言葉を共有するか、
          <br />
          合言葉を入力して参加できます。
        </p>
      </div>
      <div className={`conn-badge conn-${w}`}>
        <span className="conn-dot" />
        接続状態:
        {w === "ok"
          ? "オンライン"
          : w === "checking"
            ? "確認中…"
            : "利用できません"}
      </div>
      {w === "fail" && (
        <p
          className="hint"
          style={{
            color: "#e08b7a",
          }}
        >
          {g}
        </p>
      )}
      <button
        className="btn btn-primary btn-wide"
        disabled={v || w !== "ok"}
        onClick={onBeforeRoom}
      >
        <DoorOut size={22} /> ルームを作る
      </button>
      <div className="code-row">
        <div
          className="code-boxes"
          onClick={() => {
            let P = document.getElementById("code-input");
            P && P.focus();
          }}
        >
          {[0, 1, 2, 3].map((P) => (
            <div
              className={`code-box ${r.length === P ? "code-box-active" : ""}`}
              key={P}
            >
              {r[P] || <span className="code-placeholder">—</span>}
            </div>
          ))}
          <input
            id="code-input"
            className="code-hidden"
            value={r}
            maxLength={4}
            onChange={(P) =>
              d(P.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
            }
            inputMode="text"
            autoComplete="off"
          />
        </div>
        <button
          className="btn btn-ghost code-join"
          disabled={v || w !== "ok"}
          onClick={T}
        >
          <DoorIn size={18} /> {v ? "参加中…" : "参加する"}
        </button>
      </div>
      <p className="code-note">
        <Info size={14} /> 4文字の合言葉を入力してください。
      </p>
      {m && (
        <p
          className="hint"
          style={{
            color: "#e08b7a",
          }}
        >
          {m}
        </p>
      )}
      <button className="btn btn-teal btn-wide" onClick={onOfflineLocal}>
        <Users size={20} /> オフラインで対戦(2人)
      </button>
      <button
        className="btn btn-ghost btn-wide"
        style={{
          marginTop: 12,
        }}
        onClick={onBackToMatching}
      >
        <ArrowLeft size={18} /> メインメニューへ戻る
      </button>
    </div>
  );
}
export function TotteryApp() {
  // はじめて遊ぶときは、まず名前を決めてもらう
  let [named, setNamed] = (0, useState)(() => hasName()),
    [e, t] = (0, useState)("home"),
    [l, n] = (0, useState)(!1),
    [a, u] = (0, useState)(null),
    [i, f] = (0, useState)(5),
    [o, r] = (0, useState)("game"),
    [d, m] = (0, useState)(!1),
    [tut, setTut] = (0, useState)(null);
  function s() {
    (u(null), m(!1), setTut(null), t("home"));
  }
  function v(b) {
    (u(b), t("game"));
  }
  let [p, w] = (0, useState)(!1);
  function z(b) {
    (f(b), o === "room" && w(!0), t(o));
  }
  // 画面の枠(背景や上のバー)は GameShell が出すので、その中に入れる
  if (!named)
    return (
      <GameShell showRules={l} setShowRules={n}>
        <NameSetupScreen onDone={() => setNamed(!0)} />
      </GameShell>
    );
  if (e === "game") {
    // 対局中に出す名前。相手の名前が分からない席は色名のまま
    let me = loadProfile().name || null,
      seats = a
        ? a.names || [null, null]
        : d
          ? [me, tut ? null : "CPU"]
          : [null, null];
    return (
      <NamesProvider value={seats}>
        <GameCore
          network={a}
          boardSize={tut ? tut.boardSize : i}
          cpu={d}
          tutorial={tut}
          onExit={s}
        />
      </NamesProvider>
    );
  }
  let g = o === "online" || o === "room" ? "matching" : "room";
  return (
    <GameShell showRules={l} setShowRules={n}>
      {
        {
          home: <HomeScreen onStart={() => t("matching")} />,
          matching: (
            <MatchingScreen
              onOnline={() => {
                (u(null), m(!1), r("online"), t("rules"));
              }}
              onFriend={() => {
                (u(null), m(!1), t("room"));
              }}
              onCpu={() => {
                (u(null), m(!0), setTut(null), r("game"), t("rules"));
              }}
              onTutorial={() => {
                (u(null), t("tutorial"));
              }}
            />
          ),
          tutorial: (
            <TutorialSelect
              onBack={() => t("matching")}
              onStart={(chosen) => {
                (setTut(chosen), m(!0), r("game"), t("game"));
              }}
            />
          ),
          online: (
            <RandomMatchScreen onBack={() => t("matching")} onRoomReady={v} />
          ),
          room: (
            <RoomScreen
              autoCreate={p}
              onOfflineLocal={() => {
                (w(!1), u(null), m(!1), r("game"), t("rules"));
              }}
              onBeforeRoom={() => {
                (r("room"), t("rules"));
              }}
              onRoomReady={v}
              onBackToMatching={() => {
                (w(!1), t("matching"));
              }}
            />
          ),
          rules: (
            <RulesSelectScreen
              onStart={z}
              onBack={() => t(g)}
              backLabel="戻る"
              note={
                o === "online"
                  ? "この設定で対戦相手を探します。相手が先に待っていた場合は、相手の設定が使われます。"
                  : o === "room"
                    ? "この設定でルームを作ります。"
                    : null
              }
            />
          ),
        }[e]
      }
    </GameShell>
  );
}
