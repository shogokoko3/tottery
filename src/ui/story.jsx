/**
 * ストーリー(2026-09-30 本人の指示。設計は ストーリーとフェーズ.md)。
 *
 * 画面は2つ:
 *   StoryScreen … いまのフェーズの7ステージ。クリアの印、褒美、昇格までの残り、昇格の釦、「遊び方」(導入)
 *   StoryIntro  … ステージを始める前の1枚。**相手の王の特徴を毎回説明する**(中身はフェーズで変わる)。
 *                 フェーズ1 は駒の動き方を**盤の図**で見せる(寿司将棋の導入のように。2026-09-30 本人の指示)
 *
 * チュートリアルの一覧(tutorial.jsx)に代わる導線。チュートリアルのコードは残す(本人の指示)
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { typing } from "./key-target.js";
import { ArrowLeft } from "../icons.jsx";
import { loadProfile, promotePhase } from "../game/profile.js";
import { STORY_AXES, canPromote, promotionStatus, stageSize } from "../game/phase.js";
import { onlineGate } from "../game/online-gate.js";
import { stageIntro, storyList, nextStage, nextStageLine, ranksLabel, storyLesson, storyRival } from "../game/story.js";
import { CardFace } from "./cards.jsx";
import { findTitle } from "../game/titles.js";
import { TitleFrame } from "./title-frame.jsx";
import { MoveDiagram } from "./guides.jsx";
import { CHRONICLE, STORY_PHASES, storyArc, storyEpisode } from "../game/story-narrative.js";
import { ChronicleStyles, StoryArt, StoryReader, ChronicleWorld, StoryPurpose, StoryText, JoinedPhrases } from "./story-chronicle.jsx";
import { StoryChapterArt } from "./story-chapter-art.jsx";
import { Phrases } from "./phrases.jsx";

/** フェーズの一言 */
export const PHASE_LABEL = Object.freeze({
  1: "駒の動きだけ",
  2: "王の力あり",
  3: "エリアあり",
});

