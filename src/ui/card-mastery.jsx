import { ArrowLeft } from "../icons.jsx";
/**
 * ホームの「カード」。札ごとの熟練度を見る画面(2026-09-22 本人の指示)。
 *
 * 熟練度は**その札を王に選び、王として動かした回数**(src/game/profile.js)。
 * 13種の札を A〜K の順に並べ、いまの回数・段・次の段までの残り・称号を出す。
 * 札を押すと、その札の動きと王にしたときの能力を開く。
 *
 * ここは見るだけ。数えるのは対局(src/ui/game.jsx)、貯めるのは recordMastery。
 * 盤の有利不利には一切効かせない(docs/mastery.md §3-4)。
 */
import { useState } from "react";
import {
  KING_TEXT,
  MASTERY_STEPS,
  MASTERY_TITLE_STEP,
  RANKS,
  moveOnlyText,
} from "../game/constants.js";
import { masteryProgress } from "../game/profile.js";
import { MASTERY_TITLES, hasTitle } from "../game/titles.js";
import { CardFace } from "./cards.jsx";
import { useMissionProfile } from "./mission-profile.js";
import { FRAME_GRADES } from "./title-design.js";
import { TitleFrame } from "./title-frame.jsx";

/** 段の呼び名。終局画面のメーター(mastery.jsx)と同じ言い方にそろえる */
export function masteryStepName(step) {
  if (step <= 0) return "未到達";
  if (step >= MASTERY_STEPS.length) return "極み";
  return FRAME_GRADES[step - 1] ? FRAME_GRADES[step - 1].name : `段${step}`;
}

const titleNeed = MASTERY_STEPS[MASTERY_TITLE_STEP - 1];
const titleFor = (rank) => MASTERY_TITLES.find((t) => t.mastery === rank);
const ALL_TITLES = MASTERY_TITLES.filter((t) => t.mastery === "all");

export function CardMasteryScreen({ onBack }) {
  const [profile] = useMissionProfile();
  const [open, setOpen] = useState(null);
  const mastery = (profile && profile.mastery) || {};
  const rows = RANKS.map((rank) => {
    const p = masteryProgress(mastery[rank] || 0);
    const title = titleFor(rank);
    return { rank, p, title, owned: title ? hasTitle(profile, title.id) : false };
  });
  const total = rows.reduce((s, r) => s + r.p.count, 0);
  const reached = rows.filter((r) => r.p.step >= 1).length;
  const titled = rows.filter((r) => r.owned).length;
  const mastered = rows.filter((r) => r.p.done).length;
  // 通しの称号(13種すべてが同じ段)。あと何種で届くかを添える
  const allRows = ALL_TITLES.map((t) => {
    const need = t.id === "mastery-master" ? MASTERY_STEPS.length : MASTERY_TITLE_STEP;
    const have = rows.filter((r) => r.p.step >= need).length;
    return { title: t, need, have, owned: hasTitle(profile, t.id) };
  });
  return (
    <div className="setup-wrap card-mastery">
      <h2>カード</h2>
      <p className="hint">
        王に選んだ札を、王として動かした回数がたまります。
        段に届くと称号が手に入ります。盤の有利不利には効きません。
      </p>
      <div className="card-mastery-summary" aria-label="熟練度のまとめ">
        <span>
          段に届いた札 <b>{reached}</b>/{RANKS.length}
        </span>
        <span>
          称号 <b>{titled}</b>/{RANKS.length}
        </span>
        <span>
          極み <b>{mastered}</b>/{RANKS.length}
        </span>
        <span>
          合計 <b>{total}</b>回
        </span>
      </div>
      <ul className="card-mastery-list">
        {rows.map(({ rank, p, title, owned }) => {
          const isOpen = open === rank;
          return (
            <li
              key={rank}
              className={`card-mastery-row${p.done ? " is-done" : ""}${p.step >= 1 ? " is-reached" : ""}`}
            >
              <button
                type="button"
                className="card-mastery-main"
                aria-expanded={isOpen}
                aria-controls={`card-mastery-detail-${rank}`}
                onClick={() => setOpen(isOpen ? null : rank)}
              >
                <CardFace rank={rank} suit="spade" size="sm" isKing animated={false} />
                <span className="card-mastery-body">
                  <span className="card-mastery-head">
                    <b className="card-mastery-rank">{rank}</b>
                    <span className="card-mastery-step">{masteryStepName(p.step)}</span>
                    <span className="card-mastery-count">
                      {p.done ? `${p.count}回` : `${p.count} / ${p.next}回`}
                    </span>
                  </span>
                  <span
                    className="mastery-track"
                    role="progressbar"
                    aria-label={`${rank} の熟練度`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(p.ratio * 100)}
                    aria-valuetext={
                      p.done
                        ? `極み（${p.count}回）`
                        : `${p.count}回。次の段まであと${p.left}回`
                    }
                  >
                    <span style={{ width: `${p.ratio * 100}%` }} />
                  </span>
                  <span className="card-mastery-foot">
                    {owned && title ? (
                      <TitleFrame id={title.id} size="compact" className="card-mastery-title" />
                    ) : title ? (
                      <small>
                        あと{Math.max(0, titleNeed - p.count)}回で称号「{title.name}」
                      </small>
                    ) : null}
                    {!p.done && (
                      <small className="card-mastery-left">次の段まであと {p.left}</small>
                    )}
                    {p.done && <small className="card-mastery-left">これ以上は上がりません</small>}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="card-mastery-detail" id={`card-mastery-detail-${rank}`}>
                  <p>
                    <b>動き</b> {moveOnlyText(rank)}
                  </p>
                  <p>
                    <b>王にすると</b> {KING_TEXT[rank]}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <section className="card-mastery-all" aria-label="通しの称号">
        <h3>すべての札を使い込むと</h3>
        {allRows.map(({ title, need, have, owned }) => (
          <div key={title.id} className={`card-mastery-all-row${owned ? " is-owned" : ""}`}>
            {owned ? (
              <TitleFrame id={title.id} size="compact" />
            ) : (
              <b className="card-mastery-all-name">{title.name}</b>
            )}
            <small>
              {title.how} · {masteryStepName(need)}に届いた札 {have}/{RANKS.length}
            </small>
          </div>
        ))}
        <p className="mastery-steps-note">段の境目: {MASTERY_STEPS.join(" · ")}回</p>
      </section>
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>
    </div>
  );
}
