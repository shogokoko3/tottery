import assert from "node:assert/strict";
import {
  clearTitleNotices,
  dismissTitleNotice,
  getTitleNotices,
  holdTitleNotices,
  subscribeTitleNotices,
} from "../src/game/title-notices.js";
import { TITLES, newlyEarned } from "../src/game/titles.js";
import { FORMATION_EMBLEMS } from "../src/game/formation-honors.js";
import { MASTERY_STEPS, MASTERY_TITLE_STEP } from "../src/game/constants.js";

const memory = new Map();
let failWrite = false;
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    if (failWrite) throw new Error("quota");
    memory.set(key, String(value));
  },
  removeItem: (key) => memory.delete(key),
};
const {
  loadProfile,
  restoreProfile,
  resetAccount,
  forgetMe,
  saveName,
  saveTitle,
  recordGame,
  recordGachaStats,
  recordMastery,
  grantTitle,
  grantMissionTitle,
  achieveSecret,
} = await import("../src/game/profile.js");
const { giveGift } = await import("../src/game/gifts.js");
const ids = () => getTitleNotices().notices.map((n) => n.titleId);
const assertEarned = (before) =>
  assert.deepEqual(
    ids(),
    newlyEarned(before, loadProfile()).map((t) => t.id),
  );

// 保存が済んでから通知する。全7エリア・盤面未装備でも同じ経路。
for (const emblem of FORMATION_EMBLEMS) {
  resetAccount();
  let observed = false;
  const stop = subscribeTitleNotices(() => {
    if (ids().includes(emblem.titleId)) {
      assert.ok(loadProfile().titles.includes(emblem.titleId));
      observed = true;
    }
  });
  grantTitle(emblem.titleId);
  assert.deepEqual(ids(), [emblem.titleId]);
  assert.ok(observed);
  grantTitle(emblem.titleId);
  assert.equal(ids().length, 1, "同じ布陣の成立は再通知しない");
  stop();
}

resetAccount();
let before = loadProfile();
recordGame(true, { ranked: false, deferXpNotice: true });
assertEarned(before);
assert.ok(ids().includes("first"));
clearTitleNotices();
saveName("称号テスト");
saveTitle("first");
assert.deepEqual(ids(), [], "名前・装備の変更や再読み込みは獲得ではない");

restoreProfile({
  ...loadProfile(),
  mastery: { J: MASTERY_STEPS[MASTERY_TITLE_STEP - 1] - 1 },
});
before = loadProfile();
recordMastery({ J: 1 });
assertEarned(before);
assert.ok(ids().includes("mastery-J"));

resetAccount();
const releaseGate = holdTitleNotices();
const releaseFoil = holdTitleNotices();
recordGachaStats({ foil: 1, ssr: 1, freeze: 1 });
assert.equal(ids().length, 3);
assert.ok(getTitleNotices().held, "ガチャ中は新しい称号名を見せない");
const queued = getTitleNotices().notices;
releaseGate();
releaseGate();
assert.ok(getTitleNotices().held, "二重解除でも後続の演出を追い越さない");
releaseFoil();
assert.equal(getTitleNotices().held, false);
assert.equal(getTitleNotices().notices, queued);
assert.equal(dismissTitleNotice(queued[1].id), false, "取得順を守る");
assert.equal(dismissTitleNotice(queued[0].id), true);
assert.equal(getTitleNotices().notices[0], queued[1]);
clearTitleNotices();
recordGachaStats({ foil: 1, ssr: 1, freeze: 1 });
assert.deepEqual(ids(), [], "結果の再表示で重複しない");

grantMissionTitle("test-foil", "foil-elf-male");
assert.deepEqual(ids(), ["foil-elf-male"]);
clearTitleNotices();
grantMissionTitle("test-foil", "foil-elf-male");
assert.deepEqual(ids(), []);
await giveGift({ type: "title", id: "season:2026-09:first" });
assert.deepEqual(ids(), ["season:2026-09:first"]);
clearTitleNotices();
achieveSecret("court-heavy");
assert.deepEqual(ids(), ["court-heavy"]);
clearTitleNotices();
achieveSecret("court-heavy");
assert.deepEqual(ids(), []);

resetAccount();
failWrite = true;
grantTitle("fortress");
assert.deepEqual(ids(), [], "保存に失敗した称号を獲得済みと見せない");
assert.throws(
  () => grantMissionTitle("failed", "foil-elf-male"),
  /保存できません/,
);
assert.deepEqual(ids(), []);
assert.equal(loadProfile().missions.includes("failed"), false);
failWrite = false;
grantMissionTitle("failed", "foil-elf-male");
assert.deepEqual(ids(), ["foil-elf-male"], "保存失敗後の再受取は通知する");

// 所持済み・未知の称号・初期称号を勝手に通知しない。
restoreProfile({ ...loadProfile(), titles: TITLES.map((t) => t.id) });
assert.deepEqual(ids(), []);
saveName("引継ぎテスト");
assert.deepEqual(ids(), []);
resetAccount();
grantTitle("unknown-title");
grantTitle("novice");
assert.deepEqual(ids(), []);
grantTitle("fortress");
forgetMe();
assert.deepEqual(ids(), [], "別のアカウントへ通知を持ち越さない");
assert.equal(getTitleNotices().held, false);
console.log(
  "称号獲得: 全7エリア・対局・熟練度・ガチャ・ミッション・配布・シーズン・保留/順序・保存失敗・引継ぎ: OK",
);
