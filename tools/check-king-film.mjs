/**
 * 王を取ったときの演出の検査。
 *
 * ・ふだんは、伏せたままの駒で取っても相手の画面には流さない(正体が漏れる)
 * ・王を取った手だけは、伏せたままでも相手に見せる
 * ・王の2・3なら跡継ぎが立つので、取った側の映像のあとに継承の映像が続く
 * ・新公開の相手駒と道連れ・継承の映像は、撃破札を確認したあとに見せる
 */
import assert from "node:assert/strict";
import { initialState, reducer } from "../src/game/reducer.js";
import { emptyBoard } from "../src/game/board.js";
import {
  captureFilm,
  filmPlanFor,
  filmQueueState,
  filmsFor,
  revengeFilm,
  successionFilm,
} from "../src/skins/events.js";

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
const move = (s, id, row, col) =>
  reducer(s, { type: "MOVE_PIECE", pieceId: id, row, col });
const name = (v) => (v ? v.name : null);

// 攻める側は 0 番、6 に「翠樹の射手」。守る側は 1 番、2 に「墓守のレヴナント」
const loadouts = [
  { 6: "elf-male" },
  {
    2: "zombie-male",
    3: "zombie-female",
    4: "pirate-male",
    5: "pirate-female",
  },
];

console.log("ふだんの取り(王ではない)");
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["foe", "8", 1, 2, 2, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "K", 1, 0, 4, true],
  ]);
  const after = move(before, "elf", 2, 2);
  t(
    "取った本人には流れる",
    name(captureFilm(before, after, loadouts, 0)) === "翠樹の射手",
  );
  t(
    "伏せたままなら相手には流れない",
    captureFilm(before, after, loadouts, 1) === null,
  );
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
  t(
    "取った本人に流れる",
    name(captureFilm(before, after, loadouts, 0)) === "翠樹の射手",
  );
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
  t(
    "取った側の映像",
    name(captureFilm(before, after, loadouts, 1)) === "翠樹の射手",
  );
  t(
    "継承の映像は取られた側のスキン",
    name(successionFilm(before, after, loadouts)) === "墓守のレヴナント",
  );
  const both = filmsFor(before, after, loadouts, 1);
  t("2本流れる", both.length === 2);
  t(
    "順番は 取った側 → 継承",
    both[0].name === "翠樹の射手" && both[1].name === "墓守のレヴナント",
  );
  t(
    "どちらの画面でも同じ2本",
    filmsFor(before, after, loadouts, 0).length === 2,
  );
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
  t(
    "同じ盤をもう一度描いても流さない",
    filmsFor(after, { ...after }, loadouts, 1).length === 0,
  );
  t(
    "取っていない手では流さない",
    filmsFor(
      before,
      reducer(before, { type: "SELECT_PIECE", id: "elf" }),
      loadouts,
      1,
    ).length === 0,
  );
}

console.log("\n王を討った駒は名乗りを上げる(決まり)");
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "K", 1, 2, 2, true],
  ]);
  t("討つ前は伏せている", before.pieces.elf.revealed === false);
  const after = move(before, "elf", 2, 2);
  t("討った駒が表になる", after.pieces.elf.revealed === true);
  t("盤の上でも表になっている", after.board[2][2].revealed === true);
  t("めくる演出の相手が分かる", after.lastReveal?.id === "elf");
  t(
    "行動の記録に残る",
    after.pieces.elf.history.includes("王を討って名乗りを上げた"),
  );
  t(
    "対局の記録に名乗りが出る",
    after.log.some((l) => l.includes("名乗りを上げた")),
  );
  t("相手の駒は表にならない", after.pieces.k0.revealed === false);
}
{
  // 王でない駒を取っただけなら、名乗らない
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["foe", "8", 1, 2, 2, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "K", 1, 0, 4, true],
  ]);
  const after = move(before, "elf", 2, 2);
  t("ふだんの取りでは伏せたまま", after.pieces.elf.revealed === false);
  t("めくる相手も立たない", !after.lastReveal);
}
{
  // 2の王を討ったときも名乗る(対局は続く)
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "2", 1, 2, 2, true],
    ["heir", "2", 1, 0, 4, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t("対局が続いても名乗る", after.pieces.elf.revealed === true);
  t("跡継ぎは伏せたまま", after.pieces.heir.revealed === false);
  t("跡継ぎが王になっている", after.players[1].kingId === "heir");
}
{
  // すでに表だった駒を二度めくらない
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "K", 1, 2, 2, true],
  ]);
  before.pieces.elf.revealed = true;
  before.board[3][1].revealed = true;
  const after = move(before, "elf", 2, 2);
  t("もとから表なら演出は立てない", !after.lastReveal);
  t("表のままである", after.pieces.elf.revealed === true);
}

