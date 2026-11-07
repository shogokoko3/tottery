/**
 * ストーリーの CPU の手加減(2026-10-26 本人の指示「いちばん良い手をときどき外す形で、ストーリーのCPUを少し弱めて」)。
 *
 * 見ること:
 *   A. slipMove: rate の割合でだけ外す。外す先は 2・3 番目で、いちばん良い手より margin 以上低い手は選ばない。
 *      random の割合で、取られない手の中からでたらめに選ぶ(2026-10-26 本人の指示「でたらめな手も織り交ぜる」)
 *   B. ストーリーの CPU だけに付く(game.jsx は story のときだけ STORY_CPU_SLIP を渡す)。定石の CPU は、王を追い詰める手(forced)は外さない
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { slipMove } from "../src/game/cpu-informed.js";
import { STORY_CPU_SLIP } from "../src/game/story.js";

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
const seeded = (seed) => { let n = seed >>> 0 || 1; return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296; };

console.log("A. slipMove");
{
  const moves = [{ score: 30, id: "best" }, { score: 25, id: "second" }, { score: 22, id: "third" }, { score: 0, id: "bad" }];
  const real = Math.random;
  Math.random = seeded(7);
  let slips = 0, picked = new Set();
  for (let i = 0; i < 2000; i++) {
    const m = slipMove(moves, { rate: 0.3, margin: 12 });
    if (m) { slips++; picked.add(m.id); }
  }
  is("外す割合はおよそ rate(0.3)", Math.abs(slips / 2000 - 0.3) < 0.04, true);
  is("外す先は 2・3 番目だけ", [...picked].sort(), ["second", "third"]);
  is("margin より低い手しか無ければ外さない", Array.from({ length: 200 }, () => slipMove([{ score: 30 }, { score: 10 }], { rate: 1, margin: 12 })).every((m) => m === null), true);
  is("slip が無ければ外さない", slipMove(moves, null), null);
  // でたらめな手は、取られない手(safe)の中からだけ
  const mixed = [{ score: 30, id: "best", safe: true }, { score: 5, id: "safe-low", safe: true }, { score: -20, id: "hanging", safe: false }];
  const picks = new Set();
  for (let i = 0; i < 500; i++) {
    const m = slipMove(mixed, { rate: 0, random: 1 });
    if (m) picks.add(m.id);
  }
  is("でたらめな手は取られない手の中からだけ(駒をただ損する手は選ばない)", [...picks], ["safe-low"]);
  Math.random = real;
}

console.log("B. ストーリーの CPU だけ");
{
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  const joseki = fs.readFileSync(new URL("../src/game/cpu-joseki.js", import.meta.url), "utf8");
  is("game.jsx はストーリーのときだけ手加減を渡す", game.includes("const cpuOptions = story ? { slip: STORY_CPU_SLIP } : {};"), true);
  is("定石の CPU は王を追い詰める手(forced)を外さない", joseki.includes('if (!forced && options.slip && action.type === "MOVE_PIECE") {'), true);
  is("手加減の値(rate 0.3・margin 12・でたらめ 0.15)", { ...STORY_CPU_SLIP }, { rate: 0.3, margin: 12, random: 0.15 });
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.log(`NG: ${fail.join(", ")}`);
  process.exit(1);
}
