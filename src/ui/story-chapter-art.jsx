/** 一覧専用の縦長イラスト。紙芝居の場面とは別の21枚を使う。 */
import art23_1 from "../../assets/story/chapter-portraits/23-phase-1.webp";
import art23_2 from "../../assets/story/chapter-portraits/23-phase-2.webp";
import art23_3 from "../../assets/story/chapter-portraits/23-phase-3.webp";
import art45_1 from "../../assets/story/chapter-portraits/45-phase-1.webp";
import art45_2 from "../../assets/story/chapter-portraits/45-phase-2.webp";
import art45_3 from "../../assets/story/chapter-portraits/45-phase-3.webp";
import art67_1 from "../../assets/story/chapter-portraits/67-phase-1.webp";
import art67_2 from "../../assets/story/chapter-portraits/67-phase-2.webp";
import art67_3 from "../../assets/story/chapter-portraits/67-phase-3.webp";
import art89_1 from "../../assets/story/chapter-portraits/89-phase-1.webp";
import art89_2 from "../../assets/story/chapter-portraits/89-phase-2.webp";
import art89_3 from "../../assets/story/chapter-portraits/89-phase-3.webp";
import art10_1 from "../../assets/story/chapter-portraits/10-phase-1.webp";
import art10_2 from "../../assets/story/chapter-portraits/10-phase-2.webp";
import art10_3 from "../../assets/story/chapter-portraits/10-phase-3.webp";
import artjq_1 from "../../assets/story/chapter-portraits/jq-phase-1.webp";
import artjq_2 from "../../assets/story/chapter-portraits/jq-phase-2.webp";
import artjq_3 from "../../assets/story/chapter-portraits/jq-phase-3.webp";
import artk_1 from "../../assets/story/chapter-portraits/k-phase-1.webp";
import artk_2 from "../../assets/story/chapter-portraits/k-phase-2.webp";
import artk_3 from "../../assets/story/chapter-portraits/k-phase-3.webp";

export const STORY_CHAPTER_ART = {
  23: { 1: art23_1, 2: art23_2, 3: art23_3 },
  45: { 1: art45_1, 2: art45_2, 3: art45_3 },
  67: { 1: art67_1, 2: art67_2, 3: art67_3 },
  89: { 1: art89_1, 2: art89_2, 3: art89_3 },
  10: { 1: art10_1, 2: art10_2, 3: art10_3 },
  jq: { 1: artjq_1, 2: artjq_2, 3: artjq_3 },
  k: { 1: artk_1, 2: artk_2, 3: artk_3 },
};

export function StoryChapterArt({ axis, phase = 1 }) {
  const src = STORY_CHAPTER_ART[axis]?.[phase];
  return src ? (
    <img
      className="chronicle-chapter-portrait"
      src={src}
      alt=""
      aria-hidden="true"
      width="400"
      height="600"
      data-axis={axis}
      data-phase={phase}
      draggable="false"
      decoding="async"
    />
  ) : null;
}
