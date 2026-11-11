/**
 * 運営の口座だけを全ステージクリアにしていた確認用の処理(2026-10-02)を外し、
 * その印が残る記録を一度だけフェーズ1・未クリアに戻す(2026-11-12 本人の指示)。
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

function memStore() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
globalThis.localStorage = memStore();
globalThis.sessionStorage = memStore();
const { loadProfile, adoptUid, undoStoryReviewGrant } = await import("../src/game/profile.js");
const OP = "4jAiZRTJdQTtSJI39JrnpRLtSrB2";

assert.equal(existsSync(new URL("../src/game/story-review-grant.js", import.meta.url)), false, "付け直す処理は無い");

// 印のある記録: フェーズ1・未クリアに戻す。経験値や対局数は残す
localStorage.setItem("tottery.account.v1", JSON.stringify({
  id: OP, name: "ショウ", xp: 150, plays: 1, wins: 1, phase: 3, phaseEpoch: 1,
  phaseWins: { 3: 2 }, story: { 1: ["23", "45"], 2: ["23"], 3: ["k"] },
  storyReviewGrant: "story-review-phase3-20261002",
}));
const p = loadProfile();
assert.equal(p.phase, 1);
assert.deepEqual(p.story, { 1: [], 2: [], 3: [] });
assert.equal(p.xp, 150);
assert.equal(p.plays, 1);
assert.equal(p.name, "ショウ");
assert.equal(JSON.parse(localStorage.getItem("tottery.account.v1")).storyReviewGrant, undefined, "印は消える(一度だけ)");

// 戻したあとにクリアしたものは、次の読み込みで消えない
const cleared = { ...JSON.parse(localStorage.getItem("tottery.account.v1")), story: { 1: ["23"], 2: [], 3: [] } };
localStorage.setItem("tottery.account.v1", JSON.stringify(cleared));
assert.deepEqual(loadProfile().story[1], ["23"]);

// 運営の口座に付け替えても、全クリアにはならない
localStorage.clear?.();
for (const k of ["tottery.account.v1"]) localStorage.removeItem(k);
localStorage.setItem("tottery.account.v1", JSON.stringify({ id: "anon-1", name: "ショウ", xp: 0 }));
const adopted = adoptUid(OP);
assert.equal(adopted.phase, 1);
assert.deepEqual(adopted.story, { 1: [], 2: [], 3: [] });

// 印の無い記録はそのまま
const plain = { id: "x", story: { 1: ["23"] } };
assert.strictEqual(undoStoryReviewGrant(plain), plain);

console.log("check-story-review-undo: ok");
