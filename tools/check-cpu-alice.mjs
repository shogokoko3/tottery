/**
 * シーズン2(不思議の国のアリス)を CPU が扱えるかの検査。
 *   node tools/check-cpu-alice.mjs
 *
 * - 決まった局面で、CPU がアリスの能力を正しい形で使う
 *   (バリアの駒を取りに行かない・アリスのAで入れ替えない・正体の見えない駒は先に確定する・
 *    チェシャ猫で騙す位置を付ける・王の帰還/仲間にする選択を待っている側が選ぶ・ハートの王でAを編成しない)
 * - いろいろな装備・王で CPU 同士に打たせ、止まらずに終わる
 * - CPU の装備にアリスのシリーズが入り、ストーリーと Bot は最初のシリーズのまま
 */
import assert from "node:assert/strict";
import { initialState, reducer, removePiece, endTurn } from "../src/game/reducer.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { enrichAction } from "../src/game/actions.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { cpuAction } from "../src/game/cpu.js";
import { buildDeck, emptyBoard } from "../src/game/board.js";
import { syncAlice, alive } from "../src/game/alice-rules.js";
import { aliceSetupFix } from "../src/game/cpu-alice.js";
import { ALICE_SKINS } from "../src/skins/alice.js";
import { SKINS } from "../src/skins/catalog.js";
import { createCpuLoadout, ensureCpuFoil } from "../src/skins/cpu-loadout.js";
import fs from "node:fs";

const ALICE_FOIL = Object.fromEntries(ALICE_SKINS.map((s) => [s.rank, s.rank === "A" ? s.id : `${s.id}:foil`]));

/** check-alice-gameplay.mjs と同じ小さな局面 */
function game(rank = "4", loadout = ALICE_FOIL) {
  let s = { ...initialState(), ruleVersion: GAME_RULE_VERSION, phase: "play", boardSize: 9, board: emptyBoard(9), currentTurn: 0, turnNo: 0,
    areaLoadouts: [loadout, {}], areasEnabled: true, log: [], setupEffects: null, clocks: [300000, 300000] };
  const ps = [["k", rank, 0, 6, 4, true], ["p", "2", 0, 6, 3, false], ["q", "3", 0, 7, 2, false], ["a", "A", 0, 8, 4, false],
    ["ek", "K", 1, 0, 4, true], ["ep", "2", 1, 2, 3, false], ["ea", "A", 1, 0, 0, false]];
  for (const [id, r, owner, row, col, isKing] of ps) {
    const p = { id, rank: r, owner, row, col, isKing, alive: true, revealed: false, suit: "heart", history: [] };
    s.pieces[id] = p;
    s.board[row][col] = p;
  }
  s.players = s.players.map((p, i) => ({ ...p, kingId: i ? "ek" : "k", armyRankCounts: { 2: 2, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, A: 1, J: 1, Q: 1, K: 1 } }));
  return syncAlice(s);
}
const run = (s, a) => reducer(s, enrichAction(a, s));

// グリフォンのバリアを張った駒を、CPU は取りに行かない
{
  let s = game("4", {});
  s.areaLoadouts = [{}, { K: "alice-6-gryphon" }];
  // 相手(席1)の王を4のグリフォンにして、バリアを張らせる
  s.pieces.ek = { ...s.pieces.ek, rank: "4" };
  s.board[0][4] = s.pieces.ek;
  s.areaLoadouts = [{}, { 4: "alice-6-gryphon" }];
  s.currentTurn = 1;
  s = syncAlice(s);
  s = run(s, { type: "ALICE_ACTION", kind: "king", player: 1 });
  assert.ok(s.pieces.ep.barrier, "バリアが張られる");
  s = endTurn(s);
  // 自分の2の目の前に相手の2(バリア)を置く
  s.board[2][3] = null;
  s.pieces.ep = { ...s.pieces.ep, row: 5, col: 3, revealed: true };
  s.board[5][3] = s.pieces.ep;
  s = syncAlice(s);
  for (let i = 0; i < 20; i++) {
    const a = cpuInformedAction(s, 0);
    assert.ok(!(a?.type === "MOVE_PIECE" && a.row === 5 && a.col === 3), "バリアの駒を取りに行かない");
    const b = cpuAction(s, 0);
    assert.ok(!(b?.type === "MOVE_PIECE" && b.row === 5 && b.col === 3), "基本のCPUもバリアの駒を取りに行かない");
  }
}

