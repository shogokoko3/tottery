/**
 * 版18: サイコロと引き直しを両者同時に(2026-09-23 本人の指示)。
 *   - サイコロは各自が自分の目を振る。どちらが先でもよく、両方そろった時点で先手が決まる。同じ目なら振り直し
 *   - 席を名乗らない手(同じ端末の順番の画面)は今までどおり diceIdx の目を振る。NEXT_DICE_STEP は決まったあとは何もしない
 *   - 引き直しは両者が同時に選ぶ。予備札は GOTO_MULLIGAN で決定的に並べ、席0は前から・席1は後ろから引くので、
 *     確定がどちらの順で届いても手札と予備札は同じ。一人が引けるのは半分まで
 *   - 旧版(17以下)の対局は今までどおり(順番に振る・引き直しの並びは手に載せる)
 *   - 画面: オンライン・CPU 戦は同時の画面(20秒/1分で自動)。布陣中は先攻・後攻を出す
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState, reducer, DICE_LIMIT_MS, MULLIGAN_LIMIT_MS } from "../src/game/reducer.js";
import { GAME_RULE_VERSION, hasSimultaneousPrep } from "../src/game/rule-version.js";
import { seededShuffle } from "../src/game/reserve.js";
import { cpuAction } from "../src/game/cpu.js";

assert.equal(GAME_RULE_VERSION, 18);
assert.equal(hasSimultaneousPrep(18), true);
assert.equal(hasSimultaneousPrep(17), false);
assert.equal(DICE_LIMIT_MS, 20000);
assert.equal(MULLIGAN_LIMIT_MS, 60000);

const start = (ruleVersion) =>
  reducer(initialState(), { type: "START_SETUP", size: 5, setupMode: "simultaneous", handSize: 13, ruleVersion });

/* ---- サイコロ ---- */
{
  let s = start(18);
  assert.equal(s.phase, "dice");
  // 席1が先に振っても通る(順番が無い)
  s = reducer(s, { type: "ROLL_DICE_SINGLE", player: 1, value: 2 });
  assert.deepEqual(s.dice, [null, 2], "席1が先に振れる");
  assert.equal(s.diceIdx, 0, "まだ決まらない");
  // 同じ席は二度振れない
  assert.equal(reducer(s, { type: "ROLL_DICE_SINGLE", player: 1, value: 5 }), s, "二度は振れない");
  s = reducer(s, { type: "ROLL_DICE_SINGLE", player: 0, value: 6 });
  assert.deepEqual(s.dice, [6, 2]);
  assert.equal(s.diceIdx, 2, "両方そろった時点で決まる(NEXT は要らない)");
  assert.equal(s.firstPlayer, 0);
  assert.equal(reducer(s, { type: "NEXT_DICE_STEP" }), s, "決まったあとの NEXT は何もしない");
  assert.equal(reducer(s, { type: "ROLL_DICE_SINGLE", player: 1, value: 1 }), s, "決まったあとは振れない");
  // 同じ目 → 振り直し → また同時に
  let t = start(18);
  t = reducer(t, { type: "ROLL_DICE_SINGLE", player: 0, value: 4 });
  t = reducer(t, { type: "ROLL_DICE_SINGLE", player: 1, value: 4 });
  assert.equal(t.diceIdx, 3, "同じ目は振り直し待ち");
  t = reducer(t, { type: "REROLL_DICE" });
  assert.deepEqual(t.dice, [null, null]);
  t = reducer(t, { type: "ROLL_DICE_SINGLE", player: 1, value: 3 });
  t = reducer(t, { type: "ROLL_DICE_SINGLE", player: 0, value: 1 });
  assert.equal(t.firstPlayer, 1, "振り直し後も同時に振れる");
  // 席を名乗らない(同じ端末の順番の画面)は今までどおり
  let u = start(18);
  u = reducer(u, { type: "ROLL_DICE_SINGLE", value: 6 });
  assert.deepEqual(u.dice, [6, null]);
  u = reducer(u, { type: "NEXT_DICE_STEP" });
  assert.equal(u.diceIdx, 1, "順番の画面では NEXT で相手の番へ");
  u = reducer(u, { type: "ROLL_DICE_SINGLE", value: 2 });
  assert.equal(u.diceIdx, 2, "相手が振ればその場で決まる");
  assert.equal(reducer(u, { type: "NEXT_DICE_STEP" }).log.length, u.log.length, "NEXT で記録が重ならない");
  // 旧版は順番のまま(席1は先に振れない)
  let o = start(17);
  assert.equal(reducer(o, { type: "ROLL_DICE_SINGLE", player: 1, value: 2 }), o, "旧版で席1は先に振れない");
}

