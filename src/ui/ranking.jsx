import { SeasonScreen } from "./season.jsx";
import { useState } from "react";
import { ArrowLeft } from "../icons.jsx";
import { L } from "../i18n/index.js";

export function RankingScreen({ onBack }) {
  const [tab, setTab] = useState("season");
  return (
    <div className="season-screen">
      <header className="season-header">
        <h2>{L("ランキング")}</h2>
        <button className="btn btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} /> {L("戻る")}
        </button>
      </header>
      <p className="hint ranking-scope">
        {L("フェーズ3の9×9のオンライン対戦の成績で並びます(練習相手を含む)。CPU戦・フレンド対戦・5×5と、フェーズ1・2の対局は数えません。")}
      </p>
      <nav className="season-tabs" aria-label={L("ランキングの種類")}>
        {[
          ["season", L("今シーズン")],
          ["ranking", L("ランキング")],
          ["history", L("歴代記録")],
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
