import { useEffect, useRef, useState } from "react";
import { loadProfile } from "../game/profile.js";
import {
  CHRONICLE,
  STORY_PHASES,
  storyArc,
  storyEpisode,
  storyPages,
} from "../game/story-narrative.js";
import art23 from "../../assets/story/chronicle/23.webp";
import art45 from "../../assets/story/chronicle/45.webp";
import art67 from "../../assets/story/chronicle/67.webp";
import art89 from "../../assets/story/chronicle/89.webp";
import art10 from "../../assets/story/chronicle/10.webp";
import artJQ from "../../assets/story/chronicle/jq.webp";
import artK from "../../assets/story/chronicle/k.webp";
import { storyPhrases } from "../game/story-phrases.js";
import { CardFace } from "./cards.jsx";
import { Phrases } from "./phrases.jsx";
import css from "./story-chronicle.css";

export const STORY_ART = {
  23: art23,
  45: art45,
  67: art67,
  89: art89,
  10: art10,
  jq: artJQ,
  k: artK,
};
export function ChronicleStyles() {
  return <style>{css}</style>;
}

/**
 * 年代記の短い文(章の名・ステージの一行・目的・次へ続く一言など)を句の塊で出す(2026-10-06 見直し)。
 * 切り方は story-phrases.js(無ければ読点・句点で切る)。語り・台詞・あらすじ・対立する理由の本文・
 * 世界の説明のような長い地の文は、段落のまま折り返す
 */
export function StoryText({ text }) {
  return <Phrases text={storyPhrases(text)} />;
}

/**
 * 「立場 ／ 主題」「初回クリア · チケット 10枚」のように区切りでつないだ句。区切りは前の句の終わりに付け、
 * 次の句との間はふつうの空白にする(そこで折り返すと消える)。塊の端に入れた空白は塊の中で消えるので外に置く
 */
export function JoinedPhrases({ head, sep, tail }) {
  return (
    <>
      <span className="text-phrase">{`${head} ${sep}`}</span>{" "}
      <Phrases text={storyPhrases(tail)} />
    </>
  );
}

/** 三つの場面を一枚に収めた挿絵。各フェーズはその1/3だけを表示する。 */
export function StoryArt({ axis, phase = 1, className = "" }) {
  const src = STORY_ART[axis];
  return src ? (
    <div className={`chronicle-art ${className}`} aria-hidden="true">
      <img
        src={src}
        alt=""
        style={{ top: `${-(phase - 1) * 100}%` }}
        draggable="false"
      />
    </div>
  ) : null;
}

export function StoryPurpose({ episode, compact = false }) {
  if (!episode?.purpose) return null;
  const { goal, reason, kind, rivalIdeal, playerIdeal } = episode.purpose;
  return (
    <aside className="chronicle-purpose" aria-label="あなたの目的">
      <small>あなたの目的</small>
      <p>
        <StoryText text={goal} />
      </p>
      {!compact && (
        <details>
          <summary>
            <JoinedPhrases head={kind} sep="·" tail="対立する理由" />
          </summary>
          <p>{reason}</p>
          {rivalIdeal && (
            <dl>
              <dt>相手の信念</dt>
              <dd>
                <StoryText text={rivalIdeal} />
              </dd>
              <dt>あなたの信念</dt>
              <dd>
                <StoryText text={playerIdeal} />
              </dd>
            </dl>
          )}
        </details>
      )}
    </aside>
  );
}

