/**
 * 管理画面。/admin.html で開く。
 *
 * アカウントは各端末の中(localStorage)にだけあり、サーバーに本人確認の
 * 仕組みは無い。サーバーに載るのは、オンラインの持ち点つき対局を終えた
 * 端末が置いていく成績(ranks/<端末id>)だけ。ここではそれと、待ち合わせ
 * (lobby)を一覧にして、探す・並べ替える・消すができる。
 *
 * 消しても本人の端末の記録は消えない(次の持ち点つき対局でまた載る)。
 * 読み書きは本体と同じ REST で、ルール上は誰でもできる。管理画面が
 * 特別な権限を持っているわけではない。
 */
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import STYLES from "../styles.css";
import ADMIN_STYLES from "./admin.css";
import { DB_URL } from "../net/firebase.js";
import { findIcon } from "../game/icons.js";
import { rankTitle } from "../game/rating.js";
import { titleNameOf } from "../game/titles.js";
import { deletePlayer, readPlayers, setBanned } from "../net/players.js";

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

async function getJson(path) {
  const res = await withTimeout(fetch(`${DB_URL}/${path}.json`), TIMEOUT_MS);
  if (res.status === 401)
    throw new Error(`${path} は読めません(Firebase のルールで閉じています)`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function remove(path) {
  const res = await withTimeout(
    fetch(`${DB_URL}/${path}.json`, { method: "DELETE" }),
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

function AdminApp() {
  const [ranks, setRanks] = useState(null);
  const [players, setPlayers] = useState(null);
  const [playersError, setPlayersError] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rating");
  const [loadedAt, setLoadedAt] = useState(null);
  // 押して開いている行。{ kind, id }
  const [detail, setDetail] = useState(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const [r, l, p] = await Promise.all([
        getJson("ranks"),
        getJson("lobby"),
        // 登録した人の台帳。ルールがまだなら、そこだけ知らせて他は出す
        readPlayers().then(
          (rows) => ({ rows }),
          (e) => ({ error: (e && e.message) || String(e) }),
        ),
      ]);
      setRanks(Object.entries(r || {}).map(([id, row]) => ({ id, ...row })));
      setPlayers(p.rows || []);
      setPlayersError(p.error || null);
      setLobby(
        Object.entries(l || {}).map(([code, row]) => ({
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
          ? `「${row.name || row.id}」を使用停止にします。\nその端末は次に開いたときに名前を失い、決め直しの画面になります。`
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
  const total = (ranks || []).length;
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
        <div className="top-right" />
      </header>
      <main className="stage admin-stage">
        <section className="admin-card">
          <h2>アカウントの持ち方</h2>
          <p className="hint">
            アカウントは各端末の中にだけあります(名前・アイコン・称号・対局数・勝数・持ち点)。
            サーバーに本人確認の仕組みは無く、端末を替えると別の人として数えられます。
          </p>
          <p className="hint">
            <b>登録した人</b>は、名前を決めた端末すべて。
            <b>持ち点つきの成績</b>
            は、オンラインの持ち点つき対局を終えた端末だけです。
            「消す」はサーバーの記録を消すだけで、端末は次に開いたときにまた載ります。
            「使用停止」にすると、その端末は次に開いたときに名前を失い、決め直しになります。
          </p>
        </section>

        <section className="admin-card">
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

        <section className="admin-card">
          <h2>持ち点つきの成績</h2>
          <p className="hint">
            オンラインの持ち点つき対局を終えた端末が置いた記録です。
          </p>
          {error && <p className="admin-error">{error}</p>}
          <div className="admin-rows">
            {rows.map((r) => (
              <Row
                key={r.id}
                id={r.id}
                kind="rank"
                name={r.name || "(名無し)"}
                sub={`持ち点 ${typeof r.rating === "number" ? r.rating : "—"} · ${ago(r.at)}`}
              />
            ))}
            {ranks && rows.length === 0 && (
              <p className="hint">
                {total === 0 ? "まだ誰も載っていません" : "見つかりません"}
              </p>
            )}
          </div>
        </section>

        <section className="admin-card">
          <h2>待ち合わせ</h2>
          <p className="hint">
            相手を待っている部屋。対局が始まるか3分たつと消えます。
          </p>
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

        <p className="hint admin-foot">
          {loadedAt ? `${when(loadedAt)} に読み込み` : ""} ・ 宛先 {DB_URL}
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
                <Line label="称号">
                  {titleNameOf(opened.title) ||
                    (opened.title ? `? ${opened.title}` : "—")}
                </Line>
                <Line label="持ち点">
                  {typeof opened.rating === "number"
                    ? `${opened.rating}(${rankTitle(opened.rating)})`
                    : "—"}
                </Line>
                <Line label="持ち点つき対局">{opened.rated ?? "—"}</Line>
                <Line label="対局">{opened.plays ?? "—"}</Line>
                <Line label="勝ち">
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
