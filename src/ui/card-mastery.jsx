import { ArrowLeft, Lock } from "../icons.jsx";
/**
 * ホームの「カード」。スキンごとの熟練度を見る画面(2026-09-22 着手。2026-09-24 でスキン制に)。
 *
 * 熟練度は**所持スキンを装備して王にし、貯めた点**(src/game/profile.js)。通常札では貯まらない。
 * 17スキンを A〜K の順に並べ、いまの点・段・次の段までの残り・称号を出す。
 * 所持していないスキンは鎖(ロック)。スキンを1つも持っていなければ、この画面全体がロック。
 *
 * ここは見るだけ。数えるのは対局(src/ui/game.jsx)、貯めるのは recordMastery。
 * 盤の有利不利には一切効かせない(docs/mastery.md §3-4)。
 */
import { useState } from "react";
import {
  MASTERY_STEPS,
  MASTERY_TITLE_STEP,
  MASTERY_SKINS,
  MASTERY_SKIN_RANK,
} from "../game/constants.js";
import { masteryProgress } from "../game/profile.js";
import { MASTERY_TITLES, hasTitle } from "../game/titles.js";
import { useCollection } from "../skins/store.js";
import { byId, foilId } from "../skins/catalog.js";
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
const titleFor = (skin) => MASTERY_TITLES.find((t) => t.mastery === skin);
const ALL_TITLES = MASTERY_TITLES.filter((t) => t.mastery === "all");

/** そのスキンを持っているか(通常版・フォイルのどちらかを持っていれば所持) */
const ownsSkin = (owned, skin) => !!(owned?.[skin] || owned?.[foilId(skin)]);

