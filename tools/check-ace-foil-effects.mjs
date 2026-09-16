import assert from "node:assert/strict";
import { reducer } from "../src/game/reducer.js";
import { aceFoilPosition } from "./fixtures/ace-foil-position.mjs";
import { acePosition } from "./fixtures/ace-position.mjs";
import { ACE_FOIL_SKIN_ID } from "../src/game/ace-foil.js";
import {
  createRenderer,
  duration,
  eventFromStates,
  phaseAt,
  validateEvent,
} from "../src/skins/ace-magic.js";

const loadouts = [{ A: ACE_FOIL_SKIN_ID }, {}];
const act = {
  type: "USE_ACE_FOIL",
  aId: "ace",
  pickIds: ["king-1", "foe-ace", "outside"],
  order: [1, 2, 0],
};
for (const frozen of [false, true]) {
  const before = aceFoilPosition({ frozen });
  const after = reducer(before, act);
  for (const viewer of [0, 1, null]) {
    const event = validateEvent(
      eventFromStates(before, after, { loadouts, viewer }),
    );
    assert.equal(event.kind, "ace-foil");
    assert.equal(event.defeated.length, 0);
    assert.equal(duration(event), 2880);
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
    for (const card of [...event.beforeCards, ...event.afterCards]) {
      assert.equal("id" in card, false);
      assert.equal("history" in card, false);
      if (viewer !== 1)
        assert.deepEqual(Object.keys(card).sort(), [
          "col",
          "face",
          "owner",
          "row",
        ]);
    }
    assert.equal(
      eventFromStates(before, after, {
        loadouts: [{ A: "genie-magician" }, {}],
        viewer,
      }),
      null,
    );
  }
}

// 正体を知っている札だけ表向きを保つ。伏せた敵王・敵Aは王印もランクも渡さない。
{
  const before = aceFoilPosition();
  before.known = [{ "foe-ace": true }, {}];
  before.pieces.outside.revealed = true;
  const event = eventFromStates(before, reducer(before, act), {
    loadouts,
    viewer: 0,
  });
  for (const cards of [event.beforeCards, event.afterCards]) {
    assert.equal(cards.filter((p) => p.face === "back").length, 1);
    assert.deepEqual(
      cards
        .filter((p) => p.face === "front")
        .map((p) => p.rank)
        .sort(),
      ["7", "A"],
    );
    assert.equal(
      cards.some((p) => p.isKing),
      false,
      "敵王は伏せたまま",
    );
  }
}

// 同じフォイル装備で、元のAの包囲・王Aの2回目・凍結解除も演出できる。
for (const king of [false, true]) {
  const before = acePosition({ size: 9, count: 1, king });
  before.pieces.left.frozenUntil = 6;
  const normal = {
    type: "CONFIRM_SHUFFLE",
    aId: "ace",
    pickIds: ["left", "right"],
    order: [1, 2, 0],
  };
  const after = reducer(before, normal);
  const event = validateEvent(
    eventFromStates(before, after, { loadouts, viewer: 0 }),
  );
  assert.equal(event.kind, undefined);
  assert.equal(event.defeated.length, 1);
  assert.equal(duration(event), 4000);
  if (king)
    assert.ok(
      eventFromStates(after, reducer(after, normal), { loadouts, viewer: 0 }),
    );
}

// 実際のrendererで指パッチン→帽子→中身を隠す→再登場の順番を確認。
{
  const before = aceFoilPosition();
  const event = validateEvent(
    eventFromStates(before, reducer(before, act), { loadouts, viewer: 0 }),
  );
  assert.match(phaseAt(event, 200), /指パッチン/);
  assert.match(phaseAt(event, 650), /3つのシルクハット/);
  assert.match(phaseAt(event, 1700), /中身を隠す/);
  assert.match(phaseAt(event, 2400), /再登場/);
  const ctx = new Proxy(
    { canvas: { width: 600, height: 600 } },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key === "createLinearGradient" || key === "createRadialGradient")
          return () => ({ addColorStop() {} });
        return () => {};
      },
    },
  );
  const render = createRenderer(ctx);
  const paint = (time, flip) => {
    const shown = [];
    render(event, time, {
      flip,
      drawCard: (card, x, y, opacity) => {
        if (opacity > 0.01) shown.push(card);
      },
    });
    for (const card of shown)
      assert.deepEqual(Object.keys(card).sort(), [
        "col",
        "face",
        "owner",
        "row",
      ]);
    return shown;
  };
  for (const flip of [false, true]) {
    assert.equal(paint(200, flip).length, 3);
    assert.equal(paint(1700, flip).length, 0, "シャッフル中は3体とも描かない");
    assert.equal(paint(2500, flip).length, 3);
  }
}
console.log(
  "Aフォイル演出: 実状態から検出・凍結解除・既存A互換・敵王/数字/IDの非公開・指パッチン/帽子/隠す/再登場: OK",
);
