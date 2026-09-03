/**
 * レーティングを検査する。
 *
 * 勝てば上がり負ければ下がる、強い相手に勝つほど大きく上がる、
 * といった当たり前のことが崩れていないかを見る。
 * オンライン以外の対局で動いてしまわないことも確かめる。
 */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
};

const {
  MIN_RATING,
  PROVISIONAL_GAMES,
  START_RATING,
  applyRating,
  expectedScore,
  kFactor,
  rankTitle,
  ratingDelta,
} = await import("../src/game/rating.js");
const { loadProfile, recordGame, saveName } = await import(
  "../src/game/profile.js"
);

let ok = 0;
const fails = [];
function is(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    ok++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(label);
    console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
  }
}
function yes(label, cond) {
  is(label, !!cond, true);
}

console.log("見込み");
is("同じ持ち点なら五分", expectedScore(1500, 1500), 0.5);
yes("強い相手には分が悪い", expectedScore(1500, 1900) < 0.15);
yes("弱い相手には分がいい", expectedScore(1900, 1500) > 0.85);

console.log("増減");
{
  yes("勝てば上がる", ratingDelta(1500, 1500, true, 50) > 0);
  yes("負ければ下がる", ratingDelta(1500, 1500, false, 50) < 0);
  yes(
    "強い相手に勝つほど大きく上がる",
    ratingDelta(1500, 1900, true, 50) > ratingDelta(1500, 1100, true, 50),
  );
  yes(
    "弱い相手に負けるほど大きく下がる",
    ratingDelta(1500, 1100, false, 50) < ratingDelta(1500, 1900, false, 50),
  );
  yes(
    "差がつきすぎても勝てば必ず1は上がる",
    ratingDelta(2800, 100, true, 50) >= 1,
  );
  yes(
    "差がつきすぎても負ければ必ず1は下がる",
    ratingDelta(100, 2800, false, 50) <= -1,
  );
  is("慣れるまでは大きく動く", kFactor(0) > kFactor(PROVISIONAL_GAMES), true);
  yes("下限より下がらない", applyRating(MIN_RATING, 2800, false, 50) >= MIN_RATING);
}

console.log("互いの増減");
{
  // 同じ対局を両側から見て、上がった分と下がった分が釣り合うか
  const a = ratingDelta(1500, 1700, true, 50);
  const b = ratingDelta(1700, 1500, false, 50);
  is("勝った側の増と負けた側の減が釣り合う", a + b, 0);
}

console.log("対局の記録");
{
  saveName("しょうご");
  is("始めの持ち点", loadProfile().rating, START_RATING);

  const cpu = recordGame(true);
  is("CPU戦では動かない", cpu.rating, START_RATING);
  is("CPU戦は増減も出さない", cpu.delta, null);
  is("CPU戦でも対局数は増える", cpu.plays, 1);
  is("レーティングの対局数は増えない", cpu.rated, 0);

  const online = recordGame(true, { foeRating: 1500 });
  yes("オンラインで勝つと上がる", online.rating > START_RATING);
  yes("増減を返す", online.delta > 0);
  is("レーティングの対局数が増える", online.rated, 1);

  const lost = recordGame(false, { foeRating: 1500 });
  yes("負けると下がる", lost.delta < 0);
  is("持ち点は保存される", loadProfile().rating, lost.rating);
}

console.log("呼び名");
is("見習い", rankTitle(1200), "見習い");
is("王", rankTitle(2100), "王");

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) process.exit(1);
