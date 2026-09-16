import assert from "node:assert/strict";
import {
  initialState,
  reducer,
  autoArrange,
  autoPickKing,
} from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";
import { buildDeck, getLegalMoves, kingRankOf } from "../src/game/board.js";
import { canUseArea, isFrozen, isKnownTo } from "../src/game/areas.js";
import {
  ACE_FOIL_SKIN_ID,
  aceFoilCandidates,
  canUseAceFoil,
} from "../src/game/ace-foil.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { advanceNotes, noteSquare } from "../src/game/private-notes.js";
import { acceptAct, NET_ACTIONS, roomRuleVersion } from "../src/net/sync.js";
import { takePresentationBatch } from "../src/net/presentation.js";
import { verifyMatch } from "../src/server/verify-match.js";
import { acePosition } from "./fixtures/ace-position.mjs";
import { canWrite } from "./check-rules.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));
const position = (piece) => ({ row: piece.row, col: piece.col });
const fixture = (options) => ({
  ...acePosition({ count: 0, ...options }),
  ruleVersion: GAME_RULE_VERSION,
  areasEnabled: true,
  areaLoadouts: [{ A: ACE_FOIL_SKIN_ID }, { A: ACE_FOIL_SKIN_ID }],
});
const foil = (overrides = {}) => ({
  type: "USE_ACE_FOIL",
  aId: "ace",
  pickIds: ["left", "right", "king-1"],
  order: [1, 2, 0],
  ...overrides,
});
const normalA = {
  type: "CONFIRM_SHUFFLE",
  aId: "ace",
  pickIds: ["left", "right"],
  order: [1, 2, 0],
  elapsedMs: 0,
};
function add(state, piece) {
  const made = {
    suit: "heart",
    alive: true,
    revealed: false,
    history: [],
    isKing: false,
    ...piece,
  };
  state.pieces[made.id] = made;
  state.board[made.row][made.col] = made;
  return made;
}
function remove(state, id) {
  const piece = state.pieces[id];
  state.board[piece.row][piece.col] = null;
  delete state.pieces[id];
}
function move(state, id) {
  const piece = state.pieces[id];
  const moves = getLegalMoves(
    piece,
    state.board,
    9,
    state.players[piece.owner].armyRankCounts,
    kingRankOf(state, piece.owner),
  );
  const destination = moves.find((m) => !state.board[m.row][m.col]);
  assert.ok(destination, `${id}に通常の移動先がある`);
  return {
    type: "MOVE_PIECE",
    pieceId: id,
    row: destination.row,
    col: destination.col,
    elapsedMs: 0,
  };
}
function consistent(state) {
  const seen = new Set();
  state.board.forEach((row, r) =>
    row.forEach((piece, c) => {
      if (!piece) return;
      assert.equal(piece.alive, true);
      assert.equal(piece.row, r);
      assert.equal(piece.col, c);
      assert.equal(seen.has(piece.id), false);
      assert.deepEqual(piece, state.pieces[piece.id]);
      seen.add(piece.id);
    }),
  );
  assert.equal(
    seen.size,
    Object.values(state.pieces).filter((p) => p.alive).length,
  );
}

// A自身は王でなくても使え、王のエリアを必要としない。
{
  const state = fixture();
  assert.deepEqual(state.areas, [null, null]);
  assert.equal(state.pieces.ace.isKing, false);
  assert.equal(canUseAceFoil(state).ok, true);
  add(state, { id: "other-ace", rank: "A", owner: 0, row: 2, col: 0 });
  add(state, { id: "enemy-ace", rank: "A", owner: 1, row: 2, col: 8 });
  add(state, { id: "dead", rank: "2", owner: 1, row: 3, col: 0, alive: false });
  state.board[3][0] = null;
  state.pieces.reserve = {
    ...state.pieces.left,
    id: "reserve",
    row: -1,
    col: -1,
  };
  const candidates = aceFoilCandidates(state);
  for (const id of ["ace", "other-ace", "king-0", "dead", "reserve"])
    assert.equal(candidates.includes(id), false, `${id}は対象外`);
  for (const id of ["left", "right", "ally", "king-1", "enemy-ace"])
    assert.equal(candidates.includes(id), true, `${id}は抽選に入る`);
  assert.equal(canUseAceFoil(state, 0, "other-ace").ok, true);
  const after = reducer(state, foil());
  assert.equal(
    reducer(after, foil({ aId: "other-ace" })),
    after,
    "Aが複数でも1回だけ",
  );
}

