import assert from "node:assert/strict";
import fs from "node:fs";
import { STORY_AXES } from "../src/game/phase.js";
import { normalize } from "../src/skins/collection.js";
import { homeThemeForProfile, setPhaseHome } from "../src/skins/home-themes.js";
import { STORY_HOME_SCENES, STORY_HOME_THEMES, storyHomeProgress } from "../src/skins/home-story-themes.js";

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
for (const theme of STORY_HOME_THEMES) {
  const original = normalize({ tickets: 20, gems: 100, owned: { "elf-male": 1 } });
  const chosen = normalize(JSON.parse(JSON.stringify(setPhaseHome(original, theme.phase, theme.id))));
  assert.equal(chosen.phaseHomes[theme.phase].homeTheme, theme.id, "全21話の選択を保存・復元できる");
  for (const clears of [[], STORY_AXES]) {
    const progress = { phase: theme.phase, story: { [theme.phase]: clears } };
    assert.equal(homeThemeForProfile(chosen, progress).id, theme.id, "未クリア・全話クリアとも固定背景を維持");
    assert.equal(homeThemeForProfile(chosen, progress).assets.scene, theme.assets.scene);
  }
  assert.equal(chosen.tickets, original.tickets);
  assert.equal(chosen.gems, original.gems);
  assert.deepEqual(chosen.owned, original.owned);
  assert.deepEqual(original.phaseHomes, {}, "元データを書き換えない");
}
for (const invalid of ["phase-1-story-8", "phase-4-story-23", "phase-1-story-unknown"]) {
  assert.throws(() => setPhaseHome(normalize(null), 1, invalid), /ホーム装飾/);
  const restored = normalize({ phaseHomes: { 1: { homeTheme: invalid } } });
  assert.equal(restored.phaseHomes[1].homeTheme, "default");
}
console.log("物語ホーム: 全21背景・各話の原稿対応・進行による切り替え・フェーズ移行・手動設定を確認");
