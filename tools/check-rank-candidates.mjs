/**
 * 動いた伏せ札の「ありうる数字」の絞り込み(2026-09-28 本人の指示)を確かめる。
 *
 * いちばん大事なのは**伏せ札の正体を読んでいないこと**と、
 * **ありえる数字を消しすぎないこと**(消しすぎると、相手を誤らせる)。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  candidatesFromHistory,
  movesFromHistory,
  parseMoveLine,
  rankCandidates,
  rankCouldMove,
} from "../src/game/rank-candidates.js";
import {
  emptyBoard,
  getLegalMoves,
  squareName,
  KING_RANGE_PER_CARD,
} from "../src/game/board.js";
import { RANKS } from "../src/game/constants.js";

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
const SIZE = 9;
const line = (from, to, note = "") =>
  `${from}→${to} ⬆︎ へ移動${note}`;

console.log("行動記録の読み取り");
is("マスを取り出す", parseMoveLine(line("c2", "c3"), SIZE), {
  from: { row: 7, col: 2 },
  to: { row: 6, col: 2 },
});
is("移動でない行は無視", parseMoveLine("何らかの効果が発生した", SIZE), null);
is(
  "海の引き寄せは数えない(その駒の動き方ではない)",
  parseMoveLine(line("c2", "c3", "(海の引き寄せ)"), SIZE),
  null,
);
is("2回目の移動は数える", !!parseMoveLine(line("c2", "c3", "(2回目)"), SIZE), true);
is(
  "伏せた行が混ざっても、移動だけ拾う",
  movesFromHistory([line("c2", "c3"), "何らかの効果が発生した"], SIZE).length,
  1,
);

console.log("\n絞り込み");
const ranksOf = (lines) => candidatesFromHistory(lines, SIZE).ranks;
is("動いていなければ全部", ranksOf([]), RANKS);
is("縦1マス", ranksOf([line("c2", "c3")]), ["2", "4", "8", "J", "Q", "K"]);
is("縦2マス", ranksOf([line("c2", "c4")]), ["2", "4", "6", "J", "K"]);
is("斜め1マス", ranksOf([line("c2", "d3")]), ["3", "5", "9", "J", "Q", "K"]);
is("桂馬", ranksOf([line("c2", "d4")]), ["10", "K"]);
is("A はどの動きでも外れる", ranksOf([line("c2", "c3")]).includes("A"), false);
is(
  "2手で重ねて絞る(縦1 → 斜め2)",
  ranksOf([line("c2", "c3"), line("c3", "e5")]),
  ["Q", "K"],
);

console.log("\n王でないとできない動き");
{
  const d = candidatesFromHistory([line("c2", "c3"), line("c3", "e5")], SIZE);
  is("Q は王のときだけ縦横に1マス動ける", d.kingOnly, ["Q"]);
  is("K は王でなくてもできる", d.kingOnly.includes("K"), false);
  const j = candidatesFromHistory([line("c2", "d3"), line("d3", "d7")], SIZE);
  is("J の斜め1マスも王のときだけ", j.kingOnly, ["J"]);
  const all = candidatesFromHistory(
    [line("c2", "d3"), line("d3", "e4"), line("e4", "e5")],
    SIZE,
  );
  is("残りが全部「王のみ」なら王で確定", all.mustBeKing, false);
  is("そのときの候補", all.ranks, ["J", "Q", "K"]);
}

console.log("\n消しすぎていないか(盤の決まりと突き合わせる)");
{
  // 実際に getLegalMoves が出す手は、必ず候補に残らなければならない。
  // 残らなければ「ありえる数字を消した」ことになり、相手を誤らせる
  let checked = 0;
  for (const rank of RANKS) {
    if (rank === "A") continue;
    for (const isKing of [false, true]) {
      for (const cards of [1, 4]) {
        const board = emptyBoard(SIZE);
        const piece = { id: "x", owner: 1, rank, suit: "S", row: 4, col: 4, alive: true, isKing };
        board[4][4] = piece;
        const counts = { [rank]: cards };
        for (const m of getLegalMoves(piece, board, SIZE, counts, isKing ? rank : rank)) {
          const from = squareName(4, 4, SIZE);
          const to = squareName(m.row, m.col, SIZE);
          const got = ranksOf([line(from, to)]);
          checked++;
          if (!got.includes(rank)) {
            fail.push(`${rank}(王${isKing})の ${from}→${to} が候補から消えた`);
            console.log(`  NG   ${rank} の合法手 ${from}→${to} が候補に残らない`);
          }
        }
      }
    }
  }
  is(`盤の決まりが出す手は全部候補に残る(${checked}手)`, fail.length, 0);
  assert.ok(checked > 200, `十分な数を見た(${checked})`);
}

console.log("\n伏せ札の正体を読んでいないか");
{
  const src = fs.readFileSync(new URL("../src/game/rank-candidates.js", import.meta.url), "utf8");
  // 引数は行動記録の文字列と盤の大きさだけ。駒そのものを受け取らない
  is("piece.rank を読まない", /\.(rank|isKing|revealed|kingId)\b/.test(src), false);
  is("駒そのものを受け取らない", /\bpiece\b/.test(src), false);
  is("isKing を読まない", /\.isKing/.test(src), false);
  is("state を受け取らない", /\bstate\b/.test(src), false);
  const ui = fs.readFileSync(new URL("../src/ui/private-notes.jsx", import.meta.url), "utf8");
  is(
    "画面は sanitizeHistory を通した記録だけを渡す",
    /history=\{visibleHistoryAt\(state, square, viewer\)\}/.test(ui),
    true,
  );
  is("visibleHistoryAt は sanitizeHistory を使う", /sanitizeHistory\(piece, viewer, false\)/.test(ui), true);
}

console.log("\n伸びしろの見方");
is(
  "2 の王は同じ数字の枚数ぶん伸びる。その最大まで候補に残す",
  rankCouldMove("2", 0, 1 + KING_RANGE_PER_CARD * 4),
  true,
);
is("それを超えたら外す", rankCouldMove("2", 0, 2 + KING_RANGE_PER_CARD * 4), false);
is("6 は偶数マスだけ", [1, 2, 3, 4].map((d) => rankCouldMove("6", 0, d)), [
  false,
  true,
  false,
  true,
]);
is("9 は斜めの奇数マスだけ", [1, 2, 3].map((d) => rankCouldMove("9", d, d)), [
  true,
  false,
  true,
]);
is("同じマスへの移動は無効", rankCouldMove("K", 0, 0), false);
is("pool を絞れる(レベル制限)", rankCandidates([], { pool: ["2", "3"] }), ["2", "3"]);

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