// 両方向の循環を実行しても、同じ手番・通常行動・時計・公開情報を保つ。
for (const order of [
  [1, 2, 0],
  [2, 0, 1],
]) {
  const state = fixture();
  state.pieces.right.revealed = true;
  state.known = [{ "king-1": true }, { left: true }];
  state.pieces.left.frozenUntil = 6;
  state.pieces["king-1"].frozenUntil = 6;
  const before = clone(state);
  const action = foil({ order, elapsedMs: 12000 });
  const after = reducer(state, action);
  assert.deepEqual(state, before, "元の状態を変更しない");
  assert.deepEqual(after.known, state.known);
  for (const id of action.pickIds) {
    assert.notDeepEqual(position(after.pieces[id]), position(state.pieces[id]));
    assert.equal(after.pieces[id].revealed, state.pieces[id].revealed);
    assert.equal(after.pieces[id].isKing, state.pieces[id].isKing);
    for (const viewer of [0, 1])
      assert.equal(
        isKnownTo(after, viewer, after.pieces[id]),
        isKnownTo(state, viewer, state.pieces[id]),
      );
  }
  assert.equal(isFrozen(after, after.pieces.left), false);
  assert.equal(isFrozen(after, after.pieces["king-1"]), false);
  assert.deepEqual(
    after.pieces.ace,
    state.pieces.ace,
    "術者Aは動かず公開もしない",
  );
  assert.deepEqual(after.pieces["king-0"], state.pieces["king-0"]);
  for (const key of [
    "currentTurn",
    "turnNo",
    "extraMoveFor",
    "extraUsed",
    "clocks",
    "clockExtensionUses",
    "areas",
  ])
    assert.deepEqual(after[key], state[key], `${key}を消費しない`);
  assert.equal(after.lastSwap.kind, "ace-foil");
  assert.equal(after.lastSwap.seq, 1);
  assert.equal(after.lastSwap.owner, 0);
  assert.deepEqual(
    after.lastSwap.cells,
    action.pickIds.map((id) => position(state.pieces[id])),
  );
  assert.equal(
    after.replay.length,
    state.replay.length + 1,
    "記録に盤面が残る",
  );
  consistent(after);
  const note = { ranks: ["K"], king: true, counter: false, text: "予想" };
  const notes = Object.fromEntries(
    ["king-1", "outside"].map((id) => [noteSquare(state.pieces[id]), note]),
  );
  const advanced = advanceNotes(notes, state, after, 0);
  assert.equal(
    advanced[noteSquare(state.pieces["king-1"])],
    undefined,
    "入れ替えたマスの個人メモを消す",
  );
  assert.deepEqual(advanced[noteSquare(state.pieces.outside)], note);
  const savedRandom = Math.random;
  try {
    Math.random = () => {
      throw new Error("reducerで乱数を振ってはいけない");
    };
    assert.deepEqual(reducer(clone(state), { ...action, player: 0 }), after);
  } finally {
    Math.random = savedRandom;
  }
}

// 実際の通常移動を挟み、次の自分の手番でだけ再び使える。
{
  const state = fixture();
  const after = reducer(state, foil());
  const moved = reducer(after, move(after, "king-0"));
  assert.equal(moved.currentTurn, 1, "フォイル後も通常移動できる");
  assert.equal(reducer(moved, foil()), moved, "相手手番では使えない");
  const nextTurn = reducer(moved, move(moved, "king-1"));
  assert.equal(nextTurn.currentTurn, 0);
  assert.equal(nextTurn.turnNo, 2);
  assert.equal(canUseAceFoil(nextTurn).ok, true);
  const nextFoil = reducer(nextTurn, foil());
  assert.equal(
    nextFoil.lastSwap.seq,
    2,
    "通常移動でlastSwapが消えても演出番号は進む",
  );
  assert.deepEqual(nextFoil.aceFoilUsedTurn, [2, null]);
  consistent(nextFoil);
}
{
  const state = fixture();
  add(state, {
    id: "ten",
    rank: "10",
    owner: 0,
    row: 5,
    col: 2,
    skyTwice: true,
  });
  const moved = reducer(state, move(state, "ten"));
  assert.equal(moved.extraMoveFor, "ten");
  assert.equal(
    reducer(moved, foil()),
    moved,
    "通常の1回目の移動後はフォイルを挟めない",
  );
  const after = reducer(state, foil());
  const first = reducer(after, move(after, "ten"));
  const second = reducer(first, move(first, "ten"));
  assert.equal(first.extraMoveFor, "ten", "フォイルは10の追加行動を使わない");
  assert.equal(second.currentTurn, 1);
}

