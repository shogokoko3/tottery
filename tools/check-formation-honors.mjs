import assert from "node:assert/strict";
import fs from "node:fs";
import { FORMATION_EMBLEMS } from "../src/game/formation-honors.js";
import { hasIcon, iconOf } from "../src/game/icons.js";
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { loadProfile, grantTitle, saveIcon } =
  await import("../src/game/profile.js");
assert.equal(FORMATION_EMBLEMS.length, 7);
assert.equal(new Set(FORMATION_EMBLEMS.map((i) => i.id)).size, 7);
for (const icon of FORMATION_EMBLEMS) {
  assert.equal(hasIcon({ icons: [], titles: [] }, icon.id), false);
  assert.equal(
    hasIcon({ icons: [], titles: [icon.titleId] }, icon.id),
    true,
    "Existing title owners receive the emblem",
  );
  assert.equal(
    hasIcon({ icons: [icon.id], titles: [] }, icon.id),
    true,
    "Explicit grants still work",
  );
  assert.ok(
    fs.existsSync(
      `assets/honors/icons/${icon.id.replace("formation-", "")}.png`,
    ),
  );
  assert.equal(
    iconOf({ icon: icon.id, titles: [] }).id,
    "initial",
    "Unowned choice falls back",
  );
  grantTitle(icon.titleId);
  saveIcon(icon.id);
  assert.equal(
    iconOf(loadProfile()).id,
    icon.id,
    "Selected emblem survives save/reload",
  );
}
const palace = { titles: ["royal-road"] };
assert.ok(
  hasIcon(palace, "formation-heaven") && hasIcon(palace, "formation-hell"),
);
console.log(
  "7 emblem rewards, retroactive title ownership, locked selection and persistence: OK",
);

const { formationLayout } = await import("../src/game/formation-honors.js");
const { formationFixture } = await import("./formation-fixture.mjs");
for (const form of [
  "wings",
  "fortress",
  "earth",
  "sea",
  "forest",
  "palace",
  "hell",
]) {
  const state = formationFixture(form),
    before = JSON.stringify(state),
    layout = formationLayout(state, 0);
  assert.equal(layout.cells.length, 9);
  assert.equal(layout.cells.filter((p) => p.king).length, 1);
  assert.ok(
    layout.cells.every(
      (p) => p.row >= 0 && p.row < 3 && p.col >= 0 && p.col < layout.width,
    ),
  );
  for (const p of Object.values(state.pieces))
    if (p.owner === 1) {
      p.rank = "A";
      p.row = 8;
      p.col = 8;
    }
  assert.deepEqual(
    formationLayout(state, 0),
    layout,
    "Opponent identity/position cannot change the local scene",
  );
  const original = JSON.parse(before);
  for (const p of Object.values(original.pieces)) {
    p.owner = 1 - p.owner;
    p.row = 8 - p.row;
  }
  assert.deepEqual(
    formationLayout(original, 1),
    layout,
    "Upper player sees the same relative formation",
  );
}
console.log(
  "All seven scenes use the local army only; upper/lower placement parity: OK",
);
