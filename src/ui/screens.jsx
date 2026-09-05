import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  Grid,
  Mail,
  Ticket,
} from "../icons.jsx";
import {
  LOBBY_TTL,
  createRoom,
  deleteLobbyPath,
  deleteRoom,
  generateRoomCode,
  joinRoom,
  leaveRoom,
  readLobby,
  readLobbyPath,
  readRoom,
  writeLobby,
  updateRoom,
} from "../net/firebase.js";
import { GameCore } from "./game.jsx";
import { RulesPanel } from "./guides.jsx";
import { SettingsModal } from "./overlays.jsx";
import { TutorialSelect } from "./tutorial.jsx";
import { RankingScreen } from "./ranking.jsx";
import {
  hasName,
  isTestPlay,
  loadProfile,
  levelProgress,
} from "../game/profile.js";
import { NameEditModal, NameSetupScreen } from "./account.jsx";
import { titleOf } from "../game/titles.js";
import { PlayerIcon } from "./playericon.jsx";
import { adoptUid, touchDay } from "../game/profile.js";
import { dropOldRows, syncPlayer } from "../net/players.js";
import { publishRank } from "../net/ranking.js";
import { ensureAuth } from "../net/auth.js";
import { SeatsProvider } from "./names.jsx";
import STYLES from "../styles.css";
import SKIN_STYLES from "../skins/styles.css";
import { SkinsScreen } from "./skins.jsx";
import { MissionsScreen } from "./missions.jsx";
import { BattlePassScreen } from "./battlepass.jsx";
import { LettersScreen, useUnreadLetters } from "./letters.jsx";
import { LoginBonus } from "./loginbonus.jsx";
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

/**
 * 設定を開く手。GameShell が持っている設定の札を、
 * その下に置かれた画面(ホームなど)からも開けるようにする。
 */