// 味方3体でも包囲取りを起こさず、通常A・王Aの既存能力はそのまま。
{
  const state = fixture({ count: 1 });
  state.board[state.pieces.ally.row][state.pieces.ally.col] = null;
  Object.assign(state.pieces.ally, { row: 1, col: 3 });
  state.board[1][3] = state.pieces.ally;
  const after = reducer(state, foil({ pickIds: ["ally", "left", "right"] }));
  assert.equal(after.pieces["target-0"].alive, true);
  assert.equal(after.captureReveal, null);
  assert.equal(after.lastDefeat, null);
  const normal = reducer(state, normalA);
  assert.equal(
    normal.pieces["target-0"].alive,
    false,
    "通常Aは引き続き包囲で取れる",
  );
}
{
  const state = fixture({ king: true });
  const after = reducer(state, foil());
  const first = reducer(after, normalA);
  assert.equal(first.extraMoveFor, "ace");
  assert.equal(first.currentTurn, 0);
  const second = reducer(first, normalA);
  assert.equal(
    second.currentTurn,
    1,
    "王Aはフォイル後にも通常の入れ替えを2回できる",
  );
  const normalFirst = reducer(state, normalA);
  assert.equal(
    reducer(normalFirst, foil()),
    normalFirst,
    "通常A発動後にもフォイルを挟めない",
  );
}

// 王のエリアとは利用回数を共有しない。両方の発動順序が可能。
{
  const state = fixture();
  state.areas[0] = {
    type: "palace",
    rank: "K",
    skin: "castle:foil",
    used: false,
    uses: 0,
  };
  const area = { type: "USE_AREA", pieceId: "ally" };
  const afterFoil = reducer(state, foil());
  assert.equal(canUseArea(afterFoil, 0).ok, true);
  assert.notEqual(reducer(afterFoil, area), afterFoil);
  const afterArea = reducer(state, area);
  assert.equal(afterArea.currentTurn, 0);
  assert.equal(canUseAceFoil(afterArea).ok, true);
  assert.notEqual(reducer(afterArea, foil()), afterArea);
}