/* ---- 引き直し: 順に依らない ---- */
{
  const before = (() => {
    let s = start(18);
    s = reducer(s, { type: "ROLL_DICE_SINGLE", player: 0, value: 6 });
    return reducer(s, { type: "ROLL_DICE_SINGLE", player: 1, value: 2 });
  })();
  const base = reducer(before, { type: "GOTO_MULLIGAN" });
  assert.equal(base.phase, "mulligan");
  assert.deepEqual(base.mulliganDone, [false, false]);
  // 予備札は GOTO で決定的に並べ替えてある(同じ山札・同じ seed なら同じ並び)
  const expect = seededShuffle(before.reserve, before.reserveShuffleState);
  assert.deepEqual(base.reserve.map((c) => c.id), expect.cards.map((c) => c.id), "予備札の並びは seed から決まる");
  const d0 = base.players[0].hand.slice(0, 2).map((c) => c.id);
  const d1 = base.players[1].hand.slice(0, 3).map((c) => c.id);
  const ab = reducer(reducer(base, { type: "CONFIRM_MULLIGAN", player: 0, discardIds: d0 }), { type: "CONFIRM_MULLIGAN", player: 1, discardIds: d1 });
  const ba = reducer(reducer(base, { type: "CONFIRM_MULLIGAN", player: 1, discardIds: d1 }), { type: "CONFIRM_MULLIGAN", player: 0, discardIds: d0 });
  assert.equal(ab.phase, "setup");
  assert.equal(ba.phase, "setup");
  const hands = (s) => s.players.map((p) => p.hand.map((c) => c.id).sort().join(","));
  assert.deepEqual(hands(ab), hands(ba), "確定の順が違っても手札は同じ");
  assert.deepEqual(ab.reserve.map((c) => c.id), ba.reserve.map((c) => c.id), "予備札も同じ");
  assert.equal(ab.players[0].hand.length, 13);
  assert.equal(ab.players[1].hand.length, 13);
  // 席0は前から、席1は後ろから
  assert.deepEqual(ab.players[0].hand.slice(-2).map((c) => c.id), base.reserve.slice(0, 2).map((c) => c.id), "席0は前から引く");
  assert.deepEqual(ab.players[1].hand.slice(-3).map((c) => c.id), base.reserve.slice(-3).map((c) => c.id), "席1は後ろから引く");
  // 一人は半分まで(手札20枚・予備札12枚の対局で、7枚は引けない)
  {
    let s = reducer(initialState(), { type: "START_SETUP", size: 5, setupMode: "simultaneous", handSize: 20, ruleVersion: 18 });
    s = reducer(s, { type: "ROLL_DICE_SINGLE", player: 0, value: 6 });
    s = reducer(s, { type: "ROLL_DICE_SINGLE", player: 1, value: 2 });
    s = reducer(s, { type: "GOTO_MULLIGAN" });
    const half = Math.floor(s.reserve.length / 2);
    assert.equal(half, 6);
    const tooMany = s.players[0].hand.slice(0, half + 1).map((c) => c.id);
    assert.equal(reducer(s, { type: "CONFIRM_MULLIGAN", player: 0, discardIds: tooMany }), s, "半分を超えては引けない");
    const okMany = s.players[0].hand.slice(0, half).map((c) => c.id);
    assert.equal(reducer(s, { type: "CONFIRM_MULLIGAN", player: 0, discardIds: okMany }).mulliganDone[0], true, "半分ちょうどは引ける");
  }
  // 二度は確定できない
  const once = reducer(base, { type: "CONFIRM_MULLIGAN", player: 0, discardIds: [] });
  assert.equal(once.mulliganDone[0], true);
  assert.equal(reducer(once, { type: "CONFIRM_MULLIGAN", player: 0, discardIds: d0 }), once, "二度目は通らない");
  // 席を名乗る選択は自分の手札に効く
  const picked = reducer(base, { type: "TOGGLE_MULLIGAN_CARD", player: 1, cardId: base.players[1].hand[0].id });
  assert.deepEqual(picked.players[1]._mulliganSelected, [base.players[1].hand[0].id]);
  assert.equal(picked.players[0]._mulliganSelected, undefined);
  // 順番の画面(名乗り無し)でも今までどおり進む
  let seq = reducer(base, { type: "CONFIRM_MULLIGAN", discardIds: [] });
  assert.equal(seq.phase, "mulligan");
  seq = reducer(seq, { type: "CONFIRM_MULLIGAN", discardIds: [] });
  assert.equal(seq.phase, "setup", "名乗り無しの2回で布陣へ");
  // 通信の手に並びは要らない(旧版は要る)
  const netOk = reducer(base, { type: "CONFIRM_MULLIGAN", player: 0, discardIds: [] });
  assert.notEqual(netOk, base, "版18は reserveOrder 無しで通る");
}

