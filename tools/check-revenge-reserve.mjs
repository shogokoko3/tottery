/**
 * 道連れで倒れた J・Q では K の王の予備札を引かない(ルール版15、本人の指示 2026-09-16)。
 * 相手(青)の王が K、こちら(赤)の王が 4。青の J が赤の 4 を取ると道連れで J が倒れる。
 * 版15: 青は予備札を引かない。版14: 引く(旧対局の再生は変わらない)。
 * ふつうに(道連れでなく)J が倒れれば、版15でも引く。
 */
import assert from "node:assert/strict";
import { removePiece } from "../src/game/reducer.js";
import { areaFixture } from "./area-fixture.mjs";

function build(ruleVersion) {
  const s = areaFixture("sea");
  s.ruleVersion = ruleVersion;
  // 赤の王を 4 に、赤の非王の 4 を置く。青の J を隣に置く
  s.pieces.fx0.rank = "4";
  const four = { id: "four", rank: "4", suit: "heart", owner: 0, row: 5, col: 4, isKing: false, alive: true, revealed: false, history: [] };
  const jack = { id: "jack", rank: "J", suit: "club", owner: 1, row: 4, col: 4, isKing: false, alive: true, revealed: false, history: [] };
  for (const p of [four, jack]) { s.pieces[p.id] = p; s.board[p.row][p.col] = p; }
  s.reserve = [{ id: "r1", rank: "2", suit: "heart" }, { id: "r2", rank: "3", suit: "heart" }];
  s.players = s.players.map((pl) => ({ ...pl, capturedOwn: [...(pl.capturedOwn || [])], hand: [...(pl.hand || [])] }));
  return s;
}

{
  const t = removePiece(build(15), "four", { by: "jack" });
  assert.equal(t.pieces.four.alive, false, "4 は倒れる");
  assert.equal(t.pieces.jack.alive, false, "J は道連れで倒れる");
  assert.equal(t.kPlacement, null, "版15: 道連れで倒れた J では予備札を引かない");
  assert.equal(t.reserve.length, 2, "予備札は減らない");
}
{
  const t = removePiece(build(14), "four", { by: "jack" });
  assert.equal(t.pieces.jack.alive, false);
  assert.ok(t.kPlacement && t.kPlacement.owner === 1, "版14: 旧どおり予備札を引く(再生は変わらない)");
  assert.equal(t.reserve.length, 1);
}
{
  // 道連れでなく、ふつうに J が倒れたときは版15でも引く
  const t = removePiece(build(15), "jack", { by: "four" });
  assert.equal(t.pieces.jack.alive, false);
  assert.ok(t.kPlacement && t.kPlacement.owner === 1, "版15: ふつうの撃破では引く");
}
console.log("道連れと K の予備札: 版15は引かない・版14は引く・ふつうの撃破は引く OK");
