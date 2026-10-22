import { useEffect, useRef, useState } from "react";
import { loadProfile } from "../game/profile.js";
import {
  CHRONICLE,
  STORY_PHASES,
  storyArc,
  storyEpisode,
  STORY_PROLOGUE,
  STORY_COMIC_ATLASES,
  storyReadingPages,
  storyComicUrl,
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
  if (CHRONICLE.presentation === "text" || CHRONICLE.presentation === "manga-atlas") return null;
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
    <aside className="chronicle-purpose" aria-label="この追憶の目的">
      <small>この追憶の目的</small>
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
              <dt>ニノの思い</dt>
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

/** 吹き出しの見出しに名前は表示しない。話者情報は原稿・読み上げ用に保持する。 */
export function ComicPanel({ page, column, panel }) {
  const atlas = page.art || STORY_COMIC_ATLASES[page.sheet];
  const crop = (page.art ? atlas.cells[column] : atlas?.cells[page.row]?.[column]) || [column * 512, page.row * 288, 512, 288];
  const [failed, setFailed] = useState(false);
  return <figure className={`chronicle-comic-panel${page.art ? " has-printed-lettering" : ""}${panel.lines.length > 1 ? " has-conversation" : ""}`}>
    <div className="chronicle-comic-image" aria-hidden="true" style={{aspectRatio: `${crop[2]} / ${crop[3]}`}}>
      {failed ? <span className="chronicle-comic-missing">絵を読み込めませんでした。台詞で続きを読めます。</span> :
        <svg viewBox={crop.join(" ")} preserveAspectRatio="xMidYMid meet" focusable="false">
          <defs><clipPath id={`comic-crop-${page.id}-${column}`}><rect x={crop[0]} y={crop[1]} width={crop[2]} height={crop[3]} /></clipPath></defs>
          <image clipPath={`url(#comic-crop-${page.id}-${column})`} href={storyComicUrl(page.art?.sheet || page.sheet)} width={atlas?.width || 1536} height={atlas?.height || page.rows * 288} onError={() => setFailed(true)} />
        </svg>}
    </div>
    <figcaption className={`chronicle-comic-lettering${page.art && !failed ? " printed-comic-transcript" : ""}`}>{panel.lines.map((line, i) => <div key={i}
      role="group" aria-label={line.speaker === "語り" ? "ナレーション" : line.speaker} data-speaker={line.speaker}
      className={`comic-letter ${line.speaker === "語り" ? "comic-narration" : "comic-balloon"}${line.offscreen ? " is-offscreen" : ""}`}>
      <p>{line.speaker === "語り" ? line.text : line.text.replace(/^「|」$/g, "")}</p>
    </div>)}</figcaption>
  </figure>;
}

/** 台詞・ナレーション・コマ割りを一枚に描いた完成ページ。 */
export function ComicPage({ page, zoomed = false }) {
  const [failed, setFailed] = useState(false);
  const art = page.art;
  if (art?.layout === "printed-manga") return <figure className={`ouhiroi-printed-page${zoomed ? " is-zoomed" : ""}`}>
    {!failed && <img src={storyComicUrl(art.sheet)} alt={page.label} onError={() => setFailed(true)} />}
    <figcaption className={failed ? "ouhiroi-image-fallback" : "printed-comic-transcript"}>
      {failed && <p role="status">絵を読み込めませんでした。本文で続きを読めます。</p>}
      {page.panels.flatMap(panel => panel.lines).map((line, i) => <p key={i} aria-label={line.speaker}>{line.speaker !== "語り" ? `${line.speaker} ` : ""}{line.text}</p>)}
    </figcaption>
  </figure>;
  if (art?.layout === "app-lettered-atlas") return <div className="ouhiroi-manga-page">
    {page.panels.map((panel, i) => <AtlasMangaPanel key={i} page={page} panel={panel} index={i} />)}
  </div>;
  if (!art) return <article className="chronicle-story-page" aria-label={page.label}>
    {page.panels.flatMap(panel => panel.lines).map((line, i) =>
      <div key={i} className={line.speaker === "語り" ? "story-prose" : "story-dialogue"}>
        {line.speaker !== "語り" && <small>{line.speaker}</small>}
        <p>{line.text}</p>
      </div>)}
  </article>;
  return <figure className={`chronicle-comic-panel has-printed-lettering${failed ? " is-missing" : ""}`}>
    <div className="chronicle-comic-image" aria-hidden="true">
      {failed ? <span className="chronicle-comic-missing">絵を読み込めませんでした。台詞で続きを読めます。</span> :
        <svg viewBox={`0 0 ${art.width} ${art.height}`} preserveAspectRatio="xMidYMid meet" focusable="false">
          <image href={storyComicUrl(art.sheet)} width={art.width} height={art.height} onError={() => setFailed(true)} />
        </svg>}
    </div>
    <figcaption className={`chronicle-comic-lettering${failed ? "" : " printed-comic-transcript"}`}>
      {page.panels.flatMap(panel => panel.lines).map((line, i) => <div key={i} role="group"
        aria-label={line.speaker === "語り" ? "ナレーション" : line.speaker} data-speaker={line.speaker}
        className={`comic-letter ${line.speaker === "語り" ? "comic-narration" : "comic-balloon"}${line.offscreen ? " is-offscreen" : ""}`}>
        <p>{line.text.replace(/^「|」$/g, "")}</p>
      </div>)}
    </figcaption>
  </figure>;
}

/** 絵のコマを一つずつ切り出し、日本語は拡大できる本文として組む。 */
function AtlasMangaPanel({ page, panel, index }) {
  const [failed, setFailed] = useState(false);
  const art = page.art, crop = art.cells[index];
  return <figure className="ouhiroi-manga-panel">
    <div className="ouhiroi-panel-image" style={{ aspectRatio: `${crop[2]} / ${crop[3]}` }}>
      {failed ? <p role="status">絵を読み込めませんでした。本文で続きを読めます。</p> :
        <svg viewBox={crop.join(" ")} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${page.label} ${index + 1}コマ目`}>
          <defs><clipPath id={`ouhiroi-${page.id}-${index}`}><rect x={crop[0]} y={crop[1]} width={crop[2]} height={crop[3]} /></clipPath></defs>
          <image clipPath={`url(#ouhiroi-${page.id}-${index})`} href={storyComicUrl(art.sheet)} width={art.width} height={art.height} onError={() => setFailed(true)} />
        </svg>}
    </div>
    <figcaption>{panel.lines.map((line, i) => <div key={i} className={line.speaker === "語り" ? "ouhiroi-narration" : "ouhiroi-balloon"}>
      {line.speaker !== "語り" && <small>{line.speaker}</small>}
      <p>{line.text}</p>
    </div>)}</figcaption>
  </figure>;
}

/** 一画面に一ページ全体。閲覧だけではクリア・報酬は変わらない。 */
export function StoryReader({ axis, phase = 1, part = "before", onDone, onClose, battle = false, requireRead = false, lesson = null }) {
  const prologue = axis === "prologue";
  const arc = storyArc(axis);
  const episode = prologue ? STORY_PROLOGUE : storyEpisode(axis, phase);
  const profile = loadProfile();
  const chapterPages = storyReadingPages(profile, axis, phase, part);
  const opening = battle && axis === "23" && phase === 1 && part === "before";
  const sourcePages = opening ? [...(STORY_PROLOGUE.mangaPages || STORY_PROLOGUE.pages), ...chapterPages] : chapterPages;
  const pages = lesson?.pages || sourcePages;
  const [page, setPage] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const dialog = useRef(null), nextRef = useRef(null), textRef = useRef(null);
  const current = pages[page];
  useEffect(() => {
    const previous = document.activeElement;
    nextRef.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (textRef.current) { textRef.current.scrollTop = 0; textRef.current.scrollLeft = 0; } setZoomed(false); }, [page]);
  useEffect(() => {
    const copy = textRef.current;
    if (copy) copy.scrollLeft = zoomed ? copy.scrollWidth - copy.clientWidth : 0;
  }, [zoomed]);
  function keydown(e) {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); setPage(i => Math.max(0, i - 1)); }
    if (e.key === "ArrowRight" && page < pages.length - 1) { e.preventDefault(); setPage(i => i + 1); }
    if (e.key === "Tab") {
      const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }
  if (!episode || !current) return null;
  const inOpening = prologue || (STORY_PROLOGUE.mangaPages || STORY_PROLOGUE.pages).some(p => p.id === current.id);
  const heading = lesson?.title || (inOpening ? STORY_PROLOGUE.title : episode.title);
  return <div className="modal-overlay chronicle-overlay">
    <ChronicleStyles />
    <section className={`chronicle-reader chronicle-manga chronicle-page-reader${lesson ? " chronicle-lesson" : ""}${lesson && current.art ? " has-lesson-art" : ""}${CHRONICLE.presentation === "text" || CHRONICLE.presentation === "manga-atlas" ? " chronicle-text-reader" : ""}`} role="dialog" aria-modal="true"
      aria-label={`${heading}・${lesson ? "遊び方" : "物語"}`} ref={dialog} onKeyDown={keydown}>
      <header className="chronicle-reader-head">
        <div><small>{lesson ? "漫画でわかる遊び方" : inOpening ? "旅のはじまり" : `フェーズ ${phase} · ${arc.role}`}</small><h3><StoryText text={heading} /></h3></div>
        <button type="button" className="chronicle-text-button" onClick={battle && !requireRead ? onDone : onClose}>{lesson?.closeLabel || (battle && !requireRead ? "対局説明へ" : "閉じる")}</button>
      </header>
      <div className="chronicle-comic-toolbar">
        <span aria-live="polite">{current.label} · {page + 1} / {pages.length}</span>
        {current.art?.layout === "printed-manga" && <button type="button" className="chronicle-text-button" aria-pressed={zoomed} onClick={() => setZoomed(v => !v)}>{zoomed ? "全体" : "拡大"}</button>}
      </div>
      <div className={`chronicle-reader-copy chronicle-comic-copy${current.playGuide ? " has-play-guide" : ""}`} ref={textRef} tabIndex={0} role="region" aria-label={lesson ? "遊び方本文" : "物語本文"}>
        <div key={current.id} data-comic-page={current.id}>
          {current.context?.length > 0 && <aside className={`comic-scene-context${current.art ? " printed-comic-transcript" : ""}`} aria-label="場所と背景"><small>{inOpening ? "旅のはじまり" : episode.place}</small>{current.context.map((text, i) => <p key={i}>{text}</p>)}</aside>}
          {current.playGuide ? <section className="welcome-play-guide" aria-label="最初の一局の遊び方">
            <div className="welcome-play-goal"><span aria-hidden="true">♛</span><h2>{current.playGuide.goal}</h2><p>{current.playGuide.reassurance}</p></div>
            <div className="welcome-play-start"><h3>まずは、案内と一緒に一局。</h3><ol>{current.playGuide.steps.map((step, i) => <li key={step.title}><span aria-hidden="true">{i + 1}</span><div><h4>{step.title}</h4><p>{step.text}</p></div></li>)}</ol></div>
            <ul className="welcome-play-conditions" aria-label="最初の一局のルール">{current.playGuide.conditions.map(text => <li key={text}>{text}</li>)}</ul>
            <p className="welcome-play-later">{current.playGuide.later}</p>
          </section> : <ComicPage page={current} zoomed={zoomed} />}
        </div>
      </div>
      <footer className="chronicle-reader-controls">
        <button type="button" className="btn btn-ghost" data-sound="page" disabled={!page} onClick={() => setPage(i => i - 1)}>前へ</button>
        <span aria-label={`${page + 1} / ${pages.length} ページ`}>{page + 1} <i>/ {pages.length}</i></span>
        <button type="button" className="btn btn-primary" ref={nextRef}
          data-sound="page" onClick={() => page < pages.length - 1 ? setPage(i => i + 1) : onDone()}>
          {page < pages.length - 1 ? "次へ" : lesson?.doneLabel || (battle ? "対局説明へ" : "読み終える")}
        </button>
      </footer>
    </section>
  </div>;
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
      <summary>この国と、ニノたちの旅</summary>
      <p>{CHRONICLE.world}</p>
      <p>{CHRONICLE.covenant}</p>
      <div className="chronicle-roster">
        <div>
          <CardFace rank="A" suit="spade" size="lg" skinId={false} />
          <span>
            <b>A・影の者 リン</b>
            <small>{CHRONICLE.guide[phase]}</small>
          </span>
        </div>
      </div>
    </details>
  );
}