/* ---- CPU は自分の分をすぐ済ませる ---- */
{
  let s = start(18);
  const roll = cpuAction(s, 1);
  assert.equal(roll?.type, "ROLL_DICE_SINGLE", "CPU は順番を待たずに振る");
  assert.equal(roll.player, 1);
  s = reducer(s, { ...roll, value: 3 });
  assert.equal(cpuAction(s, 1), null, "振ったあとは待つ");
  s = reducer(s, { type: "ROLL_DICE_SINGLE", player: 0, value: 5 });
  s = reducer(s, { type: "GOTO_MULLIGAN" });
  const m = cpuAction(s, 1);
  assert.equal(m?.type, "CONFIRM_MULLIGAN");
  assert.equal(m.player, 1);
  assert.ok(m.discardIds.length <= Math.floor(s.reserve.length / 2), "半分まで");
  s = reducer(s, m);
  assert.equal(cpuAction(s, 1), null, "確定したら待つ");
}

/* ---- 配線 ---- */
{
  const game = readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
  assert.ok(/const simPrep = hasSimultaneousPrep\(a\.ruleVersion\) && !!\(network \|\| cpu\) && !tutorial;/.test(game), "同時の画面はオンライン・CPU 戦(チュートリアルは順番のまま)");
  assert.ok(/y\(\{ type: "ROLL_DICE_SINGLE", player: prepSeat \}\)/.test(game), "時間切れで自分の目を振る");
  assert.ok(/y\(\{ type: "CONFIRM_MULLIGAN", player: prepSeat \}\)/.test(game), "時間切れで選んでいる札のまま確定");
  assert.ok(/if \(network && p !== 0\) return;/.test(game) && /y\(\{ type: "GOTO_MULLIGAN" \}\)/.test(game), "目がそろったあとはホストが進める");
  assert.ok(/<DiceDuo/.test(game) && /<MatchupBar viewer=\{me\} \/>/.test(game), "同時のサイコロと、引き直しに相手の名前・称号");
  const dice = readFileSync(new URL("../src/ui/dice.jsx", import.meta.url), "utf8");
  assert.ok(/export function DiceDuo\(/.test(dice) && /振る残り時間/.test(dice), "両者のサイコロと残り時間");
  const setup = readFileSync(new URL("../src/ui/setup.jsx", import.meta.url), "utf8");
  assert.ok(/export function SetupOrderNote\(/.test(setup) && /あなたは先攻/.test(setup) && /あなたは後攻/.test(setup), "布陣中に先攻・後攻");
  assert.equal((setup.match(/<SetupOrderNote state=\{state\} pIdx=\{pIdx\} \/>/g) || []).length, 2, "配置と王選びの両方に出す");
  const sync = readFileSync(new URL("../src/net/sync.js", import.meta.url), "utf8").replace(/\s+/g, " ");
  assert.ok(/const who = action\.player === 0 \|\| action\.player === 1 \? action\.player : state\.mulliganIdx;/.test(sync), "送る前に自分の席の選択を畳む");
}

console.log("版18 同時のサイコロ・引き直し: 順に依らない・半分まで・旧版そのまま・CPU・配線 OK");
