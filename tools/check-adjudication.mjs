import assert from "node:assert/strict";
import {
  ADJUDICATION_RULE_VERSION,
  adjudicatePosition,
  futureReach,
  hasLegalAction,
  isDeadPosition,
  rankValue,
  withInitialArmies,
} from "../src/game/adjudication.js";
import { emptyBoard, getLegalMoves, kingRankOf } from "../src/game/board.js";
import { initialState, reducer } from "../src/game/reducer.js";
import { roomRuleVersion } from "../src/net/sync.js";
import { bestShuffle, cpuAction } from "../src/game/cpu.js";

// [id, rank, owner, row, col, isKing]。初期採用を固定してから実reducerを動かす。
function position(cards, size = 5, currentTurn = 0) {
  const state = {
    ...initialState(),
    phase: "play",
    ruleVersion: ADJUDICATION_RULE_VERSION,
    boardSize: size,
    board: emptyBoard(size),
    currentTurn,
  };
  for (const [id, rank, owner, row, col, isKing = false] of cards) {
    const piece = {
      id,
      rank,
      owner,
      row,
      col,
      isKing,
      suit: "spade",
      alive: true,
      revealed: false,
      everRevived: false,
      history: [],
    };
    state.pieces[id] = piece;
    state.board[row][col] = piece;
    if (isKing) state.players[owner].kingId = id;
    const counts = state.players[owner].armyRankCounts;
    counts[rank] = (counts[rank] || 0) + 1;
  }
  return withInitialArmies(state);
}

function move(state, id, row, col, elapsedMs = 0) {
  const piece = state.pieces[id];
  assert.equal(piece.owner, state.currentTurn);
  const legal = getLegalMoves(
    piece,
    state.board,
    state.boardSize,
    state.players[piece.owner].armyRankCounts,
    kingRankOf(state, piece.owner),
  ).find((candidate) => candidate.row === row && candidate.col === col);
  assert.ok(legal, `${id}から${row},${col}は実際の合法手`);
  return reducer(state, {
    type: "MOVE_PIECE",
    pieceId: id,
    ...legal,
    elapsedMs,
  });
}

assert.deepEqual(
  ["A", "2", "10", "J", "Q", "K"].map(rankValue),
  [1, 2, 10, 11, 12, 13],
);

// 実際の布陣完了で9/5枚の採用合計を固定する。未採用の手札は含めない。
for (const size of [5, 9]) {
  let state = reducer(initialState(), {
    type: "START_SETUP",
    size,
    setupMode: "simultaneous",
    ruleVersion: ADJUDICATION_RULE_VERSION,
  });
  const ranks =
    size === 5
      ? ["A", "J", "Q", "K", "2"]
      : ["A", "2", "3", "4", "5", "6", "J", "Q", "K"];
  const sums = ranks.reduce((sum, rank) => sum + rankValue(rank), 0);
  state = {
    ...state,
    phase: "setup",
    players: state.players.map((player, owner) => ({
      ...player,
      hand: [...ranks, "9"].map((rank, i) => ({
        id: `p${owner}-${i}`,
        rank,
        suit: owner ? "heart" : "spade",
      })),
    })),
  };
  for (const owner of [0, 1]) {
    const placement = Object.fromEntries(
      ranks.map((_, col) => [
        `p${owner}-${col}`,
        { row: owner ? 0 : size - 1, col },
      ]),
    );
    state = reducer(state, {
      type: "SETUP_CONFIRM",
      player: owner,
      placement,
      kingId: `p${owner}-${ranks.indexOf("K")}`,
    });
  }
  assert.deepEqual(state.initialArmyTotals, [sums, sums]);
  const sorted = [...ranks].sort((a, b) => rankValue(a) - rankValue(b));
  assert.deepEqual(state.initialArmyRanks, [sorted, sorted]);
  assert.equal(state.adjudication, null, "活動できる王Kは判定で終えない");
}

