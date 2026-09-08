import assert from "node:assert/strict";
import {
  nextRating,
  expectedScore,
  ratingWithWorld,
  worldPart,
  displayRating,
  RATING_VERSION,
  MIN_RATING,
  MAX_RATING,
  rankTitle,
} from "../src/game/rating.js";
// 段位は対戦数によらずレートのみ。各境界の直前・到達時と新規1500を確認。
for (const games of [0, 1, 9, 10, 19, 20, 49, 50, 500])
  for (const [rating, title] of [
    [1449, "見習い"],
    [1450, "兵"],
    [1500, "兵"],
    [1549, "兵"],
    [1550, "士"],
    [1649, "士"],
    [1650, "将"],
    [1749, "将"],
    [1750, "王"],
  ])
    assert.equal(rankTitle(rating, games), title);
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { loadProfile, recordGame, saveName } =
  await import("../src/game/profile.js");
assert.equal(expectedScore(1500, 1500), 0.5);
assert.equal(nextRating(1500, 1500, true).rating, 1516);
assert.equal(nextRating(1500, 1500, false).rating, 1484);
assert.equal(nextRating(1500, 1500, null).rating, 1500);
assert.equal(nextRating(1500, 1700, true).delta, 24);
assert.equal(nextRating(1500, 1300, true).delta, 8);
assert.equal(nextRating(1500, 1700, false).delta, -8);
assert.equal(nextRating(1500, 1300, false).delta, -24);
assert.equal(nextRating(1500, 1700, null).delta, 8);
assert.equal(nextRating(1500, 1300, null).delta, -8);
for (const total of [0, 100, 10000, 1e9]) {
  assert.equal(worldPart(total), 0);
  assert.equal(ratingWithWorld(1500, total), 1500);
}
let pairs = 0;
for (let a = MIN_RATING; a <= MAX_RATING; a += 53)
  for (let b = MIN_RATING; b <= MAX_RATING; b += 59)
    for (const won of [true, false, null]) {
      const x = nextRating(a, b, won),
        y = nextRating(b, a, won === null ? null : !won);
      assert.equal(x.delta + y.delta, 0);
      assert(x.rating >= MIN_RATING && x.rating <= MAX_RATING);
      if (won === true) assert(x.delta >= 0);
      if (won === false) assert(x.delta <= 0);
      pairs++;
    }
// 旧データの戦績と旧点数を引き継ぎ、新たな点数は勝率から再計算しない。
store.set(
  "tottery.account.v1",
  JSON.stringify({
    id: "legacy",
    name: "引継ぎ",
    wr: 0.6,
    rated: 50,
    ratedWins: 30,
    plays: 75,
    wins: 40,
    xp: 4000,
    rating: 9999,
  }),
);
const old = loadProfile();
assert.equal(old.rating, displayRating(0.6));
const first = recordGame(true, { foeRating: 1700, startRating: old.rating });
assert.equal(first.ratingVersion, RATING_VERSION);
assert.equal(first.plays, 76);
assert.equal(first.rated, 51);
assert.equal(first.wins, 41);
assert(first.xp > 4000);
assert.equal(loadProfile().rating, first.rating);
const second = recordGame(false, {
  foeRating: 1700,
  startRating: first.rating,
});
assert.equal(loadProfile().rating, second.rating);
// 2000以上も維持できる。試合開始時の保存済みレートを結果計算の基準にする。
store.set(
  "tottery.account.v1",
  JSON.stringify({ ...second, rating: 2200, ratingVersion: RATING_VERSION }),
);
assert.equal(loadProfile().rating, 2200);
const fromSnapshot = recordGame(true, { foeRating: 1500, startRating: 1500 });
assert.equal(fromSnapshot.rating, 1516);
const unranked = recordGame(true, {});
assert.equal(unranked.rating, 1516);
assert.equal(unranked.delta, null);
store.clear();
saveName("新規");
assert.equal(loadProfile().rating, 1500);
console.log(
  `Elo: expected outcomes, symmetric bounds (${pairs} pairs), no global bonus, migration, persistence, snapshot and unranked scope: OK`,
);