// 状態・術者・対象・乱数の不正入力を拒否する。
for (const mutate of [
  (s) => {
    s.boardSize = 5;
  },
  (s) => {
    s.areasEnabled = false;
  },
  (s) => {
    s.areaLoadouts[0].A = "genie-magician";
  },
  (s) => {
    s.areaLoadouts[0].A = "other:foil";
  },
  (s) => {
    s.areaLoadouts = null;
  },
  (s) => {
    s.phase = "setup";
  },
  (s) => {
    s.phase = "gameover";
  },
  (s) => {
    s.winner = 0;
  },
  (s) => {
    s.currentTurn = 1;
  },
  (s) => {
    s.setupAck = [true, false];
  },
  (s) => {
    s.extraUsed = true;
  },
  (s) => {
    s.extraMoveFor = "left";
  },
  (s) => {
    s.pendingKingChoice = { owner: 0, candidateIds: ["left", "right"] };
  },
  (s) => {
    s.kPlacement = { owner: 0, cards: [{ id: "held" }] };
  },
  (s) => {
    s.pieces.ace.frozenUntil = 6;
  },
  (s) => {
    s.pieces.ace.alive = false;
  },
  (s) => {
    s.pieces.ace.rank = "10";
  },
  (s) => {
    s.board[s.pieces.ace.row][s.pieces.ace.col] = null;
  },
  (s) => {
    s.pieces.left.alive = false;
  },
  (s) => {
    s.board[s.pieces.left.row][s.pieces.left.col] = null;
  },
]) {
  const state = fixture();
  mutate(state);
  assert.equal(reducer(state, foil({ player: 0 })), state);
}
for (const patch of [
  { player: 1 },
  { player: 2 },
  { player: "0" },
  { player: null },
  { aId: undefined },
  { aId: "left" },
  { aId: "king-1" },
  { aId: "missing" },
  { pickIds: undefined },
  { pickIds: [] },
  { pickIds: ["left", "right"] },
  { pickIds: ["left", "right", "ally", "outside"] },
  { pickIds: ["left", "left", "right"] },
  { pickIds: ["ace", "left", "right"] },
  { pickIds: ["king-0", "left", "right"] },
  { pickIds: ["missing", "left", "right"] },
  { pickIds: [null, "left", "right"] },
  { order: undefined },
  { order: [0, 1, 2] },
  { order: [1, 0, 2] },
  { order: [1, 1, 0] },
  { order: [1, 2, 3] },
  { order: ["1", "2", "0"] },
  { order: { 0: 1, 1: 2, 2: 0 } },
]) {
  const state = fixture();
  assert.equal(
    reducer(state, foil({ player: 0, ...patch })),
    state,
    JSON.stringify(patch),
  );
}
{
  const state = fixture();
  for (const id of ["left", "right", "ally"]) remove(state, id);
  assert.equal(aceFoilCandidates(state).length, 2);
  assert.equal(canUseAceFoil(state).ok, false, "候補が2体以下なら発動不可");
  const original = { type: "USE_ACE_FOIL" };
  assert.equal(enrichAction(original, state), original);
}
for (const ruleVersion of [
  null,
  ...Array.from({ length: 16 }, (_, i) => i),
  999,
]) {
  const state = { ...fixture(), ruleVersion };
  assert.equal(canUseAceFoil(state).ok, false);
  assert.equal(
    reducer(state, foil()),
    state,
    `版${ruleVersion}では新能力を適用しない`,
  );
}
for (const ruleVersion of [null, 3, 7, 15, 16]) {
  const state = { ...fixture({ king: true }), ruleVersion };
  const first = reducer(state, { ...normalA, order: [0, 1, 2] });
  assert.equal(
    first.extraMoveFor,
    "ace",
    "旧Aは固定点のある並べ替えも従来通り受け取る",
  );
  assert.equal(reducer(first, normalA).currentTurn, 1);
}

// 4候補でFisher–Yatesの全分岐と循環方向を列挙し、抽選の均等性を厳密に確認。
{
  const state = fixture();
  remove(state, "outside");
  assert.equal(aceFoilCandidates(state).length, 4);
  const triples = new Map(),
    cycles = new Map();
  const savedRandom = Math.random;
  try {
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 3; b++)
        for (let c = 0; c < 2; c++)
          for (let d = 0; d < 2; d++) {
            const draws = [
              (a + 0.5) / 4,
              (b + 0.5) / 3,
              (c + 0.5) / 2,
              (d + 0.5) / 2,
            ];
            Math.random = () => {
              assert.ok(draws.length);
              return draws.shift();
            };
            const action = enrichAction({ type: "USE_ACE_FOIL" }, state);
            assert.equal(draws.length, 0);
            assert.equal(new Set(action.pickIds).size, 3);
            const triple = [...action.pickIds].sort().join(",");
            const cycle = action.order.join(",");
            triples.set(triple, (triples.get(triple) || 0) + 1);
            cycles.set(cycle, (cycles.get(cycle) || 0) + 1);
            consistent(reducer(state, action));
          }
  } finally {
    Math.random = savedRandom;
  }
  assert.equal(triples.size, 4);
  assert.deepEqual([...triples.values()], [12, 12, 12, 12]);
  assert.deepEqual([...cycles.values()], [24, 24]);
}

