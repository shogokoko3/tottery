/**
 * 版18: サイコロと引き直しを両者同時に(2026-09-23 本人の指示)。
 *   - サイコロは各自が自分の目を振る。どちらが先でもよく、両方そろった時点で先手が決まる。同じ目なら振り直し
 *   - 席を名乗らない手(同じ端末の順番の画面)は今までどおり diceIdx の目を振る。NEXT_DICE_STEP は決まったあとは何もしない
 *   - 引き直しは版18でも先攻→後攻の順(本人の指示)。各1分で、切れたら選んでいる札のまま確定
 *   - 旧版(17以下)の対局は今までどおり(順番に振る・引き直しの並びは手に載せる)
 *   - 画面: オンライン・CPU 戦は同時の画面(20秒/1分で自動)。布陣中は先攻・後攻を出す
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState, reducer, DICE_LIMIT_MS, MULLIGAN_LIMIT_MS } from "../src/game/reducer.js";
import { GAME_RULE_VERSION, hasSimultaneousPrep } from "../src/game/rule-version.js";

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

/* ---- 引き直し: 先攻→後攻の順(版18でも同じ。2026-09-23 本人の指示) ---- */
{
  let base = start(18);
  base = reducer(base, { type: "ROLL_DICE_SINGLE", player: 0, value: 2 });
  base = reducer(base, { type: "ROLL_DICE_SINGLE", player: 1, value: 6 });
  base = reducer(base, { type: "GOTO_MULLIGAN" });
  assert.equal(base.phase, "mulligan");
  assert.equal(base.firstPlayer, 1);
  assert.equal(base.mulliganIdx, 1, "先攻(席1)から引き直す");
  const order = (s) => s.reserve.map((c) => c.id);
  // 後攻は先攻より先に確定できない(通信の手は席を名乗る)
  const early = reducer(base, { type: "CONFIRM_MULLIGAN", player: 0, discardIds: [], reserveOrder: order(base) });
  assert.equal(early, base, "後攻は先に引き直せない");
  // 先攻が確定 → 後攻の番
  const d1 = base.players[1].hand.slice(0, 2).map((c) => c.id);
  let s = reducer(base, { type: "CONFIRM_MULLIGAN", player: 1, discardIds: d1, reserveOrder: order(base) });
  assert.equal(s.mulliganIdx, 0, "次は後攻");
  assert.equal(s.players[1].hand.length, 13);
  assert.equal(s.reserve.length, base.reserve.length - 2, "先攻が引いたぶん予備札が減る");
  // 通信の手には並び(reserveOrder)が要る(今までどおり)
  assert.equal(reducer(s, { type: "CONFIRM_MULLIGAN", player: 0, discardIds: [] }), s, "並びの無い通信の手は通らない");
  s = reducer(s, { type: "CONFIRM_MULLIGAN", player: 0, discardIds: [], reserveOrder: order(s) });
  assert.equal(s.phase, "setup", "後攻が確定すると布陣へ");
  // 選択は番の席の手札に効く
  const picked = reducer(base, { type: "TOGGLE_MULLIGAN_CARD", cardId: base.players[1].hand[0].id });
  assert.deepEqual(picked.players[1]._mulliganSelected, [base.players[1].hand[0].id]);
}

/* ---- CPU: サイコロはすぐ振り、引き直しは自分の番を待つ ---- */
{
  let s = start(18);
  const roll = cpuAction(s, 1);
  assert.equal(roll?.type, "ROLL_DICE_SINGLE", "CPU は順番を待たずに振る");
  assert.equal(roll.player, 1);
  s = reducer(s, { ...roll, value: 3 });
  assert.equal(cpuAction(s, 1), null, "振ったあとは待つ");
  s = reducer(s, { type: "ROLL_DICE_SINGLE", player: 0, value: 5 });
  s = reducer(s, { type: "GOTO_MULLIGAN" });
  assert.equal(s.mulliganIdx, 0, "先攻は席0");
  assert.equal(cpuAction(s, 1), null, "後攻の CPU は先攻を待つ");
  s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: [] });
  const m = cpuAction(s, 1);
  assert.equal(m?.type, "CONFIRM_MULLIGAN", "自分の番になったら引き直す");
}

/* ---- 配線 ---- */
{
  const game = readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
  assert.ok(/const simPrep = hasSimultaneousPrep\(a\.ruleVersion\) && !!\(network \|\| cpu\) && !tutorial;/.test(game), "同時の画面はオンライン・CPU 戦(チュートリアルは順番のまま)");
  assert.ok(/y\(\{ type: "ROLL_DICE_SINGLE", player: prepSeat \}\)/.test(game), "時間切れで自分の目を振る");
  assert.ok(/if \(a\.phase === "mulligan" && a\.mulliganIdx === prepSeat\) y\(\{ type: "CONFIRM_MULLIGAN" \}\);/.test(game), "時間切れで(自分の番なら)選んでいる札のまま確定");
  assert.ok(/who: a\.mulliganIdx, at: Date\.now\(\)/.test(game), "引き直しの1分は番が替わるたびに数え直す");
  assert.ok(/if \(network && p !== 0\) return;/.test(game) && /y\(\{ type: "GOTO_MULLIGAN" \}\)/.test(game), "目がそろったあとはホストが進める");
  assert.ok(/<DiceDuo/.test(game) && /<MatchupBar viewer=\{me\} \/>/.test(game), "同時のサイコロと、引き直しに相手の名前・称号");
  const dice = readFileSync(new URL("../src/ui/dice.jsx", import.meta.url), "utf8");
  assert.ok(/export function DiceDuo\(/.test(dice) && /振る残り時間/.test(dice), "両者のサイコロと残り時間");
  const setup = readFileSync(new URL("../src/ui/setup.jsx", import.meta.url), "utf8");
  assert.ok(/export function SetupOrderNote\(/.test(setup) && /あなたは先攻/.test(setup) && /あなたは後攻/.test(setup), "布陣中に先攻・後攻");
  assert.equal((setup.match(/<SetupOrderNote state=\{state\} pIdx=\{pIdx\} \/>/g) || []).length, 2, "配置と王選びの両方に出す");
}

console.log("版18 同時のサイコロ／先攻→後攻の引き直し: 旧版そのまま・CPU・配線 OK");
