/**
 * バトルパスを検査する。
 *
 * 真ん中から縦横に広がること、1手ぶんを二度数えないこと、
 * 絵片の順序を保存すること、全部めくって絵が完成すると受け取れること。
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
  markAssembled,
  normalize,
  openCells,
  rewardSkin,
  statusOf,
  toggleFlip,
} = await import("../src/game/battlepass.js");
const { claimSpecial, normalize: normalizeCollection } =
  await import("../src/skins/collection.js");
const { POOL } = await import("../src/skins/catalog.js");

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
is(
  "報酬はAのランプのマジシャン",
  [rewardSkin().id, rewardSkin().rank, rewardSkin().rarity],
  ["genie-magician", "A", "SPECIAL"],
);
is(
  "通常ガチャからは出ない",
  POOL.some((skin) => skin.id === rewardSkin().id),
  false,
);

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
const hasEveryPiece = (order) =>
  JSON.stringify([...order].sort((a, b) => a - b)) ===
  JSON.stringify(CELLS.map((_, i) => i));
const allMisplaced = (order) => order.every((piece, i) => piece !== i);
const initialOrder = [...s.puzzleOrder];
is("保存はv3", s.version, 3);
is("初回の絵片に重複・欠落がない", hasEveryPiece(s.puzzleOrder), true);
is("初回は全25片が正位置と異なる", allMisplaced(s.puzzleOrder), true);
is("初回は絵が未完成", s.assembled, false);
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
is("進捗が増えても絵片の順序は変わらない", s.puzzleOrder, initialOrder);
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
is("めくりを繰り返しても絵片の順序は変わらない", s.puzzleOrder, initialOrder);
is("途中では絵を完成扱いにできない", markAssembled(s).assembled, false);
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
is(
  "全部めくっても完成処理前は受け取れない",
  [allFlipped(full), canClaim(full)],
  [true, false],
);
is("25枚めくったら単体操作で戻せない", toggleFlip(full, "0-0"), full);
is("25枚めくったら一括操作で戻せない", flipAll(full, false), full);
const scrambledOrder = [...full.puzzleOrder];
full = markAssembled(full);
is("絵の完成後は受け取れる", [full.assembled, canClaim(full)], [true, true]);
is("完成後も元の絵片の順序を保存", full.puzzleOrder, scrambledOrder);
is("完成の通知を繰り返しても変わらない", markAssembled(full), full);
full = normalize({ ...full, claimed: true });
is("一度受け取ったら終わり", canClaim(full), false);
is(
  "受取済みを保存し直しても受け取れない",
  canClaim(normalize(JSON.parse(JSON.stringify(full)))),
  false,
);

console.log("報酬変更時の引き継ぎ");
const legacy = {
  version: 1,
  progress: { "1-2": 3, "0-0": 10 },
  cleared: CELLS.map((c) => c.id),
  flipped: CELLS.map((c) => c.id),
  claimed: true,
};
const migrated = normalize(legacy);
is("旧天使の受取済みでは新しい絵を完成扱いにしない", migrated.assembled, false);
is(
  "旧天使を受取済みでも絵の完成後にAを受け取れる",
  canClaim(markAssembled(migrated)),
  true,
);
is(
  "以前の報酬IDがあっても新報酬の受取を塞がない",
  canClaim(markAssembled(normalize({ ...legacy, rewardId: "angel-k" }))),
  true,
);
is("移行で進捗を消さない", migrated.progress, legacy.progress);
is(
  "移行でクリアしたマスを消さない",
  [...migrated.cleared].sort(),
  [...legacy.cleared].sort(),
);
is("移行でめくったマスを戻さない", migrated.flipped, legacy.flipped);
is("移行後も報酬と受取待ちが保存される", normalize(migrated), migrated);
const partial = normalize({
  ...legacy,
  cleared: [centerId, "1-2"],
  flipped: [centerId],
  claimed: false,
});
is(
  "途中の進捗・めくりも引き継ぐ",
  [partial.progress, partial.cleared, partial.flipped],
  [legacy.progress, [centerId, "1-2"], [centerId]],
);
is("途中の人は完成するまで受け取れない", canClaim(partial), false);
is(
  "未受取で25枚開いていなければ完成フラグを落とす",
  normalize({ ...partial, assembled: true }).assembled,
  false,
);
const claimedV2 = normalize({
  version: 2,
  rewardId: rewardSkin().id,
  progress: legacy.progress,
  cleared: legacy.cleared,
  flipped: [centerId],
  claimed: true,
});
is(
  "v2で条件に戻した受取済みAも完成・受取済みを維持",
  [claimedV2.assembled, claimedV2.claimed, canClaim(claimedV2)],
  [true, true, false],
);
is(
  "受取済みAの旧進捗とめくりを維持",
  [claimedV2.progress, claimedV2.flipped],
  [legacy.progress, [centerId]],
);
is("受取済みAの移行を再読込しても変わらない", normalize(claimedV2), claimedV2);
is(
  "旧版から移行した完成絵も単体操作で戻さない",
  toggleFlip(claimedV2, centerId),
  claimedV2,
);
is(
  "旧版から移行した完成絵も一括操作で戻さない",
  flipAll(claimedV2, false),
  claimedV2,
);
const oldCollection = normalizeCollection({
  owned: { "angel-k": 1 },
  equipped: { K: "angel-k" },
  tickets: 4,
  ether: 12,
});
const received = claimSpecial(oldCollection, rewardSkin().id);
is("新報酬のAを1枚受け取る", received.owned[rewardSkin().id], 1);
is(
  "旧報酬・装備・チケット・エーテルを残す",
  [
    received.owned["angel-k"],
    received.equipped,
    received.tickets,
    received.ether,
  ],
  [1, oldCollection.equipped, 4, 12],
);
is(
  "保存再試行や重複受取でも増えない",
  claimSpecial(received, rewardSkin().id),
  received,
);
const alreadyOwned = normalizeCollection({
  ...received,
  equipped: { ...received.equipped, A: rewardSkin().id },
});
is(
  "先行受取済みのAは枚数も装備も維持",
  claimSpecial(alreadyOwned, rewardSkin().id),
  alreadyOwned,
);

console.log("保存の読み直し");
is(
  "再読み込みしても絵片の順序と完成状態を保持",
  normalize(JSON.parse(JSON.stringify(full))),
  full,
);
for (const [label, order] of [
  ["欠落", initialOrder.slice(1)],
  ["重複", initialOrder.map((n, i) => (i === 1 ? initialOrder[0] : n))],
  ["範囲外", initialOrder.map((n, i) => (i === 1 ? 25 : n))],
  ["小数", initialOrder.map((n, i) => (i === 1 ? 0.5 : n))],
  ["文字", initialOrder.map(String)],
  ["正位置", CELLS.map((_, i) => i)],
]) {
  const repaired = normalize({ ...partial, puzzleOrder: order });
  is(
    `${label}のある順序は重複なし・全片ずれた順序へ修復`,
    hasEveryPiece(repaired.puzzleOrder) && allMisplaced(repaired.puzzleOrder),
    true,
  );
  is(
    `${label}の修復後は順序を再生成しない`,
    normalize(repaired).puzzleOrder,
    repaired.puzzleOrder,
  );
}
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

console.log("実ストアの初回保存・別タブ・保存失敗");
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const storage = new Map();
const storageListeners = [];
let rejectRead = false,
  rejectWrite = false,
  storeId = 0;
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    addEventListener(type, fn) {
      if (type === "storage") storageListeners.push(fn);
    },
  },
});
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem(key) {
      if (rejectRead) throw new Error("storage read unavailable");
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      if (rejectWrite) throw new Error("storage write unavailable");
      storage.set(key, value);
    },
  },
});
const freshStore = async () => {
  const url = new URL("../src/game/battlepass-store.js", import.meta.url);
  url.searchParams.set("check-store", String(++storeId));
  return import(url.href);
};
try {
  const a = await freshStore();
  storage.set(
    a.PASS_KEY,
    JSON.stringify({
      version: 2,
      rewardId: rewardSkin().id,
      progress: { "1-2": 2 },
      cleared: [centerId],
      flipped: [centerId],
      claimed: false,
    }),
  );
  const firstRead = a.getPass();
  is(
    "初回読込でv3と絵片の順序を永続化",
    JSON.parse(storage.get(a.PASS_KEY)),
    firstRead,
  );
  const b = await freshStore();
  is(
    "別タブの初回読込も同じ順序",
    b.getPass().puzzleOrder,
    firstRead.puzzleOrder,
  );
  a.updatePass((state) => applyCaptures(state, [{ rank: "2" }]));
  for (const notify of storageListeners) notify({ key: a.PASS_KEY });
  is("別タブに進捗と同じ絵片順序が伝わる", b.getPass(), a.getPass());
  const reloaded = await freshStore();
  is("再読込でも進捗と同じ絵片順序が残る", reloaded.getPass(), a.getPass());

  rejectWrite = true;
  const beforeFailure = a.getPass();
  a.updatePass((state) => ({
    ...state,
    cleared: legacy.cleared,
    flipped: legacy.flipped,
  }));
  const assembledInMemory = a.updatePass(markAssembled);
  is(
    "保存失敗しても次の更新で完成状態を失わない",
    [assembledInMemory.assembled, canClaim(assembledInMemory)],
    [true, true],
  );
  is(
    "保存失敗しても絵片の順序を失わない",
    assembledInMemory.puzzleOrder,
    beforeFailure.puzzleOrder,
  );
  const claimedInMemory = a.updatePass((state) => ({
    ...state,
    claimed: true,
  }));
  for (const notify of storageListeners) notify({ key: a.PASS_KEY });
  is(
    "保存失敗中の通知でも未保存の完成・受取済みを戻さない",
    a.updatePass((state) => state),
    claimedInMemory,
  );
  rejectWrite = false;
  const savedAgain = a.updatePass((state) => state);
  is(
    "保存が復旧したら最新の完成・受取済みを永続化",
    JSON.parse(storage.get(a.PASS_KEY)),
    savedAgain,
  );
  for (const notify of storageListeners) notify({ key: a.PASS_KEY });
  is("保存復旧後は他タブも完成・受取済みになる", b.getPass(), savedAgain);

  rejectRead = rejectWrite = true;
  const unavailable = await freshStore();
  const memoryStart = unavailable.getPass();
  const memoryProgress = unavailable.updatePass((state) =>
    applyCaptures(state, [{ rank: "2" }, { rank: "3" }, { rank: "4" }]),
  );
  is(
    "最初から保存を使えなくても順序は変わらない",
    memoryProgress.puzzleOrder,
    memoryStart.puzzleOrder,
  );
  is(
    "保存が読めなくても進捗は次の更新へ残る",
    unavailable.updatePass((state) => toggleFlip(state, "1-2")).progress,
    memoryProgress.progress,
  );
  rejectRead = rejectWrite = false;
  unavailable.updatePass((state) => state);
  const afterRecovery = await freshStore();
  is(
    "保存不可から復旧しても同じ順序で再読込できる",
    afterRecovery.getPass(),
    unavailable.getPass(),
  );

  storage.set(a.PASS_KEY, "{broken json");
  const corrupt = await freshStore();
  const repaired = corrupt.getPass();
  is(
    "壊れたJSONから生成した順序も初回に保存する",
    JSON.parse(storage.get(a.PASS_KEY)),
    repaired,
  );
} finally {
  if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
  else delete globalThis.window;
  if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
  else delete globalThis.localStorage;
}

console.log(`\n${ok} ok / ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
