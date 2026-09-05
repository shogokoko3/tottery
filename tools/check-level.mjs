/**
 * プレイヤーレベルと経験値を検査する。
 *
 * 指示された数字(要る経験値・対戦での入り・5000戦でレベル100・
 * チュートリアルだけでレベル10)を、実装がそのまま満たしているか見る。
 */
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

const {
  EARLY_STEPS,
  MAX_LEVEL,
  XP,
  levelOfXp,
  progressOfXp,
  stepFor,
  totalFor,
} = await import("../src/game/level.js");
const { TUTORIALS } = await import("../src/game/tutorial.js");
const { TEST_BUILD, addXp, loadProfile, recordGame, saveName } =
  await import("../src/game/profile.js");

let ok = 0;
const fails = [];
function is(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    ok++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(label);
    console.log(
      `  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`,
    );
  }
}

console.log("レベル10までの坂");
// 指示された表。5→6 は抜けていたので +200 の等差として補ってある
is(
  "1→2 … 9→10 に要る経験値",
  EARLY_STEPS,
  [100, 300, 500, 700, 900, 1100, 1300, 1500, 1700],
);
is(
  "+200 ずつ増える",
  EARLY_STEPS.every((v, i) => i === 0 || v - EARLY_STEPS[i - 1] === 200),
  true,
);
is("レベル10までの累計", totalFor(10), 8100);

console.log("レベル10から先");
is("上限は100", MAX_LEVEL, 100);
is("10→11 は 1800", stepFor(10), 1800);
is(
  "上がるほど重くなる",
  [stepFor(20), stepFor(50), stepFor(99)],
  [2000, 2600, 3580],
);
is(
  "増え方はゆるやか(1つ上がるごとに20ずつ)",
  Array.from({ length: 89 }, (_, i) => stepFor(11 + i) - stepFor(10 + i)).every(
    (d) => d === 20,
  ),
  true,
);
is("上限を越えては要らない", stepFor(100), 0);

console.log("対戦だけで上限へ");
is("対戦1局の経験値", XP.BATTLE, 50);
const battles = totalFor(MAX_LEVEL) / XP.BATTLE;
is(
  `レベル100までの対戦数 ${battles} が 5000 の前後100以内`,
  Math.abs(battles - 5000) <= 100,
  true,
);
is("有償ガチャの経験値", XP.PAID_GACHA, 150);

console.log("境目");
is("経験値0 はレベル1", levelOfXp(0), 1);
is("99 でまだレベル1", levelOfXp(99), 1);
is("100 でレベル2", levelOfXp(100), 2);
is("8099 でレベル9", levelOfXp(8099), 9);
is("8100 でレベル10", levelOfXp(8100), 10);
is("累計ちょうどで上限", levelOfXp(totalFor(100)), 100);
is("それ以上でも上限を越えない", levelOfXp(totalFor(100) * 3), 100);
is(
  "壊れた値はレベル1",
  [levelOfXp(-5), levelOfXp(NaN), levelOfXp(undefined)],
  [1, 1, 1],
);
const mid = progressOfXp(150);
is(
  "進み具合(150)",
  [mid.level, mid.into, mid.need, mid.left],
  [2, 50, 300, 250],
);
is(
  "上限では次が無い",
  [progressOfXp(totalFor(100)).left, progressOfXp(totalFor(100)).done],
  [null, true],
);

console.log("チュートリアル");
is("12話ある", TUTORIALS.length, 12);
is(
  "どの話にも経験値がある",
  TUTORIALS.every((t) => Number.isInteger(t.xp) && t.xp > 0),
  true,
);
const sum = TUTORIALS.reduce((a, t) => a + t.xp, 0);
is("全部終えるとレベル10以上", levelOfXp(sum) >= 10, true);
// この話を開くのに要るレベルが、前の話まで終えた時点で届いているか。
// あわせて、1話終えるごとに何話が新しく開くかを数える
let acc = 0;
let stuck = null;
const openedAt = [];
const seen = new Set(TUTORIALS.filter((t) => t.level <= 1).map((t) => t.id));
TUTORIALS.forEach((t, i) => {
  const have = levelOfXp(acc);
  if (t.level > have && !stuck)
    stuck = `${t.title} は Lv${t.level} だが、${i}話終えた時点では Lv${have}`;
  acc += t.xp;
  const now = TUTORIALS.filter(
    (o) => o.level <= levelOfXp(acc) && !seen.has(o.id),
  );
  now.forEach((o) => seen.add(o.id));
  openedAt.push(now.length);
});
is("チュートリアルだけで最後まで開く", stuck, null);
is(
  "はじめに開いているのは第1話だけ",
  TUTORIALS.filter((t) => t.level <= 1).length,
  1,
);
is(
  "第10話を終えた時点でレベル10",
  levelOfXp(TUTORIALS.slice(0, 10).reduce((a, t) => a + t.xp, 0)),
  10,
);
// 12話に対してレベルは10段しかないので、対になっている2組だけ同時に開く
is("最初の8話は1話ずつ開く", openedAt.slice(0, 7), [1, 1, 1, 1, 1, 1, 1]);
is(
  "一度に3話以上は開かない",
  openedAt.every((n) => n <= 2),
  true,
);
is(
  "同時に2話開くのは2回だけ(Aの2話と布陣の2話)",
  openedAt.filter((n) => n === 2).length,
  2,
);
is(
  "レベル10で全話が開いている",
  TUTORIALS.every((t) => t.level <= 10),
  true,
);
// 各話の経験値は「次のレベルまでちょうど届く量」。対の回は2話で1段ぶん
is(
  "第1〜8話は1話でちょうど1つ上がる",
  TUTORIALS.slice(0, 8).map((t) => t.xp),
  EARLY_STEPS.slice(0, 8),
);
is(
  "第9・10話の2話で1つ上がる",
  TUTORIALS[8].xp + TUTORIALS[9].xp,
  EARLY_STEPS[8],
);

console.log("記録のつけ方");
saveName("たろう");
let r = recordGame(true);
is("対戦で50入る", r.xp, 50);
is("対戦の数に入る", [r.plays, r.battles], [1, 1]);
r = recordGame(false, { xp: TUTORIALS[0].xp, tutorial: true });
is("チュートリアルはその話の経験値", r.xp, 50 + TUTORIALS[0].xp);
is("チュートリアルは対戦の数に入れない", [r.plays, r.battles], [2, 1]);
// テスト環境でも、獲得時の表示は実経験値で増える。
is(
  "経験値の総量でレベルが上がっている",
  [levelOfXp(50), levelOfXp(r.xp)],
  [1, 2],
);
is(
  "テストビルドでも獲得前後の表示レベルは実経験値",
  [TEST_BUILD, r.levelBefore, r.levelAfter],
  [true, 1, 2],
);
r = addXp(XP.PAID_GACHA);
is("有償ガチャの経験値を足せる", r.xp, 50 + TUTORIALS[0].xp + 150);
is("負の値は足さない", addXp(-100).xp, r.xp);
is("読み直しても残る", loadProfile().xp, r.xp);

console.log("古い保存の引き継ぎ");
store["tottery.account.v1"] = JSON.stringify({
  id: "p9",
  name: "はなこ",
  plays: 7,
  wins: 3,
});
const old = loadProfile();
is("対局数ぶんの経験値を配る", old.xp, 7 * XP.BATTLE);
is("対戦の数も引き継ぐ", old.battles, 7);

console.log(`\n${ok} ok / ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
