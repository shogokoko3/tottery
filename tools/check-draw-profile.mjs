/** 引き分けを、勝数・経験値・クリア履歴・レーティングへ正しく記録する。 */
import assert from "node:assert/strict";

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

const { loadProfile, recordGame } = await import("../src/game/profile.js");
const { ratingDelta, applyRating, MIN_RATING } =
  await import("../src/game/rating.js");
const { XP } = await import("../src/game/level.js");
const { hasTitle } = await import("../src/game/titles.js");
const { MISSIONS, statusOf } = await import("../src/game/missions.js");

function fixture(extra = {}) {
  memory.clear();
  memory.set(
    "tottery.account.v1",
    JSON.stringify({
      id: "draw-player",
      name: "引分け検証",
      plays: 9,
      battles: 9,
      wins: 9,
      xp: 450,
      rating: 1500,
      rated: 50,
      ...extra,
    }),
  );
  return loadProfile();
}

// 保存済みの実XP・勝数を残して、引分け数のない旧版から読み込める。
{
  const old = fixture();
  assert.deepEqual([old.draws, old.wins, old.xp], [0, 9, 450]);
  memory.clear();
  memory.set("tottery.profile.v1", JSON.stringify({ plays: 7, wins: 3 }));
  assert.deepEqual(
    [loadProfile().draws, loadProfile().plays, loadProfile().wins],
    [0, 7, 3],
  );
  for (const draws of [-1, 1.5, "broken"])
    assert.equal(fixture({ draws }).draws, 0);
}

// Eloは引分け0.5点。同格の0変動を勝敗用の最低±1補正で壊さない。
assert.equal(ratingDelta(1500, 1500, null, 50), 0);
assert.equal(ratingDelta(1500, 1500, null, 0), 0);
assert.equal(ratingDelta(1500, 1501, null, 50), 0);
assert.equal(ratingDelta(1501, 1500, null, 50), 0);
assert.ok(ratingDelta(1500, 1700, null, 50) > 0);
assert.ok(ratingDelta(1700, 1500, null, 50) < 0);
assert.equal(
  ratingDelta(1500, 1700, null, 50) + ratingDelta(1700, 1500, null, 50),
  0,
);
assert.ok(applyRating(MIN_RATING, MIN_RATING, null, 50) >= MIN_RATING);
assert.ok(ratingDelta(2800, 100, true, 50) >= 1, "従来の勝利の最低増加を維持");
assert.ok(
  ratingDelta(100, 2800, false, 50) <= -1,
  "従来の敗北の最低減少を維持",
);
assert.equal(
  ratingDelta(1500, 1500, undefined, 50),
  ratingDelta(1500, 1500, false, 50),
);

{
  const before = fixture();
  const after = recordGame(null, { foeRating: 1500, deferXpNotice: true });
  assert.deepEqual([after.rating, after.delta, after.rated], [1500, 0, 51]);
  assert.deepEqual(
    [after.plays, after.battles, after.wins, after.draws],
    [10, 10, 9, 1],
  );
  assert.equal(after.gained, XP.BATTLE);
  assert.equal(after.xp, before.xp + XP.BATTLE);
  assert.ok(after.xpNoticeId, "通常の引分けでも獲得通知を用意");
  assert.equal(after.firstClear, false);
  assert.equal(
    hasTitle(after, "win10"),
    false,
    "9勝の後の引分けで十勝称号を付けない",
  );
  assert.equal(hasTitle(after, "ten"), true, "10局遊んだ実績は進む");
  assert.equal(
    statusOf(
      MISSIONS.find((m) => m.id === "battles-10"),
      after,
    ).done,
    true,
  );
  assert.deepEqual(
    [loadProfile().draws, loadProfile().rating, loadProfile().xp],
    [1, 1500, after.xp],
  );
  const win = recordGame(true, { foeRating: 1500 });
  assert.deepEqual([win.wins, win.draws], [10, 1]);
  assert.equal(hasTitle(win, "win10"), true);
}

{
  const before = fixture({ draws: 2 });
  const after = recordGame(null);
  assert.deepEqual(
    [after.rating, after.rated, after.delta],
    [before.rating, before.rated, null],
    "CPU・同一端末の引分けはレート対象外",
  );
  assert.deepEqual(
    [after.plays, after.battles, after.wins, after.draws],
    [10, 10, 9, 3],
  );
  assert.equal(after.xp, before.xp + XP.BATTLE);
  const lost = recordGame();
  assert.deepEqual(
    [lost.wins, lost.draws],
    [9, 3],
    "引数省略は従来どおり敗北で、引分け数を増やさない",
  );
  assert.equal(lost.xp, after.xp + XP.BATTLE);
}

{
  const before = fixture({ cleared: [1] });
  const opts = { tutorial: true, tutorialId: 2, xp: 300 };
  const draw = recordGame(null, opts);
  assert.deepEqual(
    [draw.gained, draw.xp, draw.firstClear, draw.xpNoticeId],
    [0, before.xp, false, null],
  );
  assert.deepEqual(
    draw.cleared,
    [1],
    "チュートリアルの引分けを初回クリアに登録しない",
  );
  assert.equal(draw.battles, before.battles);
  assert.equal(draw.draws, 1);
  const clear = recordGame(true, opts);
  assert.deepEqual(
    [clear.gained, clear.firstClear, clear.cleared],
    [300, true, [1, 2]],
    "後で勝てば初回報酬を受け取れる",
  );
  const again = recordGame(true, opts);
  assert.deepEqual(
    [again.gained, again.firstClear, again.xpNoticeId],
    [0, false, null],
  );
}

// 既存APIの明示XP指定を保つ。引分けだけを新しい結果として分岐する。
{
  const before = fixture();
  const lost = recordGame(false, { tutorial: true, xp: 100 });
  assert.equal(lost.xp, before.xp + 100);
  assert.deepEqual(
    [lost.draws, lost.wins, lost.battles],
    [0, before.wins, before.battles],
  );
}

console.log(
  "引分けプロフィール: 旧保存・勝数/称号・対戦数/ミッション・通常XP・チュートリアル未クリア・Elo0.5点・既存勝敗API: OK",
);
