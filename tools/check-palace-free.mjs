import assert from "node:assert/strict";
import { areaFixture } from "./area-fixture.mjs";
import { reducer } from "../src/game/reducer.js";
import { canUseArea } from "../src/game/areas.js";
import { getLegalMoves, kingRankOf } from "../src/game/board.js";
import { areaEvent, areaEventText } from "../src/game/area-presentation.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
for (const version of [6, 7]) {
  const s = areaFixture("palace");
  s.ruleVersion = version;
  s.pieces.fx1.rank = "10";
  const a = { type: "USE_AREA", pieceId: "fx1" };
  const t = reducer(s, a);
  assert.equal(t.pieces.fx1.rank, "J");
  assert.equal(t.currentTurn, version === 7 ? 0 : 1);
  assert.equal(t.turnNo, s.turnNo + (version === 7 ? 0 : 1));
  assert.equal(reducer(t, a), t, "no repeated promotion in same turn");
  const text = areaEventText(areaEvent(s, t, 0), "resolve");
  assert(text.includes(version === 7 ? "続けて駒を動かせる" : "相手の手番へ"));
  if (version === 7) {
    assert.equal(canUseArea(t, 0).ok, false);
    for (const id of ["fx1", "fx2"]) {
      const p = t.pieces[id],
        m = getLegalMoves(
          p,
          t.board,
          9,
          t.players[0].armyRankCounts,
          kingRankOf(t, 0),
        ).find((m) => !t.board[m.row][m.col]);
      assert(m);
      const u = reducer(t, {
        type: "MOVE_PIECE",
        pieceId: id,
        row: m.row,
        col: m.col,
      });
      assert.notEqual(u, t, "promoted and other pieces can move");
      assert.equal(u.currentTurn, 1);
    }
    assert.notEqual(cpuInformedAction(t, 0)?.type, "USE_AREA");
  }
}
console.log(
  "Palace v7: promotion without turn cost, either piece moves, once per turn, v6 replay behavior, event text passed",
);