// 送信形式は既存Firebase規則に収まり、受信者の席決定と演出の区切りも働く。
{
  assert.ok(NET_ACTIONS.has("USE_ACE_FOIL"));
  assert.equal(
    roomRuleVersion({ hostRuleVersion: 16, guestRuleVersion: 16 }),
    16,
  );
  assert.equal(
    roomRuleVersion({ hostRuleVersion: 16, guestRuleVersion: 15 }),
    null,
  );
  const state = fixture();
  const action = { ...foil(), by: "host", __id: "-abcdefghijklmnopqrs" };
  const received = acceptAct({ ...action, player: 1 }, "guest", 1, "host");
  assert.equal(received.player, 0, "通信の名乗りは送り主で決める");
  assert.deepEqual(reducer(state, received), reducer(state, foil()));
  const db = {
    rooms: { TEST: { seats: { host: "host", guest: "guest" }, acts: {} } },
  };
  assert.equal(
    canWrite(
      db,
      ["rooms", "TEST", "acts", action.__id],
      { uid: "host" },
      action,
    ),
    true,
  );
  const sequence = [action, { ...normalA, __id: "next" }];
  const batch = takePresentationBatch(sequence);
  assert.deepEqual(batch.actions, [action]);
  assert.deepEqual(batch.remaining, [sequence[1]]);
  assert.deepEqual(
    takePresentationBatch(sequence, { split: false }).actions,
    sequence,
  );
}

// 正規のSTART_SETUPから新アクションを含む通信記録を作り、同じ手順で再生・結果検証。
{
  let state = initialState();
  const acts = {},
    record = [];
  const send = (action, player = state.currentTurn) => {
    const n = String(record.length).padStart(4, "0");
    const sent = {
      ...action,
      __id: `act-${n}`,
      by: player === 0 ? "host" : "guest",
      player,
    };
    state = reducer(state, sent);
    acts[n] = sent;
    record.push(sent);
    return state;
  };
  send(
    {
      type: "START_SETUP",
      size: 9,
      setupMode: "simultaneous",
      deck: buildDeck(),
      ruleVersion: GAME_RULE_VERSION,
      areas: true,
      loadouts: [{ A: ACE_FOIL_SKIN_ID }, { A: ACE_FOIL_SKIN_ID }],
    },
    0,
  );
  for (let guard = 0; state.phase !== "setup" && guard < 30; guard++) {
    if (state.phase === "dice") {
      const i = state.diceIdx;
      send(
        state.dice[i] === null
          ? { type: "ROLL_DICE_SINGLE", value: i === 0 ? 6 : 1 }
          : i === 2
            ? { type: "GOTO_MULLIGAN" }
            : { type: "NEXT_DICE_STEP" },
        i === 1 ? 1 : 0,
      );
    } else if (state.phase === "mulligan") {
      send(
        {
          type: "CONFIRM_MULLIGAN",
          discardIds: [],
          reserveOrder: state.reserve.map((c) => c.id),
        },
        state.mulliganIdx,
      );
    }
  }
  assert.equal(state.phase, "setup");
  for (const player of [0, 1]) {
    const preference = [...state.players[player].hand].sort(
      (a, b) =>
        Number(b.rank === "A" || b.rank === "K") -
        Number(a.rank === "A" || a.rank === "K"),
    );
    const placement = autoArrange(
      state,
      player,
      null,
      preference.map((c) => c.id),
      null,
    );
    send(
      {
        type: "SETUP_CONFIRM",
        placement,
        kingId: autoPickKing(state, player, placement),
      },
      player,
    );
  }
  assert.equal(state.phase, "play");
  if (state.setupAck)
    for (const player of [0, 1]) send({ type: "ACK_SETUP_EFFECTS" }, player);
  assert.equal(canUseAceFoil(state).ok, true);
  send(enrichAction({ type: "USE_ACE_FOIL" }, state));
  assert.equal(state.lastSwap.kind, "ace-foil");
  const kingId = state.players[state.currentTurn].kingId;
  send(move(state, kingId));
  send({ type: "RESIGN" });
  assert.deepEqual(record.reduce(reducer, initialState()), state);
  const result = verifyMatch(
    { seats: { host: "host", guest: "guest" }, createdAt: 1, round: 0, acts },
    { code: "TEST", createdAt: 1, round: 0, winner: state.winner },
    "host",
  );
  assert.equal(result.winner, state.winner);
}

console.log(
  "Aフォイル: 対象・均等抽選・循環・毎手番1回・通常行動・王A2回・エリア独立・公開情報/メモ・旧版・不正入力・通信/結果検証: OK",
);
