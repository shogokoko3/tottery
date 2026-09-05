import assert from "node:assert/strict";
import {
  dismissXpNotice,
  getXpNotices,
  publishXpNotice,
  releaseXpNotice,
  startXpNotice,
  subscribeXpNotices,
} from "../src/game/xp-notices.js";

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
const {
  addXp,
  levelOf,
  levelProgress,
  loadProfile,
  recordGame,
  resetAccount,
  saveName,
  TEST_BUILD,
} = await import("../src/game/profile.js");
const { MAX_LEVEL, progressOfXp, totalFor } =
  await import("../src/game/level.js");
const { giveGift, giveGifts } = await import("../src/game/gifts.js");
const clearNotices = () => {
  for (const notice of getXpNotices()) dismissXpNotice(notice.id);
};
const only = () => {
  assert.equal(getXpNotices().length, 1);
  return getXpNotices()[0];
};

// 不正値や非増加、ガチャは通知を作らず、外部ストアの参照も変えない。
let notifications = 0;
const unsubscribe = subscribeXpNotices(() => notifications++);
const empty = getXpNotices();
assert.equal(getXpNotices(), empty);
for (const input of [
  undefined,
  { beforeXp: 0, afterXp: 0 },
  { beforeXp: 10, afterXp: 9 },
  { beforeXp: -10, afterXp: 1 },
  { beforeXp: NaN, afterXp: 5 },
  { beforeXp: 1, afterXp: Infinity },
  { beforeXp: 0, afterXp: 150, source: "gacha" },
])
  assert.equal(publishXpNotice(input), null);
assert.equal(getXpNotices(), empty);
assert.equal(notifications, 0);

// 未開始の連続受取は同じIDへまとめ、異なる出どころは共通の報酬にする。
const first = publishXpNotice({ beforeXp: 0, afterXp: 50, source: "letter" });
const initialSnapshot = getXpNotices();
assert.equal(only().source, "letter");
assert.equal(
  publishXpNotice({ beforeXp: 50, afterXp: 100, source: "letter" }),
  first,
);
assert.equal(only().source, "letter");
assert.equal(
  publishXpNotice({ beforeXp: 100, afterXp: 150, source: "mission" }),
  first,
);
assert.equal(only().source, "reward");
assert.deepEqual([only().beforeXp, only().afterXp], [0, 150]);
assert.equal(initialSnapshot[0].afterXp, 50, "既存スナップショットは不変");
assert.ok(
  Object.isFrozen(initialSnapshot) && Object.isFrozen(initialSnapshot[0]),
);
assert.equal(notifications, 3);
const merged = getXpNotices();
assert.equal(releaseXpNotice(first), false);
assert.equal(dismissXpNotice("missing"), false);
assert.equal(startXpNotice("missing"), false);
assert.equal(
  getXpNotices(),
  merged,
  "変更なしではスナップショットを再生成しない",
);
unsubscribe();
startXpNotice(first);
assert.equal(notifications, 3, "購読解除後は呼ばない");

// 表示中のゲージの到達点を変更せず、次の受取を別の通知にする。
const showing = only();
const second = publishXpNotice({ beforeXp: 150, afterXp: 200 });
assert.notEqual(second, first);
assert.equal(getXpNotices()[0], showing);
assert.equal(showing.afterXp, 150);
assert.equal(publishXpNotice({ beforeXp: 200, afterXp: 250 }), second);
assert.equal(getXpNotices().length, 2);
assert.equal(startXpNotice(second), false, "先頭の表示を追い越さない");
assert.equal(dismissXpNotice(first), true);
assert.equal(startXpNotice(second), true);
assert.equal(startXpNotice(second), false, "同じ通知の開始は一度だけ");
clearNotices();

// 対局終了前の保留は、後続の通知でも追い越さない。
const held = publishXpNotice({
  beforeXp: 0,
  afterXp: 50,
  source: "battle",
  ready: false,
});
const later = publishXpNotice({ beforeXp: 50, afterXp: 100 });
assert.equal(getXpNotices().length, 2);
assert.equal(startXpNotice(held), false);
assert.equal(startXpNotice(later), false);
const heldSnapshot = getXpNotices();
assert.equal(releaseXpNotice(held), true);
assert.equal(heldSnapshot[0].ready, false);
assert.deepEqual(
  getXpNotices().map((n) => n.id),
  [held, later],
  "解放しても既発行IDと順序を維持",
);
assert.equal(startXpNotice(held), true);
dismissXpNotice(held);
assert.equal(startXpNotice(later), true);
clearNotices();

