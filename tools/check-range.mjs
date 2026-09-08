/**
 * 王による移動距離の伸びの検査。
 *
 *   2・3 が王 … 王自身が「採用枚数×2マス」伸びる
 *   4・5 が王 … 王以外の同じ数字が「採用枚数×2マス」伸びる(王自身は伸びない)
 */
import {
  KING_RANGE_PER_CARD,
  emptyBoard,
  getLegalMoves,
  kingRankOf,
  rangeBonus,
} from "../src/game/board.js";

let ok = 0,
  fail = 0;
const t = (name, cond) => {
  if (cond) {
    ok++;
    console.log("  ok  ", name);
  } else {
    fail++;
    console.log("  NG  ", name);
  }
};

const P = (rank, isKing = false) => ({ rank, isKing, row: 4, col: 4, owner: 0 });

console.log("伸び幅は 採用枚数×2マス");
t("1枚あたり2マス", KING_RANGE_PER_CARD === 2);
for (const n of [1, 2, 3, 4])
  t(
    `2の王・${n}枚採用 → ${1 + 2 * n}マス`,
    1 + rangeBonus(P("2", true), { 2: n }, "2") === 1 + 2 * n,
  );
t("2を4枚採用した王は9マス", 1 + rangeBonus(P("2", true), { 2: 4 }, "2") === 9);
t("3を4枚採用した王は9マス", 1 + rangeBonus(P("3", true), { 3: 4 }, "3") === 9);
t(
  "枚数が分からなければ1枚として数える",
  rangeBonus(P("2", true), {}, "2") === 2 && rangeBonus(P("2", true), null, "2") === 2,
);

console.log("\n2・3 は王自身が伸びる");
t("王でない2は伸びない", rangeBonus(P("2"), { 2: 4 }, "2") === 0);
t("王でない3は伸びない", rangeBonus(P("3"), { 3: 4 }, "3") === 0);
t("2が王でも、他の数字は伸びない", rangeBonus(P("4"), { 4: 2 }, "2") === 0);

console.log("\n4・5 は王以外の同じ数字が伸びる");
t("王自身は伸びない", rangeBonus(P("4", true), { 4: 3 }, "4") === 0);
t("5の王自身も伸びない", rangeBonus(P("5", true), { 5: 3 }, "5") === 0);
t(
  "王以外の4は 2+2×枚数",
  2 + rangeBonus(P("4"), { 4: 1 }, "4") === 4 &&
    2 + rangeBonus(P("4"), { 4: 3 }, "4") === 8,
);
t("王以外の5も同じ", 2 + rangeBonus(P("5"), { 5: 2 }, "5") === 6);
t("王が4なら、5は伸びない", rangeBonus(P("5"), { 5: 3 }, "4") === 0);
t("王が2なら、4は伸びない", rangeBonus(P("4"), { 4: 3 }, "2") === 0);
t("王が決まっていなければ伸びない", rangeBonus(P("4"), { 4: 3 }, null) === 0);

console.log("\n上限の無い数字は関わらない");
for (const r of ["6", "7", "8", "9", "10", "J", "Q", "K", "A"])
  t(`${r} は伸びない`, rangeBonus(P(r, true), { [r]: 4 }, r) === 0);

console.log("\n実際に動ける先の数で確かめる");
{
  const size = 9,
    mid = 4;
  const at = (piece, counts, kingRank) => {
    const board = emptyBoard(size);
    const p = { ...piece, id: "me", suit: "spade", owner: 0, row: mid, col: mid, alive: true, history: [] };
    board[mid][mid] = p;
    return getLegalMoves(p, board, size, counts, kingRank);
  };
  // 縦横に n マスなら、空盤で 4方向 × n マス
  const reach = (mv) => Math.max(...mv.map((m) => Math.abs(m.row - mid) + Math.abs(m.col - mid)));
  t("素の2は1マス", reach(at({ rank: "2" }, {}, null)) === 1);
  t("2の王(1枚)は3マス", reach(at({ rank: "2", isKing: true }, { 2: 1 }, "2")) === 3);
  t("2の王(4枚)は9マスだが盤の端で止まる", reach(at({ rank: "2", isKing: true }, { 2: 4 }, "2")) === 4);
  t("素の4は2マス", reach(at({ rank: "4" }, {}, null)) === 2);
  t("4の王自身は2マスのまま", reach(at({ rank: "4", isKing: true }, { 4: 3 }, "4")) === 2);
  t("王以外の4(3枚採用)は8マス相当、盤の端で止まる", reach(at({ rank: "4" }, { 4: 3 }, "4")) === 4);
  t("王以外の4(1枚採用)は4マス", reach(at({ rank: "4" }, { 4: 1 }, "4")) === 4);
}

console.log("\n盤から王の数字を引く");
{
  const state = {
    players: [{ kingId: "a" }, { kingId: null }],
    pieces: { a: { rank: "4" } },
  };
  t("王のいる側は数字が引ける", kingRankOf(state, 0) === "4");
  t("王がいなければ null", kingRankOf(state, 1) === null);
  t("空でも落ちない", kingRankOf(null, 0) === null && kingRankOf({}, 0) === null);
}

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
