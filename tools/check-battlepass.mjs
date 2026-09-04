/**
 * バトルパスを検査する。
 *
 * 真ん中から縦横に広がること、1手ぶんを二度数えないこと、
 * クリアしていないマスはめくれないこと、全部めくると受け取れること。
 */
const {
  CELLS,
  SIZE,
  allCleared,
  allFlipped,
  applyCaptures,
  canClaim,
  capturedIn,
  cellById,
  centerId,
  flipAll,
  gainOf,
  normalize,
  openCells,
  rewardSkin,
  statusOf,
  toggleFlip,
} = await import("../src/game/battlepass.js");

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
const ids = (list) => list.map((c) => c.id).sort();

console.log("盤の作り");
is("一辺は奇数", SIZE % 2, 1);
is("マスの数", CELLS.length, SIZE * SIZE);
is("id が重複しない", new Set(CELLS.map((c) => c.id)).size, CELLS.length);
is("真ん中はフリー", cellById(centerId).free, true);
is("フリーは真ん中だけ", CELLS.filter((c) => c.free).length, 1);
is(
  "フリー以外には条件がある",
  CELLS.filter((c) => !c.free).every(
    (c) => c.track && Number.isInteger(c.goal) && c.goal > 0 && c.name,
  ),
  true,
);
is("褒美のスキンが実在する", !!rewardSkin(), true);

console.log("取った駒の数え方");
is("何も取らなければ0", gainOf([]).any, 0);
is(
  "2枚取ると any 2 と multi 1",
  (() => {
    const g = gainOf([{ rank: "2" }, { rank: "3" }]);
    return [g.any, g.multi, g["rank:2"], g["rank:3"]];
  })(),
  [2, 1, 1, 1],
);
is("1枚だけなら multi は立たない", gainOf([{ rank: "2" }]).multi, 0);
is("王を取ると king", gainOf([{ rank: "J", wasKing: true }]).king, 1);
is("壊れた入力でも落ちない", [gainOf(null).any, gainOf([null]).any], [0, 1]);

console.log("広がり方");
let s = normalize(null);
is("はじめはフリーだけクリア済み", s.cleared, [centerId]);
is("はじめに挑戦できるのは縦横の4マス", ids(openCells(s)), [
  "1-2",
  "2-1",
  "2-3",
  "3-2",
]);
is(
  "斜めのマスはまだ開かない",
  openCells(s).some((c) => c.id === "1-1"),
  false,
);
// 真ん中の上のマス(駒を3枚取る)を埋める
const first = cellById("1-2");
is("最初のマスはやさしい", [first.track, first.goal], ["any", 3]);
s = applyCaptures(s, [{ rank: "2" }, { rank: "3" }, { rank: "4" }]);
is("3枚取るとクリアになる", s.cleared.includes("1-2"), true);
is("同じ1手を二度数えない(any5 のマスは3のまま)", s.progress["2-1"], 3);
is(
  "クリアすると隣が開く",
  openCells(s).some((c) => c.id === "0-2"),
  true,
);
is("開いていないマスには進まない", s.progress["0-0"], undefined);
const before = { ...s.progress };
s = applyCaptures(s, []);
is("何も取らなければ変わらない", s.progress, before);

console.log("めくる");
s = toggleFlip(s, "0-2");
is("クリアしていないマスはめくれない", s.flipped.includes("0-2"), false);
s = toggleFlip(s, "1-2");
is("クリアしたマスはめくれる", s.flipped, ["1-2"]);
s = toggleFlip(s, "1-2");
is("もう一度押すと戻って条件が読める", s.flipped, []);
s = toggleFlip(s, "1-2");
is("また返せる", s.flipped, ["1-2"]);
// まとめて
s = flipAll(s, true);
is("まとめて返すとクリア済みが全部裏に", s.flipped.length, s.cleared.length);
s = flipAll(s, false);
is("まとめて戻すと全部表に", s.flipped, []);
is(
  "クリアしていないマスは混ざらない",
  flipAll(s, true).flipped.every((id) => s.cleared.includes(id)),
  true,
);

console.log("最後まで");
let full = normalize({
  cleared: CELLS.map((c) => c.id),
  flipped: CELLS.filter((c) => c.id !== "0-0").map((c) => c.id),
});
is("全部クリア", allCleared(full), true);
is(
  "1枚残っていれば受け取れない",
  [allFlipped(full), canClaim(full)],
  [false, false],
);
full = toggleFlip(full, "0-0");
is("全部めくると受け取れる", [allFlipped(full), canClaim(full)], [true, true]);
full = { ...full, claimed: true };
is("一度受け取ったら終わり", canClaim(full), false);

console.log("保存の読み直し");
is(
  "知らない id は落とす",
  normalize({ cleared: ["9-9"], flipped: ["9-9"] }).cleared,
  [centerId],
);
is(
  "クリアしていないマスのめくりは落とす",
  normalize({ flipped: ["1-2"] }).flipped,
  [],
);
is(
  "壊れた進みは落とす",
  normalize({ progress: { "1-2": -3, "9-9": 5 } }).progress,
  {},
);
is("読み直しても同じ", normalize(normalize(full)).flipped.length, CELLS.length);

console.log("対局から拾う");
const piece = (id, owner, rank, alive, isKing) => ({
  id,
  owner,
  rank,
  alive,
  isKing,
});
const bef = {
  currentTurn: 0,
  pieces: {
    a: piece("a", 1, "5", true),
    b: piece("b", 1, "K", true, true),
    c: piece("c", 0, "4", true),
  },
};
const aft = {
  pieces: {
    a: piece("a", 1, "5", false),
    b: piece("b", 1, "K", false, true),
    c: piece("c", 0, "4", false),
  },
};
is(
  "自分が取った相手の駒だけを拾う(道連れで消えた自分の駒は入れない)",
  capturedIn(bef, aft, 0),
  [
    { rank: "5", wasKing: false },
    { rank: "K", wasKing: true },
  ],
);
is(
  "相手の手番では拾わない",
  capturedIn({ ...bef, currentTurn: 1 }, aft, 0),
  null,
);
is(
  "何も減っていなければ null",
  capturedIn(bef, { pieces: bef.pieces }, 0),
  null,
);
is(
  "盤が無くても落ちない",
  [capturedIn(null, aft, 0), capturedIn(bef, null, 0)],
  [null, null],
);

console.log(`\n${ok} ok / ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