// ガチャによる非表示の増分は、前後の別報酬へ紛れ込ませない。
const beforeGacha = publishXpNotice({ beforeXp: 0, afterXp: 50 });
publishXpNotice({ beforeXp: 50, afterXp: 200, source: "gacha" });
const afterGacha = publishXpNotice({ beforeXp: 200, afterXp: 250 });
assert.notEqual(beforeGacha, afterGacha);
assert.deepEqual(
  getXpNotices().map((n) => n.afterXp - n.beforeXp),
  [50, 50],
);
clearNotices();

// 実際のプロフィール更新。保存が先、表示通知が後になる。
saveName("経験値確認");
let savedAtNotification;
const stopReading = subscribeXpNotices(() => {
  savedAtNotification = loadProfile().xp;
});
const battle = recordGame(true, { deferXpNotice: true });
stopReading();
assert.equal(battle.xp, 50);
assert.equal(savedAtNotification, 50);
assert.equal(battle.xpNoticeId, only().id);
assert.deepEqual(
  [only().beforeXp, only().afterXp, only().source, only().ready],
  [0, 50, "battle", false],
);
releaseXpNotice(battle.xpNoticeId);
assert.equal(only().ready, true);
clearNotices();

const tutorial = recordGame(true, { tutorial: true, tutorialId: 1, xp: 100 });
assert.equal(tutorial.gained, 100);
assert.deepEqual(
  [tutorial.levelBefore, tutorial.levelAfter, tutorial.leveledUp],
  [1, 2, true],
);
assert.equal(tutorial.xpNoticeId, only().id);
assert.equal(only().source, "tutorial");
assert.deepEqual(levelProgress(tutorial), progressOfXp(150));
assert.equal(
  levelOf(tutorial),
  2,
  `TEST_BUILD=${TEST_BUILD}でも実レベルで開放する`,
);
clearNotices();
const repeated = recordGame(true, { tutorial: true, tutorialId: 1, xp: 100 });
assert.equal(repeated.gained, 0);
assert.equal(repeated.xpNoticeId, null);
assert.equal(getXpNotices().length, 0);
assert.equal(recordGame(false, { xp: 0 }).xpNoticeId, null);
assert.equal(getXpNotices().length, 0);

// 同じ150XPでも、出どころがガチャのときだけ非表示。
const paid = addXp(150, { source: "gacha" });
assert.equal(paid.xp, 300);
assert.equal(paid.xpNoticeId, null);
assert.equal(getXpNotices().length, 0);
const reward = addXp(150);
assert.equal(reward.xp, 450);
assert.deepEqual([reward.levelBefore, reward.levelAfter], [2, 3]);
assert.deepEqual(
  [only().beforeXp, only().afterXp, only().source],
  [300, 450, "reward"],
);
clearNotices();
for (const value of [0, -1, NaN, Infinity, 0.5]) {
  assert.equal(addXp(value).xpNoticeId, null);
  assert.equal(loadProfile().xp, 450);
}
assert.equal(getXpNotices().length, 0);

// 手紙等と共通の実ギフト経路。一括受取は未開始なら1表示になる。
await giveGift({ type: "xp", amount: 20 });
const giftId = only().id;
await giveGifts([
  { type: "xp", amount: 30 },
  { type: "xp", amount: 40 },
]);
assert.equal(only().id, giftId);
assert.deepEqual([only().beforeXp, only().afterXp], [450, 540]);
assert.equal(loadProfile().xp, 540);
clearNotices();

const atMax = totalFor(MAX_LEVEL);
assert.deepEqual(levelProgress({ xp: atMax }), progressOfXp(atMax));
assert.equal(levelProgress({ xp: atMax + 100 }).done, true);
assert.equal(levelProgress({ xp: 0 }).level, 1);
assert.equal(levelProgress({ xp: 0 }).done, false);
assert.equal(levelOf({ xp: 0 }), 1, "テスト環境の新規プレイヤーもレベル1");
assert.equal(levelOf({ xp: 99 }), 1, "テスト用の上限レベルへ飛ばさない");
assert.equal(levelOf({ xp: 100 }), 2, "テスト環境でも経験値でレベルアップする");

// 旧保存の読み込みとアカウント初期化は、新規獲得ではない。
memory.set(
  "tottery.account.v1",
  JSON.stringify({ name: "以前の記録", plays: 7 }),
);
const beforeRead = getXpNotices();
assert.equal(loadProfile().xp, 350);
assert.equal(getXpNotices(), beforeRead);
resetAccount();
assert.equal(loadProfile().xp, 0);
assert.equal(getXpNotices(), beforeRead);
console.log(
  "XP通知: 不変ストア・順序・保留/開始/解除・連続受取・ガチャ除外・保存後通知・対局/初回/再クリア/ギフト・実レベル・旧保存: OK",
);
