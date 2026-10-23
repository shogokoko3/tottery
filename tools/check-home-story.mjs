import assert from "node:assert/strict";
import fs from "node:fs";
import { STORY_AXES } from "../src/game/phase.js";
import { normalize } from "../src/skins/collection.js";
import { homeThemeForProfile, setPhaseHome } from "../src/skins/home-themes.js";
import { STORY_HOME_SCENES, storyHomeProgress } from "../src/skins/home-story-themes.js";

const manga = JSON.parse(fs.readFileSync("src/game/story-comics.json", "utf8"));
assert.equal(STORY_HOME_SCENES.length, 21);
assert.equal(new Set(STORY_HOME_SCENES.map((scene) => scene.file)).size, 21);
for (const phase of [1, 2, 3]) {
  const profile = { phase, story: { [phase]: [] } };
  for (const [index, axis] of STORY_AXES.entries()) {
    const before = JSON.stringify(profile);
    const scene = storyHomeProgress(profile);
    assert.equal(scene.axis, axis);
    assert.equal(scene.chapter, index + 1);
    assert.equal(scene.complete, false);
    assert.equal(scene.title, manga.episodes.find((episode) => episode.phase === phase && episode.axis === axis).title);
    const theme = homeThemeForProfile(normalize(null), profile);
    assert.equal(theme.assets.scene, scene.file);
    assert.equal(theme.assets.decoration, scene.file);
    assert.equal(JSON.stringify(profile), before, "背景の表示で進行を変更しない");
    const bytes = fs.readFileSync(`assets/${scene.file}`);
    assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
    assert.ok(bytes.length > 30000, `${scene.file}: 本番用の背景美術を収録`);
    profile.story[phase].push(axis);
  }
  assert.equal(storyHomeProgress(profile).complete, true);
  assert.equal(storyHomeProgress(profile).axis, "k", "全話クリア後は最終話の風景を維持");
}

// 順番を飛ばしても未クリア話を表示し、再戦や読了だけでは背景を進めない。
assert.equal(storyHomeProgress({ phase: 1, story: { 1: ["67", "23", "k"] } }).axis, "45");
assert.equal(storyHomeProgress({ phase: 2, story: { 1: STORY_AXES, 2: ["23"] } }).axis, "45");
assert.equal(storyHomeProgress({ phase: 3, story: { 1: STORY_AXES, 2: STORY_AXES } }).axis, "23");
assert.equal(storyHomeProgress({ phase: 999, story: "broken" }).axis, "23");

// 手動の着せ替えを残し、「物語に合わせる」に戻せば現在地へ戻る。
const collection = normalize(setPhaseHome(normalize(null), 2, "phase-2"));
const profile = { phase: 2, story: { 2: ["23", "45"] } };
assert.equal(homeThemeForProfile(collection, profile).id, "phase-2");
assert.equal(homeThemeForProfile(setPhaseHome(collection, 2, "default"), profile).axis, "67");
assert.equal(homeThemeForProfile(collection, { phase: 1 }).axis, "23");
console.log("物語ホーム: 全21背景・各話の原稿対応・進行による切り替え・フェーズ移行・手動設定を確認");
