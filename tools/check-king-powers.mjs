/**
 * 王の力を切る旗(2026-09-30 本人の指示。ストーリーのフェーズ1「駒の動きだけ」)。
 *
 * 決まり:
 *   - 王は**いる**。伏せたままで、討てば勝ち(勝敗の判定は今のまま)
 *   - 力だけ無い: 2/3 の伸びと継承、4/5 の仲間の伸びと道連れ、6〜9 のまとめ取り、
 *     10 と A の2回目、J/Q の+1マス、K の予備札
 *   - 採用枚数の決まり(maxAdopt)は札の規則なので残す
 *   - 空のエリアの2回目(skyTwice)は王の力ではないので残る
 *   - 旗が無い古い記録・古い端末の対局は「力あり」と読む
 *
 * 作り: 旗は state.kingPowers、駒には powers:false が付く。合法手(board.js)は駒だけを見るので、
 * 呼び出し元 60 か所(CPU・画面)を触らずに同じ手が出る。
 */
import assert from "node:assert/strict";
import { initialState, reducer, removePiece, endAction, autoArrange, autoPickKing } from "../src/game/reducer.js";
import { getLegalMoves, maxAdopt, kingPowersOn, emptyBoard } from "../src/game/board.js";
import { candidatesFromHistory } from "../src/game/rank-candidates.js";

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

const pc = (rank, isKing, powers, row = 4, col = 4, owner = 0, extra = {}) => ({
  id: `${rank}${isKing ? "k" : ""}${owner}`, rank, suit: "spade", owner, isKing, row, col, alive: true, revealed: false, history: [],
  ...(powers ? {} : { powers: false }), ...extra,
});
const far = (moves) => Math.max(0, ...moves.map((m) => Math.max(Math.abs(m.row - 4), Math.abs(m.col - 4))));
const B = () => emptyBoard(9);

console.log("動き(board.js)");
for (const powers of [true, false]) {
  const tag = powers ? "力あり" : "力なし";
  is(`${tag}: 2 の王の届く距離`, far(getLegalMoves(pc("2", true, powers), B(), 9, { 2: 1 }, "2")), powers ? 3 : 1);
  is(`${tag}: 3 の王の届く距離`, far(getLegalMoves(pc("3", true, powers), B(), 9, { 3: 1 }, "3")), powers ? 3 : 1);
  is(`${tag}: 4 の王がいるときの仲間の 4`, far(getLegalMoves(pc("4", false, powers), B(), 9, { 4: 1 }, "4")), powers ? 4 : 2);
  is(`${tag}: 5 の王がいるときの仲間の 5`, far(getLegalMoves(pc("5", false, powers), B(), 9, { 5: 1 }, "5")), powers ? 4 : 2);
  {
    // 6 の王。同じ線に相手が2枚並ぶ
    const board = B();
    const six = pc("6", true, powers, 4, 0);
    const e1 = pc("2", false, true, 4, 2, 1), e2 = pc("2", false, true, 4, 4, 1);
    e2.id = "e2";
    board[4][0] = six; board[4][2] = e1; board[4][4] = e2;
    // 単独の取りは capture:true だけで captures 配列を持たない。まとめ取りは captures に並ぶ
    const most = Math.max(0, ...getLegalMoves(six, board, 9, { 6: 1 }, "6").map((m) => (m.captures ? m.captures.length : m.capture ? 1 : 0)));
    is(`${tag}: 6 の王のまとめ取り(いちばん多く取れる枚数)`, most, powers ? 2 : 1);
  }
  is(`${tag}: J の王の斜め1マス`, getLegalMoves(pc("J", true, powers), B(), 9, { J: 1 }, "J").some((m) => Math.abs(m.row - 4) === 1 && Math.abs(m.col - 4) === 1), powers);
  is(`${tag}: Q の王の縦横1マス`, getLegalMoves(pc("Q", true, powers), B(), 9, { Q: 1 }, "Q").some((m) => (m.row === 4) !== (m.col === 4) && Math.abs(m.row - 4) + Math.abs(m.col - 4) === 1), powers);
  is(`${tag}: K の動きは同じ`, getLegalMoves(pc("K", true, powers), B(), 9, { K: 1 }, "K").length, getLegalMoves(pc("K", true, true), B(), 9, { K: 1 }, "K").length);
  is(`${tag}: 10 の跳びは同じ`, getLegalMoves(pc("10", true, powers), B(), 9, { 10: 1 }, "10").length, 8);
}
is("王でない駒は力の有無で変わらない(2)", far(getLegalMoves(pc("2", false, false), B(), 9, { 2: 1 }, "3")), 1);
is("採用枚数の決まりは残す(K は王のときだけ)", [maxAdopt("K", null), maxAdopt("K", "K"), maxAdopt("J", "K"), maxAdopt("J", "2")], [0, 1, 1, 2]);
is("旗の読み方: 無ければ力あり", [kingPowersOn(undefined), kingPowersOn({}), kingPowersOn({ kingPowers: true }), kingPowersOn({ kingPowers: false })], [true, true, true, false]);

