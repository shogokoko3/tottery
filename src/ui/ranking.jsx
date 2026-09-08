/**
 * ランキング。持ち点の高い順に並べる。
 *
 * いまの本人確認は端末ごとの目印だけなので、消して入れ直せば作り直せる。
 * 順位は自己申告に近い、ということを画面にも書いておく。
 */
import { useEffect, useState } from "react";
import { loadProfile } from "../game/profile.js";
import { rankTitle } from "../game/rating.js";
import { readRanks } from "../net/ranking.js";
import { withoutBlocked } from "../game/blocked.js";
import { ArrowLeft } from "../icons.jsx";
import { PlayerIcon } from "./playericon.jsx";
import { PlayerActionModal } from "./report.jsx";

export function RankingScreen({ onBack }) {
  const me = loadProfile();
  const [state, setState] = useState("loading");
  const [list, setList] = useState([]);
  const [error, setError] = useState("");
  // 通報・ブロックの画面を出している相手
  const [acting, setActing] = useState(null);
  // 見えなくした直後に一覧から消すための数え札
  const [hidden, setHidden] = useState(0);

  useEffect(() => {
    let gone = false;
    (async () => {
      const res = await readRanks();
      if (gone) return;
      if (!res.ok) {
        setError(res.error);
        setState("error");
        return;
      }
      setList(res.list);
      setState("done");
    })();
    return () => {
      gone = true;
    };
  }, []);

  // 見えなくした相手は並びから外す。順位は外したあとで数え直す。
  // hidden が変わると描き直され、そのとき端末の一覧を読み直す
  void hidden;
  const shown = withoutBlocked(list);
  const myPlace = shown.findIndex((r) => r.id === me.id);

  return (
    <div className="rank-wrap">
      {acting && (
        <PlayerActionModal
          target={acting}
          onClose={() => setActing(null)}
          onChanged={() => setHidden((n) => n + 1)}
        />
      )}
      <h2>ランキング</h2>
      <p className="hint">
        オンライン対戦の成績で並びます。CPU戦は数えません。
      </p>

      <div className="rank-me">
        <PlayerIcon icon={me.icon} name={me.name} />
        <div className="rank-me-id">
          <b>{me.name || "(未設定)"}</b>
          <span className="rank-me-sub">
            {rankTitle(me.rating)} · {me.rated}戦
          </span>
        </div>
        <div className="rank-me-score">
          <b>{me.rating}</b>
          <span>{myPlace >= 0 ? `${myPlace + 1}位` : "未掲載"}</span>
        </div>
      </div>

      {state === "loading" && <p className="hint">読み込んでいます…</p>}
      {state === "error" && <p className="error-text">{error}</p>}
      {state === "done" && shown.length === 0 && (
        <p className="hint">まだ誰も載っていません。</p>
      )}

      {state === "done" && shown.length > 0 && (
        <ol className="rank-list">
          {shown.map((row, i) => (
            <li
              className={`rank-row ${row.id === me.id ? "rank-row-me" : ""}`}
              key={row.id}
            >
              <span className="rank-place">{i + 1}</span>
              <PlayerIcon icon={row.icon} name={row.name} size="sm" />
              <span className="rank-name">{row.name}</span>
              <span className="rank-title">{rankTitle(row.rating)}</span>
              <b className="rank-score">{row.rating}</b>
              {row.id !== me.id && (
                <button
                  className="rank-more"
                  onClick={() => setActing({ id: row.id, name: row.name })}
                  aria-label={`${row.name} を通報する、または見えなくする`}
                >
                  ⋯
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="hint rank-note">
        いまの本人確認は端末ごとの目印だけです。アプリを消して入れ直すと
        別人として載ります。端末を替えても続くアカウントは今後入れる予定です。
      </p>
      <button className="btn btn-ghost" onClick={onBack}>
        <ArrowLeft size={16} /> 戻る
      </button>
    </div>
  );
}
