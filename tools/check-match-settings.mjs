import assert from "node:assert/strict";
import {
  loadOnlineSize,
  saveOnlineSize,
  matchesOnlineSize,
} from "../src/net/match-settings.js";
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => mem.get(k),
  setItem: (k, v) => mem.set(k, v),
};
assert.equal(loadOnlineSize(), 5);
saveOnlineSize(9);
assert.equal(loadOnlineSize(), 9);
saveOnlineSize(7);
assert.equal(loadOnlineSize(), 9);
saveOnlineSize(5);
assert.equal(loadOnlineSize(), 5);
mem.set("tottery.online-rules.v1", "broken");
assert.equal(loadOnlineSize(), 5);
for (const wanted of [5, 9]) {
  for (const offered of [5, 9, 7, undefined, null, "9"]) {
    assert.equal(
      matchesOnlineSize({ matchSize: offered }, wanted),
      offered === wanted,
    );
  }
  assert.equal(matchesOnlineSize(null, wanted), false);
}
globalThis.localStorage = {
  getItem() {
    throw Error("disabled");
  },
  setItem() {
    throw Error("disabled");
  },
};
assert.equal(loadOnlineSize(), 5);
assert.doesNotThrow(() => saveOnlineSize(9));
console.log(
  "Online settings: persistence, invalid values, incompatible/legacy matching OK",
);
