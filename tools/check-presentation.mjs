import assert from "node:assert/strict";
import { takePresentationBatch } from "../src/net/presentation.js";
import { reducer } from "../src/game/reducer.js";
import { eventFromStates } from "../src/skins/ace-magic.js";
import { acePosition } from "./fixtures/ace-position.mjs";

const action = (type, id) => Object.freeze({ type, __id: id });
const mixed = Object.freeze([
  action("SETUP_CONFIRM", "setup"),
  action("CONFIRM_SHUFFLE", "shuffle"),
  action("MOVE_PIECE", "move"),
]);
const prefix = takePresentationBatch(mixed);
assert.deepEqual(prefix.actions, mixed.slice(0, 2));
assert.deepEqual(prefix.consumedIds, ["setup", "shuffle"]);
assert.deepEqual(prefix.remaining, mixed.slice(2));
assert.deepEqual(takePresentationBatch(prefix.remaining).consumedIds, ["move"]);
assert.deepEqual(takePresentationBatch([], { split: true }), {
  actions: [],
  consumedIds: [],
  remaining: [],
});
assert.deepEqual(takePresentationBatch(mixed, { split: false }), {
  actions: [...mixed],
  consumedIds: ["setup", "shuffle", "move"],
  remaining: [],
});
assert.deepEqual(
  takePresentationBatch([
    action("ROLL_DICE_SINGLE", "dice"),
    action("SETUP_CONFIRM", "placement"),
  ]).consumedIds,
  ["dice", "placement"],
);

// 通信の1回の取得に、王Aの1回目・2回目が両方含まれた実際の reducer 遷移。
// 全件を受信済みにせず、演出が終わってから次の取得結果を取り込む。
const received = Object.freeze(
  ["king-a-first", "king-a-second"].map((id) =>
    Object.freeze({
      type: "CONFIRM_SHUFFLE",
      __id: id,
      aId: "ace",
      pickIds: Object.freeze(["left", "right"]),
      order: Object.freeze([0, 1, 2]),
      elapsedMs: 0,
    }),
  ),
);
const initial = acePosition({ size: 9, count: 0, king: true });
const options = { loadouts: [{ A: "genie-magician" }, {}], viewer: 1 };
const collapsed = received.reduce(reducer, initial);
assert.equal(eventFromStates(initial, collapsed, options), null);

const seen = new Set();
let state = initial;
for (let turn = 0; turn < 2; turn++) {
  const unseen = received.filter((entry) => !seen.has(entry.__id));
  const batch = takePresentationBatch(unseen);
  assert.equal(batch.actions.length, 1);
  assert.equal(seen.size, turn, "分割だけでは受信済みを変更しない");
  const after = batch.actions.reduce(reducer, state);
  const event = eventFromStates(state, after, options);
  assert.ok(event, `王Aの${turn + 1}回目を独立して描画できる`);
  assert.equal(event.defeated.length, 0);
  assert.equal(after.pieces.ace.history.length, turn + 1);
  if (turn === 0) {
    assert.equal(after.extraMoveFor, "ace");
    assert.equal(batch.remaining[0].__id, "king-a-second");
  }
  batch.consumedIds.forEach((id) => seen.add(id));
  assert.equal(seen.has("king-a-second"), turn === 1);
  state = after;
}
assert.deepEqual(
  state,
  collapsed,
  "演出を区切っても最終盤面・時計は変わらない",
);
assert.deepEqual(
  takePresentationBatch(received.filter((entry) => !seen.has(entry.__id)))
    .actions,
  [],
);
assert.equal(initial.pieces.ace.history.length, 0);
console.log(
  "通信演出: 移動・入れ替えの分割、初回復元、王Aの2回、消費IDのみ確定、最終盤面一致: OK",
);
