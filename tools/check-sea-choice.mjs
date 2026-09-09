import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { areaFixture } from "./area-fixture.mjs";
import { automaticAreaAction } from "../src/game/area-presentation.js";
import { canUseArea } from "../src/game/areas.js";
import { getLegalMoves, kingRankOf } from "../src/game/board.js";
import { reducer } from "../src/game/reducer.js";
import { shouldUseSea } from "../src/game/cpu-sea.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { bestAreaUse } from "../src/game/cpu.js";
import { roomRuleVersion } from "../src/net/sync.js";

const s = { ...areaFixture("sea"), ruleVersion: 10 };
const move = (state, id) => {
  const p = state.pieces[id];
  const target = getLegalMoves(
    p,
    state.board,
    9,
    state.players[p.owner].armyRankCounts,
    kingRankOf(state, p.owner),
  ).find((m) => !state.board[m.row][m.col]);
  assert(target);
  return { type: "MOVE_PIECE", pieceId: id, row: target.row, col: target.col };
};
assert.equal(automaticAreaAction(s), null, "海は勝手に発動しない");
assert.equal(canUseArea(s, 0).ok, true);
const skipped = reducer(s, move(s, "fx1"));
assert.equal(skipped.currentTurn, 1, "使わずに通常移動で手番を終えられる");
assert.equal(skipped.areas[0].uses, 0);
assert.equal(
  skipped.pieces.fx2.row,
  s.pieces.fx2.row,
  "見送ると潮流で駒が動かない",
);
const returned = reducer(skipped, move(skipped, "fx5"));
assert.equal(returned.currentTurn, 0);
assert.equal(canUseArea(returned, 0).ok, true, "次の手番でまた選べる");
assert.equal(automaticAreaAction(returned), null);
const action = { type: "USE_AREA" };
const used = reducer(s, action);
assert.equal(used.currentTurn, 0, "発動で手番を消費しない");
assert.equal(used.areas[0].uses, 1);
assert(used.lastArea.moves.length > 0);
assert.equal(canUseArea(used, 0).ok, false);
assert.deepEqual(reducer(used, action), used, "重複した通信でも2回発動しない");
const moved = reducer(used, move(used, "fx1"));
assert.equal(moved.currentTurn, 1, "発動後も移動できる");
const nextTurn = reducer(moved, move(moved, "fx5"));
assert.equal(canUseArea(nextTurn, 0).ok, true);
assert.equal(reducer(nextTurn, action).areas[0].uses, 2);
assert.equal(
  automaticAreaAction({ ...s, ruleVersion: 9 }).type,
  "USE_AREA",
  "旧対局は自動発動のまま",
);
for (const type of ["earth", "forest", "ice"])
  assert.equal(
    automaticAreaAction({ ...areaFixture(type), ruleVersion: 10 }).type,
    "USE_AREA",
  );
assert.equal(
  roomRuleVersion({ hostRuleVersion: 10, guestRuleVersion: 10 }),
  10,
);
assert.equal(
  roomRuleVersion({ hostRuleVersion: 10, guestRuleVersion: 9 }),
  null,
);
assert.deepEqual(
  reducer(structuredClone(s), action),
  used,
  "双方で同じ盤面を再生",
);

assert.equal(shouldUseSea(s, 0), false, "CPUは不利な引き寄せを見送る");
assert.equal(bestAreaUse(s, 0, null), null);
const advantage = structuredClone(s);
advantage.board = Array.from({ length: 9 }, () => Array(9).fill(null));
[
  [5, 6],
  [8, 1],
  [6, 4],
  [5, 5],
  [7, 5],
  [1, 6],
  [8, 4],
  [7, 3],
].forEach(([row, col], i) => {
  const p = advantage.pieces[`fx${i}`];
  p.row = row;
  p.col = col;
  advantage.board[row][col] = p;
});
const before = structuredClone(advantage);
assert.equal(
  shouldUseSea(advantage, 0),
  true,
  "CPUは手が改善する引き寄せを選べる",
);
assert.equal(bestAreaUse(advantage, 0, null).type, "USE_AREA");
assert.equal(cpuInformedAction(advantage, 0).type, "USE_AREA");
assert.deepEqual(advantage, before, "思考で実盤面を書き換えない");
const hidden = structuredClone(advantage);
for (const p of Object.values(hidden.pieces).filter((p) => p.owner === 1)) {
  p.rank = p.id === "fx7" ? "Q" : "3";
  p.isKing = p.id === "fx7";
}
hidden.players[1].kingId = "fx7";
assert.equal(
  shouldUseSea(hidden, 0),
  shouldUseSea(advantage, 0),
  "伏せ駒の数字・王の位置を盗み見ない",
);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-sea-choice-"));
try {
  const outfile = path.join(dir, "bar.cjs");
  await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "jsx",
      contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {AreaBar} from './src/ui/areas.jsx';export const render=(state)=>renderToStaticMarkup(<AreaBar state={state} viewer={0} myTurn dispatch={()=>{}} picking={false} setPicking={()=>{}} busy={false}/>);`,
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    outfile,
    logLevel: "silent",
  });
  const { render } = createRequire(import.meta.url)(outfile);
  const html = render(s);
  assert.match(html, /<button[^>]*>発動<\/button>/);
  assert.match(html, /使わずに駒を動かせます/);
  assert.match(render(used), /<button[^>]*disabled/);
  assert.doesNotMatch(render({ ...s, ruleVersion: 9 }), /<button/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(
  "Sea: optional each turn, use then move, skip then next turn, legacy replay, UI and CPU privacy passed",
);
