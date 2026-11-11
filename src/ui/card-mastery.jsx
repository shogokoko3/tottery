import { ArrowLeft, Lock } from "../icons.jsx";
/**
 * ホームの「カード」。スキンごとの熟練度を見る画面(2026-09-22 着手。2026-09-24 でスキン制に)。
 *
 * 熟練度は**所持スキンを装備して王にし、貯めた点**(src/game/profile.js)。通常札では貯まらない。
 * シリーズを切り替え、A〜K の順に点・段・次の段までの残り・称号を出す。
 * 所持していないスキンは鎖(ロック)。スキンを1つも持っていなければ、この画面全体がロック。
 *
 * ここは見るだけ。数えるのは対局(src/ui/game.jsx)、貯めるのは recordMastery。
 * 盤の有利不利には一切効かせない(docs/mastery.md §3-4)。
 */
import { useState } from "react";
import {
  MASTERY_STEPS,
  MASTERY_TITLE_STEP,
  MASTERY_SERIES,
  MASTERY_SKIN_RANK,
} from "../game/constants.js";
import { masteryProgress } from "../game/profile.js";
import { MASTERY_TITLES, hasTitle } from "../game/titles.js";
import { useCollection } from "../skins/store.js";
import { byId, foilId } from "../skins/catalog.js";
import { CardFace } from "./cards.jsx";
import { useMissionProfile } from "./mission-profile.js";
import { isSeriesOpen } from "../game/content-seasons.js";
import { FRAME_GRADES } from "./title-design.js";
import { TitleFrame } from "./title-frame.jsx";
import { L, Lx } from "../i18n/index.js";

/** 段の呼び名。終局画面のメーター(mastery.jsx)と同じ言い方にそろえる */
export function masteryStepName(step) {
  if (step <= 0) return L("未到達");
  if (step >= MASTERY_STEPS.length) return L("極み");
  return FRAME_GRADES[step - 1] ? FRAME_GRADES[step - 1].name : L("段{n}", { n: step });
}

const titleNeed = MASTERY_STEPS[MASTERY_TITLE_STEP - 1];
const titleFor = (skin) => MASTERY_TITLES.find((t) => t.mastery === skin);
const ALL_TITLES = MASTERY_TITLES.filter((t) => t.mastery === "all");

/** そのスキンを持っているか(通常版・フォイルのどちらかを持っていれば所持) */
const ownsSkin = (owned, skin) => !!(owned?.[skin] || owned?.[foilId(skin)]);

