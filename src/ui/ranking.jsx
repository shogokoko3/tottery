import { SeasonScreen } from "./season.jsx";
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
import { rankTitle, RANK_TIERS } from "../game/rating.js";
import { readRanks } from "../net/ranking.js";
import { ArrowLeft } from "../icons.jsx";
import { PlayerIcon } from "./playericon.jsx";

function LifetimeRanking() {
  const me = loadProfile();
  const [state, setState] = useState("loading");
  const [list, setList] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let gone = false;
    const refresh = async () => {
      const res = await readRanks();
      if (gone) return;
      if (!res.ok) {
        setError(res.error);
        setState("error");
        return;
      }
      setList(res.list);
      setState("done");
    };
    refresh();
    const onSaved = (event) => {
      if (event.detail === "saved") refresh();
    };
    window.addEventListener("tottery:profile-sync", onSaved);
    return () => {
      gone = true;
      window.removeEventListener("tottery:profile-sync", onSaved);
    };
  }, []);

  const myPlace = list.findIndex((r) => r.id === me.id);

  return (
    <div className="rank-wrap">
      <h3>通算ランキング</h3>
      <p className="hint">
        9×9のオンライン対戦の成績で並びます。5×5とCPU戦は数えません。
      </p>

      <div className="rank-me">
        <PlayerIcon icon={me.icon} name={me.name} />
        <div className="rank-me-id">
          <b>{me.name || "(未設定)"}</b>
          <span className="rank-me-sub">
            {rankTitle(me.rating, me.rated)} · {me.rated}戦
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
                {rankTitle(row.rating, row.rated)}
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
    </div>
  );
}

function RankGuide() {
  return (
    <section className="rank-guide" aria-labelledby="rank-guide-title">
      <h3 id="rank-guide-title">段位と到達条件</h3>
      <p className="rank-guide-intro">
        現在のレートで段位が決まります。対戦数の条件はありません。
      </p>
      <table className="rank-guide-table" aria-label="段位ごとのレート範囲">
        <thead>
          <tr>
            <th scope="col">段位</th>
            <th scope="col">レート</th>
          </tr>
        </thead>
        <tbody>
          {RANK_TIERS.map((tier, index) => (
            <tr key={tier.name}>
              <th scope="row">
                <span className={`rank-guide-emblem rank-guide-tier-${index}`}>
                  {tier.name}
                </span>
              </th>
              <td>
                <b>
                  {index === 0
                    ? RANK_TIERS[1].rating - 1
                    : RANK_TIERS[index + 1]
                      ? `${tier.rating}〜${RANK_TIERS[index + 1].rating - 1}`
                      : tier.rating}
                </b>
                {index === 0 && <small>以下</small>}
                {index === RANK_TIERS.length - 1 && <small>以上</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rank-guide-note">
        <b>対象は9×9のオンライン対戦</b>
        <p>通算と今シーズン、それぞれのレートで判定します。</p>
        <p>初期レートは1500。「兵」からスタートします。</p>
      </div>
    </section>
  );
}

export function RankingScreen({ onBack }) {
  const [tab, setTab] = useState("season");
  return (
    <div className="season-screen">
      <header className="season-header">
        <h2>ランキング</h2>
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} /> 戻る
        </button>
      </header>
      <nav className="season-tabs" aria-label="ランキングの種類">
        {[
          ["season", "今シーズン"],
          ["lifetime", "通算"],
          ["history", "歴代記録"],
          ["ranks", "段位一覧"],
        ].map(([id, label]) => (
          <button
            key={id}
            className="btn btn-ghost"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="season-scroll" key={tab}>
        {tab === "ranks" ? (
          <RankGuide />
        ) : tab === "lifetime" ? (
          <LifetimeRanking />
        ) : (
          <SeasonScreen key={tab} historyOnly={tab === "history"} />
        )}
      </div>
    </div>
  );
}
