/**
 * ストーリー(2026-09-30 本人の指示。設計は ストーリーとフェーズ.md)。
 *
 * 画面は2つ:
 *   StoryScreen … いまのフェーズの6ステージ。クリアの印、褒美、昇格までの残り、昇格の釦
 *   StoryIntro  … ステージを始める前の1枚。**相手の王の特徴を毎回説明する**(中身はフェーズで変わる)
 *
 * チュートリアルの一覧(tutorial.jsx)に代わる導線。チュートリアルのコードは残す(本人の指示)
 */
import { useEffect, useState } from "react";
import { typing } from "./key-target.js";
import { ArrowLeft, Check } from "../icons.jsx";
import { loadProfile, promotePhase } from "../game/profile.js";
import { canPromote, promotionStatus } from "../game/phase.js";
import { stageIntro, storyList, nextStage, ranksLabel } from "../game/story.js";
import { CardFace } from "./cards.jsx";

/** フェーズの一言 */
export const PHASE_LABEL = Object.freeze({
  1: "駒の動きだけ",
  2: "王の力あり",
  3: "エリアあり",
});

export function StoryScreen({ onBack, onStart }) {
  const [profile, setProfile] = useState(() => loadProfile());
  const list = storyList(profile);
  const status = promotionStatus(profile);
  const next = nextStage(profile);
  const promotable = canPromote(profile);
  return (
    <div className="setup-wrap story-wrap">
      <div className="story-head">
        <h2>ストーリー</h2>
        <p className="story-phase">
          フェーズ {status.phase}
          <small>{PHASE_LABEL[status.phase]}</small>
        </p>
      </div>
      <ol className="story-list" aria-label="ステージ">
        {list.map((s) => (
          <li key={s.axis}>
            <button
              type="button"
              className={`story-stage ${s.cleared ? "is-cleared" : ""} ${next && next.axis === s.axis ? "is-next" : ""}`}
              onClick={() => onStart(s.axis)}
            >
              <span className="story-stage-ranks" aria-hidden="true">
                {s.ranks.map((r) => (
                  <CardFace key={r} rank={r} suit="spade" size="xs" />
                ))}
              </span>
              <span className="story-stage-body">
                <b>{s.name}の王</b>
                <small>{s.tagline}</small>
              </span>
              <span className="story-stage-tail">
                {s.cleared ? (
                  <>
                    {/* アイコンは aria-label を落とすので、読み上げ用の文字を添える */}
                    <Check size={16} aria-hidden="true" />
                    <span className="sr-only">クリア済み</span>
                  </>
                ) : (
                  <small className="story-stage-reward">チケット {s.tickets}枚</small>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {/* 昇格までの残り。最後のフェーズでは出さない */}
      {!status.last && (
        <section className="story-promotion" aria-label="昇格">
          {promotable ? (
            <button
              type="button"
              className="btn btn-primary story-promote"
              onClick={() => setProfile(promotePhase())}
            >
              フェーズ {status.phase + 1} へ進む
              <small>{PHASE_LABEL[status.phase + 1]}</small>
            </button>
          ) : (
            <p className="hint">
              {/* 数字の前後に空白を置かない(375px で「5」と「勝」の間で折れる) */}
              昇格の条件: 6ステージ全部のクリアと、このフェーズでオンライン対戦に{status.winsNeeded}勝。
              {status.axesLeft.length > 0 && `ステージはあと${status.axesLeft.length}。`}
              {status.winsLeft > 0 && `勝利はあと${status.winsLeft}。`}
            </p>
          )}
        </section>
      )}
      {status.last && (
        <p className="hint">最後のフェーズです。ステージは何度でも遊べます。</p>
      )}
      <button className="btn btn-ghost btn-home" onClick={onBack}>
        <ArrowLeft size={16} /> ホームに戻る
      </button>
    </div>
  );
}

/**
 * ステージの前の1枚を Escape で閉じるか。自分の中(「はじめる」に最初から focus がある)に向いた Escape は受け、
 * 上に重なった別の画面(設定の入力欄など)に向いたものは取らない
 */
export function introKeyCloses(e) {
  if (!e || e.key !== "Escape") return false;
  const t = e.target;
  const mine = !!(t && typeof t.closest === "function" && t.closest(".story-intro"));
  return mine || !typing(e);
}

/** ステージの前の1枚。相手の王の特徴を、そのフェーズの中身で */
export function StoryIntro({ axis, phase, onStart, onBack }) {
  const intro = stageIntro(axis, phase);
  useEffect(() => {
    const onKey = (e) => {
      if (introKeyCloses(e)) onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);
  if (!intro) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-panel story-intro" role="group" aria-label="相手の王">
        <div className="story-intro-head">
          <span className="skins-eyebrow">フェーズ {phase}・{PHASE_LABEL[phase]}</span>
          <h3>{intro.title}</h3>
          <p className="story-intro-lead">{intro.lead}</p>
        </div>
        <ul className="story-intro-items">
          {intro.items.map((it) => (
            <li key={it.rank}>
              <b>{it.rank}</b>
              <span>{it.text}</span>
            </li>
          ))}
        </ul>
        <p className="hint">{intro.note}</p>
        <div className="setup-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            戻る
          </button>
          <button type="button" className="btn btn-primary" onClick={onStart} autoFocus>
            はじめる
          </button>
        </div>
      </div>
    </div>
  );
}

/** ホームのタイルの一言。次のステージか、昇格できるか */
export function storyTileNote(profile) {
  const status = promotionStatus(profile);
  const next = nextStage(profile);
  if (next) return `フェーズ ${status.phase}・次は ${next.name}の王(${ranksLabel(next.ranks)})`;
  if (canPromote(profile)) return `フェーズ ${status.phase + 1} へ進めます`;
  if (status.last) return "全ステージクリア";
  return `昇格まで オンラインの勝利あと ${status.winsLeft}`;
}
