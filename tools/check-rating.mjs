/**
 * 持ち点を検査する。
 *
 * 見るのは次のこと。
 *   ・1局ごとの足し引きではなく、功績値から曲線で導いていること
 *   ・遊ぶほど上がるが、伸びは鈍っていくこと
 *   ・全体の総対局数が増えると、みんなが少し上がること
 *   ・強い相手に勝つほど大きいこと
 *   ・**同じ実力の人どうしが、以前より開かないこと**（作り直した狙い）
 *   ・段位は遊んだ量ではなく、1局あたりの成績で決まること
 *   ・9×9のオンライン以外では動かないこと
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
  MIN_RATING,
  START_RATING,
  displayRating,
  nextScore,
  rankTitle,
  scoreFromRating,
  scoreGain,
  worldAverage,
  worldPart,
} = await import("../src/game/rating.js");
const { loadProfile, recordGame, saveName } =
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
const yes = (label, cond) => is(label, !!cond, true);

console.log("功績値から導く");
is("何もしていなければ始めの点", displayRating(0, 0), START_RATING);
yes("功績値が増えれば上がる", displayRating(10, 0) > displayRating(0, 0));
yes(
  "伸びは鈍っていく",
  displayRating(20, 0) - displayRating(10, 0) <
    displayRating(10, 0) - displayRating(0, 0),
);
yes("下限を割らない", displayRating(0, 0) >= MIN_RATING);
yes(
  "持ち点から功績値へ戻せる",
  Math.abs(scoreFromRating(displayRating(200, 0), 0) - 200) < 1,
);

console.log("\n全体の総対局数");
is("誰も遊んでいなければ乗らない", Math.round(worldPart(0)), 0);
yes("遊ばれるほど上がる", worldPart(1000) > worldPart(100));
yes("暴走しない(10万局でも+310以内)", worldPart(100000) < 310);
yes(
  "全体が増えると、同じ功績値でも上がる",
  displayRating(100, 1000) > displayRating(100, 0),
);

console.log("\n1局で貯まる功績値");
yes("勝てば貯まる", scoreGain(worldAverage(0), true, 0) > 0);
is("負けても減らない", scoreGain(worldAverage(0), false, 0), 0);
yes(
  "引き分けは勝ちより小さい",
  scoreGain(worldAverage(0), null, 0) < scoreGain(worldAverage(0), true, 0),
);
yes(
  "強い相手に勝つほど大きい",
  scoreGain(2000, true, 0) > scoreGain(worldAverage(0), true, 0),
);
yes(
  "相手が桁外れを名乗っても、効き方に上限がある",
  scoreGain(4000, true, 0) < scoreGain(worldAverage(0), true, 0) * 1.25,
);

console.log("\n遊ぶほど上がる（下がらない）");
{
  let e = 0,
    n = 0,
    prev = START_RATING;
  let downs = 0;
  for (let i = 1; i <= 200; i++) {
    const o = nextScore(e, n, worldAverage(i), i % 3 === 0, i);
    e = o.earned;
    n = o.rated;
    const r = displayRating(o.score, i);
    if (r < prev) downs++;
    prev = r;
  }
  is("1度も下がらない", downs, 0);
  yes("200局で上がっている", prev > START_RATING);
}

console.log("\n同じ実力の人どうしが開かないか");
{
  const ends = [];
  for (let t = 0; t < 800; t++) {
    let e = 0,
      n = 0,
      r = START_RATING;
    for (let i = 1; i <= 100; i++) {
      const w = i * 14;
      const o = nextScore(e, n, worldAverage(w), Math.random() < 0.5, w);
      e = o.earned;
      n = o.rated;
      r = displayRating(o.score, w);
    }
    ends.push(r);
  }
  ends.sort((a, b) => a - b);
  const spread = ends[759] - ends[40];
  console.log(`       互角100局の開き: ${spread}点`);
  yes("以前(135点)よりはっきり小さい", spread < 100);
}

console.log("\n強い人はきちんと上に行く");
{
  const at = (p) => {
    const runs = [];
    for (let t = 0; t < 400; t++) {
      let e = 0,
        n = 0,
        r = START_RATING;
      for (let i = 1; i <= 100; i++) {
        const w = i * 14;
        const o = nextScore(e, n, worldAverage(w), Math.random() < p, w);
        e = o.earned;
        n = o.rated;
        r = displayRating(o.score, w);
      }
      runs.push(r);
    }
    runs.sort((a, b) => a - b);
    return runs[200];
  };
  const g50 = at(0.5);
  const g65 = at(0.65);
  console.log(`       100局後: 勝率50% ${g50} / 勝率65% ${g65}`);
  yes("勝ち越す人のほうが上", g65 > g50);
  yes("差がちゃんと出る(40点以上)", g65 - g50 >= 40);
}

console.log("\n段位は遊んだ量では上がらない");
{
  // 勝率5割のまま、20局と500局
  const climb = (n, p) => {
    let e = 0,
      m = 0,
      r = START_RATING,
      w = 0;
    for (let i = 1; i <= n; i++) {
      w = i * 14;
      const o = nextScore(e, m, worldAverage(w), i % 2 === 0, w);
      e = o.earned;
      m = o.rated;
      r = displayRating(o.score, w);
    }
    return [r, m, w];
  };
  const [r20, n20, w20] = climb(20, 0.5);
  const [r500, n500, w500] = climb(500, 0.5);
  yes("持ち点は遊ぶほど上がる", r500 > r20);
  is("段位は同じまま", rankTitle(r500, n500, w500), rankTitle(r20, n20, w20));
  is("1局も数えていなければ見習い", rankTitle(START_RATING, 0, 0), "見習い");
  // 全勝でも、局数が少ないうちは上の段位に届かない
  const allWin = (n) => {
    let e = 0,
      m = 0,
      r = START_RATING,
      w = 0;
    for (let i = 1; i <= n; i++) {
      w = i * 14;
      const o = nextScore(e, m, worldAverage(w), true, w);
      e = o.earned;
      m = o.rated;
      r = displayRating(o.score, w);
    }
    return rankTitle(r, m, w);
  };
  is("5局の全勝では王にならない", allWin(5) === "王", false);
  is("60局の全勝なら王", allWin(60), "王");
}

console.log("\n持ち点が動く対局");
{
  saveName("ためし");
  const a = recordGame(true, { foeRating: START_RATING, worldGames: 100 });
  yes("相手の持ち点が渡れば上がる", a.rating > START_RATING);
  is("対局数を数える", a.rated, 1);
  const b = recordGame(true, {});
  is("渡らなければ動かない", b.rating, a.rating);
  is("対局数も増えない", b.rated, 1);
  yes("それでも対戦の記録には残る", b.plays > a.plays);
}

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
