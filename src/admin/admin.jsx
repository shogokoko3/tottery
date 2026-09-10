/** 運営専用の管理画面。入場時のサーバー照合とFirebaseの権限でデータを保護する。 */
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  API_KEY,
  OPERATOR_UID,
  authedFetch,
  signInAsOperator,
  signOut,
  useOperatorSlot,
} from "../net/auth.js";

// 合言葉の置き場をゲーム本体と分ける。同じオリジンなので、分けないと
// あとから開いたほうが先の合言葉を上書きしてしまう
useOperatorSlot();
import STYLES from "../styles.css";
import ADMIN_STYLES from "./admin.css";
import { DB_URL } from "../net/firebase.js";
import { findIcon } from "../game/icons.js";
import { rankTitle, ratingWithWorld } from "../game/rating.js";
import { titleNameOf } from "../game/titles.js";
import { deletePlayer, readPlayers, setBanned } from "../net/players.js";
import { deleteLetter, normalizeLetter, sendLetter } from "../net/letters.js";
import { giftsLabel } from "../game/gifts.js";
import { TITLES } from "../game/titles.js";
import { ICONS } from "../game/icons.js";
import { SKINS } from "../skins/catalog.js";
import { verifyOperatorSession, readAdminSeason } from "./session.js";
import {
  isRankedRecord,
  worldGamesOf,
  reconciliationPlan,
} from "../net/profile-record.js";
import { seasonName } from "../game/season.js";

const TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_r, reject) =>
      setTimeout(
        () => reject(new Error("通信が8秒以内に応答しませんでした")),
        ms,
      ),
    ),
  ]);
}

