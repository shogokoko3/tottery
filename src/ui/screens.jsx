import { useEffect, useRef, useState } from "react";
import { useScreenBgm } from "../audio/index.js";
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
  Sparkle,
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
import { RankingScreen } from "./ranking.jsx";
import { hasName, isTestPlay, loadProfile } from "../game/profile.js";
import { NameEditModal, NameSetupScreen } from "./account.jsx";
import { titleOf } from "../game/titles.js";
import { resetAccount, touchDay } from "../game/profile.js";
import { syncPlayer } from "../net/players.js";
import { SeatsProvider } from "./names.jsx";
import STYLES from "../styles.css";
import SKIN_STYLES from "../skins/styles.css";
import { SkinsScreen } from "./skins.jsx";
import { MissionsScreen } from "./missions.jsx";
import { BattlePassScreen } from "./battlepass.jsx";
import { claimableCount } from "../game/missions.js";
import { getCollection, useCollection } from "../skins/store.js";
import { sanitizeLoadout } from "../skins/catalog.js";

const mySkins = () => sanitizeLoadout(getCollection().equipped);

/** いま端末に登録されている自分の名前。まだ決めていなければ null */
function myName() {
  return loadProfile().name || null;
}

/** いま選んでいるアイコン。相手にも渡す */
function myIcon() {
  return loadProfile().icon || null;
}

/** いま選んでいる称号。相手にも渡す */
function myTitle() {
  return titleOf(loadProfile()).id;
}

/** いまの持ち点。相手に渡して、対局後の増減を互いに計算する */
function myRating() {
  return loadProfile().rating;
}

