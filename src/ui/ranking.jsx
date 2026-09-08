import { SeasonScreen } from "./season.jsx";
import { useState } from "react";
import { RANK_TIERS } from "../game/rating.js";
import { ArrowLeft } from "../icons.jsx";

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
        <p>今シーズンのレートで段位を判定します。</p>
        <p>初期レートは1500。「兵」からスタートします。</p>
      </div>
    </section>
  );
}

export function RankingScreen({ onBack }) {
  const [tab, setTab] = useState("ranks");
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
          ["ranks", "段位一覧"],
          ["season", "今シーズン"],
          ["history", "歴代記録"],
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
        ) : (
          <SeasonScreen key={tab} historyOnly={tab === "history"} />
        )}
      </div>
    </div>
  );
}