// この2本だけ authed を通していなかった。ルールを締めると管理画面の
// 半分(待ち合わせ・お知らせ)が読めなくなるので、他と同じ口に揃える
async function getJson(path) {
  const res = await withTimeout(
    authedFetch(`${DB_URL}/${path}.json`),
    TIMEOUT_MS,
  );
  if (res.status === 401)
    throw new Error(
      `${path} は読めません(運営としてサインインしていないか、ルールで閉じています)`,
    );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function remove(path) {
  const res = await withTimeout(
    authedFetch(`${DB_URL}/${path}.json`, { method: "DELETE" }),
    TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

const DAY = 24 * 60 * 60 * 1000;

/** いつのことか。読む人が数えなくて済むように */
function ago(ms) {
  if (!ms) return "—";
  const d = Date.now() - ms;
  if (d < 60 * 1000) return "たった今";
  if (d < 60 * 60 * 1000) return `${Math.floor(d / 60000)}分前`;
  if (d < DAY) return `${Math.floor(d / 3600000)}時間前`;
  return `${Math.floor(d / DAY)}日前`;
}

function when(ms) {
  return ms ? new Date(ms).toLocaleString("ja-JP") : "—";
}

const SORTS = {
  rating: { label: "持ち点", by: (a, b) => (b.rating || 0) - (a.rating || 0) },
  at: { label: "最終更新", by: (a, b) => (b.at || 0) - (a.at || 0) },
  plays: { label: "対局数", by: (a, b) => (b.plays || 0) - (a.plays || 0) },
  name: {
    label: "名前",
    by: (a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "ja"),
  },
};

/**
 * 添付を1つ選ぶ。種類によって、選ぶものと数を出し分ける。
 */
function GiftPicker({ gift, onChange, onRemove }) {
  const kinds = [
    ["ticket", "ガチャチケット"],
    ["ether", "エーテル"],
    ["xp", "経験値"],
    ["title", "称号"],
    ["icon", "アイコン"],
    ["skin", "スキン"],
  ];
  const lists = { title: TITLES, icon: ICONS, skin: SKINS };
  const nameOf = (o) => o.name || o.label;
  return (
    <div className="letter-gift-row">
      <select
        className="admin-input"
        value={gift.type}
        onChange={(e) => {
          const type = e.target.value;
          const list = lists[type];
          onChange(
            list
              ? { type, id: list[0].id }
              : {
                  type,
                  amount: type === "xp" ? 100 : type === "ether" ? 100 : 1,
                },
          );
        }}
      >
        {kinds.map(([v, label]) => (
          <option value={v} key={v}>
            {label}
          </option>
        ))}
      </select>
      {lists[gift.type] ? (
        <select
          className="admin-input"
          value={gift.id}
          onChange={(e) => onChange({ ...gift, id: e.target.value })}
        >
          {lists[gift.type].map((o) => (
            <option value={o.id} key={o.id}>
              {nameOf(o)}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="admin-input"
          type="number"
          min="1"
          value={gift.amount}
          onChange={(e) =>
            onChange({
              ...gift,
              amount: Math.max(1, Number(e.target.value) || 1),
            })
          }
        />
      )}
      <button className="btn btn-ghost btn-small" onClick={onRemove}>
        外す
      </button>
    </div>
  );
}

/** 運営用のメールアドレスとパスワードで入場する。 */
function OperatorGate({ onDone, notice }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice || null);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const a = await signInAsOperator(email.trim(), password);
      // 通ったからといって運営とは限らない。ルールに書いてある uid と
      // 違うなら、この画面では何も読めない。入る前にそう伝える
      if (a.uid !== OPERATOR_UID) {
        signOut();
        setError(
          "このアカウントには運営権限がありません。運営用のメールアドレスでサインインしてください。",
        );
        return;
      }
      const uid = await verifyOperatorSession();
      if (!uid) throw new Error("もう一度サインインしてください。");
      onDone(uid);
    } catch (err) {
      setError((err && err.message) || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tottery-root admin-root">
      <style>{STYLES}</style>
      <style>{ADMIN_STYLES}</style>
      <header className="top-bar">
        <div className="top-left" />
        <span className="brand">トッタリー 管理</span>
        <div className="top-right" />
      </header>
      <main className="stage admin-stage admin-login">
        <section className="admin-card">
          <h2>運営としてサインイン</h2>
          <p className="hint">
            プレイヤーの確認・利用停止・お知らせ配信を行えます。
            登録済みの運営用メールアドレスとパスワードを入力してください。
          </p>
          {!API_KEY && (
            <p className="admin-warn">
              API キーが入っていません。src/net/auth.js の API_KEY
              を埋めてください。
            </p>
          )}
          <form className="letter-form" onSubmit={submit}>
            <label className="letter-field">
              <span>メールアドレス</span>
              <input
                className="admin-input"
                type="email"
                required
                autoCapitalize="none"
                spellCheck={false}
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="letter-field">
              <span>パスワード</span>
              <input
                className="admin-input"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              className="btn btn-primary btn-wide"
              disabled={busy || !email || !password}
            >
              {busy ? "確かめています…" : "サインイン"}
            </button>
          </form>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <a className="admin-game-link" href="/">
            ゲームへ戻る
          </a>
        </section>
      </main>
    </div>
  );
}

function AdminApp() {
  const [uid, setUid] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    let gone = false;
    verifyOperatorSession()
      .then(
        (id) => {
          if (!gone) setUid(id);
        },
        () => {
          if (!gone)
            setNotice(
              "セッションを確認できませんでした。もう一度サインインしてください。",
            );
        },
      )
      .finally(() => {
        if (!gone) setChecking(false);
      });
    return () => {
      gone = true;
    };
  }, []);
  if (checking)
    return (
      <div className="tottery-root admin-root">
        <style>{STYLES + ADMIN_STYLES}</style>
        <main className="stage admin-login">
          <p role="status">運営のログイン状態を確認しています…</p>
        </main>
      </div>
    );
  if (!uid)
    return (
      <OperatorGate
        notice={notice}
        onDone={(id) => {
          setNotice(null);
          setUid(id);
        }}
      />
    );
  return (
    <AdminDashboard
      key={uid}
      onSignOut={() => {
        signOut();
        setUid(null);
        setNotice(null);
      }}
    />
  );
}

function AdminDashboard({ onSignOut }) {
  const [ranks, setRanks] = useState(null);
  const [season, setSeason] = useState(null);
  const [seasonError, setSeasonError] = useState(null);
  const [players, setPlayers] = useState(null);
  const [playersError, setPlayersError] = useState(null);
  const [lettersError, setLettersError] = useState(null);
  const [ranksError, setRanksError] = useState(null);
  const [lobbyError, setLobbyError] = useState(null);
  const [lobby, setLobby] = useState(null);
  // 対局の部屋。勝敗のあと片付けられなかったものが残ることがある
  const [rooms, setRooms] = useState(null);
  const [roomsError, setRoomsError] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rating");
  const [loadedAt, setLoadedAt] = useState(null);
  // 押して開いている行。{ kind, id }
  const [detail, setDetail] = useState(null);
  // 手紙。宛先が null なら全員宛て
  const [letters, setLetters] = useState(null);
  const [draft, setDraft] = useState({
    to: "all",
    subject: "",
    body: "",
    gifts: [],
  });

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const [r, l, p, m, monthly, rm] = await Promise.all([
        // 1つでも投げると Promise.all ごと落ち、他の一覧まで出なくなる。
        // 「読めなかった」も画面に出したいので、全部に受け皿を付ける
        getJson("ranks").then(
          (rows) => ({ rows }),
          (e) => ({ error: (e && e.message) || String(e) }),
        ),
        getJson("lobby").then(
          (rows) => ({ rows }),
          (e) => ({ error: (e && e.message) || String(e) }),
        ),
        // 登録した人の台帳。ルールがまだなら、そこだけ知らせて他は出す
        readPlayers().then(
          (rows) => ({ rows }),
          (e) => ({ error: (e && e.message) || String(e) }),
        ),
        // お知らせは置き場が2つ(全員宛て / 宛先ごと)。運営はどちらも読める
        getJson("letters").then(
          (tree) => ({ tree }),
          (e) => ({ error: (e && e.message) || String(e) }),
        ),
        readAdminSeason().then(
          (data) => ({ data }),
          (e) => ({ error: e.message }),
        ),
        getJson("rooms").then(
          (rows) => ({ rows }),
          (e) => ({ error: (e && e.message) || String(e) }),
        ),
      ]);
      setRoomsError((rm && rm.error) || null);
      setRooms(
        Object.entries((rm && rm.rows) || {})
          .map(([code, row]) => {
            const r = row && typeof row === "object" ? row : {};
            return {
              code,
              createdAt: Number(r.createdAt) || 0,
              host: (r.seats && r.seats.host) || null,
              guest: (r.seats && r.seats.guest) || null,
              acts: r.acts ? Object.keys(r.acts).length : 0,
            };
          })
          .sort((a, b) => a.createdAt - b.createdAt),
      );
      setSeason(monthly.data || null);
      setSeasonError(monthly.error || null);
      setRanks(
        Object.entries((r && r.rows) || {}).map(([id, row]) => ({
          id,
          ...row,
        })),
      );
      setRanksError((r && r.error) || null);
      setLobbyError((l && l.error) || null);
      // letters/all/<id> と letters/to/<uid>/<id> を1本にならす
      {
        const tree = (m && m.tree) || {};
        const rows = [
          ...Object.entries(tree.all || {}).map(([id, row]) =>
            normalizeLetter(id, row),
          ),
          ...Object.entries(tree.to || {}).flatMap(([uid, byId]) =>
            Object.entries(byId || {}).map(([id, row]) =>
              normalizeLetter(id, { ...row, to: uid }),
            ),
          ),
        ];
        setLetters(rows.filter(Boolean).sort((a, b) => b.at - a.at));
      }
      setPlayers(p.rows || []);
      setPlayersError(p.error || null);
      setLettersError((m && m.error) || null);
      setLobby(
        Object.entries((l && l.rows) || {}).map(([code, row]) => ({
          code,
          ...(row && typeof row === "object" ? row : { value: row }),
        })),
      );
      setLoadedAt(Date.now());
    } catch (e) {
      setError((e && e.message) || String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function removeRank(row) {
    if (
      !window.confirm(
        `「${row.name || row.id}」の成績をサーバーから消します。\n本人の端末の記録は消えず、次の持ち点つき対局でまた載ります。`,
      )
    )
      return;
    setBusy(true);
    try {
      await remove(`ranks/${row.id}`);
      await load();
    } catch (e) {
      setError((e && e.message) || String(e));
      setBusy(false);
    }
  }

  async function removePlayer(row) {
    if (
      !window.confirm(
        `「${row.name || row.id}」をサーバーの台帳から消します。\n端末の記録は消えず、次に開いたときにまた載ります。二度と載せないなら「使用停止」にしてください。`,
      )
    )
      return;
    setBusy(true);
    try {
      await deletePlayer(row.id);
      await load();
    } catch (e) {
      setError((e && e.message) || String(e));
      setBusy(false);
    }
  }

  async function toggleBan(row) {
    const on = !row.banned;
    if (
      !window.confirm(
        on
          ? `「${row.name || row.id}」を使用停止にします。\nこの口座は次に開いたときから遊べなくなり、順位表からも消えます。\n端末のデータを消して新しく始め直されると、この停止は外れます。`
          : `「${row.name || row.id}」の使用停止を解きます。`,
      )
    )
      return;
    setBusy(true);
    try {
      await setBanned(row.id, on);
      await load();
    } catch (e) {
      setError((e && e.message) || String(e));
      setBusy(false);
    }
  }

  async function send() {
    if (busy) return;
    if (!draft.subject.trim()) {
      setError("件名を入れてください");
      return;
    }
    const who =
      draft.to === "all"
        ? "全員"
        : `「${(players || []).find((p) => p.id === draft.to)?.name || draft.to}」`;
    if (
      !window.confirm(
        `${who}にお知らせを出します。\n\n件名: ${draft.subject}\n添付: ${giftsLabel(draft.gifts)}\n\n出したあとは、受け取った人からは取り消せません。`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await sendLetter(draft);
      setDraft({ to: "all", subject: "", body: "", gifts: [] });
      await load();
    } catch (e) {
      setError((e && e.message) || String(e));
      setBusy(false);
    }
  }

  async function removeLetter(l) {
    if (
      !window.confirm(
        `お知らせ「${l.subject}」を取り消します。\nまだ受け取っていない人には届かなくなります。受け取り済みの人からは戻せません。`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteLetter(l.id, l.to);
      await load();
    } catch (e) {
      setError((e && e.message) || String(e));
      setBusy(false);
    }
  }

  /**
   * 片付け残った部屋。ゲスト無しで3分、両者ありで24時間を過ぎたものを「古い」と見る
   * (ルールの、誰でも消してよい条件と同じ線)
   */
  function staleRoom(r, now) {
    if (!r.createdAt) return true;
    if (r.createdAt < now - 86400000) return true;
    return !r.guest && r.createdAt < now - 180000;
  }

  async function removeRoom(row) {
    if (!window.confirm(`部屋 ${row.code} をサーバーから消します。`)) return;
    setBusy(true);
    try {
      await remove(`rooms/${row.code}`);
      await load();
    } catch (e) {
      setError((e && e.message) || String(e));
      setBusy(false);
    }
  }

  async function sweepRooms() {
    const now = Date.now();
    const stale = (rooms || []).filter((r) => staleRoom(r, now));
    if (!stale.length) return;
    if (
      !window.confirm(
        `古い部屋 ${stale.length} 件をサーバーから消します。\n(相手待ちのまま3分、または作られてから24時間を過ぎたもの)`,
      )
    )
      return;
    setBusy(true);
    try {
      for (const r of stale) await remove(`rooms/${r.code}`);
      await load();
    } catch (e) {
      setError((e && e.message) || String(e));
      setBusy(false);
    }
  }

  async function removeLobby(row) {
    if (!window.confirm(`待ち合わせ ${row.code} をサーバーから消します。`))
      return;
    setBusy(true);
    try {
      await remove(`lobby/${row.code}`);
      await load();
    } catch (e) {
      setError((e && e.message) || String(e));
      setBusy(false);
    }
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (ranks || [])
      .filter(isRankedRecord)
      .filter(
        (r) =>
          !needle ||
          String(r.name || "")
            .toLowerCase()
            .includes(needle) ||
          r.id.toLowerCase().includes(needle),
      )
      .sort(SORTS[sort].by);
  }, [ranks, q, sort]);

  const found = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (players || [])
      .filter(
        (r) =>
          !needle ||
          String(r.name || "")
            .toLowerCase()
            .includes(needle) ||
          r.id.toLowerCase().includes(needle),
      )
      .sort(SORTS[sort].by);
  }, [players, q, sort]);
  const registered = (players || []).length;
  const banned = (players || []).filter((r) => r.banned).length;
  const active7p = (players || []).filter(
    (r) => r.at && Date.now() - r.at < 7 * DAY,
  ).length;
  const world = worldGamesOf(ranks || []);
  const differences = reconciliationPlan(
    Object.fromEntries(
      (players || []).filter((p) => !p.banned).map((p) => [p.id, p]),
    ),
    Object.fromEntries((ranks || []).map((r) => [r.id, r])),
  );
  const total = (ranks || []).filter(isRankedRecord).length;
  const active7 = (ranks || []).filter(
    (r) => r.at && Date.now() - r.at < 7 * DAY,
  ).length;
  const active30 = (ranks || []).filter(
    (r) => r.at && Date.now() - r.at < 30 * DAY,
  ).length;

  // 押して開いている行。{ kind: "player"|"rank"|"lobby", id }
  const opened =
    detail &&
    (detail.kind === "player"
      ? (players || []).find((r) => r.id === detail.id)
      : detail.kind === "rank"
        ? (ranks || []).find((r) => r.id === detail.id)
        : (lobby || []).find((r) => r.code === detail.id));

  /** 一覧の1行。名前(または合言葉)と、そえ書きだけを出す */
  const Row = ({ id, kind, name, sub, note, dim }) => (
    <button
      className={`admin-row ${dim ? "is-dim" : ""}`}
      onClick={() => setDetail({ kind, id })}
    >
      <span className="admin-row-main">
        <b>{name}</b>
        <small>{sub}</small>
      </span>
      <span className="admin-row-side">
        {note && <em>{note}</em>}
        <span aria-hidden="true">›</span>
      </span>
    </button>
  );

  /** 詳細の1項目 */
  const Line = ({ label, children }) => (
    <div className="admin-line">
      <span>{label}</span>
      <b>{children}</b>
    </div>
  );

  return (
    <div className="tottery-root admin-root">
      <style>{STYLES}</style>
      <style>{ADMIN_STYLES}</style>
      <header className="top-bar">
        <div className="top-left" />
        <span className="brand">トッタリー 管理</span>
        <div className="top-right">
          <button className="btn btn-ghost btn-small" onClick={onSignOut}>
            サインアウト
          </button>
        </div>
      </header>
      <main className="stage admin-stage">
        <section className="admin-card">
          <h2>運営管理</h2>
          <p className="hint">
            プレイヤーを選ぶと戦績や登録日を確認できます。お知らせは全員または指定した相手に配信できます。
          </p>
          <nav className="admin-nav" aria-label="管理メニュー">
            <a href="#admin-players">プレイヤー</a>
            <a href="#admin-ranks">9×9通算</a>
            <a href="#admin-season">月間成績</a>
            <a href="#admin-letters">お知らせ・補填</a>
            <a href="#admin-lobby">待ち合わせ</a>
            <a href="#admin-rooms">対局の部屋</a>
          </nav>
          <details className="admin-help">
            <summary>操作とデータについて</summary>
            <p>
              「使用停止」はそのアカウントの利用を止めます。「消す」は台帳の行だけを削除し、本人が起動すると再登録される場合があります。
            </p>
            <p>
              所持品と進捗の多くはプレイヤーの端末内に保存されています。所持品・進捗の全データ復元には対応していません。月間成績はサーバーで確認済みの対局だけを表示します。
            </p>
          </details>
        </section>

        <section className="admin-card" id="admin-players">
          <div className="admin-head">
            <h2>登録した人</h2>
            <button
              className="btn btn-ghost btn-small"
              onClick={load}
              disabled={busy}
            >
              {busy ? "読み込み中…" : "更新"}
            </button>
          </div>
          <div className="stat-row">
            <div className="stat">
              <b>{players ? registered : "—"}</b>
              <span>登録</span>
            </div>
            <div className="stat">
              <b>{players ? active7p : "—"}</b>
              <span>7日以内</span>
            </div>
            <div className="stat">
              <b>{players ? banned : "—"}</b>
              <span>使用停止</span>
            </div>
          </div>
          {playersError && <p className="admin-error">{playersError}</p>}
          <div className="admin-tools">
            <input
              className="admin-input"
              placeholder="名前か端末idで探す"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="admin-input"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {Object.entries(SORTS).map(([k, v]) => (
                <option value={k} key={k}>
                  {v.label}の順
                </option>
              ))}
            </select>
          </div>
          <div className="admin-rows">
            {found.map((r) => (
              <Row
                key={r.id}
                id={r.id}
                kind="player"
                name={r.name || "(名無し)"}
                sub={`${titleNameOf(r.title) || "—"} · ${ago(r.at)}`}
                note={r.banned ? "使用停止" : ""}
                dim={r.banned}
              />
            ))}
            {players && found.length === 0 && (
              <p className="hint">
                {registered === 0
                  ? "まだ誰も登録していません"
                  : "見つかりません"}
              </p>
            )}
          </div>
        </section>

        <section className="admin-card" id="admin-ranks">
          <h2>9×9オンライン・通算成績</h2>
          <p className="hint">
            9×9オンライン対戦が1戦以上あるプレイヤーを掲載します。持ち点はゲームの通算ランキングと同じ表示です。
          </p>
          {ranksError && <p className="admin-error">{ranksError}</p>}
          {!playersError && !ranksError && differences.length > 0 && (
            <p className="admin-error">
              同期が必要な記録が{differences.length}
              件あります。対象プレイヤーのゲーム再起動時に再送されます。
            </p>
          )}
          {error && <p className="admin-error">{error}</p>}
          <div className="admin-rows">
            {rows.map((r) => (
              <Row
                key={r.id}
                id={r.id}
                kind="rank"
                name={r.name || "(名無し)"}
                sub={`持ち点 ${ratingWithWorld(r.rating, world)} · 9×9オンライン ${r.rated}戦 · ${ago(r.at)}`}
              />
            ))}
            {ranks && rows.length === 0 && (
              <p className="hint">
                {total === 0 ? "まだ誰も載っていません" : "見つかりません"}
              </p>
            )}
          </div>
        </section>

        <section className="admin-card" id="admin-season">
          <h2>月間シーズン成績</h2>
          <p className="hint">
            今月の9×9オンライン対戦のみ。10戦で順位が付きます。全対戦・通算の成績とは別集計です。
          </p>
          {seasonError && <p className="admin-error">{seasonError}</p>}
          {season && (
            <>
              <p>
                {seasonName(season.season.id)} · 確認済み対局 {season.matches}局
              </p>
              <div className="admin-rows">
                {season.players
                  .filter((r) => !q || r.name.includes(q) || r.uid.includes(q))
                  .map((r) => (
                    <div className="admin-row" key={r.uid}>
                      <span className="admin-row-main">
                        <b>
                          {(players || []).find((p) => p.id === r.uid)?.name ||
                            r.name}
                        </b>
                        <small>
                          {r.place
                            ? `${r.place}位`
                            : `順位確定まで${Math.max(0, 10 - r.rated)}戦`}{" "}
                          · 持ち点 {r.rating} · {r.rated}戦 {r.wins}勝 {r.draws}
                          分
                        </small>
                      </span>
                    </div>
                  ))}
              </div>
              {!season.players.length && (
                <p className="hint">今月の対象対局はまだありません。</p>
              )}
            </>
          )}
        </section>

        <section className="admin-card" id="admin-letters">
          <h2>運営からのお知らせ</h2>
          <p className="hint">
            補填やプレゼントを渡します。受け取ると添付がその場で配られます。
            出したあとに取り消せるのは、まだ受け取っていない人にだけです。
          </p>
          <div className="letter-form">
            <label className="letter-field">
              <span>宛先</span>
              <select
                className="admin-input"
                value={draft.to}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              >
                <option value="all">全員</option>
                {(players || []).map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name || p.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="letter-field">
              <span>件名</span>
              <input
                className="admin-input"
                maxLength={60}
                placeholder="おわびとお知らせ"
                value={draft.subject}
                onChange={(e) =>
                  setDraft({ ...draft, subject: e.target.value })
                }
              />
            </label>
            <label className="letter-field">
              <span>本文</span>
              <textarea
                className="admin-input"
                rows={4}
                maxLength={1000}
                placeholder="ご不便をおかけしました。おわびの品をお受け取りください。"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </label>
            <div className="letter-field">
              <span>添付</span>
              <div className="letter-gifts-edit">
                {draft.gifts.map((g, i) => (
                  <GiftPicker
                    key={i}
                    gift={g}
                    onChange={(next) =>
                      setDraft({
                        ...draft,
                        gifts: draft.gifts.map((x, k) => (k === i ? next : x)),
                      })
                    }
                    onRemove={() =>
                      setDraft({
                        ...draft,
                        gifts: draft.gifts.filter((_, k) => k !== i),
                      })
                    }
                  />
                ))}
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      gifts: [...draft.gifts, { type: "ticket", amount: 1 }],
                    })
                  }
                >
                  添付を足す
                </button>
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={busy || !draft.subject.trim()}
              onClick={send}
            >
              お知らせを出す
            </button>
          </div>
          <div className="admin-rows">
            {(letters || []).map((l) => (
              <div className="admin-row letter-sent" key={l.id}>
                <span className="admin-row-main">
                  <b>{l.subject}</b>
                  <small>
                    {l.to === "all"
                      ? "全員"
                      : `→ ${(players || []).find((p) => p.id === l.to)?.name || l.to}`}
                    {" · "}
                    {ago(l.at)} · {giftsLabel(l.gifts)}
                  </small>
                </span>
                <button
                  className="btn btn-ghost btn-small"
                  disabled={busy}
                  onClick={() => removeLetter(l)}
                >
                  取り消す
                </button>
              </div>
            ))}
            {lettersError && <p className="admin-error">{lettersError}</p>}
            {!lettersError && letters && letters.length === 0 && (
              <p className="hint">まだお知らせを出していません</p>
            )}
          </div>
        </section>

        <section className="admin-card" id="admin-lobby">
          <h2>待ち合わせ</h2>
          <p className="hint">
            相手を待っている部屋。対局が始まるか3分たつと消えます。
          </p>
          {lobbyError && <p className="admin-error">{lobbyError}</p>}
          <div className="admin-rows">
            {(lobby || []).map((l) => (
              <Row
                key={l.code}
                id={l.code}
                kind="lobby"
                name={l.code}
                sub={l.createdAt ? ago(l.createdAt) : "—"}
              />
            ))}
            {lobby && lobby.length === 0 && (
              <p className="hint">いま待っている部屋はありません</p>
            )}
          </div>
        </section>

        <section className="admin-card" id="admin-rooms">
          <h2>対局の部屋</h2>
          <p className="hint">
            オンライン対局の手順を置く部屋。勝敗のあとに片付けられます。アプリを閉じられて残ったものは、ここから消せます。
          </p>
          {roomsError && <p className="admin-error">{roomsError}</p>}
          <p>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={
                busy ||
                !(rooms || []).some((r) => staleRoom(r, Date.now()))
              }
              onClick={sweepRooms}
            >
              古い部屋をまとめて消す
            </button>
          </p>
          <div className="admin-rows">
            {(rooms || []).map((r) => {
              const stale = staleRoom(r, Date.now());
              return (
                <div className="admin-row" key={r.code}>
                  <span className="admin-row-main">
                    <b>{r.code}</b>
                    <small>
                      {r.createdAt ? ago(r.createdAt) : "作成時刻なし"} ·{" "}
                      {r.guest ? "2人" : "相手待ち"} · 手順 {r.acts}
                    </small>
                  </span>
                  <span className="admin-row-side">
                    {stale && <em>古い</em>}
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      disabled={busy}
                      onClick={() => removeRoom(r)}
                    >
                      消す
                    </button>
                  </span>
                </div>
              );
            })}
            {rooms && rooms.length === 0 && (
              <p className="hint">いま残っている部屋はありません</p>
            )}
          </div>
        </section>

        <p className="hint admin-foot">
          {loadedAt ? `${when(loadedAt)} に読み込み` : ""}
        </p>
      </main>

      {opened && (
        <div className="admin-sheet" onClick={() => setDetail(null)}>
          <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
            <div className="admin-panel-head">
              <b>
                {detail.kind === "lobby"
                  ? opened.code
                  : opened.name || "(名無し)"}
              </b>
              <button
                className="icon-btn"
                aria-label="閉じる"
                onClick={() => setDetail(null)}
              >
                ×
              </button>
            </div>

            {detail.kind === "lobby" ? (
              <>
                <Line label="合言葉">{opened.code}</Line>
                <Line label="作られた">
                  {opened.createdAt
                    ? `${ago(opened.createdAt)}(${when(opened.createdAt)})`
                    : "—"}
                </Line>
                <Line label="中身">
                  <span className="admin-json">
                    {Object.entries(opened)
                      .filter(([k]) => k !== "code" && k !== "createdAt")
                      .map(
                        ([k, v]) =>
                          `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`,
                      )
                      .join(" / ") || "—"}
                  </span>
                </Line>
                <div className="admin-panel-actions">
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() =>
                      removeLobby(opened).then(() => setDetail(null))
                    }
                  >
                    消す
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="hint">
                  全対戦はCPU・5×5・チュートリアルを含みます。通算の持ち点に反映するのは9×9オンライン対戦だけです。
                </p>
                <Line label="称号">
                  {titleNameOf(opened.title) ||
                    (opened.title ? `? ${opened.title}` : "—")}
                </Line>
                <Line label="通算ランキングの持ち点">
                  {typeof opened.rating === "number"
                    ? `${ratingWithWorld(opened.rating, world)} (${rankTitle(opened.rating, opened.rated)})`
                    : "—"}
                </Line>
                <Line label="9×9オンライン・通算対局">
                  {opened.rated ?? "—"}
                </Line>
                <Line label="全対戦・対局">{opened.plays ?? "—"}</Line>
                <Line label="全対戦・勝利">
                  {opened.wins ?? "—"}
                  {opened.plays
                    ? `(${Math.round((opened.wins / opened.plays) * 100)}%)`
                    : ""}
                </Line>
                <Line label="アイコン">
                  {opened.icon ? findIcon(opened.icon).label : "—"}
                </Line>
                {detail.kind === "player" && (
                  <Line label="登録">
                    {opened.since
                      ? `${ago(opened.since)}(${when(opened.since)})`
                      : "—"}
                  </Line>
                )}
                <Line label="最終更新">
                  {`${ago(opened.at)}(${when(opened.at)})`}
                </Line>
                {detail.kind === "player" && (
                  <Line label="状態">
                    {opened.banned ? "使用停止" : "ふつう"}
                  </Line>
                )}
                <Line label="端末id">
                  <span className="admin-id">{opened.id}</span>
                </Line>
                <div className="admin-panel-actions">
                  {detail.kind === "player" && (
                    <button
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => {
                        setDraft({ ...draft, to: opened.id });
                        setDetail(null);
                      }}
                    >
                      お知らせを出す
                    </button>
                  )}
                  {detail.kind === "player" && (
                    <button
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => toggleBan(opened)}
                    >
                      {opened.banned ? "使用停止を解く" : "使用停止にする"}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() =>
                      (detail.kind === "player"
                        ? removePlayer(opened)
                        : removeRank(opened)
                      ).then(() => setDetail(null))
                    }
                  >
                    消す
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<AdminApp />);