// 7は単なる白黒や行列の偶奇だけではなく、偶数歩の斜め連結成分を見る。
for (const size of [5, 9]) {
  const state = position(
    [
      ["a", "7", 0, 4, 0, true],
      ["b", "7", 1, 0, 2, true],
    ],
    size,
  );
  assert.equal(isDeadPosition(state), true);
  const done = adjudicatePosition(state);
  assert.equal(done.phase, "gameover");
  assert.equal(done.endReason, "dead-position");
  assert.equal(done.winner, null, "採用合計が同点なら引き分け");
  assert.deepEqual(done.adjudication.totals, [7, 7]);
  assert.equal(reducer(done, { type: "SKIP_EXTRA_ACTION" }), done);
  assert.equal(reducer(done, { type: "RESIGN", player: 0 }), done);
  assert.equal(
    reducer(done, { type: "MOVE_PIECE", pieceId: "a", row: 2, col: 2 }),
    done,
    "winner:nullでも終局後に動かせない",
  );
  assert.equal(reducer(done, { type: "NEW_GAME" }).adjudication, null);
}

// 王Qの縦横1マスを忘れると、普通のQ同士と誤判定する。
const queens = position([
  ["a", "Q", 0, 4, 0, true],
  ["b", "Q", 1, 0, 1, true],
]);
assert.equal(futureReach({ ...queens.pieces.a, isKing: false }, 5).size, 13);
assert.equal(futureReach(queens.pieces.a, 5).size, 25);
assert.equal(isDeadPosition(queens), false);
assert.equal(adjudicatePosition(queens), queens);

const splitKings = position([
  ["a", "3", 0, 4, 0, true],
  ["b", "3", 1, 0, 1, true],
]);
assert.equal(isDeadPosition(splitKings), true);
assert.deepEqual(
  futureReach(splitKings.pieces.a, 5),
  futureReach({ ...splitKings.pieces.a, isKing: false }, 5),
  "3の継承/距離延長も同じ色領域を出ない",
);
const threat = position([
  ["a", "3", 0, 4, 0, true],
  ["b", "3", 1, 0, 1, true],
  ["foe", "2", 1, 1, 4],
]);
assert.equal(
  isDeadPosition(threat),
  false,
  "王同士が届かなくても一般駒が討てるなら継続",
);

const ace = position([
  ["a", "7", 0, 4, 0, true],
  ["b", "7", 1, 0, 2, true],
  ["ace", "A", 0, 4, 1],
]);
assert.equal(
  isDeadPosition(ace),
  false,
  "Aは敵を混ぜて位置/到達域を変えられる",
);
assert.equal(hasLegalAction(ace), true);
assert.equal(adjudicatePosition(ace), ace);
assert.equal(
  isDeadPosition(
    position([
      ["a", "A", 0, 4, 0, true],
      ["b", "A", 1, 0, 1, true],
    ]),
  ),
  true,
  "合計2枚のAは入れ替えを作れない",
);

// 一般駒同士をまだ取れても、どちらの王にも永久に届かない場合。
const ordinary = position([
  ["a", "7", 0, 4, 0, true],
  ["b", "7", 1, 0, 2, true],
  ["qa", "Q", 0, 3, 0],
  ["qb", "Q", 1, 1, 2],
]);
assert.equal(isDeadPosition(ordinary), true);
const captured = move(ordinary, "qa", 1, 2);
assert.ok(captured.captureReveal, "論理判定しても撃破札の演出を保持");
assert.equal(captured.endReason, "dead-position");
assert.deepEqual(
  captured.adjudication.totals,
  [19, 19],
  "取られたQを初期採用合計から引かない",
);
assert.deepEqual(captured.adjudication.ranks, [
  ["7", "Q"],
  ["7", "Q"],
]);
assert.equal(captured.winner, null);
assert.ok(
  captured.replay.some((entry) => entry.line.includes("布陣判定")),
  "判定も盤面付きの記録に残る",
);
const viewed = reducer(captured, { type: "DISMISS_CAPTURE" });
assert.deepEqual(
  viewed.adjudication,
  captured.adjudication,
  "ローカル確認で判定は変わらない",
);