export function StoryScreen({ onBack, onStart, onGuide = null, revealNext = false }) {
  const [profile, setProfile] = useState(() => loadProfile());
  // 導入を終えて一覧へ来たら(revealNext)、「次は、四と五の王。」を画面の真ん中へ送る(2026-10-06 見直し)。
  // 一行は年代記の見出しとフェーズの札の下にあり、375×667 では 712px、320×568 では 832px で、送らないと見えなかった
  const nextRef = useRef(null);
  useEffect(() => {
    if (!revealNext) return undefined;
    const id = setTimeout(() => {
      const el = nextRef.current;
      if (!el || !el.scrollIntoView) return;
      const still = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    }, 250);
    return () => clearTimeout(id);
  }, [revealNext]);
  const status = promotionStatus(profile);
  const [phase, setPhase] = useState(status.phase);
  const [reading, setReading] = useState(null);
  const list = storyList({ ...profile, phase });
  const next = phase === status.phase ? nextStage(profile) : null;
  const nextLine = phase === status.phase ? nextStageLine(profile) : null;
  const promotable = canPromote(profile);
  const gate = onlineGate(profile);
  const available = phase <= status.phase;
  const act = STORY_PHASES[phase];
  const titleGoal = ["win10", "win30"]
    .map(findTitle)
    .find((title) => title && !title.unlocked(profile));
  return (
    <div className="setup-wrap story-wrap chronicle-hub">
      <ChronicleStyles />
      {/* 年代記の短い文は句の塊で出す(語の途中で割らない。2026-10-06 見直し)。長い地の文は段落のまま */}
      <header className="chronicle-hero">
        <StoryArt axis="k" phase={Math.min(phase, status.phase)} />
        <div className="chronicle-hero-top">
          <span>
            <Phrases text="ストーリー · 七つの立場、三つの時代" />
          </span>
          {onGuide && (
            <button
              type="button"
              className="chronicle-text-button"
              onClick={onGuide}
            >
              遊び方
            </button>
          )}
        </div>
        <div>
          <small className="chronicle-kicker">
            THE CHRONICLE OF THE ASHEN CROWN
          </small>
          <h2>{CHRONICLE.title}</h2>
          <p>
            <StoryText text={CHRONICLE.subtitle} />
          </p>
        </div>
      </header>
      <div className="chronicle-main">
        <nav className="chronicle-phases" aria-label="物語のフェーズ">
          {[1, 2, 3].map((p) => (
            <button
              type="button"
              key={p}
              aria-pressed={phase === p}
              onClick={() => setPhase(p)}
            >
              <small>
                PHASE {p}
                <span>
                  {p > status.phase
                    ? "未解放"
                    : p < status.phase
                      ? "回想"
                      : "進行中"}
                </span>
              </small>
              <b>
                <StoryText text={STORY_PHASES[p].title} />
              </b>
            </button>
          ))}
        </nav>
        <section className="chronicle-phase-intro">
          <h3>{act.label}</h3>
          <p>{act.summary}</p>
          <div className="chronicle-journey">
            <b>{phase === 1 ? "あなたが戦う理由" : "あなたが引き受けるもの"}</b>
            {/* フェーズ1 はあなたが戦う理由(段落)。2・3 は短い目的なので句で */}
            <p>{phase === 1 ? CHRONICLE.player : <StoryText text={act.purpose} />}</p>
          </div>
          <p className="story-phase">
            フェーズ {phase}
            <small>
              {PHASE_LABEL[phase]}・{stageSize(phase)}×{stageSize(phase)}
            </small>
          </p>
        </section>
        {!available ? (
          <section className="chronicle-locked">
            <b>
              <Phrases text="この先の頁は、まだ閉じている。" />
            </b>
            <p>
              現在のフェーズの7ステージをクリアし、
              <br />
              オンライン対戦で{status.winsNeeded}
              勝すると、次のフェーズへ進めます。
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPhase(status.phase)}
            >
              進行中の物語へ
            </button>
          </section>
        ) : (
          <>
            {nextLine && (
              <p className="story-next" ref={nextRef}>
                {nextLine}
              </p>
            )}
            <div
              className="story-progress"
              aria-label={`${list.filter((s) => s.cleared).length} / ${list.length} ステージクリア`}
            >
              <div aria-hidden="true">
                {list.map((s) => (
                  <i
                    key={s.axis}
                    className={
                      s.cleared
                        ? "is-cleared"
                        : next?.axis === s.axis
                          ? "is-next"
                          : ""
                    }
                  />
                ))}
              </div>
              <small>
                {list.filter((s) => s.cleared).length} / {list.length} クリア
              </small>
            </div>
            <ol className="story-list" aria-label="七つの物語">
              {list.map((s) => {
                const arc = storyArc(s.axis),
                  chapter = storyEpisode(s.axis, phase);
                const replayOnly = phase < status.phase;
                return (
                  <li key={s.axis} className="chronicle-chapter">
                    <button
                      type="button"
                      className={`story-stage ${s.cleared ? "is-cleared" : ""} ${next?.axis === s.axis ? "is-next" : ""}`}
                      onClick={() =>
                        replayOnly ? setReading(s.axis) : onStart(s.axis)
                      }
                    >
                      <span className="chronicle-chapter-image">
                        <StoryChapterArt axis={s.axis} phase={phase} />
                        <span>{s.ranks.join(" · ")}</span>
                      </span>
                      <span className="story-stage-body">
                        <span className="chronicle-role">
                          <JoinedPhrases head={arc.role} sep="／" tail={arc.theme} />
                        </span>
                        <b>
                          <StoryText text={chapter.title} />
                        </b>
                        <span className="story-stage-rival">{arc.cast}</span>
                        <small>
                          <StoryText text={chapter.hook} />
                        </small>
                        <span className="sr-only">{s.name}の王</span>
                      </span>
                    </button>
                    <div className="chronicle-chapter-tail">
                      <small>
                        {s.cleared ? (
                          <JoinedPhrases head="✓ クリア済み" sep="·" tail="後日談を解放" />
                        ) : (
                          <JoinedPhrases head="初回クリア" sep="·" tail={`チケット ${s.tickets}枚`} />
                        )}
                      </small>
                      <button
                        type="button"
                        className="chronicle-text-button"
                        onClick={() => setReading(s.axis)}
                      >
                        {s.cleared ? "回想を読む" : "物語を読む"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
        <ChronicleWorld phase={Math.min(phase, status.phase)} />
        {titleGoal && (
          <details className="chronicle-world">
            <summary>対局を重ねて目指す称号</summary>
            <section className="story-title-goal">
              <TitleFrame id={titleGoal.id} />
              <p>
                {titleGoal.how}・現在 {profile.wins || 0}勝
              </p>
              <small>獲得した称号は、オンラインの名前に添えられます。</small>
            </section>
          </details>
        )}
        {!status.last && (
          <section className="story-promotion" aria-label="昇格">
            {promotable ? (
              <button
                type="button"
                className="btn btn-primary story-promote"
                onClick={() => {
                  const promoted = promotePhase();
                  setProfile(promoted);
                  setPhase(promotionStatus(promoted).phase);
                }}
              >
                フェーズ {status.phase + 1} へ進む
                <small>
                  {STORY_PHASES[status.phase + 1].title} ·{" "}
                  {PHASE_LABEL[status.phase + 1]}
                </small>
              </button>
            ) : (
              <p className="hint">
                昇格の条件: {STORY_AXES.length}
                ステージ全部のクリアと、このフェーズでオンライン対戦に
                {status.winsNeeded}勝。
                {status.axesLeft.length > 0 &&
                  `ステージはあと${status.axesLeft.length}。`}
                {status.winsLeft > 0 && `勝利はあと${status.winsLeft}。`}
              </p>
            )}
          </section>
        )}
        {status.last && (
          <p className="hint">
            最後のフェーズです。ステージは何度でも遊べます。
          </p>
        )}
        {!gate.ok && (
          <p className="hint story-gate">
            ランダムマッチまで、あと{gate.remaining}ステージ。
            <span>フレンドとは、ホームの「対戦する」から今すぐ遊べます。</span>
          </p>
        )}
        <button className="btn btn-ghost btn-home" onClick={onBack}>
          <ArrowLeft size={16} /> ホームに戻る
        </button>
      </div>
      {reading && (
        <StoryReader
          key={`${reading}-${phase}`}
          axis={reading}
          phase={phase}
          part="all"
          onDone={() => setReading(null)}
          onClose={() => setReading(null)}
        />
      )}
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
  const [reading, setReading] = useState(true);
  const arc = storyArc(axis);
  const intro = stageIntro(axis, phase);
  const rival = storyRival(axis, phase);
  const lesson = storyLesson(axis, phase);
  // 開いたら「はじめる」に focus(画面は送らない。autoFocus だと札がスクロールして題が隠れていた)
  const startRef = useRef(null);
  useEffect(() => {
    try {
      if (!reading && startRef.current && startRef.current.focus) startRef.current.focus({ preventScroll: true });
    } catch {
      /* focus できなくても押せる */
    }
  }, [axis, reading]);
  useEffect(() => {
    const onKey = (e) => {
      if (!reading && introKeyCloses(e)) onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, reading]);
  if (!intro) return null;
  return (
    <>
    <ChronicleStyles />
    <div className="modal-overlay" style={reading ? { display: "none" } : undefined}>
      <div className="modal-panel story-intro chronicle-rules" role="dialog" aria-modal="true" aria-label="相手の王">
        <div className="story-intro-head">
          <span className="skins-eyebrow">
            フェーズ {phase}・{PHASE_LABEL[phase]}・{stageSize(phase)}×{stageSize(phase)}
          </span>
          <h3>
            <StoryText text={storyEpisode(axis, phase)?.title} />
          </h3>
          <p className="chronicle-kicker">対局説明 · {intro.title}</p>
          <p className="story-intro-lead">{intro.lead}</p>
        </div>
        {/* 登場人物の一言・この局のねらいは句の塊で(語の途中で割らない。2026-10-06 見直し)。挑戦状(台詞)は段落のまま */}
        {arc && <div className="chronicle-roster">{arc.characters.map(c => <div key={c.rank}><CardFace rank={c.rank} suit="spade" size="sm" skinId={false} /><span><b>{c.name}</b><small><StoryText text={c.detail} /></small></span></div>)}</div>}
        <StoryPurpose episode={storyEpisode(axis, phase)} />
        {rival && (
          <div className="story-rival">
            <div><b>{rival.quoteSpeaker || rival.name}</b><p className="story-rival-quote">{rival.quote}</p><small><Phrases text={rival.aim} /></small></div>
          </div>
        )}
        {lesson && <p className="story-lesson">手札{lesson.handSize}枚から5枚を並べる。<span>使う札：{lesson.pool.join("・")}／時間制限なし</span></p>}
        {phase === 1 ? (
          // フェーズ1 は駒の動き方を盤の図で。図はルール(getLegalMoves)から描く MoveDiagram、文は MOVE_TEXT のまま
          // (句に切った MOVE_PHRASES で出す。つなぐと MOVE_TEXT)。
          // 図は 9×9 の中央から描く(5×5 だと 2マス先までしか描けず、8 と 2・J と 4 などが同じ絵になっていた)
          <ul className="story-intro-moves">
            {intro.items.map((it) => (
              <li key={it.rank}>
                <div className="story-move-art">
                  <CardFace rank={it.rank} suit="spade" size="sm" skinId={false} />
                  <MoveDiagram rank={it.rank} gridSize={9} />
                </div>
                {/* 句ごとに折り返す(語の途中で割らない。2026-10-05 見直し) */}
                <p>
                  {(it.phrases || [it.text]).map((phrase, i) => (
                    <span className="text-phrase" key={i}>
                      {phrase}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="story-intro-items">
            {intro.items.map((it) => (
              <li key={it.rank}>
                <b>{it.rank}</b>
                <span>{it.text}</span>
              </li>
            ))}
          </ul>
        )}
        {/* 1文1行(2026-10-01 本人の指示。長い1行だと語の途中で割れる) */}
        <p className="hint story-intro-note">
          {intro.note.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
        <div className="setup-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            戻る
          </button>
          <button type="button" className="btn btn-primary" onClick={onStart} ref={startRef}>
            はじめる
          </button>
        </div>
      </div>
    </div>
    {reading && <StoryReader key={`${axis}-${phase}`} axis={axis} phase={phase} onDone={() => setReading(false)} onClose={onBack} battle />}
    </>
  );
}

/**
 * ステージの中断の確認(2026-10-01 本人の指示「ストーリー中に中断できるようなボタン」)。
 * 中断はクリアにも負けにもしない(記録は対局の終わりにしか付けないので、途中で抜ければ何も残らない)。
 * ストーリーの一覧へ戻り、あとで最初から遊べる。チュートリアルの「中断してやめる」と同じ考え方
 */
export function StoryInterruptConfirm({ onCancel, onInterrupt }) {
  // 開いたら「対局を続ける」に focus。Escape でも続ける(閉じる)
  const keepRef = useRef(null);
  useEffect(() => {
    try {
      if (keepRef.current && keepRef.current.focus) keepRef.current.focus({ preventScroll: true });
    } catch {
      /* focus できなくても押せる */
    }
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="modal-overlay tutorial-skip-confirm" onClick={onCancel}>
      <div
        className="modal-panel tutorial-offer story-interrupt"
        role="dialog"
        aria-modal="true"
        aria-label="ステージを中断する"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>ステージを中断しますか?</h3>
        <p className="hint">
          クリアにも負けにもなりません。ストーリーの一覧に戻り、このステージはあとで最初から遊べます。
        </p>
        <div className="tutorial-skip-options">
          <button type="button" className="btn btn-primary btn-wide" onClick={onCancel} ref={keepRef}>
            対局を続ける
          </button>
          <button type="button" className="btn btn-ghost btn-wide" onClick={onInterrupt}>
            中断してストーリーへ
          </button>
        </div>
      </div>
    </div>
  );
}

/** 札の外に出す先(色の変数を持つ画面の根)。無ければ body */
const portalRoot = () => document.querySelector(".tottery-root") || document.body;

/** 対局の上のバーに置く「中断」。押すと確認を出す(StoryInterruptConfirm) */
export function StoryInterruptMenu({ onInterrupt }) {
  const [open, setOpen] = useState(false);
  const confirm = open ? (
    <StoryInterruptConfirm
      onCancel={() => setOpen(false)}
      onInterrupt={() => {
        setOpen(false);
        onInterrupt();
      }}
    />
  ) : null;
  return (
    <>
      <button
        type="button"
        className="icon-btn plain tutorial-skip-top story-interrupt-top"
        onClick={() => setOpen(true)}
        aria-label="ステージを中断する"
      >
        中断
      </button>
      {confirm && (typeof document === "undefined" ? confirm : createPortal(confirm, portalRoot()))}
    </>
  );
}

/**
 * ストーリー2つ目の手当ての一言(src/game/story-coach.js。2026-10-01 本人の指示)。1文1行。
 * サイコロと引き直しは見出しの下、陣は見出しの代わりに帯へ置く。無ければ何も出さない
 */
export function StoryCoachNote({ lines }) {
  if (!lines || !lines.length) return null;
  return (
    <p className="story-coach" role="status">
      {lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </p>
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