/** 自動送りをせず、自分のペースで読める紙芝居。報酬・進行の書き込みは行わない。 */
export function StoryReader({
  axis,
  phase,
  part = "before",
  onDone,
  onClose,
  battle = false,
}) {
  const arc = storyArc(axis);
  const episode = storyEpisode(axis, phase);
  const profile = loadProfile();
  const before = storyPages(profile, axis, phase);
  const after = storyPages(profile, axis, phase, "after");
  const pages =
    part === "all" ? [...before, ...after] : part === "after" ? after : before;
  const [page, setPage] = useState(0);
  const dialog = useRef(null);
  const nextRef = useRef(null);
  const textRef = useRef(null);
  const current = pages[page];
  const ending = part === "after" || (part === "all" && page >= before.length);
  useEffect(() => {
    const previous = document.activeElement;
    nextRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus?.({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (textRef.current) textRef.current.scrollTop = 0;
  }, [page]);
  function keydown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPage((i) => Math.max(0, i - 1));
    }
    if (e.key === "ArrowRight" && page < pages.length - 1) {
      e.preventDefault();
      setPage((i) => i + 1);
    }
    if (e.key === "Tab") {
      const buttons = [
        ...dialog.current.querySelectorAll("button:not(:disabled)"),
      ];
      const first = buttons[0],
        last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
  if (!episode || !current) return null;
  return (
    <div className="modal-overlay chronicle-overlay">
      <ChronicleStyles />
      <section
        className="chronicle-reader"
        role="dialog"
        aria-modal="true"
        aria-label={`${episode.title}・${ending ? "後日談" : "物語"}`}
        ref={dialog}
        onKeyDown={keydown}
      >
        <header className="chronicle-reader-head">
          <div>
            <small>
              フェーズ {phase} · {arc.role}
            </small>
            <h3>
              <StoryText text={episode.title} />
            </h3>
          </div>
          <button
            type="button"
            className="chronicle-text-button"
            onClick={battle ? onDone : onClose}
          >
            {battle ? "対局説明へ" : "閉じる"}
          </button>
        </header>
        <div className="chronicle-scene">
          <StoryArt axis={axis} phase={phase} />
          <span>{episode.place}</span>
        </div>
        <div
          className="chronicle-reader-copy"
          ref={textRef}
          tabIndex={0}
          role="region"
          aria-label="物語本文"
        >
          <div key={page} aria-live="polite" aria-atomic="true">
            <small className="chronicle-kicker">
              {ending ? (
                <Phrases text="戦いのあと" />
              ) : (
                <JoinedPhrases
                  head={arc.name}
                  sep="／"
                  tail={STORY_PHASES[phase].label}
                />
              )}
            </small>
            <b className="chronicle-speaker">{current.speaker}</b>
            <p>{current.text}</p>
            {page === 0 && !ending && (
              <StoryPurpose episode={episode} compact />
            )}
            {page === 0 && !ending && episode.recap && (
              <details className="chronicle-recap">
                <summary>これまでの物語</summary>
                <p>{episode.recap}</p>
              </details>
            )}
            {ending && page === pages.length - 1 && (
              <p className="chronicle-next-voice">
                <small>
                  {phase < 3
                    ? `フェーズ ${phase + 1} へ続く`
                    : "この物語の結び"}
                </small>
                <StoryText text={episode.next} />
              </p>
            )}
          </div>
        </div>
        <footer className="chronicle-reader-controls">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!page}
            onClick={() => setPage((i) => i - 1)}
          >
            前へ
          </button>
          <span aria-label={`${page + 1} / ${pages.length} ページ`}>
            {page + 1} <i>/ {pages.length}</i>
          </span>
          <button
            type="button"
            className="btn btn-primary"
            ref={nextRef}
            onClick={() =>
              page < pages.length - 1 ? setPage((i) => i + 1) : onDone()
            }
          >
            {page < pages.length - 1
              ? "次へ"
              : battle
                ? "対局説明へ"
                : "読み終える"}
          </button>
        </footer>
      </section>
    </div>
  );
}

/** 勝利の記録が済んだ結果画面に置く。読まなくても次へ進め、一覧から読み直せる。 */
export function StoryAfterword({ axis, phase }) {
  const [open, setOpen] = useState(false);
  const episode = storyEpisode(axis, phase);
  if (!episode) return null;
  return (
    <div className="chronicle-afterword">
      <ChronicleStyles />
      <button
        type="button"
        className="btn btn-ghost btn-wide"
        onClick={() => setOpen(true)}
      >
        後日談を読む
      </button>
      {open && (
        <StoryReader
          axis={axis}
          phase={phase}
          part="after"
          onClose={() => setOpen(false)}
          onDone={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export function ChronicleWorld({ phase = 1 }) {
  return (
    <details className="chronicle-world">
      <summary>この国と、あなたの役割</summary>
      <p>{CHRONICLE.world}</p>
      <p>{CHRONICLE.covenant}</p>
      <div className="chronicle-roster">
        <div>
          <CardFace rank="A" suit="spade" size="lg" skinId={false} />
          <span>
            <b>A・忍者 シノ</b>
            <small>{CHRONICLE.guide[phase]}</small>
          </span>
        </div>
      </div>
    </details>
  );
}
