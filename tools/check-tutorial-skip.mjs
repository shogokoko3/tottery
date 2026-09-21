// チュートリアルを飛ばす(skipTutorials, src/game/profile.js)の検査。
//   1. 全12話を飛ばすと、終えたのと同じ扱い: cleared に12話、経験値も同じ合計、レベル10、ランダムマッチが開く
//   2. 二重に入らない: 飛ばした話を勝っても経験値0、もう一度飛ばしても0
//   3. 1話だけ飛ばす → その話だけ。番外(13話)や壊れた id は無視。対局の数には数えない
//   4. 画面の配線: 一覧の「飛ばす」と案内の札の「この話を飛ばす」は確認(SkipConfirm)を挟む
import assert from "node:assert/strict";
import fs from "node:fs";
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};
const { loadProfile, recordGame, skipTutorials, hasCleared, levelOf } = await import("../src/game/profile.js");
const { TUTORIALS, EXTRA_TUTORIALS } = await import("../src/game/tutorial.js");
const { levelOfXp } = await import("../src/game/level.js");
const { onlineGate } = await import("../src/game/online-gate.js");
const { homeTutorialNudge, nextTutorial } = await import("../src/game/tutorial-nudge.js");

const reset = () => {
  for (const k of Object.keys(store)) delete store[k];
};

// 1. 全部飛ばす
{
  reset();
  const before = loadProfile();
  assert.equal(before.cleared.length, 0);
  const r = skipTutorials(TUTORIALS);
  const total = TUTORIALS.reduce((n, t) => n + t.xp, 0);
  assert.equal(r.gained, total, "経験値は12話ぶんの合計");
  assert.deepEqual(r.skipped, TUTORIALS.map((t) => t.id));
  const p = loadProfile();
  assert.equal(p.xp, total, "保存されている");
  assert.deepEqual([...p.cleared].sort((a, b) => a - b), TUTORIALS.map((t) => t.id));
  assert.equal(levelOf(p), levelOfXp(total));
  assert.ok(levelOf(p) >= 10, `全部飛ばせばレベル10以上(${levelOf(p)})`);
  assert.equal(r.leveledUp, true);
  assert.ok(r.xpNoticeId, "経験値の帯を出す");
  assert.equal(onlineGate(p).ok, true, "ランダムマッチが開く");
  assert.equal(homeTutorialNudge(p), null, "ホームの誘いが消える");
  assert.equal(nextTutorial(p), null);
  assert.equal(p.plays, 0, "対局の数には数えない");
  assert.equal(p.battles, 0);
  // 2. 二重に入らない
  const again = skipTutorials(TUTORIALS);
  assert.equal(again.gained, 0);
  assert.deepEqual(again.skipped, []);
  assert.equal(again.xpNoticeId, null);
  assert.equal(loadProfile().xp, total);
  const win = recordGame(true, { xp: TUTORIALS[0].xp, tutorial: true, tutorialId: 1 });
  assert.equal(win.xp, total, "飛ばした話を勝っても経験値は入らない");
  assert.equal(loadProfile().cleared.filter((id) => id === 1).length, 1, "cleared に重複しない");
}
// 3. 1話だけ・番外・壊れた id
{
  reset();
  const r = skipTutorials([TUTORIALS[0]]);
  assert.equal(r.gained, TUTORIALS[0].xp);
  assert.ok(hasCleared(1) && !hasCleared(2));
  assert.equal(levelOf(loadProfile()), 2, "第1話を飛ばすとレベル2(終えたのと同じ)");
  // 終えた話に続けて次を飛ばす
  const r2 = skipTutorials([TUTORIALS[0], TUTORIALS[1]]);
  assert.deepEqual(r2.skipped, [2]);
  assert.equal(r2.gained, TUTORIALS[1].xp);
  const junk = skipTutorials([null, { id: "x", xp: 100 }, { id: 3.5, xp: 100 }, { id: 4, xp: -5 }]);
  assert.deepEqual(junk.skipped, [4], "壊れた id は無視、負の経験値は0");
  assert.equal(junk.gained, 0);
  // 番外の話は一覧の「飛ばす」に含めない(画面側の決め)。処理としては id を持てば飛ばせるので、画面の配線で見る
  assert.ok(EXTRA_TUTORIALS.length >= 1);
}
// 4. 画面の配線
{
  const ui = fs.readFileSync(new URL("../src/ui/tutorial.jsx", import.meta.url), "utf8");
  assert.ok(/const left = TUTORIALS\.filter\(\(t\) => !profile\.cleared\.includes\(t\.id\)\)/.test(ui), "一覧が飛ばすのは本編の未了の話だけ(番外を含めない)");
  assert.ok(/onClick=\{\(\) => setConfirmSkip\(true\)\}/.test(ui), "一覧の「飛ばす」は確認を挟む");
  assert.ok(/const after = skipTutorials\(left\);\s*setProfile\(after\);\s*publishPlayer\(after\);/.test(ui), "確認のあとに飛ばし、画面と台帳を更新");
  assert.ok(/onClick=\{\(\) => setConfirm\(true\)\}/.test(ui), "案内の札の「この話を飛ばす」も確認を挟む");
  assert.ok(/\(onSkip \|\| onInterrupt\) && !step\.end && \(/.test(ui), "終わりの札には出さない");
  // 中断してやめる(クリアにせずホームへ)を、常に見える説明パネル下部に出す(2026-09-21)
  assert.ok(/onClick=\{onInterrupt\}[\s\S]*?中断してやめる/.test(ui), "説明パネルに「中断してやめる」を出す");
  const game0 = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  assert.ok(/onInterrupt=\{onHome \? goHome : onExit\}/.test(game0), "中断はホーム(なければタイトル)へ");
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  assert.ok(/const after = skipTutorials\(\[tutorial\]\);\s*publishPlayer\(after\);\s*if \(nextTutorial && onNextTutorial\) onNextTutorial\(\);/.test(game), "対局中に飛ばすと、その話を終えた扱いで次の話へ");
  assert.ok(/skipXp=\{tutorial\.xp \|\| 0\}/.test(game));
  // 途中でも飛ばせる: 上の釦(TutorialSkipMenu)を対局画面の全ての GameShell に渡す
  assert.ok(/export function TutorialSkipMenu\(/.test(ui), "上の「飛ばす」がある");
  assert.ok(/残りの \{left\.length\} 話をすべて飛ばす/.test(ui), "残りの全話も選べる");
  const shells = (game.match(/<GameShell\n/g) || []).length;
  const wired = (game.match(/topExtra=\{skipMenu\}/g) || []).length;
  assert.ok(shells > 0 && shells === wired, `対局画面の GameShell 全部に「飛ばす」を渡す(${wired}/${shells})`);
  assert.ok(/onSkipAll=\{\(left\) => \{\s*const after = skipTutorials\(left\);\s*publishPlayer\(after\);/.test(game), "残りの全話を飛ばすと一覧へ");
  const shell = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  assert.ok(/\{topExtra\}/.test(shell), "GameShell が右上に釦を出す");
}
console.log("チュートリアルを飛ばす: 全部・二重なし・1話だけ・配線 OK");