// 通常パスがないため、手番側だけ行動不能でも初期採用合計で決める。
//
// 動けない駒として A を使う。以前は 7 の王を置いていたが、
// 6〜9の王が「取れるときしか動けない」のは不具合だという判断で
// 空きマスへも動けるようにしたため、7 では行動不能にならなくなった。
// A は自分では動けない(入れ替えの起点になるだけ)ので、1枚だけ残れば手が無い
for (const blockedOwner of [0, 1]) {
  const state = position(
    [
      ["blocked", "A", blockedOwner, 4, 0, true],
      ["mobile", "K", 1 - blockedOwner, 0, 3, true],
    ],
    5,
    blockedOwner,
  );
  assert.equal(isDeadPosition(state), false);
  assert.equal(hasLegalAction(state), false);
  const done = adjudicatePosition(state);
  assert.equal(done.endReason, "no-legal-action");
  assert.equal(
    done.winner,
    blockedOwner,
    "詰まった側/残存駒の強さではなく採用合計が低い側の勝ち",
  );
  assert.equal(
    adjudicatePosition({ ...state, currentTurn: 1 - blockedOwner }).phase,
    "play",
  );
  assert.equal(
    reducer(state, { type: "SKIP_EXTRA_ACTION" }),
    state,
    "新ルールでは通常手番をパスできない",
  );
}

// 追加行動が残る王10は判定せず、実際のスキップ完了後に次の手番を評価。
// 動けない側は A にする(6〜9の王も空きマスへ動けるようになったため)
let twice = position([
  ["ten", "10", 0, 4, 0, true],
  ["ace", "A", 1, 0, 2, true],
]);
twice = move(twice, "ten", 2, 1);
assert.equal(twice.extraMoveFor, "ten");
assert.equal(twice.adjudication, null);
twice = reducer(twice, { type: "SKIP_EXTRA_ACTION", elapsedMs: 0 });
assert.equal(twice.endReason, "no-legal-action");
assert.equal(twice.winner, 1);

// 複数候補の王位継承は、同期されるCHOOSE_HEIRまで待つ。
let succession = position([
  ["a", "3", 0, 4, 0, true],
  ["b", "3", 1, 2, 2, true],
  ["heir1", "3", 1, 0, 1],
  ["heir2", "3", 1, 0, 3],
]);
succession = move(succession, "a", 2, 2);
assert.ok(succession.pendingKingChoice);
assert.equal(succession.adjudication, null);
const withLocalDismiss = reducer(
  reducer(succession, { type: "DISMISS_CAPTURE" }),
  { type: "ACK_KING_CHOICE" },
);
const replayed = reducer(succession, { type: "CHOOSE_HEIR", id: "heir1" });
const interactive = reducer(withLocalDismiss, {
  type: "CHOOSE_HEIR",
  id: "heir1",
});
assert.equal(replayed.endReason, "dead-position");
assert.deepEqual(
  interactive.adjudication,
  replayed.adjudication,
  "ローカルdismiss/ACKがなくても通信再生の結果は一致",
);
assert.equal(replayed.winner, 0);

// Kからの予備札は初期採用に加えない。pending中は判定できない。
let summoned = position(
  [
    ["ka", "K", 0, 4, 4, true],
    ["ja", "J", 0, 3, 1],
    ["kb", "K", 1, 0, 0, true],
    ["jb", "J", 1, 0, 1],
  ],
  5,
  1,
);
summoned = { ...summoned, reserve: [{ id: "new", rank: "3", suit: "heart" }] };
assert.equal(isDeadPosition(summoned), false);
summoned = move(summoned, "jb", 3, 1);
assert.ok(summoned.kPlacement);
assert.equal(summoned.adjudication, null);
summoned = reducer(summoned, { type: "PLACE_RESERVE_CARD", row: 4, col: 3 });
assert.equal(summoned.pieces.new.alive, true);
assert.deepEqual(summoned.initialArmyTotals, [24, 24]);
assert.deepEqual(summoned.initialArmyRanks, [
  ["J", "K"],
  ["J", "K"],
]);
for (const pending of [
  { extraMoveFor: "a", extraUsed: true },
  { pendingKingChoice: { owner: 0, candidateIds: ["a"] } },
  { kPlacement: { owner: 0, card: { id: "new", rank: "K" } } },
]) {
  const state = { ...splitKings, ...pending };
  assert.equal(
    adjudicatePosition(state),
    state,
    "未解決の能力の途中は判定しない",
  );
}

