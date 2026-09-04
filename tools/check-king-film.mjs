/**
 * 王を取ったときの演出の検査。
 *
 * ・ふだんは、伏せたままの駒で取っても相手の画面には流さない(正体が漏れる)
 * ・王を取った手だけは、伏せたままでも相手に見せる
 * ・王の2・3なら跡継ぎが立つので、取った側の映像のあとに継承の映像が続く
 */
import assert from "node:assert/strict";
import { initialState, reducer } from "../src/game/reducer.js";
import { emptyBoard } from "../src/game/board.js";
import { captureFilm, filmsFor, successionFilm } from "../src/skins/events.js";

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

/** 盤を組む。cards は [id, 数字, 持ち主, 行, 列, 王か] */
function build(cards) {
  const s = initialState();
  s.phase = "play";
  s.setupMode = "simultaneous";
  s.board = emptyBoard(5);
  for (const [id, rank, owner, row, col, isKing] of cards) {
    const p = {
      id,
      rank,
      owner,
      row,
      col,
      isKing,
      suit: "spade",
      alive: true,
      revealed: false,
      history: [],
    };
    s.board[row][col] = p;
    s.pieces[id] = p;
    if (isKing) s.players[owner].kingId = id;
  }
  return s;
}
const move = (s, id, row, col) => reducer(s, { type: "MOVE_PIECE", pieceId: id, row, col });
const name = (v) => (v ? v.name : null);

// 攻める側は 0 番、6 に「翠樹の射手」。守る側は 1 番、2 に「墓守のレヴナント」
const loadouts = [{ 6: "elf-male" }, { 2: "zombie-male", 3: "zombie-female" }];

console.log("ふだんの取り(王ではない)");
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["foe", "8", 1, 2, 2, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "K", 1, 0, 4, true],
  ]);
  const after = move(before, "elf", 2, 2);
  t("取った本人には流れる", name(captureFilm(before, after, loadouts, 0)) === "翠樹の射手");
  t("伏せたままなら相手には流れない", captureFilm(before, after, loadouts, 1) === null);
  t("継承の映像は無い", successionFilm(before, after, loadouts) === null);
  t("流すのは1本だけ", filmsFor(before, after, loadouts, 0).length === 1);
  t("相手の画面では0本", filmsFor(before, after, loadouts, 1).length === 0);
}

console.log("\n王(K)を取って決着したとき");
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "K", 1, 2, 2, true],
  ]);
  const after = move(before, "elf", 2, 2);
  t("決着している", after.winner === 0);
  t("取った本人に流れる", name(captureFilm(before, after, loadouts, 0)) === "翠樹の射手");
  t(
    "伏せたままでも相手に流れる",
    name(captureFilm(before, after, loadouts, 1)) === "翠樹の射手",
  );
  t("継承の映像は流さない", successionFilm(before, after, loadouts) === null);
  t("どちらの画面でも1本", filmsFor(before, after, loadouts, 1).length === 1);
}

console.log("\n王の2を取って、跡継ぎが1枚だけのとき");
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "2", 1, 2, 2, true],
    ["heir", "2", 1, 0, 4, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t("決着していない", after.winner === null || after.winner === undefined);
  t("跡継ぎが王になった", after.players[1].kingId === "heir");
  t("取った側の映像", name(captureFilm(before, after, loadouts, 1)) === "翠樹の射手");
  t(
    "継承の映像は取られた側のスキン",
    name(successionFilm(before, after, loadouts)) === "墓守のレヴナント",
  );
  const both = filmsFor(before, after, loadouts, 1);
  t("2本流れる", both.length === 2);
  t("順番は 取った側 → 継承", both[0].name === "翠樹の射手" && both[1].name === "墓守のレヴナント");
  t("どちらの画面でも同じ2本", filmsFor(before, after, loadouts, 0).length === 2);
}

console.log("\n王の3を取って、跡継ぎを選ぶとき");
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "3", 1, 2, 2, true],
    ["h1", "3", 1, 0, 3, false],
    ["h2", "3", 1, 0, 4, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t("選ばせる状態になる", after.pendingKingChoice?.owner === 1);
  t(
    "選ぶ前でも継承の映像は流れる",
    name(successionFilm(before, after, loadouts)) === "黄昏のレヴナント",
  );
  t("2本流れる", filmsFor(before, after, loadouts, 1).length === 2);
}

console.log("\n跡継ぎがいないとき(2の王だが他に2が無い)");
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "2", 1, 2, 2, true],
  ]);
  const after = move(before, "elf", 2, 2);
  t("決着している", after.winner === 0);
  t("継承の映像は流さない", successionFilm(before, after, loadouts) === null);
  t("取った側の映像だけ", filmsFor(before, after, loadouts, 1).length === 1);
}

console.log("\nスキンを着けていないとき");
{
  const bare = [{}, {}];
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "2", 1, 2, 2, true],
    ["heir", "2", 1, 0, 4, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t("何も流れない", filmsFor(before, after, bare, 1).length === 0);
  const onlyDefender = [{}, { 2: "zombie-male" }];
  t(
    "取った側だけ未装備なら、継承の1本だけ",
    filmsFor(before, after, onlyDefender, 1).length === 1 &&
      name(successionFilm(before, after, onlyDefender)) === "墓守のレヴナント",
  );
}

console.log("\n二重に流さない");
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "2", 1, 2, 2, true],
    ["heir", "2", 1, 0, 4, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t("同じ盤をもう一度描いても流さない", filmsFor(after, { ...after }, loadouts, 1).length === 0);
  t("取っていない手では流さない", filmsFor(before, reducer(before, { type: "SELECT_PIECE", id: "elf" }), loadouts, 1).length === 0);
}

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