console.log("\n名乗るので、相手の画面にも映像が流れる");
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "2", 1, 2, 2, true],
    ["heir", "2", 1, 0, 4, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t(
    "映像の側に例外を置かなくても相手に流れる",
    name(captureFilm(before, after, loadouts, 1)) === "翠樹の射手",
  );
  t(
    "スキンの有無で正体の割れ方が変わらない",
    after.pieces.elf.revealed === true,
  );
}

console.log("\n道連れ(4・5の効果)の映像");
{
  // 王が4。王以外の4が取られると、取った相手も道連れになる
  const before = build([
    ["k0", "K", 0, 4, 0, true],
    ["four", "4", 1, 2, 2, false],
    ["k1", "4", 1, 0, 4, true],
    ["elf", "6", 0, 3, 1, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t(
    "道連れの印が立つ",
    after.lastRevenge?.rank === "4" && after.lastRevenge?.owner === 1,
  );
  t("取った駒も倒れている", after.pieces.elf.alive === false);
  t(
    "取られた側の4のスキンが流れる",
    name(revengeFilm(before, after, loadouts)) === "黒潮の船長",
  );
  const both = filmsFor(before, after, loadouts, 0);
  t("2本流れる", both.length === 2);
  t(
    "順番は 取った側 → 道連れ",
    both[0].name === "翠樹の射手" && both[1].name === "黒潮の船長",
  );
  // 道連れに巻き込まれた駒は倒れて札置き場に並ぶので、正体はその場で公になる。
  // 伏せたままでも隠す意味がないので、両方の画面に2本とも流す
  {
    const foeSide = filmsFor(before, after, loadouts, 1);
    t("取られた側にも2本とも流れる", foeSide.length === 2);
    t(
      "順番も同じ",
      foeSide[0].name === "翠樹の射手" && foeSide[1].name === "黒潮の船長",
    );
    t("巻き込まれた駒は倒れている", after.pieces.elf.alive === false);
  }
  {
    // 取った駒がもう表なら、相手にも2本流れる
    const shown = build([
      ["k0", "K", 0, 4, 0, true],
      ["four", "4", 1, 2, 2, false],
      ["k1", "4", 1, 0, 4, true],
      ["elf", "6", 0, 3, 1, false],
    ]);
    shown.pieces.elf.revealed = true;
    shown.board[3][1].revealed = true;
    const done = move(shown, "elf", 2, 2);
    t(
      "取った駒が表なら相手にも2本",
      filmsFor(shown, done, loadouts, 1).length === 2,
    );
  }
  t(
    "同じ盤をもう一度描いても流さない",
    revengeFilm(after, { ...after }, loadouts) === null,
  );
  t(
    "印が残ったままの次の手では流さない",
    revengeFilm(after, { ...after, seq: 99 }, loadouts) === null,
  );
}
{
  // 王が4でも、取られたのが5なら道連れは起きない
  const before = build([
    ["k0", "K", 0, 4, 0, true],
    ["five", "5", 1, 2, 2, false],
    ["k1", "4", 1, 0, 4, true],
    ["elf", "6", 0, 3, 1, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t("数字が違えば道連れなし", !after.lastRevenge);
  t("映像も流れない", revengeFilm(before, after, loadouts) === null);
}
{
  // 王が6なら、4を取られても道連れは起きない
  const before = build([
    ["k0", "K", 0, 4, 0, true],
    ["four", "4", 1, 2, 2, false],
    ["k1", "6", 1, 0, 4, true],
    ["elf", "6", 0, 3, 1, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t("王が別の数字なら道連れなし", !after.lastRevenge);
}
{
  // スキンを着けていなければ流れない
  const before = build([
    ["k0", "K", 0, 4, 0, true],
    ["four", "4", 1, 2, 2, false],
    ["k1", "4", 1, 0, 4, true],
    ["elf", "6", 0, 3, 1, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t("未装備なら流れない", revengeFilm(before, after, [{}, {}]) === null);
  t(
    "取った側が未装備でも道連れの1本は流れる",
    filmsFor(before, after, [{}, { 4: "pirate-male" }], 0).length === 1,
  );
}

console.log("\n2・3 は継承、4・5 は道連れ。効果が出たときに流れる");
{
  const before = build([
    ["k0", "K", 0, 4, 0, true],
    ["k1", "2", 1, 2, 2, true],
    ["heir", "2", 1, 0, 4, false],
    ["elf", "6", 0, 3, 1, false],
  ]);
  const after = move(before, "elf", 2, 2);
  t(
    "2の王を討つと継承の映像",
    name(successionFilm(before, after, loadouts)) === "墓守のレヴナント",
  );
  t("道連れは起きない", revengeFilm(before, after, loadouts) === null);
}

console.log("\n2〜5 は取っても流さない(効果のときだけ)");
{
  const all = {
    2: "zombie-male",
    3: "zombie-female",
    4: "pirate-male",
    5: "pirate-female",
    6: "elf-male",
    7: "elf-female",
    8: "viking-male",
    9: "viking-female",
  };
  const mine = [all, {}];
  const shot = (rank) => {
    const before = build([
      ["me", rank, 0, 3, 1, false],
      ["foe", "8", 1, 2, 2, false],
      ["k0", "K", 0, 4, 0, true],
      ["k1", "K", 1, 0, 4, true],
    ]);
    before.pieces.me.revealed = true;
    before.board[3][1].revealed = true;
    return captureFilm(before, move(before, "me", 2, 2), mine, 1);
  };
  for (const r of ["2", "3", "4", "5"])
    t(`${r} が取っても流れない`, shot(r) === null);
  for (const r of ["6", "7", "8", "9"])
    t(`${r} が取ると流れる`, shot(r) !== null);
}
{
  // 2〜5 が王を討ったときも、取った側の映像は流さない。
  // 名乗り(表になる決まり)はそのまま働く
  const before = build([
    ["four", "4", 0, 3, 2, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "K", 1, 2, 2, true],
  ]);
  const after = move(before, "four", 2, 2);
  t(
    "王を討っても4の映像は流れない",
    captureFilm(before, after, [{ 4: "pirate-male" }, {}], 1) === null,
  );
  t("名乗りは働く", after.pieces.four.revealed === true);
  t(
    "流れる映像は無い",
    filmsFor(before, after, [{ 4: "pirate-male" }, {}], 1).length === 0,
  );
}

console.log("\nKの王の予備札は表向きで出る");
{
  // 王がK。自分の J が取られると予備札を1枚引ける
  const before = build([
    ["k0", "K", 0, 4, 0, true],
    ["jack", "J", 0, 3, 2, false],
    ["k1", "K", 1, 0, 4, true],
    ["foe", "8", 1, 2, 2, false],
  ]);
  before.reserve = [{ id: "spare", rank: "9", suit: "heart" }];
  // 相手の番にして、こちらの J を取らせる
  before.currentTurn = 1;
  const taken = move(before, "foe", 3, 2);
  t("予備札が来ている", taken.kPlacement?.owner === 0);
  t("引いた札が控えている", taken.kPlacement?.card.id === "spare");
  const placed = reducer(taken, { type: "PLACE_RESERVE_CARD", row: 4, col: 4 });
  t("盤に出る", placed.pieces.spare?.alive === true);
  t("表向きで出る", placed.pieces.spare?.revealed === true);
  t("盤の上でも表", placed.board[4][4]?.revealed === true);
  t("めくる演出に乗る", placed.lastReveal?.id === "spare");
  t(
    "行動の記録に残る",
    placed.pieces.spare.history.includes("予備札から表向きに出撃"),
  );
  t(
    "対局の記録に数字が出る",
    placed.log.some((l) => l.includes("9♥") && l.includes("公開")),
  );
  t("他の駒は伏せたまま", placed.pieces.k0.revealed === false);
  t(
    "出さずに見送れる",
    reducer(taken, { type: "SKIP_RESERVE_PLACEMENT" }).kPlacement === null,
  );
}

console.log("\n撃破札の公開と映像の順序");
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "K", 1, 2, 2, true],
  ]);
  const after = move(before, "elf", 2, 2);
  const foePlan = filmPlanFor(before, after, loadouts, 1);
  t(
    "王撃破で新公開の相手の攻撃映像は延期",
    foePlan.length === 1 && foePlan[0].afterReveal,
  );
  t("延期しても映像自体は残す", foePlan[0].skin.id === "elf-male");
  const waiting = filmQueueState(foePlan, { revealPending: true });
  t("公開待ちでは映像を表示しない", waiting.active === null);
  t("公開待ちはbusyにせず撃破札を開ける", waiting.busy === false);
  const ready = filmQueueState(foePlan, { revealPending: false });
  t(
    "撃破札の確認後に映像を開始する",
    ready.busy && ready.active === foePlan[0],
  );
  const ownPlan = filmPlanFor(before, after, loadouts, 0);
  t(
    "自分の攻撃映像は従来タイミング",
    ownPlan.length === 1 && !ownPlan[0].afterReveal,
  );
  t(
    "自分の攻撃映像は撃破札より前に開始できる",
    filmQueueState(ownPlan, { revealPending: true }).busy,
  );
  const acknowledged = reducer(after, { type: "DISMISS_CAPTURE" });
  t(
    "撃破札を閉じる際に同じ映像を新規発火しない",
    filmPlanFor(after, acknowledged, loadouts, 1).length === 0,
  );
  t(
    "再描画でも計画を再発火しない",
    filmPlanFor(after, { ...after }, loadouts, 1).length === 0,
  );

  before.pieces.elf.revealed = true;
  const shownAfter = move(before, "elf", 2, 2);
  const shownPlan = filmPlanFor(before, shownAfter, loadouts, 1);
  t(
    "以前から公開の相手の映像は延期しない",
    shownPlan.length === 1 && !shownPlan[0].afterReveal,
  );
}
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["foe", "8", 1, 2, 2, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "K", 1, 0, 4, true],
  ]);
  const after = move(before, "elf", 2, 2);
  t(
    "通常捕獲の未公開相手は延期列にも入れない",
    filmPlanFor(before, after, loadouts, 1).length === 0,
  );
  const ownPlan = filmPlanFor(before, after, loadouts, 0);
  t(
    "通常捕獲の自分の映像は即時",
    ownPlan.length === 1 && !ownPlan[0].afterReveal,
  );
}
{
  const before = build([
    ["elf", "6", 0, 3, 1, false],
    ["k0", "K", 0, 4, 0, true],
    ["k1", "2", 1, 2, 2, true],
    ["heir", "2", 1, 0, 4, false],
  ]);
  const after = move(before, "elf", 2, 2);
  const ownPlan = filmPlanFor(before, after, loadouts, 0);
  t(
    "自分の攻撃→公開待ちの継承",
    ownPlan.length === 2 && !ownPlan[0].afterReveal && ownPlan[1].afterReveal,
  );
  t("継承の映像の順番を維持", ownPlan[1].skin.id === "zombie-male");
  const afterAttack = ownPlan.slice(1);
  t(
    "攻撃映像を終了・スキップすると撃破札を開ける",
    !filmQueueState(afterAttack, { revealPending: true }).busy,
  );
  t(
    "継承は撃破札のあとに始まる",
    filmQueueState(afterAttack, { revealPending: false }).active ===
      afterAttack[0],
  );
  const foePlan = filmPlanFor(before, after, loadouts, 1);
  t(
    "相手の新公開攻撃→継承は両方延期",
    foePlan.length === 2 && foePlan.every((entry) => entry.afterReveal),
  );
  t(
    "相手にも攻撃→継承の順",
    foePlan[0].skin.id === "elf-male" && foePlan[1].skin.id === "zombie-male",
  );
  const paused = filmQueueState(foePlan, {
    revealPending: false,
    paused: true,
  });
  t("他演出中は映像を重ねない", paused.active === null);
  t("他演出待ちでも再生可能な列はbusyを保つ", paused.busy);
  t(
    "空の列は公開後もbusyを残さない",
    !filmQueueState([], { revealPending: false }).busy,
  );
}
{
  const before = build([
    ["k0", "K", 0, 4, 0, true],
    ["four", "4", 1, 2, 2, false],
    ["k1", "4", 1, 0, 4, true],
    ["elf", "6", 0, 3, 1, false],
  ]);
  const after = move(before, "elf", 2, 2);
  const foePlan = filmPlanFor(before, after, loadouts, 1);
  t(
    "道連れで新公開の相手の攻撃→道連れも延期",
    foePlan.length === 2 && foePlan.every((entry) => entry.afterReveal),
  );
  t(
    "延期後も攻撃→道連れの順",
    foePlan[0].skin.id === "elf-male" && foePlan[1].skin.id === "pirate-male",
  );
  const ownPlan = filmPlanFor(before, after, loadouts, 0);
  t(
    "自分の攻撃は即時・道連れは公開後",
    !ownPlan[0].afterReveal && ownPlan[1].afterReveal,
  );
  assert.deepEqual(
    filmsFor(before, after, loadouts, 1),
    foePlan.map(({ skin }) => skin),
  );
}

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
