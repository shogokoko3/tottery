import assert from "node:assert/strict";
import { STORY_AXES } from "../src/game/phase.js";
import {
  STORY_ARCS,
  STORY_PHASES,
  storyArc,
  storyEpisode,
  storyPages,
  episodeAccess,
} from "../src/game/story-narrative.js";
import { stageOf, storyRival } from "../src/game/story.js";

assert.deepEqual(
  STORY_ARCS.map((a) => a.axis),
  STORY_AXES,
);
assert.equal(Object.keys(STORY_PHASES).length, 3);
const titles = new Set();
for (const arc of STORY_ARCS) {
  assert.deepEqual(arc.ranks, stageOf(arc.axis).ranks);
  assert.deepEqual(
    arc.characters.map((c) => c.rank),
    arc.ranks,
  );
  for (const phase of [1, 2, 3]) {
    const e = storyEpisode(arc.axis, phase);
    assert.ok(e.title && e.hook && e.place && e.next);
    if (phase > 1)
      assert.ok(e.recap, `${arc.axis}/${phase}: previous chapter context`);
    assert.equal(e.before.length, 4);
    assert.equal(e.before.at(-1).speaker, "あなた");
    assert.ok(e.purpose?.goal && e.purpose.reason && e.purpose.kind);
    if (phase > 1) assert.ok(e.purpose.leadership);
    if (phase === 3) {
      assert.ok(e.purpose.rivalIdeal && e.purpose.playerIdeal);
      assert.notEqual(e.purpose.rivalIdeal, e.purpose.playerIdeal);
      assert.ok(!JSON.stringify(e).includes("演習"));
    }
    assert.equal(e.after.length, 2);
    const rival = storyRival(arc.axis, phase);
    assert.equal(rival.quote, e.before[2].text);
    assert.equal(rival.quoteSpeaker, e.before[2].speaker);
    for (const page of [...e.before, ...e.after]) {
      if (page.speaker !== "語り") {
        assert.ok(page.text.startsWith("「") && page.text.endsWith("」"));
        assert.equal((page.text.match(/「/g) || []).length, 1);
        assert.equal((page.text.match(/」/g) || []).length, 1);
        assert.equal(
          (page.text.match(/『/g) || []).length,
          (page.text.match(/』/g) || []).length,
        );
      } else assert.ok(!page.text.startsWith("「"));
      assert.ok(
        page.speaker && page.text.length >= 20 && page.text.length < 160,
      );
    }
    assert.ok(!titles.has(e.title));
    titles.add(e.title);
    assert.equal(storyRival(arc.axis, phase).name, arc.cast);
    assert.equal(storyRival(arc.axis, phase).skin, false);
    // Reading cannot unlock later phases, endings, rewards or modify the account.
    const profile = { phase, story: { 1: [], 2: [], 3: [] }, xp: 500 };
    const original = JSON.stringify(profile);
    assert.deepEqual(storyPages(profile, arc.axis, phase), e.before);
    assert.deepEqual(storyPages(profile, arc.axis, phase, "after"), []);
    if (phase < 3)
      assert.deepEqual(storyPages(profile, arc.axis, phase + 1), []);
    assert.equal(JSON.stringify(profile), original);
    profile.story[phase].push(arc.axis);
    assert.deepEqual(storyPages(profile, arc.axis, phase, "after"), e.after);
    assert.deepEqual(episodeAccess(profile, arc.axis, phase), {
      available: true,
      cleared: true,
    });
    // Existing saves unlock the same endings; advancing does not remove old chapters.
    profile.phase = 3;
    assert.deepEqual(storyPages(profile, arc.axis, phase, "after"), e.after);
  }
}
assert.equal(titles.size, 21);
assert.equal(storyArc("A"), null); // Ninja is the connecting narrator, not an eighth battle/reward.
assert.deepEqual(storyPages({}, "missing", 1), []);
assert.deepEqual(storyPages(null, "23", 1, "after"), []);
console.log(
  "Story narrative: 21 episodes, normal-character roles, phase locks, endings and old-save replay verified.",
);