// アリスのAは入れ替えを使わない(数字の逆転を使うか、何もしない)
{
  const s = game("9", { A: "alice-A-alice" });
  for (let i = 0; i < 30; i++) {
    const a = cpuInformedAction(s, 0);
    assert.notEqual(a?.type, "__CPU_SHUFFLE", "アリスのAで入れ替えない");
    if (a?.type === "ALICE_ACTION" && a.kind === "reverse") {
      const next = run(s, a);
      assert.notEqual(next, s, "数字の逆転が受け付けられる");
    }
  }
}

// 自分の2・3を K・Q に逆転させるのは得なので、アリスのAは使う
{
  const s = game("9", { A: "alice-A-alice" });
  const a = cpuInformedAction(s, 0);
  assert.equal(a?.kind, "reverse", "得な逆転は使う");
  const next = run(s, a);
  assert.ok(["K", "Q"].includes(next.pieces[a.pickIds[0]].rank));
}

// イモムシで正体が見えなくなった駒は、先に「動かす」と確定してから動かす
{
  let s = game("7");
  s = run(s, { type: "ALICE_ACTION", kind: "king", player: 0 });
  s = endTurn(s);
  for (let guard = 0; guard < 6 && s.currentTurn === 1 && s.phase === "play"; guard++) {
    if (s.captureReveal) { s = reducer(s, { type: "DISMISS_CAPTURE" }); continue; }
    const a = cpuInformedAction(s, 1);
    assert.ok(a, "CPU は手を返す");
    const next = run(s, a);
    assert.notEqual(next, s, `受け付けられる手を返す: ${JSON.stringify(a)}`);
    s = next;
  }
  assert.ok(s.currentTurn === 0 || s.phase === "gameover", "手番を終えるまで進む");
}

// チェシャ猫の王は、騙す位置(空きマス)を付けて動かす
{
  let s = game("10");
  // 手番を使わない能力(アリスのAの逆転など)を先に使い終える
  for (let a = cpuInformedAction(s, 0); a?.type === "ALICE_ACTION"; a = cpuInformedAction(s, 0)) s = run(s, a);
  let faked = 0;
  for (let i = 0; i < 20; i++) {
    const a = cpuInformedAction(s, 0);
    if (a?.type !== "MOVE_PIECE") continue;
    if (a.fakeRow !== undefined) {
      faked++;
      assert.equal(s.board[a.fakeRow][a.fakeCol], null, "騙す位置は空きマス");
      assert.notEqual(run(s, a), s, "騙す手が受け付けられる");
    }
  }
  assert.ok(faked > 0, "騙す位置を使う");
}

// 王の帰還は、手番でなくても待っている側(CPU)が選ぶ
{
  let s = game("2");
  s = removePiece(s, "k", { by: "ep" });
  s = { ...s, currentTurn: 1 };
  const a = cpuInformedAction(s, 0);
  assert.equal(a?.kind, "revive");
  assert.ok(run(s, a).pieces.k.alive, "王が戻る");
  assert.equal(cpuInformedAction(s, 1), null, "相手は待つ");
}

// ハートの王で仲間にできる駒は、断らずに仲間にする
{
  let s = game("Q");
  s.pieces.ep = { ...s.pieces.ep, row: 5, col: 3 };
  s.board[2][3] = null;
  s.board[5][3] = s.pieces.ep;
  s = run(s, { type: "MOVE_PIECE", pieceId: "p", row: 5, col: 3, player: 0 });
  assert.ok(s.aliceRecruit?.length, "仲間にする選択が来る");
  const a = cpuInformedAction(s, 0);
  assert.equal(a?.kind, "recruit");
  s = run(s, a);
  assert.equal(s.board[a.row][a.col]?.owner, 0, "仲間にした駒が置かれる");
}

// ハートの王(J・Q・K)を王にする編成では、Aを外して別の札で埋める
{
  const s = { ...initialState(), phase: "setup", ruleVersion: GAME_RULE_VERSION, boardSize: 9, board: emptyBoard(9), areaLoadouts: [ALICE_FOIL, {}], setupIdx: 0, armySize: 9 };
  const ranks = ["Q", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  s.players[0].hand = ranks.map((rank, i) => ({ id: "c" + i, rank, suit: i % 2 ? "spade" : "heart" }));
  const placement = Object.fromEntries(ranks.slice(0, 9).map((_, i) => ["c" + i, { row: 6, col: i }]));
  const fixed = aliceSetupFix(s, 0, "c0", placement);
  assert.ok(!Object.keys(fixed).some((id) => s.players[0].hand.find((c) => c.id === id).rank === "A"), "Aを外す");
  assert.equal(Object.keys(fixed).length, 9, "枚数はそのまま");
  assert.equal(reducer(s, { type: "SETUP_CONFIRM", placement: fixed, kingId: "c0" }).setupDone[0], true, "布陣が通る");
}

// CPU の装備: 両方のシリーズが出る。ストーリーと Bot は最初のシリーズ
{
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const l = createCpuLoadout();
    const series = new Set(Object.values(l).map((id) => SKINS.find((s) => s.id === id.replace(/:foil$/, ""))?.series));
    assert.equal(series.size, 1, "1局の装備は1つのシリーズにそろう");
    seen.add([...series][0]);
  }
  assert.ok(seen.has("alice") && seen.has("heroes"), "アリスのシリーズも装備する");
  assert.ok(ensureCpuFoil({ 10: "alice-10-cheshire-cat" }, "10")[10].startsWith("alice-"), "フォイルも同じシリーズ");
  const screens = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  assert.ok(screens.includes('createCpuLoadout(Math.random, "heroes"), [stage.ranks[0]]'), "ストーリーは最初のシリーズ");
}

