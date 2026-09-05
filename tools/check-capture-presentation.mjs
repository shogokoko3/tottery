/** 撃破札を確認するまで、王殺しの正体・履歴・継承を先に表示しない。 */
import assert from "node:assert/strict";
import { deserialize, serialize } from "node:v8";
import { emptyBoard, getLegalMoves, kingRankOf } from "../src/game/board.js";
import { captureDisplayState } from "../src/game/capture-presentation.js";
import { initialState, reducer } from "../src/game/reducer.js";

const snapshot = (value) => deserialize(serialize(value));

// [id, rank, owner, row, col, isKing, revealed]。移動も撃破も実reducerを通す。
function position(cards, size = 5) {
  const state = initialState();
  state.phase = "play";
  state.setupMode = "simultaneous";
  state.boardSize = size;
  state.board = emptyBoard(size);
  state.log = ["この手より前の記録"];
  for (const [
    id,
    rank,
    owner,
    row,
    col,
    isKing = false,
    revealed = false,
  ] of cards) {
    const piece = {
      id,
      rank,
      owner,
      row,
      col,
      isKing,
      revealed,
      suit: "spade",
      alive: true,
      history: ["この手より前の履歴"],
    };
    state.pieces[id] = piece;
    state.board[row][col] = piece;
    if (isKing) state.players[owner].kingId = id;
    state.players[owner].armyRankCounts[rank] =
      (state.players[owner].armyRankCounts[rank] || 0) + 1;
  }
  const old = {
    id: "old-capture",
    rank: "5",
    suit: "heart",
    owner: 1,
    row: 0,
    col: 0,
    alive: false,
    revealed: true,
    isKing: false,
    history: [],
  };
  state.pieces[old.id] = old;
  state.players[1].capturedOwn = [old];
  return state;
}

function capture(before, id, row, col) {
  const piece = before.pieces[id];
  const move = getLegalMoves(
    piece,
    before.board,
    before.boardSize,
    before.players[piece.owner].armyRankCounts,
    kingRankOf(before, piece.owner),
  ).find((m) => m.row === row && m.col === col);
  assert.ok(move?.capture, "検査に使う手は実際に合法な撃破手");
  const after = reducer(before, { type: "MOVE_PIECE", pieceId: id, ...move });
  assert.ok(after.captureReveal, "ルール側で撃破札が用意される");
  return after;
}

function display(before, after) {
  const originalBefore = snapshot(before);
  const originalAfter = snapshot(after);
  const shown = captureDisplayState(after, before);
  assert.deepEqual(before, originalBefore, "直前の状態を変更しない");
  assert.deepEqual(after, originalAfter, "確定したルール状態を変更しない");
  for (let row = 0; row < after.boardSize; row++) {
    for (let col = 0; col < after.boardSize; col++) {
      const piece = after.board[row][col];
      assert.equal(
        shown.board[row][col]?.id,
        piece?.id,
        "新しい盤面の移動先・空きマスを維持",
      );
      if (piece) assert.equal(shown.board[row][col], shown.pieces[piece.id]);
    }
  }
  for (const [id, piece] of Object.entries(after.pieces)) {
    assert.equal(
      shown.pieces[id].alive,
      piece.alive,
      "撃破済みの生死を巻き戻さない",
    );
    assert.deepEqual(
      shown.pieces[id].history,
      before.pieces[id].history,
      "新しい個別履歴を先出ししない",
    );
  }
  assert.deepEqual(shown.log, before.log, "対局記録は直前まで");
  assert.deepEqual(
    shown.players.map((p) => p.capturedOwn),
    before.players.map((p) => p.capturedOwn),
    "撃破一覧は直前まで",
  );
  assert.deepEqual(
    shown.players.map((p) => p.kingId),
    before.players.map((p) => p.kingId),
    "王位継承先を先出ししない",
  );
  assert.equal(
    shown.currentTurn,
    before.currentTurn,
    "確認中は撃破した側の表示を維持",
  );
  assert.equal(shown.lastReveal, null);
  assert.equal(shown.pendingKingChoice, null);
  assert.equal(shown.winner, null);
  assert.equal(shown.phase, "play");
  return shown;
}

function dismiss(before, after) {
  const next = reducer(after, { type: "DISMISS_CAPTURE" });
  const shown = captureDisplayState(next, before);
  assert.equal(shown, next, "撃破確認後は状態をそのまま返す");
  assert.equal(shown.captureReveal, null);
  assert.deepEqual(shown.log, after.log, "確認後は新しい対局記録を表示");
  assert.deepEqual(
    shown.pieces,
    after.pieces,
    "確認後は新公開・継承・個別履歴を表示",
  );
  assert.deepEqual(
    shown.players,
    after.players,
    "確認後は新しい撃破一覧と王を表示",
  );
  return shown;
}

const attacker = ["attacker", "6", 0, 4, 2];
const ownKing = ["own-king", "K", 0, 4, 0, true];

