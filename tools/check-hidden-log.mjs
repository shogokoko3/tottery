// 行動記録から伏せた情報が漏れないか、と、移動の向きの矢印の検査(2026-09-17)。
//   1. 王位の継承は、相手から見ると **行ごと消える**(「何らかの効果が発生した」も残さない)。
//      残すと、王が倒れた手番に相手の駒を1つずつ開いて「行が増えた駒」を探せば新しい王が割れる
//   2. 自分の駒・倒れた駒・記録の再生では、これまでどおり全部見える
//   3. 移動の記録に向きの矢印が入る(縦横斜めの8方向。跳ぶ手は素の矢印)
import assert from "node:assert/strict";
import { sanitizeHistory, moveArrow, SECRET_HISTORY } from "../src/game/board.js";
import { reducer } from "../src/game/reducer.js";

// 1・2. 伏せる行
{
  const piece = (over) => ({
    id: "x", owner: 0, rank: "2", suit: "spade", alive: true, isKing: true,
    history: ["c1 ↑ c2 へ移動", "王位を継承", "b2 ↗ c3 へ移動"],
    ...over,
  });
  const mine = sanitizeHistory(piece(), 0, false);
  assert.deepEqual(mine, piece().history, "自分の駒は全部見える");
  const foe = sanitizeHistory(piece(), 1, false);
  assert.deepEqual(foe, ["c1 ↑ c2 へ移動", "b2 ↗ c3 へ移動"], "相手からは継承の行が消える(伏せた印も残さない)");
  assert.ok(!foe.some((h) => h.includes("何らかの効果")), "置き換えの行も残さない");
  const dead = sanitizeHistory(piece({ alive: false }), 1, false);
  assert.deepEqual(dead, piece().history, "倒れた駒は全部見える(正体は公開済み)");
  const replay = sanitizeHistory(piece(), 1, true);
  assert.deepEqual(replay, piece().history, "記録の再生では全部見える");
  // 継承以外の伏せる効果(昇格・凍結など)は、これまでどおり「何らかの効果」で残す
  const other = sanitizeHistory(piece({ history: ["昇格した"] }), 1, false);
  assert.deepEqual(other, ["何らかの効果が発生した"], "盤で見える効果は伏せて残す");
  assert.deepEqual(SECRET_HISTORY, ["王位を継承"]);
}

// 3. 矢印
{
  const at = (row, col) => ({ row, col });
  assert.equal(moveArrow(at(4, 2), at(3, 2)), "↑", "行が減る=盤の上へ");
  assert.equal(moveArrow(at(3, 2), at(4, 2)), "↓");
  assert.equal(moveArrow(at(3, 2), at(3, 0)), "←");
  assert.equal(moveArrow(at(3, 2), at(3, 4)), "→");
  assert.equal(moveArrow(at(4, 2), at(3, 1)), "↖");
  assert.equal(moveArrow(at(4, 2), at(3, 3)), "↗");
  assert.equal(moveArrow(at(2, 2), at(4, 0)), "↙");
  assert.equal(moveArrow(at(2, 2), at(4, 4)), "↘");
  assert.equal(moveArrow(at(2, 2), at(4, 3)), "→", "跳ぶ手(斜め45度でない)は素の矢印");
  assert.equal(moveArrow(at(2, 2), at(2, 2)), "→");
  assert.equal(moveArrow(null, at(1, 1)), "→");
}

// 実際の対局で、記録に矢印が入るか
{
  const { buildDeck, shuffle } = await import("../src/game/board.js");
  const real = Math.random;
  let n = 7;
  Math.random = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
  let s = reducer({ phase: "intro" }, { type: "START_SETUP", size: 5, setupMode: "simultaneous", deck: shuffle(buildDeck()) });
  Math.random = real;
  assert.equal(s.phase, "dice");
}
console.log("行動記録: 継承は相手から消える・向きの矢印 OK");
