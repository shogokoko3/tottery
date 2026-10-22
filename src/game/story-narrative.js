/** 誰がための王印。読了は報酬やクリア記録を変更しない。 */
import { normalizePhase, normalizeStory, phaseOf } from "./phase.js";
import manga from "./story-comics.json" with { type: "json" };

export const CHRONICLE = Object.freeze({
  title: manga.title, subtitle: manga.subtitle, world: manga.world, presentation: manga.presentation,
  player: manga.world, covenant: manga.covenant,
  guide: { 1: manga.guide, 2: manga.guide, 3: manga.guide },
});
export const STORY_PHASES = Object.freeze(Object.fromEntries(manga.phases.map(p =>
  [p.phase, { ...p, label: p.question, summary: p.purpose }])));
export const STORY_PROLOGUE = Object.freeze(manga.prologue);
export const STORY_COMIC_ATLASES = Object.freeze(manga.atlases || {});
const lines = pages => pages.flatMap(p => p.panels.flatMap(panel => panel.lines));
export const STORY_ARCS = Object.freeze(manga.arcs.map(a => ({
  ...a, name: a.theme, question: manga.episodes.find(e => e.axis === a.axis).question,
  episodes: Object.fromEntries(manga.episodes.filter(e => e.axis === a.axis).map(e => {
    const before = (e.mangaPages || e.comicPages).filter(p => p.stage === "before");
    const after = (e.mangaPages || e.comicPages).filter(p => p.stage === "after");
    return [e.phase, { ...e, hook: e.summary, next: e.hook,
      before: lines(before), after: lines(after) }];
  })),
})));
export function storyArc(axis) { return STORY_ARCS.find(a => a.axis === axis) || null; }
export function storyEpisode(axis, phase = 1) { return storyArc(axis)?.episodes[normalizePhase(phase)] || null; }
/** 最終章は六つのF3を積んだ後。既存のクリア済み回想は保持する。 */
export function finaleReady(profile) {
  const cleared = normalizeStory(profile?.story)[3];
  return cleared.includes("k") || manga.arcs.filter(a => a.axis !== "k").every(a => cleared.includes(a.axis));
}
export function episodeAccess(profile, axis, phase) {
  const p = normalizePhase(phase);
  if (!storyArc(axis)) return { available: false, cleared: false };
  return { available: p <= phaseOf(profile) && (axis !== "k" || p !== 3 || finaleReady(profile)), cleared: normalizeStory(profile?.story)[p].includes(axis) };
}
/** 従来の台詞参照（対局説明など）も、漫画と同じ本文を使う。 */
export function storyPages(profile, axis, phase, part = "before") {
  const episode = storyEpisode(axis, phase), access = episodeAccess(profile, axis, phase);
  if (!episode || !access.available || (part === "after" && !access.cleared)) return [];
  return part === "after" ? episode.after : episode.before;
}
/** 新しいフェーズと未クリアの後日談は、漫画からも解放しない。 */
export function storyComicPages(profile, axis, phase, part = "before") {
  if (axis === "prologue") return part === "after" ? [] : STORY_PROLOGUE.pages;
  const episode = storyEpisode(axis, phase), access = episodeAccess(profile, axis, phase);
  if (!episode || !access.available) return [];
  return episode.comicPages.filter(p =>
    (p.stage === "before" && part !== "after") ||
    (p.stage === "after" && part !== "before" && access.cleared));
}
/** コマ割りを持つ完成ページ。公開条件は原稿と同じで、閲覧は進行を変更しない。 */
export function storyReadingPages(profile, axis, phase, part = "before") {
  if (axis === "prologue") return part === "after" ? [] : (STORY_PROLOGUE.mangaPages || STORY_PROLOGUE.pages);
  const episode = storyEpisode(axis, phase), access = episodeAccess(profile, axis, phase);
  if (!episode || !access.available) return [];
  return (episode.mangaPages || episode.comicPages).filter(p =>
    (p.stage === "before" && part !== "after") ||
    (p.stage === "after" && part !== "before" && access.cleared));
}
/** 1話ずつ読み込む画像は、ビルド時にハッシュ付きの名前でアプリへ同梱する。 */
export function storyComicUrl(sheet) {
  const files = typeof __STORY_COMIC_FILES__ !== "undefined" ? __STORY_COMIC_FILES__ : {};
  return `story-comics/${files[sheet] || `${sheet}.webp`}`;
}