export function CardMasteryScreen({ onBack, initialSeries = null }) {
  const [profile] = useMissionProfile();
  const collection = useCollection();
  const owned = (collection && collection.owned) || {};
  // ガチャと同じ流れ(2026-10-16 本人の指示): まず「シリーズ選択」の画面、選ぶといつもの一覧。
  // 一覧の右上の「シリーズ選択へ」で選択画面に戻る
  const [seriesId, setSeriesId] = useState(initialSeries);
  // まだ始まっていないシーズンは出さない。ただしそのシリーズのスキンを持っていれば出す(2026-11-09)
  const shownSeries = MASTERY_SERIES.filter(
    (s) => isSeriesOpen(s.id) || s.skins.some((skin) => ownsSkin(owned, skin)),
  );
  const series = shownSeries.find((s) => s.id === seriesId) || shownSeries[0] || MASTERY_SERIES[0];
  const pickSeries = (id) => {
    setSeriesId(id);
    setOpen(null);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };
  const [open, setOpen] = useState(null);
  const mastery = (profile && profile.mastery) || {};
  const rows = series.skins.map((skin) => {
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
  const anyOwned = MASTERY_SERIES.some((s) => s.skins.some((skin) => ownsSkin(owned, skin)));
  const total = rows.reduce((s, r) => s + r.p.count, 0);
  const titled = rows.filter((r) => r.titleOwned).length;
  const mastered = rows.filter((r) => r.p.done).length;
  // 通しの称号も表示中のシリーズだけで数える。
  const allRows = ALL_TITLES.filter((t) => t.masterySeries === series.id).map((t) => {
    const need = t.id.endsWith("-master") ? MASTERY_STEPS.length : MASTERY_TITLE_STEP;
    const has = rows.filter((r) => r.p.step >= need).length;
    return { title: t, need, has, owned: hasTitle(profile, t.id) };
  });

  if (!seriesId)
    return (
      <div className="setup-wrap card-mastery">
        <h2>{L("カード")}</h2>
        <p className="hint">
          {L("熟練度を見るシリーズを選びます。所持スキンを装備して対局すると、そのスキンに点がたまります。")}
        </p>
        {!anyOwned && (
          <p className="card-mastery-locked-all">
            <Lock size={14} />{" "}
            {L(
              "スキンをまだ持っていません。ガチャやミッションでスキンを手に入れると、そのスキンの熟練度が解放されます。",
            )}
          </p>
        )}
        <div className="card-mastery-pick-list" role="list" aria-label={L("シリーズを選ぶ")}>
          {shownSeries.map((s) => {
            const have = s.skins.filter((skin) => ownsSkin(owned, skin));
            const points = s.skins.reduce((n, skin) => n + (mastery[skin] || 0), 0);
            return (
              <section className="gacha-pick card-mastery-pick" key={s.id} role="listitem">
                <div className="gacha-pick-head">
                  <h2>{Lx(s.name)}</h2>
                  <span>
                    {L("所持 {have}/{total} · 合計 {points}点", {
                      have: have.length,
                      total: s.skins.length,
                      points,
                    })}
                  </span>
                </div>
                <div className="card-mastery-pick-art" onClick={() => pickSeries(s.id)} aria-hidden="true">
                  {s.skins.map((skin) => (
                    <CardFace
                      key={skin}
                      rank={MASTERY_SKIN_RANK[skin]}
                      suit="spade"
                      size="sm"
                      isKing
                      skinId={ownsSkin(owned, skin) ? (owned[foilId(skin)] ? foilId(skin) : skin) : undefined}
                      animated={false}
                    />
                  ))}
                </div>
                <button type="button" className="skin-btn skin-btn-gold gacha-pick-go" onClick={() => pickSeries(s.id)}>
                  {L("このシリーズの熟練度を見る")}
                </button>
              </section>
            );
          })}
        </div>
        <button className="btn btn-ghost btn-home" onClick={onBack}>
          <ArrowLeft size={16} /> {L("ホームに戻る")}
        </button>
      </div>
    );

  return (
    <div className="setup-wrap card-mastery">
      <div className="card-mastery-top">
        <h2>{L("カード")}</h2>
        {/* 右上にガチャと同じ「シリーズ選択へ」(2026-10-16 本人の指示) */}
        <button type="button" className="skins-gacha-back card-mastery-back" onClick={() => { setSeriesId(null); setOpen(null); }}>
          <ArrowLeft size={14} /> {L("シリーズ選択へ")}
        </button>
      </div>
      <p className="card-mastery-series-name">{Lx(series.name)}</p>
      <p className="hint">
        {L(
          "所持スキンを装備して対局すると、そのスキンに点がたまります。通常版とフォイル版は同じ熟練度です。 王に選ぶ +5、駒を出す +1(何体でも)、 王として動かす +1(1局3点まで)、王で相手の駒を取る +1(10点まで)、王で相手の王を討つ +10。 段に届くと称号が手に入ります。通常札では増えません。盤の有利不利には効きません。",
        )}
      </p>
      {!anyOwned && (
        <p className="card-mastery-locked-all">
          <Lock size={14} />{" "}
            {L(
              "スキンをまだ持っていません。ガチャやミッションでスキンを手に入れると、そのスキンの熟練度が解放されます。",
            )}
        </p>
      )}
      <div className="card-mastery-summary" aria-label={L("熟練度のまとめ")}>
        <span>
          {L("解放したスキン")} <b>{unlocked.length}</b>/{series.skins.length}
        </span>
        <span>
          {L("称号")} <b>{titled}</b>/{series.skins.length}
        </span>
        <span>
          {L("極み")} <b>{mastered}</b>/{series.skins.length}
        </span>
        <span>
          {L("合計")} <b>{total}</b>
          {L("点")}
        </span>
      </div>
      <ul className="card-mastery-list" aria-label={L("{series}シリーズの熟練度", { series: Lx(series.name) })}>
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
                      <span className="card-mastery-lockname">{Lx(s?.name) || L("スキン")}</span>
                    </span>
                    <small className="card-mastery-left">
                      {L("このスキンを手に入れると解放")}
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
                {/* 持っている版の絵を映す。フォイル所持ならフォイル、通常だけ(や天馬騎士など
                    フォイルの無いスキン)なら通常の絵 */}
                <CardFace
                  rank={rank}
                  suit="spade"
                  size="sm"
                  isKing
                  skinId={owned[foilId(skin)] ? foilId(skin) : skin}
                  animated={false}
                />
                <span className="card-mastery-body">
                  <span className="card-mastery-head">
                    <b className="card-mastery-rank">{rank}</b>
                    <span className="card-mastery-skin-name">{Lx(s?.name) || L("スキン")}</span>
                    <span className="card-mastery-step">{masteryStepName(p.step)}</span>
                    <span className="card-mastery-count">
                      {p.done
                        ? L("{n}点", { n: p.count })
                        : L("{n} / {next}点", { n: p.count, next: p.next })}
                    </span>
                  </span>
                  <span
                    className="mastery-track"
                    role="progressbar"
                    aria-label={L("{name} の熟練度", { name: Lx(s?.name) || rank })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(p.ratio * 100)}
                    aria-valuetext={
                      p.done
                        ? L("極み（{n}点）", { n: p.count })
                        : L("{n}点。次の段まであと{left}点", {
                            n: p.count,
                            left: p.left,
                          })
                    }
                  >
                    <span style={{ width: `${p.ratio * 100}%` }} />
                  </span>
                  <span className="card-mastery-foot">
                    {titleOwned && title ? (
                      <TitleFrame id={title.id} size="compact" className="card-mastery-title" />
                    ) : title ? (
                      <small>
                        {L("あと{n}点で称号「{name}」", {
                          n: Math.max(0, titleNeed - p.count),
                          name: Lx(title.name),
                        })}
                      </small>
                    ) : null}
                    {!p.done && (
                      <small className="card-mastery-left">
                        {L("次の段まであと {n}", { n: p.left })}
                      </small>
                    )}
                    {p.done && (
                      <small className="card-mastery-left">{L("これ以上は上がりません")}</small>
                    )}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="card-mastery-detail" id={`card-mastery-detail-${skin}`}>
                  <p>
                    <b>{Lx(s?.name) || L("スキン")}</b>
                    {s?.role ? ` · ${Lx(s.role)}` : ""}
                  </p>
                  {s?.move && (
                    <p>
                      <b>{Lx(s.move)}</b>
                      {s.description ? ` — ${Lx(s.description)}` : ""}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <section className="card-mastery-all" aria-label={L("通しの称号")}>
        <h3>{L("{series}の全スキンを使い込むと", { series: Lx(series.name) })}</h3>
        {allRows.map(({ title, need, has, owned: got }) => (
          <div key={title.id} className={`card-mastery-all-row${got ? " is-owned" : ""}`}>
            {got ? (
              <TitleFrame id={title.id} size="compact" />
            ) : (
              <b className="card-mastery-all-name">{Lx(title.name)}</b>
            )}
            <small>
              {title.how} ·{" "}
              {L("{step}に届いたスキン {has}/{total}", {
                step: masteryStepName(need),
                has,
                total: series.skins.length,
              })}
            </small>
          </div>
        ))}
        <p className="mastery-steps-note">
          {L("段の境目: {steps}点", { steps: MASTERY_STEPS.join(" · ") })}
        </p>
      </section>
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> {L("ホームに戻る")}
      </button>
    </div>
  );
}
