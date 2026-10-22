import { useState } from "react";
import {
  PHASES,
  promotionStatus,
  rulesForPhase,
  stageSize,
} from "../game/phase.js";
import { loadProfile } from "../game/profile.js";
import { MoveDiagram } from "./guides.jsx";
import { AreaGuide } from "./area-guide.jsx";
import { AREA_GUIDE_ROWS } from "./area-guide-rows.js";
import css from "./phase-guide.css";

const TITLES = {
  1: "駒の動きを覚える",
  2: "王の力を使う",
  3: "エリアを使いこなす",
};
const SUMMARIES = {
  1: "小さな盤で、札の動きを手がかりに相手の王を探します。このフェーズでは、王も基本の動きだけで遊びます。",
  2: "王ごとの特殊な力が加わります。どの札を王にするかで、戦い方が変わります。盤も9×9へ広がります。",
  3: "王の力に加えて、フォイルの王が持つエリア効果を使えます。効果で得た情報や盤の変化も、次の一手の手がかりになります。",
};

export function PhaseGuide({ onBack, profile = loadProfile() }) {
  const status = promotionStatus(profile);
  const [selected, setSelected] = useState(status.phase);
  const rules = rulesForPhase(selected);
  const earth = AREA_GUIDE_ROWS.find((row) => row.type === "earth");
  return (
    <div className="setup-wrap phase-guide">
      <style>{css}</style>
      <button type="button" className="btn btn-ghost" onClick={onBack}>
        戻る
      </button>
      <header className="phase-guide-heading">
        <small>いつでも見返せる遊びの道しるべ</small>
        <h2>フェーズガイド</h2>
        <p>
          トッタリーは、3つのフェーズで少しずつルールが広がります。今遊んでいるフェーズから確認できます。
        </p>
        <p className="phase-guide-common">
          どのフェーズでも、相手の王を取れば勝ちです。
        </p>
        {selected >= 2 && <p className="hint">
          フェーズ2からは、王を取った後に別の札が王を引き継ぐ場合もあります。詳しいルールは早見表で確認できます。
        </p>}
      </header>
      <nav className="phase-guide-steps" aria-label="説明するフェーズを選ぶ">
        {PHASES.map((p) => (
          <button
            type="button"
            key={p}
            aria-pressed={selected === p}
            className={selected === p ? "is-selected" : ""}
            onClick={() => setSelected(p)}
          >
            <small>
              フェーズ {p}
              {p === status.phase
                ? " · 現在"
                : p > status.phase
                  ? " · これから"
                  : " · 到達済み"}
            </small>
            <b>{TITLES[p]}</b>
            <span>
              {p === 1 ? "基本の動き" : p === 2 ? "＋ 王の力" : "＋ エリア効果"}
            </span>
          </button>
        ))}
      </nav>
      <section
        className="phase-guide-detail"
        aria-label={`フェーズ${selected}の説明`}
      >
        <small>フェーズ {selected}</small>
        <h3>{TITLES[selected]}</h3>
        <p>{SUMMARIES[selected]}</p>
        <dl className="phase-guide-rules">
          <div>
            <dt>ストーリーの盤</dt>
            <dd>
              {stageSize(selected)}×{stageSize(selected)}
            </dd>
          </div>
          <div>
            <dt>オンラインの盤</dt>
            <dd>{rules.sizes.map((n) => `${n}×${n}`).join("・")}</dd>
          </div>
          <div>
            <dt>王の力</dt>
            <dd>{rules.kingPowers ? "あり" : "なし"}</dd>
          </div>
          <div>
            <dt>エリア効果</dt>
            <dd>{rules.areas ? "条件を満たすと使える" : "なし"}</dd>
          </div>
        </dl>
        <h4>同じ「2の王」で動きを比べます</h4>
        <p>自分の5枚に、2の札を1枚入れた場合です。中央の白いマスが王、金色のマスが動ける場所です。</p>
        <div className="phase-guide-example">
          <figure>
            <div role="img" aria-label="王の力なし。2の王は縦横1マスに動ける">
              <MoveDiagram rank="2" gridSize={selected === 1 ? 5 : 9} />
            </div>
            <figcaption>フェーズ1：縦横1マス</figcaption>
          </figure>
          {selected >= 2 && (
            <figure>
              <div
                role="img"
                aria-label="王の力あり。2を1枚採用した王は縦横3マスまで動ける"
              >
                <MoveDiagram rank="2" isKing gridSize={9} />
              </div>
              <figcaption>フェーズ{selected}：縦横3マスまで</figcaption>
            </figure>
          )}
        </div>
        {selected >= 2 && (
          <p>
            2の王は、自分の札にある2の枚数に応じて移動距離が伸びます。王の力は数字ごとに異なります。
          </p>
        )}
        {selected === 3 && (
          <aside className="phase-guide-area">
            <h4>さらに「土」のエリア効果</h4>
            <p>
              2の札にフォイルを装備し、その札を王にして9×9で遊ぶと「土」のエリア効果が発動します。
            </p>
            <p>{earth.summary}</p>
            <p>
              フォイルを持っているだけでは発動しません。フェーズ3でも、5×5ではエリア効果を使いません。
            </p>
            <details>
              <summary>すべてのエリア効果を見る</summary>
              <AreaGuide />
            </details>
          </aside>
        )}
        <p className="hint">
          {selected === 3
            ? "オンラインの持ち点（レート）の対象はフェーズ3です。"
            : "オンラインの持ち点（レート）はフェーズ3からです。"}
        </p>
      </section>
      <section className="phase-guide-progress" aria-label="現在の進み具合">
        <small>あなたの現在地</small>
        <h3>
          フェーズ {status.phase} · {TITLES[status.phase]}
        </h3>
        {status.last ? (
          <p>
            最後のフェーズに到達しました。王の力とエリア効果を使って対局できます。
          </p>
        ) : (
          <>
            <p>
              今のフェーズで、次の両方を達成するとフェーズ{status.phase + 1}
              へ進めます。
            </p>
            <label>
              ストーリー {status.axesCleared} / {status.axesTotal} クリア
              <progress value={status.axesCleared} max={status.axesTotal} />
            </label>
            <label>
              オンライン {Math.min(status.wins, status.winsNeeded)} /{" "}
              {status.winsNeeded} 勝
              <progress
                value={Math.min(status.wins, status.winsNeeded)}
                max={status.winsNeeded}
              />
            </label>
            <p>
              {status.axesLeft.length === 0 && status.winsLeft === 0
                ? "昇格の準備ができました。ストーリー画面から次のフェーズへ進めます。"
                : "条件を達成したら、ストーリー画面から昇格できます。"}
            </p>
            {status.phase === 1 && (
              <p className="hint">
                ランダムマッチはフェーズ1のストーリー全7ステージをクリアすると開きます。
              </p>
            )}
          </>
        )}
      </section>
      <button type="button" className="btn btn-primary" onClick={onBack}>
        戻る
      </button>
    </div>
  );
}