// 時間切れは、手の終わりの布陣判定より優先する。
let timed = position([
  ["k", "K", 0, 4, 0, true],
  ["seven", "7", 1, 0, 3, true],
]);
timed = { ...timed, clocks: [1, 300000] };
timed = move(timed, "k", 4, 1, 2);
assert.equal(timed.phase, "gameover");
assert.equal(timed.timeoutBy, 0);
assert.equal(timed.adjudication, null);

// 旧版/不明版の履歴は再生時に新しい終局判定を追加しない。
for (const ruleVersion of [undefined, null, 999]) {
  const old = { ...splitKings, ruleVersion };
  assert.equal(adjudicatePosition(old), old);
  const moved = move(old, "a", 3, 1);
  assert.equal(moved.phase, "play");
  assert.equal(moved.adjudication, null);
}
assert.equal(
  reducer({ ...splitKings, ruleVersion: null }, { type: "SKIP_EXTRA_ACTION" })
    .currentTurn,
  1,
);
const missingInitial = { ...splitKings, initialArmyTotals: null };
assert.equal(
  adjudicatePosition(missingInitial),
  missingInitial,
  "初期採用不明の保存を残存駒の合計で代用しない",
);

// 同局面や無捕獲がいくら続いても、それだけでは判定しない。
let loop = position([
  ["a", "K", 0, 4, 0, true],
  ["b", "K", 1, 0, 4, true],
]);
for (let cycle = 0; cycle < 40; cycle++) {
  loop = move(loop, "a", 4, 1);
  loop = move(loop, "b", 0, 3);
  loop = move(loop, "a", 4, 0);
  loop = move(loop, "b", 0, 4);
}
assert.equal(loop.phase, "play");
assert.equal(loop.adjudication, null);
assert.equal(
  reducer(splitKings, { type: "SELECT_PIECE", id: "a" }).adjudication,
  null,
  "選択だけを判定の起点にしない",
);
assert.equal(
  reducer(splitKings, { type: "DISMISS_CAPTURE" }).adjudication,
  null,
);
assert.equal(
  reducer(splitKings, { type: "DISMISS_INTERSTITIAL" }).adjudication,
  null,
);

// 対戦相手が旧画面なら、ホスト/ゲストどちらから見ても旧ルールへ揃える。
for (const [hostRuleVersion, guestRuleVersion, expected] of [
  [1, 1, 1],
  [1, undefined, null],
  [undefined, 1, null],
  [1, 999, null],
  [999, 1, null],
  [undefined, undefined, null],
]) {
  const ruleVersion = roomRuleVersion({ hostRuleVersion, guestRuleVersion });
  assert.equal(ruleVersion, expected);
  const started = reducer(initialState(), {
    type: "START_SETUP",
    size: 5,
    ruleVersion,
  });
  assert.equal(started.ruleVersion, expected);
  const done = adjudicatePosition({
    ...splitKings,
    ruleVersion: started.ruleVersion,
  });
  assert.equal(done.phase, expected === 1 ? "gameover" : "play");
}
assert.equal(roomRuleVersion(null), null);

