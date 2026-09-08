/** 実画面のコールバックから送信する。CPU の手だけでは UI 固有の欄を見逃す。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";
import generateModule from "@babel/generator";
import { canWrite } from "./check-rules.mjs";
import { reducer } from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";
import { acceptAct, withLocalContext } from "../src/net/sync.js";

const ast = parse(readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8"), {
  sourceType: "module", plugins: ["jsx"],
});
const callbacks = {};
traverseModule.default(ast, {
  JSXOpeningElement(path) {
    if (path.node.name.name !== "DiceStep") return;
    for (const attr of path.node.attributes) {
      if (!["onRoll", "onNext"].includes(attr.name?.name)) continue;
      callbacks[attr.name.name] = generateModule.default(attr.value.expression).code;
    }
  },
});
assert.deepEqual(Object.keys(callbacks).sort(), ["onNext", "onRoll"]);

export function diceUiAction(callback, seat) {
  let action;
  Function("y", "E", `return (${callbacks[callback]})();`)(a => { action = a; }, seat);
  return action;
}

export function collectDiceUiActs(size, rolls) {
  let state = { phase: "intro" };
  const acts = [];
  function send(action, seat) {
    const act = enrichAction(withLocalContext(action, state), state);
    acts.push({ act, seat });
    state = reducer(state, act);
    return act;
  }
  send({ type: "START_SETUP", size, setupMode: "simultaneous", handSize: 13 }, 0);
  for (const pair of rolls) {
    for (const seat of [0, 1]) {
      const random = Math.random;
      try {
        Math.random = () => (pair[seat] - 0.5) / 6;
        send(diceUiAction("onRoll", seat), seat);
      } finally { Math.random = random; }
      send(diceUiAction("onNext", seat), seat);
    }
    if (state.diceIdx === 3) send({ type: "REROLL_DICE" }, 0);
  }
  send({ type: "GOTO_MULLIGAN" }, 0);
  assert.equal(state.phase, "mulligan");
  return acts;
}

if (process.argv[1]?.endsWith("check-dice-ui.mjs")) {
  const ids = ["uidA", "uidB"];
  let count = 0;
  for (const size of [5, 9]) for (const rolls of [[[6, 1]], [[1, 6]], [[3, 3], [2, 5]]]) {
    const root = { rooms: { DICE: { seats: { host: ids[0], guest: ids[1] }, createdAt: 1_699_999_940_000 } } };
    const peers = [{ phase: "intro" }, { phase: "intro" }];
    for (const { act, seat } of collectDiceUiActs(size, rolls)) {
      const wire = { ...act, by: ids[seat], __id: `dice-${++count}` };
      assert(canWrite(root, ["rooms", "DICE", "acts", "-NxxxxxxxxxxxxxxxxxA"], { uid: ids[seat] }, wire), `UI action rejected: ${JSON.stringify(wire)}`);
      peers[seat] = reducer(peers[seat], wire);
      const remote = acceptAct(wire, ids[1 - seat], 1 - seat, ids[seat]);
      assert(remote);
      peers[1 - seat] = reducer(peers[1 - seat], remote);
      assert.deepEqual(peers[0], peers[1]);
    }
    assert.equal(peers[0].phase, "mulligan");
    assert.equal(peers[0].firstPlayer, rolls.at(-1)[0] > rolls.at(-1)[1] ? 0 : 1);
  }
  console.log(`Dice UI: ${count} actions accepted; both peers reach mulligan (5×5 / 9×9, either winner, reroll).`);
}
