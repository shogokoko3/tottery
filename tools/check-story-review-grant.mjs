import assert from "node:assert/strict";
import { applyStoryReviewGrant } from "../src/game/story-review-grant.js";
import { PHASE_EPOCH, PHASES, STORY_AXES } from "../src/game/phase.js";
import { episodeAccess, storyPages } from "../src/game/story-narrative.js";
import { storyList } from "../src/game/story.js";

const uid = "4jAiZRTJdQTtSJI39JrnpRLtSrB2";
const key = "tottery.account.v1";
const mem = new Map();
globalThis.localStorage = {
  getItem: k => mem.get(k) ?? null,
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => true;
const { loadProfile, saveName, adoptUid, restoreProfile } = await import("../src/game/profile.js");

const original = {
  id: uid, name: "確認用", phase: 1, phaseEpoch: 0,
  story: { 1: ["23"], 2: [], 3: [] },
  phaseWins: { 1: 2, 2: 0, 3: 0 }, wins: 7, plays: 12,
  rating: 1620, xp: 400, letters: ["kept"], titles: ["kept-title"],
};
const originalText = JSON.stringify(original);
assert.equal(applyStoryReviewGrant(null), null);
for (const id of [undefined, "", "another-player", uid.toLowerCase(), uid + "x"]) {
  const other = { ...original, id };
  assert.strictEqual(applyStoryReviewGrant(other), other, "only the exact requested UID receives the grant");
}
const granted = applyStoryReviewGrant(original);
assert.equal(JSON.stringify(original), originalText, "does not mutate its input");
assert.strictEqual(applyStoryReviewGrant(granted), granted, "same grant is idempotent");

mem.set(key, originalText);
mem.set("tottery.skins.v1", '{"tickets":19,"gems":17,"owned":["kept"]}');
const collection = mem.get("tottery.skins.v1");
const profile = loadProfile();
const saved = JSON.parse(mem.get(key));
assert.equal(profile.phase, 3);
assert.equal(saved.phaseEpoch, PHASE_EPOCH);
assert.ok(saved.storyReviewGrant);
for (const phase of PHASES) {
  assert.deepEqual(saved.story[phase], [...STORY_AXES]);
  assert.equal(storyList({ ...profile, phase }).filter(s => s.cleared).length, 7);
  for (const axis of STORY_AXES) {
    assert.deepEqual(episodeAccess(profile, axis, phase), { available: true, cleared: true });
    assert.equal(storyPages(profile, axis, phase, "before").length, 4);
    assert.equal(storyPages(profile, axis, phase, "after").length, 2);
  }
}
for (const k of Object.keys(original)) {
  if (["phase", "phaseEpoch", "story"].includes(k)) continue;
  assert.deepEqual(saved[k], original[k], "preserves non-story field: " + k);
}
assert.equal(mem.get("tottery.skins.v1"), collection, "does not award currency or change owned items");
const completedText = mem.get(key);
loadProfile();
assert.equal(mem.get(key), completedText, "subsequent reads do not rewrite the profile");
saveName("確認用二");
assert.equal(loadProfile().storyReviewGrant, saved.storyReviewGrant, "normal profile saves retain the one-time marker");
restoreProfile(loadProfile(), uid);
assert.equal(loadProfile().storyReviewGrant, saved.storyReviewGrant, "restored profiles retain the marker");

// An intentional later reset must not be repeatedly overridden by this migration.
mem.set(key, JSON.stringify({ ...saved, phase: 1, story: { 1: [], 2: [], 3: [] } }));
assert.equal(loadProfile().phase, 1);
assert.deepEqual(loadProfile().story[1], []);

// Existing local device identifiers receive the grant when they adopt the requested UID.
mem.set(key, JSON.stringify({ ...original, id: "old-device-id", phaseEpoch: PHASE_EPOCH }));
const adopted = adoptUid(uid);
assert.equal(adopted.phase, 3);
assert.deepEqual(adopted.story[3], [...STORY_AXES]);
assert.ok(JSON.parse(mem.get(key)).storyReviewGrant);

// A different player stays at their own phase and progress, even with a similar UID.
mem.set(key, JSON.stringify({ ...original, id: "another-player", phaseEpoch: PHASE_EPOCH }));
const otherText = mem.get(key);
assert.equal(loadProfile().phase, 1);
assert.deepEqual(loadProfile().story, original.story);
assert.equal(mem.get(key), otherText);
console.log("Story review grant: exact UID only, all 21 endings, persistence, one-time application, no stats/items changes verified.");

