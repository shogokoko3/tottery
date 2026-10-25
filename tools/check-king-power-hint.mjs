/**
 * 対局中の「王の力が使える場面」(2026-10-25 本人の指示「対局中、王の力が使える場面になったら、その場で一言と光で知らせる」)。
 * src/game/king-power-hint.js の kingPowerChance を、手で組んだ盤で確かめる。
 *
 * 見ること:
 *   A. 王の2: 遠くへ動ける先だけを返す(1マス先は返さない)。途中に駒があれば、その先は返さない
 *   B. 王の6: 止まれるマスに相手が2枚並ぶと「2枚まとめて取れる」。相手がいないと、力でしか行けない先は無い
 *   C. 王の4: 王ではない4の、遠くへ動ける先を返す。ほかの4がいなければ null
 *   D. 王の10の2回目(extraMoveFor)は "again"
 *   E. 王の力が無い席(フェーズ2 ストーリーの相手)・相手の番・対局の外では null
 *   F. 対局画面がこれを使い、光(cell-kp-ready / cell-kp-power)と一言(kp-chance)を出す
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { emptyBoard } from "../src/game/board.js";
import { kingPowerChance } from "../src/game/king-power-hint.js";

let ok = 0;
const fail = [];
const is = (label, got, want) => {
  try {
    assert.deepEqual(got, want);
    ok++;
    console.log(`  ok   ${label}`);
  } catch {
    fail.push(label);
    console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
  }
};

/** 5×5 の盤に駒を置いた対局の state。pieces: [{ id, rank, owner, row, col, isKing }] */
function play(pieces, extra = {}) {
  const board = emptyBoard(5);
  const all = {};
  const counts = [{}, {}];
  for (const p of pieces) {
    const piece = { suit: "spade", alive: true, history: [], isKing: false, ...p };
    all[p.id] = piece;
    board[p.row][p.col] = piece;
    counts[p.owner][p.rank] = (counts[p.owner][p.rank] || 0) + 1;
  }
  const kingOf = (o) => pieces.find((p) => p.owner === o && p.isKing)?.id || null;
  return {
    phase: "play",
    boardSize: 5,
    currentTurn: 0,
    turnNo: 3,
    kingPowers: [true, false],
    board,
    pieces: all,
    players: [0, 1].map((o) => ({ kingId: kingOf(o), armyRankCounts: counts[o] })),
    extraMoveFor: null,
    ...extra,
  };
}
const cells = (c) => (c ? Object.values(c.moves).flat().map((m) => `${m.row},${m.col}`).sort() : null);

console.log("A. 王の2");
{
  const s = play([
    { id: "k", rank: "2", owner: 0, row: 4, col: 0, isKing: true },
    { id: "e", rank: "3", owner: 1, row: 0, col: 4, isKing: true },
  ]);
  const c = kingPowerChance(s, 0);
  is("種類は reach、光るのは王", [c.kind, c.pieceIds], ["reach", ["k"]]);
  is("1マス先は返さず、2〜3マス先だけ", cells(c), ["1,0", "2,0", "4,2", "4,3"]);
  is("選ぶ前は「タップすると金色に光る」、選んだあとは「金色のマスは王の力で行けるマス」", [c.prompt, c.line], ["王の2をタップすると、王の力で行けるマスが金色に光る。", "金色のマスは、王の2が王の力で行けるマス。"]);
  const blocked = play([
    { id: "k", rank: "2", owner: 0, row: 4, col: 0, isKing: true },
    { id: "f", rank: "5", owner: 0, row: 3, col: 0 },
    { id: "g", rank: "5", owner: 0, row: 4, col: 1 },
    { id: "e", rank: "3", owner: 1, row: 0, col: 4, isKing: true },
  ]);
  is("味方に囲まれて遠くへ行けなければ null", kingPowerChance(blocked, 0), null);
}

console.log("B. 王の6");
{
  const two = play([
    { id: "k", rank: "6", owner: 0, row: 4, col: 0, isKing: true },
    { id: "x", rank: "2", owner: 1, row: 2, col: 0 },
    { id: "y", rank: "4", owner: 1, row: 0, col: 0 },
    { id: "e", rank: "3", owner: 1, row: 0, col: 4, isKing: true },
  ]);
  const c = kingPowerChance(two, 0);
  is("種類は capture", c.kind, "capture");
  is("一言は「金色のマスまで進むと、2枚取れる」", [c.prompt, c.line], ["王の6で、相手の駒を2枚まとめて取れる。王の6をタップしてみよう。", "金色のマスまで進むと、2枚まとめて取れる。赤い枠のマスで止まってもよい。"]);
  is("2枚取りの手がある", c.moves.k.some((m) => m.captures && m.captures.length === 2), true);
  const none = play([
    { id: "k", rank: "6", owner: 0, row: 4, col: 0, isKing: true },
    { id: "e", rank: "3", owner: 1, row: 0, col: 4, isKing: true },
  ]);
  is("相手が通り道にいなければ null(ふつうの6と同じ手しかない)", kingPowerChance(none, 0), null);
}

console.log("C. 王の4");
{
  const s = play([
    { id: "k", rank: "4", owner: 0, row: 4, col: 4, isKing: true },
    { id: "o", rank: "4", owner: 0, row: 4, col: 0 },
    { id: "e", rank: "3", owner: 1, row: 0, col: 4, isKing: true },
  ]);
  const c = kingPowerChance(s, 0);
  is("種類は others、光るのは王ではない4", [c.kind, c.pieceIds], ["others", ["o"]]);
  is("王ではない4の、3マス先より遠い先", cells(c), ["0,0", "1,0", "4,3"]);
  const alone = play([
    { id: "k", rank: "4", owner: 0, row: 4, col: 4, isKing: true },
    { id: "e", rank: "3", owner: 1, row: 0, col: 4, isKing: true },
  ]);
  is("ほかの4がいなければ null", kingPowerChance(alone, 0), null);
}

console.log("D. 王の10の2回目");
{
  const s = play(
    [
      { id: "k", rank: "10", owner: 0, row: 2, col: 2, isKing: true },
      { id: "e", rank: "3", owner: 1, row: 0, col: 4, isKing: true },
    ],
    { extraMoveFor: "k" },
  );
  is("種類は again", kingPowerChance(s, 0)?.kind, "again");
}

console.log("E. 出さない場面");
{
  const base = [
    { id: "k", rank: "2", owner: 0, row: 4, col: 0, isKing: true },
    { id: "e", rank: "2", owner: 1, row: 0, col: 4, isKing: true },
  ];
  is("力の無い席(相手)", kingPowerChance(play(base, { currentTurn: 1 }), 1), null);
  is("相手の番", kingPowerChance(play(base, { currentTurn: 1 }), 0), null);
  is("対局の外(布陣)", kingPowerChance(play(base, { phase: "setup" }), 0), null);
  is("王の力の無い対局(フェーズ1)", kingPowerChance(play(base, { kingPowers: false }), 0), null);
}

console.log("F. 対局画面");
{
  const ui = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  is("kingPowerChance を使う", /kingPowerChance\(a, P, aliceBoard\(a, P\)\)/.test(ui), true);
  is("光(cell-kp-ready・cell-kp-power)と一言(kp-chance)", ["cell-kp-ready", "cell-kp-power", "kp-chance"].every((c) => ui.includes(c) && css.includes(`.${c}`)), true);
  is("はじめの一局(台本)には出さない", /!\(tutorial && tutorial\.intro\) \? kingPowerChance/.test(ui), true);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.log(`NG: ${fail.join(", ")}`);
  process.exit(1);
}
