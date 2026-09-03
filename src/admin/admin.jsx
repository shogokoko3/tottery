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
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rating");
  const [loadedAt, setLoadedAt] = useState(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const [r, l] = await Promise.all([getJson("ranks"), getJson("lobby")]);
      setRanks(Object.entries(r || {}).map(([id, row]) => ({ id, ...row })));
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

  const total = (ranks || []).length;
  const active7 = (ranks || []).filter(
    (r) => r.at && Date.now() - r.at < 7 * DAY,
  ).length;
  const active30 = (ranks || []).filter(
    (r) => r.at && Date.now() - r.at < 30 * DAY,
  ).length;

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
            ここに出るのは、<b>オンラインの持ち点つき対局を1局でも終えた端末</b>
            が置いていった成績です。CPU戦だけの人は出ません。
            行を消しても本人の端末の記録は消えず、次の持ち点つき対局でまた載ります。
          </p>
        </section>

        <section className="admin-card">
          <div className="admin-head">
            <h2>成績(ranks)</h2>
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
              <b>{ranks ? total : "—"}</b>
              <span>登録</span>
            </div>
            <div className="stat">
              <b>{ranks ? active7 : "—"}</b>
              <span>7日以内</span>
            </div>
            <div className="stat">
              <b>{ranks ? active30 : "—"}</b>
              <span>30日以内</span>
            </div>
          </div>
          {error && <p className="admin-error">{error}</p>}
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
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>称号</th>
                  <th>持ち点</th>
                  <th>位</th>
                  <th>持ち点つき</th>
                  <th>対局</th>
                  <th>勝ち</th>
                  <th>アイコン</th>
                  <th>最終更新</th>
                  <th>端末id</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="admin-name">{r.name || "(名無し)"}</td>
                    <td>
                      {titleNameOf(r.title) || (r.title ? `? ${r.title}` : "—")}
                    </td>
                    <td className="admin-num">
                      {typeof r.rating === "number" ? r.rating : "—"}
                    </td>
                    <td>
                      {typeof r.rating === "number" ? rankTitle(r.rating) : "—"}
                    </td>
                    <td className="admin-num">{r.rated ?? "—"}</td>
                    <td className="admin-num">{r.plays ?? "—"}</td>
                    <td className="admin-num">{r.wins ?? "—"}</td>
                    <td>{r.icon ? findIcon(r.icon).label : "—"}</td>
                    <td title={when(r.at)}>{ago(r.at)}</td>
                    <td className="admin-id">{r.id}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => removeRank(r)}
                        disabled={busy}
                      >
                        消す
                      </button>
                    </td>
                  </tr>
                ))}
                {ranks && rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="hint">
                      {total === 0
                        ? "まだ誰も載っていません"
                        : "見つかりません"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <h2>待ち合わせ(lobby)</h2>
          <p className="hint">
            フレンド対戦・オンライン対戦で相手を待っている部屋。対局が始まるか3分たつと消えます。
            残ったままのものはここから消せます。
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>合言葉</th>
                  <th>中身</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(lobby || []).map((l) => (
                  <tr key={l.code}>
                    <td className="admin-id">{l.code}</td>
                    <td className="admin-json">
                      {Object.entries(l)
                        .filter(([k]) => k !== "code")
                        .map(([k, v]) => {
                          // 時刻は生の数字ではなく「何分前」で読ませる
                          if (/At$|^at$/.test(k) && typeof v === "number")
                            return `${k}: ${ago(v)} (${when(v)})`;
                          return `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`;
                        })
                        .join(" / ") || "—"}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => removeLobby(l)}
                        disabled={busy}
                      >
                        消す
                      </button>
                    </td>
                  </tr>
                ))}
                {lobby && lobby.length === 0 && (
                  <tr>
                    <td colSpan={3} className="hint">
                      いま待っている部屋はありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="hint admin-foot">
          {loadedAt ? `${when(loadedAt)} に読み込み` : ""} ・ 宛先 {DB_URL}
        </p>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<AdminApp />);
