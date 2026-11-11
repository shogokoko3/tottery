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
import { L } from "../i18n/index.js";

const TITLES = {
  1: L("駒の動きを覚える"),
  2: L("王の力を使う"),
  3: L("エリアを使いこなす"),
};
const SUMMARIES = {
  1: L("小さな盤で、札の動きを手がかりに相手の王を探します。このフェーズでは、王も基本の動きだけで遊びます。"),
  2: L("王ごとの特殊な力が加わります。どの札を王にするかで、戦い方が変わります。ストーリーでは、王の力を使えるのはあなたの王だけです。"),
  // ストーリーは 5×5・相手の王も王の力・エリアはあなただけ(話ごとに決まったエリアを、フォイルが無くても貸す。2026-10-26 本人の指示)
  3: L("王の力に加えて、王のエリア効果を使えます。ストーリーでは、相手の王も王の力を持ち、エリアはあなたの王だけに付きます(話ごとに決まったエリアを、フォイルが無くても使えます)。"),
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
        {L("戻る")}
      </button>
      <header className="phase-guide-heading">
        <small>{L("いつでも見返せる遊びの道しるべ")}</small>
        <h2>{L("フェーズガイド")}</h2>
        <p>
          {L("トッタリーは、3つのフェーズで少しずつルールが広がります。今遊んでいるフェーズから確認できます。")}
        </p>
        <p className="phase-guide-common">
          {L("どのフェーズでも、相手の王を取れば勝ちです。")}
        </p>
        {selected >= 2 && <p className="hint">
          {selected === 2
            ? L("フェーズ2のオンライン対戦とフェーズ3では、王を取った後に別の札が王を引き継ぐ場合もあります。詳しいルールは早見表で確認できます。")
            : L("フェーズ2からは、王を取った後に別の札が王を引き継ぐ場合もあります。詳しいルールは早見表で確認できます。")}
        </p>}
      </header>
      <nav className="phase-guide-steps" aria-label={L("説明するフェーズを選ぶ")}>
        {PHASES.map((p) => (
          <button
            type="button"
            key={p}
            aria-pressed={selected === p}
            className={selected === p ? "is-selected" : ""}
            onClick={() => setSelected(p)}
          >
            <small>
              {L("フェーズ {p}", { p })}
              {p === status.phase
                ? L(" · 現在")
                : p > status.phase
                  ? L(" · これから")
                  : L(" · 到達済み")}
            </small>
            <b>{TITLES[p]}</b>
            <span>
              {p === 1 ? L("基本の動き") : p === 2 ? L("＋ 王の力") : L("＋ エリア効果")}
            </span>
          </button>
        ))}
      </nav>
      <section
        className="phase-guide-detail"
        aria-label={L("フェーズ{p}の説明", { p: selected })}
      >
        <small>{L("フェーズ {p}", { p: selected })}</small>
        <h3>{TITLES[selected]}</h3>
        <p>{SUMMARIES[selected]}</p>
        <dl className="phase-guide-rules">
          <div>
            <dt>{L("ストーリーの盤")}</dt>
            <dd>
              {stageSize(selected)}×{stageSize(selected)}
            </dd>
          </div>
          <div>
            <dt>{L("オンラインの盤")}</dt>
            <dd>{rules.sizes.map((n) => `${n}×${n}`).join(L("・"))}</dd>
          </div>
          <div>
            <dt>{L("王の力")}</dt>
            {/* フェーズ2 のストーリーは、王の力がプレイヤーの席だけ(2026-10-25 本人の指示。phase.js storySetupFlags) */}
            <dd>{!rules.kingPowers ? L("なし") : selected === 2 ? L("あり(ストーリーはあなたの王だけ)") : L("あり")}</dd>
          </div>
          <div>
            <dt>{L("エリア効果")}</dt>
            {/* ストーリーはあなたの王だけ・フォイルが無くても貸し出し(2026-10-26 本人の指示)。オンラインはフォイルの王で 9×9 */}
            <dd>{rules.areas ? L("あり(ストーリーはあなたの王だけ。オンラインはフォイルの王で9×9)") : L("なし")}</dd>
          </div>
        </dl>
        <h4>{L("同じ「2の王」で動きを比べます")}</h4>
        <p>{L("自分の5枚に、2の札を1枚入れた場合です。中央の白いマスが王、金色のマスが動ける場所です。")}</p>
        <div className="phase-guide-example">
          <figure>
            <div role="img" aria-label={L("王の力なし。2の王は縦横1マスに動ける")}>
              <MoveDiagram rank="2" gridSize={selected === 1 ? 5 : 9} />
            </div>
            <figcaption>{L("フェーズ1：縦横1マス")}</figcaption>
          </figure>
          {selected >= 2 && (
            <figure>
              <div
                role="img"
                aria-label={L("王の力あり。2を1枚採用した王は縦横3マスまで動ける")}
              >
                <MoveDiagram rank="2" isKing gridSize={9} />
              </div>
              <figcaption>{L("フェーズ{p}：縦横3マスまで", { p: selected })}</figcaption>
            </figure>
          )}
        </div>
        {selected >= 2 && (
          <p>
            {L("2の王は、自分の札にある2の枚数に応じて移動距離が伸びます。王の力は数字ごとに異なります。")}
          </p>
        )}
        {selected === 3 && (
          <aside className="phase-guide-area">
            <h4>{L("さらに「土」のエリア効果")}</h4>
            <p>
              {L("ストーリーでは、第1話「二と三の王」であなたの王に「土」のエリア効果が付きます(フォイルが無くても使えます)。")}
            </p>
            <p>{earth.summary}</p>
            <p>
              {L("オンラインでは、2の札にフォイルを装備し、その札を王にして9×9で遊ぶと発動します。")}
            </p>
            <details>
              <summary>{L("すべてのエリア効果を見る")}</summary>
              <AreaGuide />
            </details>
          </aside>
        )}
        <p className="hint">
          {selected === 3
            ? L("オンラインの持ち点（レート）の対象はフェーズ3です。")
            : L("オンラインの持ち点（レート）はフェーズ3からです。")}
        </p>
      </section>
      <section className="phase-guide-progress" aria-label={L("現在の進み具合")}>
        <small>{L("あなたの現在地")}</small>
        <h3>
          {L("フェーズ {p} · {title}", { p: status.phase, title: TITLES[status.phase] })}
        </h3>
        {status.last ? (
          <p>
            {L("最後のフェーズに到達しました。王の力とエリア効果を使って対局できます。")}
          </p>
        ) : (
          <>
            <p>
              {L("今のフェーズで、次の両方を達成するとフェーズ{n}へ進めます。", { n: status.phase + 1 })}
            </p>
            <label>
              {L("ストーリー {a} / {b} クリア", { a: status.axesCleared, b: status.axesTotal })}
              <progress value={status.axesCleared} max={status.axesTotal} />
            </label>
            <label>
              {L("オンライン {a} / {b} 勝", { a: Math.min(status.wins, status.winsNeeded), b: status.winsNeeded })}
              <progress
                value={Math.min(status.wins, status.winsNeeded)}
                max={status.winsNeeded}
              />
            </label>
            <p>
              {status.axesLeft.length === 0 && status.winsLeft === 0
                ? L("昇格の準備ができました。ストーリー画面から次のフェーズへ進めます。")
                : L("条件を達成したら、ストーリー画面から昇格できます。")}
            </p>
            {status.phase === 1 && (
              <p className="hint">
                {L("ランダムマッチはフェーズ1のストーリー全7ステージをクリアすると開きます。")}
              </p>
            )}
          </>
        )}
      </section>
      <button type="button" className="btn btn-primary" onClick={onBack}>
        {L("戻る")}
      </button>
    </div>
  );
}
