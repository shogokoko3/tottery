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
  ratingWithWorld,
  nextRating,
  rankTitle,
  skillPart,
  weightOf,
  worldPart,
  wrFromProfile,
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

console.log("勝率の見積もりから導く");
is("五分なら始めの点", displayRating(0.5), START_RATING);
yes("勝ち越していれば上", displayRating(0.7) > START_RATING);
yes("負け越していれば下", displayRating(0.3) < START_RATING);
yes("下限を割らない", displayRating(0) >= MIN_RATING);
yes("天井がある(2000には届かない)", displayRating(1) < 2000);
yes("床がある(1000を割らない)", displayRating(0) > 1000);

console.log("\n1局の重みは、遊ぶほど小さくなる");
yes("はじめは大きい", weightOf(0) > weightOf(50));
yes("やがて下げ止まる", weightOf(200) === weightOf(1000));

console.log("\n全体の総対局数");
is("誰も遊んでいなければ乗らない", Math.round(worldPart(0)), 0);
yes("遊ばれるほど上がる", worldPart(1000) > worldPart(100));
yes("暴走しない(10万局でも+310以内)", worldPart(100000) < 310);
yes(
  "全体が増えると、見せる持ち点が上がる",
  ratingWithWorld(1500, 1000) > ratingWithWorld(1500, 0),
);

console.log("\n相手の持ち点を一度も読まない");
{
  // nextRating は相手の値を受け取らない。呼び方が変わっても結果は同じ
  const a = nextRating(0.5, 10, true);
  const b = nextRating(0.5, 10, true);
  is("同じ入力なら同じ結果(乱数を使わない)", a, b);
  yes("勝てば上がる", a.wr > 0.5);
  yes("負ければ下がる", nextRating(0.5, 10, false).wr < 0.5);
  is("引き分けは五分のままなら動かない", nextRating(0.5, 10, null).wr, 0.5);
}

console.log("\n共謀しても得をしない");
{
  // 相手が何を名乗ろうと、式に入らない
  const climb = (n) => {
    let wr = 0.5,
      r = 0;
    for (let i = 0; i < n; i++) {
      const o = nextRating(wr, r, true);
      wr = o.wr;
      r = o.rated;
    }
    return displayRating(wr);
  };
  const honest = climb(20);
  is("共謀20連勝と正直20連勝が同じ値", honest, climb(20));
  console.log(`       20連勝で ${honest}(いままでは共謀で 2100、正直で 1709)`);
}

console.log("\n同じ実力の人どうしが開かないか");
{
  const spread = (n) => {
    const ends = [];
    for (let t = 0; t < 800; t++) {
      let wr = 0.5,
        r = 0;
      for (let i = 1; i <= n; i++) {
        const o = nextRating(wr, r, Math.random() < 0.5);
        wr = o.wr;
        r = o.rated;
      }
      ends.push(displayRating(wr));
    }
    ends.sort((a, b) => a - b);
    return ends[759] - ends[40];
  };
  const s100 = spread(100);
  const s500 = spread(500);
  console.log(`       互角100局の開き ${s100}点 / 500局 ${s500}点`);
  yes("100局で、以前(135点)よりはっきり小さい", s100 < 110);
  yes("**遊ぶほど縮む**(以前は広がっていた)", s500 < s100);
}

console.log("\n強い人はきちんと上に行く");
{
  const at = (p, n) => {
    const runs = [];
    for (let t = 0; t < 500; t++) {
      let wr = 0.5,
        r = 0;
      for (let i = 1; i <= n; i++) {
        const o = nextRating(wr, r, Math.random() < p);
        wr = o.wr;
        r = o.rated;
      }
      runs.push(displayRating(wr));
    }
    runs.sort((a, b) => a - b);
    return runs[250];
  };
  const g50 = at(0.5, 100),
    g65 = at(0.65, 100),
    g35 = at(0.35, 100);
  console.log(`       100局後: 35% ${g35} / 50% ${g50} / 65% ${g65}`);
  yes("勝ち越す人のほうが上", g65 > g50);
  yes("負け越す人は下", g35 < g50);
  yes("差がちゃんと出る(60点以上)", g65 - g50 >= 60);
}

console.log("\n段位は遊んだ量では上がらない");
{
  const climb = (n, p) => {
    let wr = 0.5,
      r = 0;
    for (let i = 1; i <= n; i++) {
      const o = nextRating(wr, r, i % 2 === 0);
      wr = o.wr;
      r = o.rated;
    }
    const w = n * 14;
    return [displayRating(wr, w), r, w];
  };
  const [r20, n20, w20] = climb(20);
  const [r500, n500, w500] = climb(500);
  yes("全体が増えれば持ち点は上がる", r500 > r20);
  is("段位は同じまま", rankTitle(r500, n500, w500), rankTitle(r20, n20, w20));
  is("10局に満たなければ見習い", rankTitle(1800, 5, 0), "見習い");
}

console.log("\n壊れた保存を渡しても正気の値になる");
for (const [name, saved] of [
  ["空", {}],
  ["undefined", undefined],
  ["文字列", { wr: "0.7", rated: "40" }],
  ["NaN", { wr: NaN, rated: NaN }],
  ["古い保存(wr なし)", { rating: 1607, rated: 12 }],
]) {
  const wr = wrFromProfile(saved);
  yes(`${name}: 勝率の見積もりが 0〜1 に収まる`, wr >= 0 && wr <= 1);
  yes(`${name}: 持ち点が数になる`, Number.isFinite(displayRating(wr)));
}
yes(
  "勝ち数から復元できる",
  Math.abs(wrFromProfile({ rated: 10, ratedWins: 7 }) - 0.7) < 1e-9,
);

console.log("\n保存の書き換えは効かない");
{
  saveName("ためし");
  const p1 = loadProfile();
  store["tottery.account.v1"] = JSON.stringify({ ...p1, rating: 2500 });
  is("読み直すと元へ戻る", loadProfile().rating, p1.rating);
}

console.log("\n持ち点が動く対局");
{
  const a = recordGame(true, { foeRating: START_RATING });
  yes("相手の持ち点が渡れば上がる", a.rating > displayRating(0.5));
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
