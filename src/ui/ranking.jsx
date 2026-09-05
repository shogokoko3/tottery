/**
 * ランキング。持ち点の高い順に並べる。
 *
 * 持ち点が動くのは9×9のオンライン対戦だけ。5×5は短期戦で運の割合が
 * 大きいので、同じ物差しには載せない。
 *
 * いまの本人確認は端末ごとの目印だけなので、消して入れ直せば作り直せる。
 * 順位は自己申告に近い、ということを画面にも書いておく。
 */
import { useEffect, useState } from "react";
import { loadProfile } from "../game/profile.js";
import { rankTitle } from "../game/rating.js";
import { readWorldGames } from "../net/ranking.js";
import { readRanks } from "../net/ranking.js";
import { ArrowLeft } from "../icons.jsx";
import { PlayerIcon } from "./playericon.jsx";

export function RankingScreen({ onBack }) {
  const me = loadProfile();
  const [state, setState] = useState("loading");
  const [list, setList] = useState([]);
  const [error, setError] = useState("");
  // 段位は「1局あたりどれだけ積み上げたか」で決まる。
  // それを持ち点から戻すのに、全体の総対局数が要る
  const [world, setWorld] = useState(0);

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
      readWorldGames().then((n) => {
        if (!gone) setWorld(n);
      });
    })();
    return () => {
      gone = true;
    };
  }, []);

  const myPlace = list.findIndex((r) => r.id === me.id);

  return (
    <div className="rank-wrap">
      <h2>ランキング</h2>
      <p className="hint">
        9×9のオンライン対戦の成績で並びます。5×5とCPU戦は数えません。
        <br />
        持ち点は遊ぶほど伸びます。位は1局あたりの成績で決まるので、
        遊んだ量では上がりません。
      </p>

      <div className="rank-me">
        <PlayerIcon icon={me.icon} name={me.name} />
        <div className="rank-me-id">
          <b>{me.name || "(未設定)"}</b>
          <span className="rank-me-sub">
            {rankTitle(me.rating, me.rated, world)} · {me.rated}戦
          </span>
        </div>
        <div className="rank-me-score">
          <b>{me.rating}</b>
          <span>{myPlace >= 0 ? `${myPlace + 1}位` : "未掲載"}</span>
        </div>
      </div>

      {state === "loading" && <p className="hint">読み込んでいます…</p>}
      {state === "error" && <p className="error-text">{error}</p>}
      {state === "done" && list.length === 0 && (
        <p className="hint">まだ誰も載っていません。</p>
      )}

      {state === "done" && list.length > 0 && (
        <ol className="rank-list">
          {list.map((row, i) => (
            <li
              className={`rank-row ${row.id === me.id ? "rank-row-me" : ""}`}
              key={row.id}
            >
              <span className="rank-place">{i + 1}</span>
              <PlayerIcon icon={row.icon} name={row.name} size="sm" />
              <span className="rank-name">{row.name}</span>
              <span className="rank-title">
                {rankTitle(row.rating, row.rated, world)}
              </span>
              <b className="rank-score">{row.rating}</b>
            </li>
          ))}
        </ol>
      )}

      <p className="hint rank-note">
        いまの本人確認は端末ごとの目印だけです。アプリを消して入れ直すと
        別人として載ります。端末を替えても続くアカウントは今後入れる予定です。
      </p>
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>
    </div>
  );
}