{
  const before = position([
    attacker,
    ownKing,
    ["foe-king", "K", 1, 2, 2, true],
  ]);
  assert.equal(captureDisplayState(before), before, "撃破のない表示は変えない");
  const after = capture(before, "attacker", 2, 2);
  assert.equal(
    after.pieces.attacker.revealed,
    true,
    "ルール上は王殺しを即公開",
  );
  assert.equal(after.lastReveal.reason, "王を討った");
  assert.equal(after.winner, 0);
  assert.ok(after.log.some((line) => line.includes("名乗りを上げた")));
  const shown = display(before, after);
  assert.equal(
    shown.pieces.attacker.revealed,
    false,
    "撃破札確認前は王殺しを伏せる",
  );
  assert.equal(shown.board[2][2].revealed, false, "移動先の盤面でも伏せる");
  assert.equal(shown.board[4][2], null);
  const done = dismiss(before, after);
  assert.equal(done.pieces.attacker.revealed, true);
  assert.equal(done.lastReveal.id, "attacker");
  assert.equal(done.winner, 0);
}

{
  const before = position([
    [...attacker, false, true],
    ownKing,
    ["foe-king", "K", 1, 2, 2, true],
  ]);
  const after = capture(before, "attacker", 2, 2);
  assert.equal(after.lastReveal, null, "既公開の駒は新たに名乗らない");
  assert.equal(
    display(before, after).board[2][2].revealed,
    true,
    "既公開の王殺しを伏せ直さない",
  );
  dismiss(before, after);
}

{
  const before = position([
    attacker,
    ownKing,
    ["foe", "8", 1, 2, 2],
    ["foe-king", "K", 1, 0, 4, true],
  ]);
  const after = capture(before, "attacker", 2, 2);
  assert.equal(after.pieces.attacker.revealed, false);
  assert.equal(after.players[1].capturedOwn.length, 2);
  assert.equal(
    display(before, after).players[1].capturedOwn.length,
    1,
    "通常撃破でも撃破一覧は確認後へ送る",
  );
  const done = dismiss(before, after);
  assert.equal(
    done.pieces.attacker.revealed,
    false,
    "通常撃破では確認後も正体を公開しない",
  );
  assert.equal(done.players[1].capturedOwn.length, 2);
}

{
  const before = position([
    attacker,
    ownKing,
    ["foe-king", "2", 1, 2, 2, true],
    ["heir", "2", 1, 0, 4, false, true],
  ]);
  const after = capture(before, "attacker", 2, 2);
  assert.equal(after.players[1].kingId, "heir");
  assert.equal(after.pieces.heir.isKing, true);
  const shown = display(before, after);
  assert.equal(
    shown.pieces.heir.isKing,
    false,
    "唯一の継承者の王マークはまだ出さない",
  );
  assert.equal(shown.pieces.heir.revealed, true, "継承者の既公開状態は維持");
  assert.equal(shown.players[1].kingId, "foe-king");
  const done = dismiss(before, after);
  assert.equal(done.pieces.heir.isKing, true);
  assert.ok(done.pieces.heir.history.includes("王位を継承"));
}

{
  const before = position([
    attacker,
    ownKing,
    ["foe-king", "3", 1, 2, 2, true],
    ["heir-a", "3", 1, 0, 3],
    ["heir-b", "3", 1, 0, 4],
  ]);
  const after = capture(before, "attacker", 2, 2);
  assert.equal(after.pendingKingChoice.owner, 1);
  assert.equal(
    display(before, after).pendingKingChoice,
    null,
    "継承者選択も撃破札の確認後",
  );
  assert.deepEqual(
    dismiss(before, after).pendingKingChoice,
    after.pendingKingChoice,
  );
}

{
  const before = position(
    [
      ["attacker", "8", 0, 8, 4, true],
      ["first", "4", 1, 7, 4],
      ["foe-king", "K", 1, 5, 4, true],
      ["last", "9", 1, 3, 4],
    ],
    9,
  );
  const after = capture(before, "attacker", 3, 4);
  assert.deepEqual(
    after.captureReveal.defeated.map((p) => p.rank),
    ["4", "9", "K"],
    "進路の途中にいた王も撃破札では最後",
  );
  const shown = display(before, after);
  assert.equal(
    shown.pieces.attacker.revealed,
    false,
    "複数撃破の王公開も最後の確認まで伏せる",
  );
  assert.equal(shown.board[3][4].id, "attacker");
  assert.equal(shown.board[5][4], null);
  assert.equal(shown.board[7][4], null);
  assert.equal(
    shown.captureReveal,
    after.captureReveal,
    "撃破札の順序と確認情報はそのまま渡す",
  );
  const done = dismiss(before, after);
  assert.equal(done.pieces.attacker.revealed, true);
  assert.equal(done.players[1].capturedOwn.length, 4);
}

{
  const before = position([
    attacker,
    ownKing,
    ["foe-king", "K", 1, 2, 2, true],
    ["already-public", "J", 1, 0, 4, false, true],
  ]);
  const after = capture(before, "attacker", 2, 2);
  const original = snapshot(after);
  for (const prior of [undefined, after]) {
    const shown = captureDisplayState(after, prior);
    assert.equal(
      shown.pieces.attacker.revealed,
      false,
      "初回復元でも王殺しの新公開を隠す",
    );
    assert.equal(shown.board[2][2].revealed, false);
    assert.equal(
      shown.pieces["already-public"].revealed,
      true,
      "初回復元でも無関係な既公開を維持",
    );
    assert.equal(shown.lastReveal, null);
  }
  assert.deepEqual(after, original, "復元表示でもルール状態を変更しない");
  dismiss(undefined, after);
}

console.log(
  "撃破の表示順: 王殺しの新公開・移動先・既公開・撃破一覧・履歴・継承・通常/複数撃破・初回復元・入力非破壊: OK",
);