// いろいろな装備・王で CPU 同士に打たせ、止まらずに終わる
{
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const real = Math.random;
  Math.random = rnd;
  let finished = 0;
  const N = 120;
  for (let g = 0; g < N; g++) {
    const deck = buildDeck(null);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const loadouts = [createCpuLoadout(rnd, g % 2 ? "alice" : null), createCpuLoadout(rnd, g % 3 ? "alice" : "heroes")];
    let s = reducer({ phase: "intro" }, { type: "START_SETUP", size: 9, setupMode: "simultaneous", deck, areas: g % 4 !== 0, loadouts, ruleVersion: GAME_RULE_VERSION });
    const basic = g % 5 === 0; // 一部は基本の CPU でも打つ
    let guard = 0;
    while (s.phase !== "gameover" && guard++ < 1500) {
      if (s.captureReveal) { s = reducer(s, { type: "DISMISS_CAPTURE" }); continue; }
      if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
      if (s.setupEffects) { s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" }); continue; }
      if (s.phase === "dice") {
        s = run(s, s.dice[s.diceIdx] === null && s.diceIdx <= 1 ? { type: "ROLL_DICE_SINGLE" } : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : s.diceIdx === 3 ? { type: "REROLL_DICE" } : { type: "NEXT_DICE_STEP" });
        continue;
      }
      if (s.phase === "mulligan") { s = run(s, { type: "CONFIRM_MULLIGAN", discardIds: [] }); continue; }
      const cpu = (st, p) => (basic && p === 1 ? cpuAction(st, p) : cpuInformedAction(st, p));
      let a = null;
      if (s.phase === "setup") {
        for (const p of [0, 1]) if (!s.setupDone[p] && (a = cpu(s, p))) break;
      } else a = cpu(s, s.currentTurn) || cpu(s, 1 - s.currentTurn);
      assert.ok(a, `CPU が手を返す(局${g} ${s.phase} 手番${s.turnNo})`);
      if (a.type === "__CPU_SHUFFLE") {
        s = reducer(s, { type: "SELECT_PIECE", id: a.aceId });
        s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: a.pickIds[0] });
        s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: a.pickIds[1] });
        a = { type: "CONFIRM_SHUFFLE", aId: a.aceId, pickIds: a.pickIds };
      }
      const before = s;
      s = run(s, { ...a, elapsedMs: 3000 });
      if (s === before && process.env.DEBUG) {
        const p = a.player ?? 0;
        console.log(JSON.stringify({ loadout: loadouts[p], armySize: before.armySize, hand: before.players[p].hand.map((c) => c.id + ":" + c.rank) }));
      }
      assert.notEqual(s, before, `受け付けられない手で止まらない(局${g}): ${JSON.stringify(a)}`);
    }
    if (s.phase === "gameover") finished++;
    for (const p of alive(s)) assert.equal(s.board[p.row][p.col]?.id, p.id, "盤と駒の位置がそろう");
  }
  Math.random = real;
  assert.ok(finished >= N * 0.95, `ほとんどの対局が決着する(${finished}/${N})`);
}

console.log("CPU シーズン2: バリア・アリスのA・正体の確定・騙す位置・帰還・仲間・編成・装備・CPU同士の対局 OK");