const OpenSettings = createContext(null);
export const useOpenSettings = () => useContext(OpenSettings);

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
  // 上の「Tottery」を押すとタイトルへ。対局中は onBack と同じ扱いにして、
  // 「対局をやめますか?」の確認を通す(黙って抜けると対局が飛ぶ)
  let goHome = onHome || onBack;
  return (
    <div className={`tottery-root ${focusButton ? "focus-button" : ""}`}>
      <style>{STYLES + SKIN_STYLES}</style>
      <header className="top-bar">
        {/* 戻る釦が無いときは空のまま。飾りの王冠を置いていたが、
            押せそうに見えて何も起きないので外した。
            桁は残す(消すと真ん中の題がずれる) */}
        <div className="top-left">
          {onBack && (
            <button
              className="icon-btn plain"
              onClick={onBack}
              aria-label="戻る"
            >
              <ArrowLeft size={20} />
            </button>
          )}
        </div>
        {goHome ? (
          <button
            className="brand brand-link"
            onClick={goHome}
            aria-label="タイトルへ戻る"
          >
            {title || "Tottery"}
          </button>
        ) : (
          <span className="brand">{title || "Tottery"}</span>
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
        <OpenSettings.Provider value={() => f(!0)}>
          {children}
        </OpenSettings.Provider>
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
/**
 * タイトル。押すところは「ゲームスタート」だけにしてある。
 * スキンはこの次のホームから入る。ここに並べると、
 * 遊び始める前に寄り道の口が見えてしまう。
 */
export function HomeScreen({ onStart }) {
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
    </div>
  );
}
/**
 * ホームの一番上に出る、自分の札。
 *
 * 「いまの自分」(名前・称号・レベル・持っているチケット)をひと目で出す。
 * 押すと設定が開く。名前やアイコンを変えるのはそこ。
 */
function HomeSelf({ profile, tickets }) {
  const openSettings = useOpenSettings();
  const progress = levelProgress(profile);
  return (
    <button
      className="home-self"
      onClick={openSettings || void 0}
      aria-label="自分の設定を開く"
    >
      <PlayerIcon icon={profile.icon} name={profile.name} size="md" />
      <span className="home-self-id">
        <b>{profile.name || "名無し"}</b>
        <small>{titleOf(profile).name}</small>
      </span>
      <span className="home-self-right">
        <span className="home-lv">
          Lv <b>{progress.level}</b>
        </span>
        <span className="home-tickets">
          <Ticket size={13} />
          {tickets}
        </span>
        <ArrowRight size={14} className="home-self-more" />
      </span>
      <span className="home-self-bar">
        <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
      </span>
    </button>
  );
}

/** ホームの四角い入り口。絵柄を上、名前を下に置く */
function HomeTile({ tone, icon, label, note, badge, onClick }) {
  return (
    <button className={`home-tile home-tile-${tone}`} onClick={onClick}>
      <span className="home-tile-icon">{icon}</span>
      <b>{label}</b>
      <small>{note}</small>
      {badge > 0 && (
        <span className="menu-badge">{badge > 99 ? "99+" : badge}</span>
      )}
    </button>
  );
}

/**
 * ホーム。タイトルの「ゲームスタート」の次に出る。
 *
 * 片手で持った電話で見るところなので、並べ方に軽重をつけた。
 * 一番やってほしい「対戦する」を大きく、次に「チュートリアル」、
 * あとは四角い入り口を2つずつ。ランキングは下に控えめに置く。
 * 7つを同じ帯で並べると、どれも同じ重さに見えて選べなくなる。
 */
export function MenuScreen({
  onPlay,
  onTutorial,
  onSkins,
  onBattlePass,
  onMissions,
  onRanking,
  onLetters,
}) {
  const profile = loadProfile();
  // 受け取れるミッションの数と、未読のお知らせ。入り口に印を出す
  const ready = claimableCount(profile);
  const unread = useUnreadLetters();
  const collection = useCollection();
  return (
    <div className="home-wrap">
      {/* その日のぶんがまだなら、ここに着いたときに札が出る */}
      <LoginBonus />

      {/* 運営からのお知らせ。読み物なので入り口は細く、一番上に置く */}
      <button className="home-news" onClick={onLetters}>
        <Mail size={15} />
        運営からのお知らせ
        {unread > 0 && <span className="home-news-count">{unread}</span>}
        <ArrowRight size={13} className="home-news-arrow" />
      </button>

      <HomeSelf profile={profile} tickets={collection.tickets} />

      <button className="home-hero" onClick={onPlay}>
        <span className="home-hero-icon">
          <Globe size={34} />
        </span>
        <span className="home-hero-label">
          <b>対戦する</b>
          <small>オンライン・フレンド・CPU</small>
        </span>
        <ArrowRight size={20} className="home-hero-arrow" />
      </button>

      <button className="home-wide" onClick={onTutorial}>
        <span className="home-wide-icon">
          <Book size={22} />
        </span>
        <span className="home-wide-label">
          <b>チュートリアル</b>
          <small>ルールとカードの効果を学ぶ</small>
        </span>
        <ArrowRight size={16} className="home-wide-arrow" />
      </button>

      {/* 左上は次に増やすものの席。空けたままにしてある */}
      <div className="home-grid">
        <div className="home-slot" aria-hidden="true" />
        <HomeTile
          tone="missions"
          icon={<Check size={26} />}
          label="ミッション"
          note="褒美を受け取る"
          badge={ready}
          onClick={onMissions}
        />
        <HomeTile
          tone="pass"
          icon={<Grid size={26} />}
          label="バトルパス"
          note="マスを埋める"
          onClick={onBattlePass}
        />
        <HomeTile
          tone="skins"
          icon={<Sparkle size={26} />}
          label="ガチャ・装備"
          note="英雄を召喚する"
          onClick={onSkins}
        />
      </div>

      <button className="home-quiet" onClick={onRanking}>
        <Crown size={16} />
        ランキングを見る
        <ArrowRight size={14} />
      </button>
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
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={18} /> ホームに戻る
      </button>
    </div>
  );
}

export function RandomMatchScreen({ onBack, onRoomReady }) {
  const loadout = useRef(mySkins()).current;
  let [l, n] = (0, useState)("searching"),
    [a, u] = (0, useState)(""),
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
        // 待ち合わせの掲示は uid で名乗る。ルール側が「持ち主だけが動かせる」
        // ようにしてあるので、端末ごとの仮のidでは掲示できない
        let auth = await ensureAuth();
        if (o.current) return;
        if (!auth) {
          (u(
            "サインインできませんでした。通信状況を確認して、もう一度お試しください。",
          ),
            n("error"));
          return;
        }
        let r = auth.uid,
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
          // 先に部屋の席をとる。部屋の中身は席についてからでないと読めないし、
          // 取れなければ何も汚さずに次の掲示へ行ける。
          // 逆に掲示へ先に名乗ると、席が取れなかったときに名乗りだけが残り、
          // 待っている人は「来たのに始まらない」ことになる(掲示の名乗りは
          // 一度きりで、こちらからは取り消せない)
          let seat = await joinRoom(z);
          if (o.current) return;
          if (!seat.ok) continue;
          let g = await writeLobby(`/${z}/guest`, r);
          if (o.current) return;
          if (!g.ok) {
            await leaveRoom(z);
            continue;
          }
          let A = await readLobbyPath(`/${z}/guest`);
          if (o.current) return;
          if (!A.ok || A.data !== r) {
            // 掲示は他の人に取られた。座った席は空けて次へ
            await leaveRoom(z);
            continue;
          }
          {
            let b = await readRoom(z);
            if (o.current) return;
            if (!b.ok) {
              (await leaveRoom(z), u(b.error), n("error"));
              return;
            }
            if (
              (await updateRoom(z, {
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
          p = await createRoom(v, {
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
          N = await createRoom(x, {
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
      x = await createRoom(P, {
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
    // 先に席をとる。部屋の中身は席についてからでないと読めない。
    // 断られたら、その合言葉の部屋が無いか、もう二人そろっている
    let seat = await joinRoom(P);
    if (!seat.ok) {
      (p(!1),
        s("そのコードのルームは見つからないか、既に対戦相手が参加しています"));
      return;
    }
    let x = await readRoom(P);
    if (!x.ok) {
      (await leaveRoom(P), p(!1), s(x.error));
      return;
    }
    // 席をとれたからといって部屋があるとは限らない(締める前のルールでは
    // 存在しない部屋にも座れてしまう)。中身を見て確かめる
    if (!x.data || (!x.data.createdAt && !x.data.hostName)) {
      (await leaveRoom(P),
        p(!1),
        s("そのコードのルームは見つかりませんでした"));
      return;
    }
    if (x.data.guestPresent) {
      (await leaveRoom(P), p(!1), s("このルームは既に対戦相手が参加済みです"));
      return;
    }
    let N = await updateRoom(P, {
      guestPresent: !0,
      guestName: myName(),
      guestIcon: myIcon(),
      guestTitle: myTitle(),
      guestRating: myRating(),
      guestSkins: loadout,
    });
    if ((p(!1), !N.ok)) {
      (await leaveRoom(P), s(N.error));
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
    // 運営に使用停止にされたかどうか
    [banned, setBanned] = (0, useState)(!1);
  // 場面に合った曲へ。対局中は GameCore のほうが決めるので、ここは触らない
  useScreenBgm(e);
  // 起動時に、登録した人の台帳へ自分を置き直す。使用停止なら名前を捨てる
  useEffect(() => {
    let gone = false;
    (async () => {
      // 先に Firebase のサインインを通す。サーバーの記録は uid を鍵に持つので、
      // 名前がまだ無い人でもここは通す(名前を決めた瞬間に uid で載るように)。
      // 通信できなければ null が返る。そのときは今までどおり素で進む
      const auth = await ensureAuth();
      const me = loadProfile();
      if (auth && me.id && me.id !== auth.uid) {
        // 端末が名乗っていた古い鍵から、Firebase の uid へ持ち替える。
        // 名前・持ち点・戦績は端末の中にあるので、鍵が変わっても失われない
        const oldId = me.id;
        adoptUid(auth.uid);
        // 先に新しい鍵で載せ直してから、古い鍵の行を消す。
        // 逆順だと、途中で落ちたときランキングから消えたままになる
        const now = loadProfile();
        await syncPlayer(now);
        publishRank(now);
        dropOldRows(oldId);
        if (gone) return;
      }
      const now = loadProfile();
      if (!now.id || !now.name) return;
      // 使用頻度のミッション用に、1日1回だけ数える
      touchDay();
      if (gone) return;
      const stopped = await syncPlayer(loadProfile());
      if (gone || !stopped) return;
      // 名前を捨てて決め直させてはいけない。停止の印は uid に付くので、
      // 何度名乗り直しても同じ印が見つかり、名前を決める画面から
      // 出られなくなる。ここで止めて、理由を出す
      setBanned(!0);
    })();
    return () => {
      gone = true;
    };
    // 名前を決めた直後にも通す(初回の記録を取りこぼさないため)
  }, [named]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [e]);
  function s() {
    (u(null), m(!1), setTut(null), t("home"));
  }
  // 上の「Tottery」から。ルーム作成の予約(p)も引きずらないように
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
  //
  // 使用停止は名前ではなく口座に付く。名前を決め直させても同じ印が
  // 残るので、ここで行き止まりにする
  if (banned)
    return (
      <GameShell>
        <div className="center-stage">
          <h2>ご利用を停止しています</h2>
          <p className="hint">
            他の方への迷惑行為が確認されたため、このアカウントでは Tottery
            をご利用いただけません。
          </p>
          <p className="hint">
            心当たりがない場合や、内容についてのお問い合わせは、
            ストアの製品ページに記載の連絡先までご連絡ください。
          </p>
        </div>
      </GameShell>
    );
  if (!named)
    return (
      <GameShell showRules={l} setShowRules={n}>
        <NameSetupScreen onDone={() => setNamed(!0)} />
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
          home: <HomeScreen onStart={() => t("menu")} />,
          skins: (
            <SkinsScreen
              onBack={() => t("menu")}
              onBattlePass={() => t("battlepass")}
            />
          ),
          menu: (
            <MenuScreen
              onPlay={() => t("matching")}
              onTutorial={() => {
                (u(null), t("tutorial"));
              }}
              onSkins={() => t("skins")}
              onBattlePass={() => t("battlepass")}
              onMissions={() => t("missions")}
              onLetters={() => t("letters")}
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
          battlepass: (
            <BattlePassScreen
              onBack={() => t("menu")}
              onSkins={() => t("skins")}
            />
          ),
          letters: <LettersScreen onBack={() => t("menu")} />,
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