export function GameShell({
  children,
  showRules,
  setShowRules,
  netInfo,
  onBack,
  onHome,
  title,
  sheet,
  focusButton,
}) {
  let [i, f] = (0, useState)(!1);
  // 上の「トッタリー」を押すとタイトルへ。対局中は onBack と同じ扱いにして、
  // 「対局をやめますか?」の確認を通す(黙って抜けると対局が飛ぶ)
  let goHome = onHome || onBack;
  return (
    <div className={`tottery-root ${focusButton ? "focus-button" : ""}`}>
      <style>{STYLES + SKIN_STYLES}</style>
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
        {goHome ? (
          <button
            className="brand brand-link"
            onClick={goHome}
            aria-label="タイトルへ戻る"
          >
            {title || "トッタリー"}
          </button>
        ) : (
          <span className="brand">{title || "トッタリー"}</span>
        )}
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
export function HomeScreen({ onStart, onSkins }) {
  return (
    <div className="intro title-hero">
      <div className="title-hero-visual">
        <img className="title-bg" src={titleBgImg} alt="" draggable="false" />
        <button
          className="btn btn-primary btn-large intro-start"
          onClick={onStart}
        >
          ゲームスタート <ArrowRight size={18} />
        </button>
      </div>
      <button className="btn btn-ghost intro-skins" onClick={onSkins}>
        スキンガチャ・装備
      </button>
    </div>
  );
}
/**
 * ホーム。タイトルの「ゲームスタート」の次に出る。
 * ここから対戦・チュートリアル・スキン・バトルパス・ミッション・ランキングへ分かれる。
 * 「対戦する」だけは、相手の種類を選ぶ画面(MatchingScreen)へ進む。
 */
export function MenuScreen({
  onPlay,
  onTutorial,
  onSkins,
  onBattlePass,
  onMissions,
  onRanking,
}) {
  // 受け取れるミッションの数。入り口に印を出す
  const ready = claimableCount(loadProfile());
  return (
    <div className="center-stage">
      <h2>ホーム</h2>
      <div className="nav-stack">
        <button className="btn btn-primary btn-choice" onClick={onPlay}>
          <Globe size={30} />
          <span className="choice-label">
            対戦する<small>オンライン・フレンド・CPU</small>
          </span>
        </button>
        <button className="btn btn-scroll btn-choice" onClick={onTutorial}>
          <Book size={30} />
          <span className="choice-label">
            チュートリアル<small>ルールとカードの効果を学ぶ</small>
          </span>
        </button>
        <button className="btn btn-friend btn-choice" onClick={onSkins}>
          <Sparkle size={30} />
          <span className="choice-label">
            スキンガチャ・装備<small>英雄を召喚してカードに着せる</small>
          </span>
        </button>
        <button className="btn btn-teal btn-choice" onClick={onBattlePass}>
          <Crown size={30} />
          <span className="choice-label">
            バトルパス<small>駒を取ってマスを埋め、絵柄をそろえる</small>
          </span>
        </button>
        <button className="btn btn-ghost btn-choice" onClick={onMissions}>
          <Check size={30} />
          <span className="choice-label">
            ミッション<small>条件を満たして称号やチケットを受け取る</small>
          </span>
          {ready > 0 && <span className="menu-badge">{ready}</span>}
        </button>
        <button className="btn btn-ghost btn-choice" onClick={onRanking}>
          <Crown size={30} />
          <span className="choice-label">
            ランキング<small>オンライン対戦の成績で並びます</small>
          </span>
        </button>
      </div>
    </div>
  );
}

/** 対戦の相手を選ぶ。ホームの「対戦する」から来る */
export function MatchingScreen({ onOnline, onFriend, onCpu, onBack }) {
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
      </div>
      <button className="btn btn-ghost btn-wide" onClick={onBack}>
        <ArrowLeft size={18} /> ホームに戻る
      </button>
    </div>
  );
}

export function RandomMatchScreen({ onBack, onRoomReady }) {
  const loadout = useRef(mySkins()).current;
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
              icons: [myIcon(), (g.data && g.data.guestIcon) || null],
              titles: [myTitle(), (g.data && g.data.guestTitle) || null],
              ratings: [myRating(), (g.data && g.data.guestRating) || null],
              skins: [
                sanitizeLoadout(g.data?.hostSkins),
                sanitizeLoadout(g.data?.guestSkins),
              ],
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
          all = Object.entries(d.data || {}),
          // 時間切れの掲載は誰も拾えない。見つけたついでに片付ける。
          // 部屋には手番の列がまるごと入っているので、残したままにしない
          stale = all.filter(
            ([, g]) => !g || m - (g.createdAt || 0) >= LOBBY_TTL,
          );
        for (let [z] of stale) {
          deleteLobbyPath(`/${z}`);
          deleteRoom(z);
        }
        let s = all
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
                guestIcon: myIcon(),
                guestTitle: myTitle(),
                guestRating: myRating(),
                guestSkins: loadout,
              }),
              o.current)
            )
              return;
            onRoomReady({
              code: z,
              myPlayerIndex: 1,
              names: [(b.data && b.data.hostName) || null, myName()],
              icons: [(b.data && b.data.hostIcon) || null, myIcon()],
              titles: [(b.data && b.data.hostTitle) || null, myTitle()],
              ratings: [(b.data && b.data.hostRating) || null, myRating()],
              skins: [sanitizeLoadout(b.data?.hostSkins), loadout],
            });
            return;
          }
        }
        let v = generateRoomCode() + generateRoomCode(),
          p = await writeRoom(v, {
            guestPresent: !1,
            gameState: null,
            hostName: myName(),
            hostIcon: myIcon(),
            hostTitle: myTitle(),
            hostRating: myRating(),
            hostSkins: loadout,
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
          対戦相手を選ぶに戻る
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
  const loadout = useRef(mySkins()).current;
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
                icons: [myIcon(), N.data.guestIcon || null],
                titles: [myTitle(), N.data.guestTitle || null],
                ratings: [myRating(), N.data.guestRating || null],
                skins: [
                  sanitizeLoadout(N.data.hostSkins),
                  sanitizeLoadout(N.data.guestSkins),
                ],
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
        hostIcon: myIcon(),
        hostTitle: myTitle(),
        hostRating: myRating(),
        hostSkins: loadout,
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
      guestIcon: myIcon(),
      guestTitle: myTitle(),
      guestRating: myRating(),
      guestSkins: loadout,
    });
    if ((p(!1), !N.ok)) {
      s(N.error);
      return;
    }
    onRoomReady({
      code: P,
      names: [x.data.hostName || null, myName()],
      icons: [x.data.hostIcon || null, myIcon()],
      titles: [x.data.hostTitle || null, myTitle()],
      ratings: [x.data.hostRating || null, myRating()],
      skins: [sanitizeLoadout(x.data.hostSkins), loadout],
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
          対戦相手を選ぶに戻る
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
        <ArrowLeft size={18} /> 対戦相手を選ぶに戻る
      </button>
    </div>
  );
}
export function TotteryApp() {
  const collection = useCollection();
  // はじめて遊ぶときは、まず名前を決めてもらう
  let [named, setNamed] = (0, useState)(() => hasName()),
    [e, t] = (0, useState)("home"),
    [l, n] = (0, useState)(!1),
    [a, u] = (0, useState)(null),
    [i, f] = (0, useState)(5),
    [o, r] = (0, useState)("game"),
    [d, m] = (0, useState)(!1),
    [tut, setTut] = (0, useState)(null),
    // ルール設定を開いた元の画面。「戻る」はここへ帰る。
    // 対戦の種類(o)から推測すると、CPU対戦とルームの「オフラインで対戦」が
    // どちらも "game" なので見分けられず、CPUの戻り先がフレンド対戦になる
    [rulesFrom, setRulesFrom] = (0, useState)("matching"),
    // 運営に使用停止にされたとき、名前を決め直す画面に出す一言
    [banNotice, setBanNotice] = (0, useState)(null);
  // 場面に合った曲へ。対局中は GameCore のほうが決めるので、ここは触らない
  useScreenBgm(e);
  // 起動時に、登録した人の台帳へ自分を置き直す。使用停止なら名前を捨てる
  useEffect(() => {
    const me = loadProfile();
    if (!me.id || !me.name) return;
    // 使用頻度のミッション用に、1日1回だけ数える
    touchDay();
    let gone = false;
    syncPlayer(me).then((banned) => {
      if (gone || !banned) return;
      resetAccount();
      setBanNotice(
        "運営により、この名前は使えなくなりました。新しい名前を決めてください。",
      );
      setNamed(false);
    });
    return () => {
      gone = true;
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [e]);
  function s() {
    (u(null), m(!1), setTut(null), t("home"));
  }
  // 上の「トッタリー」から。ルーム作成の予約(p)も引きずらないように
  function goHome() {
    (w(!1), s());
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
        <NameSetupScreen
          notice={banNotice}
          onDone={() => {
            setBanNotice(null);
            setNamed(!0);
          }}
        />
      </GameShell>
    );
  if (e === "game") {
    // 対局中に出す名前。相手の名前が分からない席は色名のまま
    let mine = loadProfile(),
      me = mine.name || null,
      names = a
        ? a.names || [null, null]
        : d
          ? [me, tut ? null : "CPU"]
          : [null, null],
      icons = a
        ? a.icons || [null, null]
        : d
          ? [mine.icon, null]
          : [null, null],
      // 称号はマッチした相手と交わすもの。CPU戦・同じ端末では渡さない
      titles = a ? a.titles || [null, null] : [null, null],
      skins = a
        ? (a.skins || [{}, {}]).map(sanitizeLoadout)
        : tut
          ? [{}, {}]
          : d
            ? [collection.equipped, {}]
            : [collection.equipped, collection.equipped];
    return (
      <SeatsProvider value={{ names, icons, titles, skins }}>
        <GameCore
          network={a}
          boardSize={tut ? tut.boardSize : i}
          cpu={d}
          tutorial={tut}
          onExit={s}
        />
      </SeatsProvider>
    );
  }
  return (
    <GameShell
      showRules={l}
      setShowRules={n}
      onHome={e === "home" ? null : goHome}
      onBack={e === "skins" ? () => t("menu") : undefined}
    >
      {
        {
          home: (
            <HomeScreen onStart={() => t("menu")} onSkins={() => t("skins")} />
          ),
          skins: <SkinsScreen onBack={() => t("menu")} />,
          menu: (
            <MenuScreen
              onPlay={() => t("matching")}
              onTutorial={() => {
                (u(null), t("tutorial"));
              }}
              onSkins={() => t("skins")}
              onBattlePass={() => t("battlepass")}
              onMissions={() => t("missions")}
              onRanking={() => t("ranking")}
            />
          ),
          matching: (
            <MatchingScreen
              onBack={() => t("menu")}
              onOnline={() => {
                (u(null),
                  m(!1),
                  r("online"),
                  setRulesFrom("matching"),
                  t("rules"));
              }}
              onFriend={() => {
                (u(null), m(!1), t("room"));
              }}
              onCpu={() => {
                (u(null),
                  m(!0),
                  setTut(null),
                  r("game"),
                  setRulesFrom("matching"),
                  t("rules"));
              }}
            />
          ),
          ranking: <RankingScreen onBack={() => t("menu")} />,
          missions: <MissionsScreen onBack={() => t("menu")} />,
          battlepass: <BattlePassScreen onBack={() => t("menu")} />,
          tutorial: (
            <TutorialSelect
              onBack={() => t("menu")}
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
                (w(!1),
                  u(null),
                  m(!1),
                  r("game"),
                  setRulesFrom("room"),
                  t("rules"));
              }}
              onBeforeRoom={() => {
                (r("room"), setRulesFrom("room"), t("rules"));
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
              onBack={() => t(rulesFrom)}
              backLabel={
                rulesFrom === "room"
                  ? "フレンド対戦に戻る"
                  : "対戦相手を選ぶに戻る"
              }
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