// 相手に合わせた指し方(2026-10-16 の検証で入れた調整。reports/alice-tactics/検証レポート.md)
{
  const { KNOB_DEFAULTS, aliceAdaptScore, isCaucusCell } = await import("../src/game/cpu-alice.js");
  assert.equal(KNOB_DEFAULTS.encircleGuard, 1, "包囲の回避は王だけ");
  assert.equal(KNOB_DEFAULTS.encirclePieceGuard, 0, "駒まで三角形を避けると攻めが鈍る(検証で負けた)");
  assert.equal(KNOB_DEFAULTS.teaMax, 5, "ティーカップの召喚は増やさない(手番を失う)");
  assert.deepEqual([KNOB_DEFAULTS.mulliganFish, KNOB_DEFAULTS.mulliganFishValue], [4, 4], "引き直しは弱い札(値打ち4以下)を4枚まで釣りに出す");
  // 釣り: 構成に入らない札に加えて、構成の弱い札も捨てる。王・王と同じ数字・A は残す
  {
    const { strategicDiscards, chooseArmyPlan } = await import("../src/game/cpu-strategy.js");
    const { reducer } = await import("../src/game/reducer.js");
    const deck = buildDeck(null);
    const ids = {};
    for (const c of deck) (ids[c.rank] = ids[c.rank] || []).push(c);
    const hand = [ids["2"][0], ids["2"][1], ids["3"][0], ids["4"][0], ids["5"][0], ids["6"][0], ids["7"][0], ids["8"][0], ids["9"][0], ids["10"][0], ids.J[0], ids.Q[0], ids.A[0]];
    const rest = deck.filter((c) => !hand.includes(c));
    let st = reducer({ phase: "intro" }, { type: "START_SETUP", size: 9, setupMode: "simultaneous", deck: [...hand, ...rest], areas: true, loadouts: [ALICE_FOIL, {}], ruleVersion: GAME_RULE_VERSION });
    const plan = chooseArmyPlan(st, 0, "2");
    const thrown = strategicDiscards(st, 0, "2").map((id) => hand.find((c) => c.id === id).rank);
    assert.ok(thrown.length >= 7 && !thrown.includes("2") && !thrown.includes("A") && !thrown.includes("J") && !thrown.includes("Q"), `釣りの捨て札 ${thrown}`);
    assert.equal(plan.kingRank, "2");
    globalThis.TOTTERY_ALICE_CPU = { mulliganFish: 0 };
    assert.equal(strategicDiscards(st, 0, "2").length, 4, "釣りを切ると構成に入らない4枚だけ");
    delete globalThis.TOTTERY_ALICE_CPU;
  }
  assert.ok(KNOB_DEFAULTS.kingBonus["2"] >= 12 && KNOB_DEFAULTS.kingBonus["8"] >= 12 && KNOB_DEFAULTS.kingBonus.K < 0, "王は 2・8 を好み、K は好まない");
  assert.ok(isCaucusCell(4, 0) && isCaucusCell(1, 1) && !isCaucusCell(0, 0) && !isCaucusCell(3, 3), "コーカス・レースで回るマス");
  // 相手(席1)の駒3つが作る三角形の内側へ王を動かす手は減点。相手の A がアリスのスキン(逆転。包囲なし)なら減点しない
  let s = game("6", {});
  s.areaLoadouts = [{}, {}];
  s.board[6][4] = null; s.board[6][3] = null; s.board[7][2] = null;
  s.pieces.k = { ...s.pieces.k, row: 8, col: 4 }; s.board[8][4] = s.pieces.k;
  s.pieces.p = { ...s.pieces.p, row: 8, col: 0 }; s.board[8][0] = s.pieces.p;
  s.pieces.q = { ...s.pieces.q, row: 8, col: 8 }; s.board[8][8] = s.pieces.q;
  s.board[0][4] = null; s.board[2][3] = null; s.board[0][0] = null;
  s.pieces.ek = { ...s.pieces.ek, row: 2, col: 4 }; s.board[2][4] = s.pieces.ek;
  s.pieces.ep = { ...s.pieces.ep, row: 6, col: 0 }; s.board[6][0] = s.pieces.ep;
  s.pieces.ea = { ...s.pieces.ea, row: 6, col: 8 }; s.board[6][8] = s.pieces.ea;
  s = syncAlice(s);
  const inside = aliceAdaptScore(s, 0, s.pieces.k, { row: 5, col: 4 }, new Set());
  const outside = aliceAdaptScore(s, 0, s.pieces.k, { row: 8, col: 3 }, new Set());
  assert.ok(inside <= -30 && outside === 0, `王は三角形の内側を避ける ${inside} / ${outside}`);
  s.areaLoadouts = [{}, { A: "alice-A-alice" }];
  s = syncAlice(s);
  assert.equal(aliceAdaptScore(s, 0, s.pieces.k, { row: 5, col: 4 }, new Set()), 0, "相手の A がアリスなら包囲は無いので避けない");
}
console.log("CPU シーズン2: 相手に合わせた指し方(包囲の回避・調整の既定) OK");
