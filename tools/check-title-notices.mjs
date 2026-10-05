import assert from "node:assert/strict";
import fs from "node:fs";
import {
  clearTitleNotices,
  dismissTitleNotice,
  getTitleNotices,
  holdTitleNotices,
  limitTitleNotices,
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
  mastery: { "elf-male": MASTERY_STEPS[MASTERY_TITLE_STEP - 1] - 1 },
});
before = loadProfile();
recordMastery({ "elf-male": 1 });
assertEarned(before);
assert.ok(ids().includes("mastery-elf-male"));

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
// 導入のあいだ(語り → はじめの一局 → 名前 → 門の語り → 初回の10連)は止め、ストーリー一覧に着いてから出す
// (2026-10-01 本人の指示)。画面(screens.jsx)と同じく、introHoldsTitles が真のあいだ1つの保留を持つ
// (useTitleNoticeHold は真のあいだ同じ保留を持ち続け、偽になったら放す)
{
  const { introHoldsTitles } = await import("../src/game/intro.js");
  resetAccount();
  let release = null;
  const visit = (scene) => {
    const want = introHoldsTitles(scene);
    if (want && !release) release = holdTitleNotices();
    if (!want && release) {
      release();
      release = null;
    }
    return getTitleNotices().held;
  };
  assert.equal(visit({ intro: "prologue", screen: "home" }), true, "語りから止める");
  assert.equal(visit({ screen: "game", firstGame: true }), true, "はじめの一局のあいだも止める");
  recordGame(true, { deferXpNotice: true, xp: 300, story: { axis: "23", phase: 1 } });
  assert.ok(ids().includes("first"), "はじめの一局の勝ちで称号が届く");
  assert.equal(visit({ intro: "name", screen: "home" }), true, "勝ったあとの名前の画面にも出さない");
  saveName("導入テスト");
  assert.equal(visit({ intro: "gate", screen: "home" }), true, "門の語りにも出さない");
  assert.equal(visit({ screen: "skins", firstPull: true }), true, "初回の10連にも出さない");
  recordGachaStats({ pulls: 10, ssr: 1, freeze: 0, foil: 0 });
  const queued = ids();
  assert.ok(queued.length >= 2, "10連の称号も積まれる");
  assert.equal(queued[0], "first", "届いた順に積む(勝ちの称号が先)");
  assert.equal(visit({ screen: "story" }), false, "ストーリー一覧に着いたら放す");
  assert.deepEqual(ids(), queued, "止めていたあいだの知らせを1件も落とさない");
  clearTitleNotices();
  assert.equal(visit({ screen: "game" }), false, "ほかの対局では止めない(導入の保留を持ち越さない)");
}
// 件数の決まり(limitTitleNotices。2026-10-05 見直し)。n 件を閉じたら残りは held と同じく待たせ、解除で続きを出す
{
  resetAccount();
  clearTitleNotices();
  recordGachaStats({ foil: 1, ssr: 1, freeze: 1 });
  grantTitle("fortress");
  const queued = getTitleNotices().notices;
  assert.equal(queued.length, 4, "4件積む");
  assert.equal(getTitleNotices().left, null, "決まりが無ければ数えない");
  const release = limitTitleNotices(1);
  assert.deepEqual([getTitleNotices().held, getTitleNotices().left], [false, 1], "1件なら1件目は出す");
  assert.equal(dismissTitleNotice(queued[0].id), true);
  assert.deepEqual([getTitleNotices().held, getTitleNotices().left], [true, 0], "1件を閉じたら残りは待たせる");
  assert.equal(getTitleNotices().notices[0], queued[1], "待たせても落とさない");
  const second = limitTitleNotices(3);
  assert.equal(getTitleNotices().held, true, "決まりが重なれば少ないほう(0)に従う");
  second();
  release();
  release();
  assert.deepEqual([getTitleNotices().held, getTitleNotices().left], [false, null], "解除すると続き(2件目)を出す。二重解除でも崩れない");
  assert.equal(getTitleNotices().notices[0], queued[1]);
  const zero = limitTitleNotices(0);
  assert.equal(getTitleNotices().held, true, "0 件なら出さない");
  zero();
  clearTitleNotices();
  // 画面: 決まりがあるときは出してよい分だけを数える(「あと3件」「›」で残りを匂わせない)。決まりは値が変わるまで持ち続ける
  const ui = fs.readFileSync(new URL("../src/ui/title-acquisition.jsx", import.meta.url), "utf8");
  assert.ok(/count=\{left === null \|\| left === undefined \? notices\.length : Math\.min\(notices\.length, left\)\}/.test(ui), "画面は残りの件数で数える");
  assert.ok(/export function useTitleNoticeLimit\(count\) \{[\s\S]{0,200}if \(on\) return limitTitleNotices\(count\);\s*\}, \[on \? count : null\]\);/.test(ui), "件数の決まりは値が変わるまで持ち続ける");
  // 知らせの言葉は導入の調子(です・ますを使わない。2026-10-06 本人の指示)。読み上げと見える一言をそろえる
  assert.ok(
    /<span\s+className="title-award-announcement"[^>]*>\s*称号「\{notice\.name\}」を手に入れた。設定で、装備できる。\s*<\/span>/.test(ui),
    "読み上げは「称号「X」を手に入れた。設定で、装備できる。」",
  );
  assert.ok(/<p>設定で、装備できる。<\/p>/.test(ui), "見える一言は「設定で、装備できる。」");
  assert.ok(!/装備できます|獲得しました/.test(ui), "です・ます調の「獲得しました」「装備できます」を残さない");
}
// 導入を終えたあと(初回の10連を閉じてから、ホームを開くまで)。画面と同じく、introHoldsTitles の保留と
// introTitleQuota の件数を、値が変わったときだけ持ち替える(useTitleNoticeHold・useTitleNoticeLimit)
{
  const { introHoldsTitles, introTitleQuota } = await import("../src/game/intro.js");
  resetAccount();
  clearTitleNotices();
  let release = null;
  let limit = null;
  let quota = null;
  const visit = (scene) => {
    const want = introHoldsTitles(scene);
    if (want && !release) release = holdTitleNotices();
    if (!want && release) {
      release();
      release = null;
    }
    const q = introTitleQuota(scene);
    if (q !== quota) {
      if (limit) limit();
      limit = q === null ? null : limitTitleNotices(q);
      quota = q;
    }
    const { held, notices } = getTitleNotices();
    return held ? null : notices[0] ? notices[0].titleId : "";
  };
  recordGame(true, { deferXpNotice: true, xp: 300, story: { axis: "23", phase: 1 } });
  saveName("導入のあと");
  recordGachaStats({ pulls: 10, ssr: 1, freeze: 0, foil: 0 });
  const queued = ids();
  assert.ok(queued.length >= 3, `一局と10連で知らせが積まれる(${queued.join(",")})`);
  const after = { afterIntro: true };
  assert.equal(visit({ ...after, screen: "story", stageIntro: "45" }), null, "次の相手の紹介のあいだは出さない");
  assert.equal(visit({ ...after, screen: "game" }), null, "紹介から対局へ進んでも、四と五の王のサイコロの上には出さない");
  assert.equal(visit({ ...after, screen: "story" }), queued[0], "一覧に着いたら1件目だけ");
  dismissTitleNotice(getTitleNotices().notices[0].id);
  assert.equal(visit({ ...after, screen: "story" }), null, "1件目を閉じたら、一覧では続けて出さない");
  assert.equal(visit({ ...after, screen: "story", stageIntro: "45" }), null, "紹介を開き直しても出さない");
  assert.equal(visit({ ...after, screen: "story" }), null, "紹介を閉じて一覧に戻っても、数え直さない");
  assert.equal(visit({ screen: "menu" }), queued[1], "ホームを開いたら残りを出す");
  assert.deepEqual(ids(), queued.slice(1), "待たせたあいだの知らせを1件も落とさない");
  clearTitleNotices();
}
console.log(
  "称号獲得: 全7エリア・対局・熟練度・ガチャ・ミッション・配布・シーズン・保留/順序・保存失敗・引継ぎ・導入のあいだ・件数の決まり・知らせの言葉・導入のあと: OK",
);