export function CardMasteryScreen({ onBack }) {
  const [profile] = useMissionProfile();
  const collection = useCollection();
  const owned = (collection && collection.owned) || {};
  const [open, setOpen] = useState(null);
  const mastery = (profile && profile.mastery) || {};
  const rows = MASTERY_SKINS.map((skin) => {
    const p = masteryProgress(mastery[skin] || 0);
    const title = titleFor(skin);
    return {
      skin,
      rank: MASTERY_SKIN_RANK[skin],
      p,
      title,
      have: ownsSkin(owned, skin),
      titleOwned: title ? hasTitle(profile, title.id) : false,
    };
  });
  const unlocked = rows.filter((r) => r.have);
  const anyOwned = unlocked.length > 0;
  const total = rows.reduce((s, r) => s + r.p.count, 0);
  const reached = rows.filter((r) => r.p.step >= 1).length;
  const titled = rows.filter((r) => r.titleOwned).length;
  const mastered = rows.filter((r) => r.p.done).length;
  // 通しの称号(17スキンすべてが同じ段)
  const allRows = ALL_TITLES.map((t) => {
    const need = t.id === "mastery-master" ? MASTERY_STEPS.length : MASTERY_TITLE_STEP;
    const has = rows.filter((r) => r.p.step >= need).length;
    return { title: t, need, has, owned: hasTitle(profile, t.id) };
  });

  return (
    <div className="setup-wrap card-mastery">
      <h2>カード</h2>
      <p className="hint">
        所持スキンを装備して王にすると、そのスキンに点がたまります。王に選ぶ +5、駒を出す +1(何体でも)、
        王として動かす +1(1局3点まで)、王で相手の駒を取る +1(10点まで)、王で相手の王を討つ +10。
        段に届くと称号が手に入ります。通常札では増えません。盤の有利不利には効きません。
      </p>
      {!anyOwned && (
        <p className="card-mastery-locked-all">
          <Lock size={14} /> スキンをまだ持っていません。ガチャやミッションでスキンを手に入れると、そのスキンの熟練度が解放されます。
        </p>
      )}
      <div className="card-mastery-summary" aria-label="熟練度のまとめ">
        <span>
          解放したスキン <b>{unlocked.length}</b>/{MASTERY_SKINS.length}
        </span>
        <span>
          称号 <b>{titled}</b>/{MASTERY_SKINS.length}
        </span>
        <span>
          極み <b>{mastered}</b>/{MASTERY_SKINS.length}
        </span>
        <span>
          合計 <b>{total}</b>点
        </span>
      </div>
      <ul className="card-mastery-list">
        {rows.map(({ skin, rank, p, title, have, titleOwned }) => {
          const isOpen = open === skin;
          const s = byId(skin);
          if (!have) {
            // 未所持は鎖(ロック)。スキンの絵は見せず、札の枠だけ薄く出す
            return (
              <li key={skin} className="card-mastery-row is-locked">
                <div className="card-mastery-main card-mastery-locked">
                  <span className="card-mastery-lockart" aria-hidden="true">
                    <CardFace rank={rank} suit="spade" size="sm" isKing animated={false} />
                    <span className="card-mastery-chain">
                      <Lock size={16} />
                    </span>
                  </span>
                  <span className="card-mastery-body">
                    <span className="card-mastery-head">
                      <b className="card-mastery-rank">{rank}</b>
                      <span className="card-mastery-lockname">{s?.name || "スキン"}</span>
                    </span>
                    <small className="card-mastery-left">
                      このスキンを手に入れると解放
                    </small>
                  </span>
                </div>
              </li>
            );
          }
          return (
            <li
              key={skin}
              className={`card-mastery-row${p.done ? " is-done" : ""}${p.step >= 1 ? " is-reached" : ""}`}
            >
              <button
                type="button"
                className="card-mastery-main"
                aria-expanded={isOpen}
                aria-controls={`card-mastery-detail-${skin}`}
                onClick={() => setOpen(isOpen ? null : skin)}
              >
                {/* フォイルが無いスキン(LIMITED の天馬騎士など)は基のスキンの絵にする */}
                <CardFace
                  rank={rank}
                  suit="spade"
                  size="sm"
                  isKing
                  skinId={byId(foilId(skin)) ? foilId(skin) : skin}
                  animated={false}
                />
                <span className="card-mastery-body">
                  <span className="card-mastery-head">
                    <b className="card-mastery-rank">{rank}</b>
                    <span className="card-mastery-step">{masteryStepName(p.step)}</span>
                    <span className="card-mastery-count">
                      {p.done ? `${p.count}点` : `${p.count} / ${p.next}点`}
                    </span>
                  </span>
                  <span
                    className="mastery-track"
                    role="progressbar"
                    aria-label={`${s?.name || rank} の熟練度`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(p.ratio * 100)}
                    aria-valuetext={
                      p.done
                        ? `極み（${p.count}点）`
                        : `${p.count}点。次の段まであと${p.left}点`
                    }
                  >
                    <span style={{ width: `${p.ratio * 100}%` }} />
                  </span>
                  <span className="card-mastery-foot">
                    {titleOwned && title ? (
                      <TitleFrame id={title.id} size="compact" className="card-mastery-title" />
                    ) : title ? (
                      <small>
                        あと{Math.max(0, titleNeed - p.count)}点で称号「{title.name}」
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
                <div className="card-mastery-detail" id={`card-mastery-detail-${skin}`}>
                  <p>
                    <b>{s?.name || "スキン"}</b>
                    {s?.role ? ` · ${s.role}` : ""}
                  </p>
                  {s?.move && (
                    <p>
                      <b>{s.move}</b>
                      {s.description ? ` — ${s.description}` : ""}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <section className="card-mastery-all" aria-label="通しの称号">
        <h3>すべてのスキンを使い込むと</h3>
        {allRows.map(({ title, need, has, owned: got }) => (
          <div key={title.id} className={`card-mastery-all-row${got ? " is-owned" : ""}`}>
            {got ? (
              <TitleFrame id={title.id} size="compact" />
            ) : (
              <b className="card-mastery-all-name">{title.name}</b>
            )}
            <small>
              {title.how} · {masteryStepName(need)}に届いたスキン {has}/{MASTERY_SKINS.length}
            </small>
          </div>
        ))}
        <p className="mastery-steps-note">段の境目: {MASTERY_STEPS.join(" · ")}点</p>
      </section>
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>
    </div>
  );
}