console.log("\n対局の中(reducer.js)");
function fixture(powers, specs, extra = {}) {
  const s = initialState();
  const size = 5, pieces = {}, board = Array.from({ length: size }, () => Array(size).fill(null));
  for (const [id, rank, owner, row, col, isKing, more] of specs) {
    const p = { id, rank, suit: "spade", owner, row, col, isKing, alive: true, revealed: false, history: [], ...(powers ? {} : { powers: false }), ...(more || {}) };
    pieces[id] = p; board[row][col] = p;
    if (isKing) s.players[owner].kingId = id;
  }
  return {
    ...s, kingPowers: powers, boardSize: size, board, pieces, phase: "play", currentTurn: 0, turnNo: 2, setupMode: "simultaneous",
    interstitial: null, ruleVersion: 15, known: [{}, {}], reserve: [],
    players: s.players.map((pl) => ({ ...pl, capturedOwn: [...(pl.capturedOwn || [])], hand: [...(pl.hand || [])] })),
    ...extra,
  };
}
for (const powers of [true, false]) {
  const tag = powers ? "力あり" : "力なし";
  {
    const s = fixture(powers, [["k2", "2", 0, 4, 0, true], ["f2", "2", 0, 4, 2, false], ["e", "J", 1, 0, 4, true]]);
    const t = removePiece(s, "k2", { by: "e" });
    is(`${tag}: 2 の王が倒れたとき`, powers ? [t.players[0].kingId, t.winner ?? null] : [t.players[0].kingId, t.winner], powers ? ["f2", null] : ["k2", 1]);
  }
  {
    const s = fixture(powers, [["k4", "4", 0, 4, 0, true], ["n4", "4", 0, 3, 3, false], ["j", "J", 1, 3, 4, false], ["ek", "K", 1, 0, 4, true]]);
    const t = removePiece(s, "n4", { by: "j" });
    is(`${tag}: 王が 4 のとき仲間の 4 を取った相手`, t.pieces.j.alive, !powers);
  }
  {
    const s = fixture(powers, [["kk", "K", 0, 4, 0, true], ["j0", "J", 0, 3, 3, false], ["e", "2", 1, 3, 4, false], ["ek", "K", 1, 0, 4, true]], { reserve: [{ id: "r1", rank: "2", suit: "heart" }] });
    const t = removePiece(s, "j0", { by: "e" });
    is(`${tag}: 王が K のとき J が倒れて予備札を引くか`, !!(t.kPlacement && t.kPlacement.cards.length), powers);
  }
  {
    const s = fixture(powers, [["t", "10", 0, 4, 0, true], ["ek", "K", 1, 0, 4, true]]);
    const t = endAction(s, "t");
    is(`${tag}: 10 の王の2回目`, t.extraMoveFor === "t", powers);
  }
  {
    const s = fixture(powers, [["a", "A", 0, 4, 0, true], ["ek", "K", 1, 0, 4, true]]);
    const t = endAction(s, "a");
    is(`${tag}: A の王の2回目`, t.extraMoveFor === "a", powers);
  }
  {
    const s = fixture(powers, [["kk", "K", 0, 4, 0, true], ["ek", "K", 1, 0, 4, true]]);
    const t = removePiece(s, "kk", { by: "ek" });
    is(`${tag}: 王を討てば勝ち`, t.winner, 1);
  }
}
{
  // 空のエリアの2回目は王の力ではない。力なしでも残る
  const s = fixture(false, [["t", "10", 0, 4, 0, false, { skyTwice: true }], ["kk", "K", 0, 4, 4, true], ["ek", "K", 1, 0, 4, true]]);
  is("力なしでも、空の 10 の2回目は残る", endAction(s, "t").extraMoveFor, "t");
}

