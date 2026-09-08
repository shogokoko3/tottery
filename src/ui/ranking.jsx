import { SeasonScreen } from "./season.jsx";
import { useState } from "react";
import { ArrowLeft } from "../icons.jsx";

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
      <p className="hint ranking-scope">
        9×9のオンライン対戦の成績で並びます。CPU戦と5×5は数えません。
      </p>
      <nav className="season-tabs" aria-label="ランキングの種類">
        {[
          ["season", "今シーズン"],
          ["ranking", "ランキング"],
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
        <SeasonScreen
          key={tab}
          historyOnly={tab === "history"}
          rankingOnly={tab === "ranking"}
        />
      </div>
    </div>
  );
}
