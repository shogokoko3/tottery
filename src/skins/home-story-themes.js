import { STORY_AXES, normalizeStory, phaseOf } from "../game/phase.js";
import { phaseHomeTheme } from "./home-phase-themes.js";

/** 原稿の各話と対応したホーム背景。未読の展開を先取りせず、次の未クリア話を表示する。 */
export const STORY_HOME_SCENES = Object.freeze([
  {
    "phase": 1,
    "axis": "23",
    "chapter": 1,
    "title": "とある印を拾った日",
    "location": "トチ村",
    "file": "skins/home-story-v1/1-23.webp"
  },
  {
    "phase": 1,
    "axis": "45",
    "chapter": 2,
    "title": "誰も見ない奴",
    "location": "西の街道の宿",
    "file": "skins/home-story-v1/1-45.webp"
  },
  {
    "phase": 1,
    "axis": "67",
    "chapter": 3,
    "title": "本の中の王",
    "location": "川の関所",
    "file": "skins/home-story-v1/1-67.webp"
  },
  {
    "phase": 1,
    "axis": "89",
    "chapter": 4,
    "title": "守られている者",
    "location": "北の砦",
    "file": "skins/home-story-v1/1-89.webp"
  },
  {
    "phase": 1,
    "axis": "10",
    "chapter": 5,
    "title": "追いつけない王",
    "location": "峠の分かれ道",
    "file": "skins/home-story-v1/1-10.webp"
  },
  {
    "phase": 1,
    "axis": "jq",
    "chapter": 6,
    "title": "作られた王",
    "location": "王都の宮",
    "file": "skins/home-story-v1/1-jq.webp"
  },
  {
    "phase": 1,
    "axis": "k",
    "chapter": 7,
    "title": "隠れない王",
    "location": "王都の広場",
    "file": "skins/home-story-v1/1-k.webp"
  },
  {
    "phase": 2,
    "axis": "23",
    "chapter": 1,
    "title": "一人で背負う",
    "location": "焼けたトチ村",
    "file": "skins/home-story-v1/2-23.webp"
  },
  {
    "phase": 2,
    "axis": "45",
    "chapter": 2,
    "title": "票が決めた",
    "location": "南の港",
    "file": "skins/home-story-v1/2-45.webp"
  },
  {
    "phase": 2,
    "axis": "67",
    "chapter": 3,
    "title": "裂かれた本",
    "location": "森の騎士館",
    "file": "skins/home-story-v1/2-67.webp"
  },
  {
    "phase": 2,
    "axis": "89",
    "chapter": 4,
    "title": "壁",
    "location": "砦の開いた門",
    "file": "skins/home-story-v1/2-89.webp"
  },
  {
    "phase": 2,
    "axis": "10",
    "chapter": 5,
    "title": "先頭",
    "location": "王都手前の平原",
    "file": "skins/home-story-v1/2-10.webp"
  },
  {
    "phase": 2,
    "axis": "jq",
    "chapter": 6,
    "title": "顔と印",
    "location": "王都外の合同陣",
    "file": "skins/home-story-v1/2-jq.webp"
  },
  {
    "phase": 2,
    "axis": "k",
    "chapter": 7,
    "title": "代わり",
    "location": "大河の渡し場",
    "file": "skins/home-story-v1/2-k.webp"
  },
  {
    "phase": 3,
    "axis": "23",
    "chapter": 1,
    "title": "百人の王",
    "location": "トチ村の小屋",
    "file": "skins/home-story-v1/3-23.webp"
  },
  {
    "phase": 3,
    "axis": "45",
    "chapter": 2,
    "title": "顔を上げた男",
    "location": "引き潮の南港",
    "file": "skins/home-story-v1/3-45.webp"
  },
  {
    "phase": 3,
    "axis": "67",
    "chapter": 3,
    "title": "本の上の剣",
    "location": "騎士館の門",
    "file": "skins/home-story-v1/3-67.webp"
  },
  {
    "phase": 3,
    "axis": "89",
    "chapter": 4,
    "title": "外へ出る壁",
    "location": "砦から続く道",
    "file": "skins/home-story-v1/3-89.webp"
  },
  {
    "phase": 3,
    "axis": "10",
    "chapter": 5,
    "title": "走らない早馬",
    "location": "仲間と越える峠",
    "file": "skins/home-story-v1/3-10.webp"
  },
  {
    "phase": 3,
    "axis": "jq",
    "chapter": 6,
    "title": "俺を取れ",
    "location": "夏至前の王都門",
    "file": "skins/home-story-v1/3-jq.webp"
  },
  {
    "phase": 3,
    "axis": "k",
    "chapter": 7,
    "title": "見つけた",
    "location": "夏至の王都",
    "file": "skins/home-story-v1/3-k.webp"
  }
].map((scene) => Object.freeze(scene)));

export function storyHomeProgress(profile) {
  const phase = phaseOf(profile);
  const cleared = normalizeStory(profile?.story)[phase];
  const next = STORY_AXES.find((axis) => !cleared.includes(axis));
  const axis = next || STORY_AXES.at(-1);
  const scene = STORY_HOME_SCENES.find((item) => item.phase === phase && item.axis === axis);
  return { ...scene, complete: next === undefined, cleared: cleared.length };
}

export function storyHomeTheme(profile) {
  const scene = storyHomeProgress(profile);
  const base = phaseHomeTheme(scene.phase);
  return {
    ...base,
    id: `phase-${scene.phase}-story-${scene.axis}`,
    chapter: scene.chapter,
    axis: scene.axis,
    name: scene.title,
    title: scene.location,
    subtitle: `第${scene.chapter}話 · ${scene.location}`,
    assets: { ...base.assets, scene: scene.file, decoration: scene.file },
  };
}