console.log("\n対局の始め方(START_SETUP と布陣)");
function place(kingPowers) {
  let s = reducer({ phase: "intro" }, { type: "START_SETUP", size: 5, setupMode: "simultaneous", handSize: 13, ...(kingPowers === undefined ? {} : { kingPowers }) });
  let guard = 0;
  // サイコロ → 引き直し → 布陣、を tools/check-twice.mjs と同じ手順で進める
  while (s.phase !== "play" && guard++ < 300) {
    if (s.setupEffects) { s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" }); continue; }
    if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
    if (s.phase === "dice") {
      s = reducer(s, s.dice[s.diceIdx] === null ? { type: "ROLL_DICE_SINGLE" } : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : s.diceIdx === 3 ? { type: "REROLL_DICE" } : { type: "NEXT_DICE_STEP" });
      continue;
    }
    if (s.phase === "mulligan") { s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: [] }); continue; }
    if (s.phase === "setup") {
      for (const i of [0, 1]) {
        if (s.setupDone[i]) continue;
        const placement = autoArrange(s, i, null, null, null);
        s = reducer(s, { type: "SETUP_CONFIRM", player: i, placement, kingId: autoPickKing(s, i, placement) });
      }
      continue;
    }
    break;
  }
  assert.equal(s.phase, "play", "布陣まで進めなかった: " + s.phase);
  return s;
}
{
  const on = place(undefined), off = place(false);
  is("旗を渡さなければ力あり", on.kingPowers, true);
  is("kingPowers:false で始めると力なし", off.kingPowers, false);
  const alive = (s) => Object.values(s.pieces).filter((p) => p.alive);
  is("力ありの駒には印が付かない", alive(on).every((p) => !("powers" in p)), true);
  is("力なしの駒には powers:false が付く", alive(off).length > 0 && alive(off).every((p) => p.powers === false), true);
  is("力なしでも王はいる", alive(off).filter((p) => p.isKing).length, 2);
}

console.log("\n推理メモ(rank-candidates)");
{
  const line = (a, b) => `${a}→${b}へ移動`;
  const three = [line("c1", "c4")]; // 縦に3マス
  const on = candidatesFromHistory(three, 5);
  const off = candidatesFromHistory(three, 5, { powers: false });
  is("力あり: 縦3マスは 2 の王の可能性がある(金の数字)", on.kingOnly.includes("2"), true);
  is("力なし: 2 は候補に残らない(伸びないので)", off.ranks.includes("2"), false);
  is("力なし: 4 も候補に残らない(仲間の伸びも無い)", off.ranks.includes("4"), false);
  is("力なし: 「王だけの動き」は断言しない", [off.kingOnly, off.mustBeKing ?? false], [[], false]);
  is("力なし: 縦3マスなら 8・J・K", off.ranks, ["8", "J", "K"]);
  const one = [line("c1", "c2")];
  is("力なし: 縦1マスなら 2・4・8・J・K", candidatesFromHistory(one, 5, { powers: false }).ranks, ["2", "4", "8", "J", "K"]);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) { console.error("NG: " + fail.join(", ")); process.exit(1); }