// A単独/味方1枚でも、敵を含む2枚を選べればCPUは通常パスで停止しない。
for (const size of [5, 9]) {
  for (const allyCount of [0, 1]) {
    let state = position(
      [
        ["ace", "A", 0, size - 1, 1, allyCount === 0],
        // 味方も動けない駒(A)にする。6〜9の王が空きマスへ動けるように
        // なったので、7 では「通常の手が無い」状況を作れない
        ...(allyCount ? [["ally", "A", 0, size - 1, 0, true]] : []),
        ["foe", "K", 1, 0, 3, true],
        ...(allyCount ? [] : [["foe2", "3", 1, 0, 4]]),
      ],
      size,
    );
    const first = cpuAction(state, 0);
    assert.equal(first.type, "__CPU_SHUFFLE");
    assert.equal(new Set(first.pickIds).size, 2);
    assert.ok(
      first.pickIds.every((id) => id !== "ace" && state.pieces[id].alive),
    );
    assert.ok(first.pickIds.some((id) => state.pieces[id].owner === 1));
    for (
      let actionNumber = 0;
      actionNumber < (allyCount ? 1 : 2);
      actionNumber++
    ) {
      const action = cpuAction(state, 0);
      assert.equal(
        action.type,
        "__CPU_SHUFFLE",
        "王Aの2回目も敵を選んで実行できる",
      );
      state = reducer(state, { type: "SELECT_PIECE", id: action.aceId });
      for (const id of action.pickIds)
        state = reducer(state, { type: "TOGGLE_SHUFFLE_PICK", id });
      const before = state;
      state = reducer(state, {
        type: "CONFIRM_SHUFFLE",
        order: [1, 2, 0],
        elapsedMs: 0,
      });
      assert.notEqual(state, before, "実際のCPU用action展開で盤が進む");
    }
    assert.equal(state.currentTurn, 1);
    assert.equal(state.extraMoveFor, null);
  }
}

// 伏せた相手の数字/マーク/王を読むと失敗する駒でも、CPUは同じ合法判断をできる。
for (const allyCount of [0, 1, 2]) {
  const state = position([
    ["ace", "A", 0, 4, 1, allyCount === 0],
    ...(allyCount ? [["ally", "7", 0, 4, 0, true]] : []),
    ...(allyCount > 1 ? [["ally2", "2", 0, 4, 2]] : []),
    ["foe", "K", 1, 0, 3, true],
    ["foe2", "3", 1, 0, 4],
  ]);
  for (const piece of Object.values(state.pieces).filter(
    (piece) => piece.owner === 1,
  )) {
    for (const field of ["rank", "suit", "isKing"]) {
      Object.defineProperty(piece, field, {
        get() {
          throw new Error(`CPUが未公開の${field}を読んだ`);
        },
      });
    }
  }
  const swap = bestShuffle(state, 0);
  assert.ok(swap);
  if (allyCount === 2)
    assert.ok(
      swap.pickIds.every((id) => state.pieces[id].owner === 0),
      "味方2枚がある時は従来の包囲候補を維持",
    );
  assert.ok(cpuAction(state, 0));
}

// 動けない駒は A だけ(6〜9の王も空きマスへ動けるようになった)
const noCpuMove = position([
  ["a", "A", 0, 4, 0, true],
  ["b", "K", 1, 0, 3, true],
]);
assert.equal(
  cpuAction(noCpuMove, 0),
  null,
  "新ルールで合法行動がなければ無効な通常パスを発行しない",
);
assert.equal(
  cpuAction({ ...noCpuMove, ruleVersion: null }, 0).type,
  "SKIP_EXTRA_ACTION",
  "旧対局のCPUパスは維持",
);
const loneAce = position([
  ["a", "A", 0, 4, 0, true],
  ["b", "K", 1, 0, 3, true],
]);
assert.equal(
  bestShuffle(loneAce, 0),
  null,
  "計2枚では存在しない3枚目を選ばない",
);
assert.equal(
  cpuAction({ ...loneAce, extraMoveFor: "a", extraUsed: true }, 0).type,
  "SKIP_EXTRA_ACTION",
  "追加行動のスキップは引き続き合法",
);

console.log(
  "布陣判定: 初期採用固定・到達領域/王Q/A/K・行動不能・同点・捕獲/継承/追加手/召喚・通信再生・旧版・反復継続: OK",
);
