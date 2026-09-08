import assert from "node:assert/strict";
import fs from "node:fs";
import { reducer } from "../src/game/reducer.js";
import { acePosition } from "./fixtures/ace-position.mjs";
import {
  eventFromStates,
  validateEvent,
  duration,
} from "../src/skins/ace-magic.js";
import { byId, POOL } from "../src/skins/catalog.js";
import { normalize, claimSpecial, equip } from "../src/skins/collection.js";
const loadouts = [{ A: "genie-magician" }, {}];
const swap = (before, order = [1, 2, 0]) =>
  reducer(before, {
    type: "CONFIRM_SHUFFLE",
    aId: "ace",
    pickIds: ["left", "right"],
    order,
    elapsedMs: 0,
  });
for (const [size, count] of [
  [5, 0],
  [5, 1],
  [9, 6],
  [9, 10],
]) {
  const before = acePosition({ size, count });
  const after = swap(before);
  for (const viewer of [0, 1]) {
    const event = validateEvent(
      eventFromStates(before, after, { loadouts, viewer }),
    );
    assert.equal(event.defeated.length, count);
    assert.equal(duration(event), count ? 4000 : 2400);
    for (const p of [
      ...event.beforeCards,
      ...event.afterCards,
      ...event.defeated,
    ]) {
      assert.equal("id" in p, false);
      if (p.owner !== viewer)
        assert.deepEqual(Object.keys(p).sort(), [
          "col",
          "face",
          "owner",
          "row",
        ]);
    }
    assert.equal(
      eventFromStates(after, JSON.parse(JSON.stringify(after)), {
        loadouts,
        viewer,
      }),
      null,
    );
    assert.equal(
      eventFromStates(before, reducer(before, { type: "CANCEL_SELECTION" }), {
        loadouts,
        viewer,
      }),
      null,
    );
  }
  assert.ok(after.pieces.ally.alive && after.pieces.outside.alive);
  assert.equal(
    eventFromStates(before, after, { loadouts: [{}, {}], viewer: 0 }),
    null,
  );
  assert.equal(Object.values(before.pieces).filter((p) => !p.alive).length, 0);
}
const first = acePosition({ size: 9, count: 0, king: true });
const second = swap(first, [0, 1, 2]);
assert.equal(second.extraMoveFor, "ace");
const third = swap(second, [0, 1, 2]);
assert.ok(eventFromStates(first, second, { loadouts, viewer: 1 }));
assert.ok(eventFromStates(second, third, { loadouts, viewer: 1 }));
const mixed = acePosition({ count: 10, mixed: true });
assert.equal(
  eventFromStates(mixed, swap(mixed), { loadouts, viewer: 0 }).defeated.length,
  0,
);
const terminal = acePosition({ size: 9, count: 6 });
terminal.pieces["king-1"].isKing = false;
terminal.pieces["target-0"].isKing = true;
terminal.players[1].kingId = "target-0";
const won = swap(terminal);
assert.equal(won.phase, "gameover");
const winEvent = eventFromStates(terminal, won, { loadouts, viewer: 0 });
assert.equal(winEvent.defeated.length, 6);
assert.ok(
  winEvent.defeated.every((p) => p.face === "back" && !("isKing" in p)),
);
let collection = equip(
  claimSpecial(normalize(null), "genie-magician"),
  "genie-magician",
);
assert.equal(collection.equipped.A, "genie-magician");
assert.deepEqual(claimSpecial(collection, "genie-magician"), collection);
assert.deepEqual(normalize(JSON.parse(JSON.stringify(collection))), collection);
assert.equal(
  POOL.some((s) => s.id === "genie-magician"),
  false,
);
for (const file of Object.values(byId("genie-magician").videos))
  assert.ok(fs.statSync("assets/" + file).size > 100000);
console.log(
  "A実戦接続: 5×5入れ替え/撃破、9×9の6/10体、匿名性、王Aの2回、勝利手、受取と保存: OK",
);

// 最新版で追加された継承映像とA包囲が、同じ確定手で両方検出される。
const { filmsFor } = await import("../src/skins/events.js");
const successionBefore = acePosition({ size: 9, count: 6, succession: true });
const successionAfter = swap(successionBefore);
const successionLoadouts = [{ A: "genie-magician" }, { 2: "zombie-male" }];
assert.equal(
  eventFromStates(successionBefore, successionAfter, {
    loadouts: successionLoadouts,
    viewer: 0,
  }).defeated.length,
  6,
);
assert.equal(successionAfter.pendingKingChoice.owner, 1);
assert.deepEqual(
  filmsFor(successionBefore, successionAfter, successionLoadouts, 0).map(
    (s) => s.id,
  ),
  ["zombie-male"],
);
console.log("A包囲と王位継承の併発: OK");
