// エリア別の定石CPU(src/game/cpu-joseki.js)の検査。
//   1. 定石の山札: 52枚そろい、CPU(後手)の手札に定石の札が入る
//   2. 各エリア×王で、引き直し→布陣→対局が通る(手が拒否されない)。王の数字とエリアが選んだとおり
//   3. 伏せ札の不変性: 相手の正体不明の駒の数字・王の印を入れ替えても、同じ手を選ぶ
//   4. 1手の思考時間が端末で待てる範囲(2秒以内)
import assert from "node:assert/strict";
import fs from "node:fs";
import { reducer } from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";
import { kingRankOf } from "../src/game/board.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { automaticAreaAction } from "../src/game/area-presentation.js";
import { isKnownTo } from "../src/game/areas.js";
import {
  JOSEKI_AREAS,
  JOSEKI_HANDS,
  JOSEKI_KINGS,
  josekiCpuAction,
  josekiDeck,
  pickJosekiKing,
} from "../src/game/cpu-joseki.js";

const realRandom = Math.random;
function seeded(seed) {
  let n = seed >>> 0 || 1;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
}

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

/** 山札の検査 */
for (const area of JOSEKI_AREAS)
  for (const k of JOSEKI_KINGS[area]) {
    Math.random = seeded(7);
    const deck = josekiDeck(area, k);
    Math.random = realRandom;
    assert.equal(deck.length, 52, `${area} ${k}: 52枚`);
    assert.equal(new Set(deck.map((c) => c.id)).size, 52, `${area} ${k}: 重複なし`);
    const cpuHand = deck.slice(13, 26);
    const want = JOSEKI_HANDS[area](k);
    const have = cpuHand.map((c) => c.rank);
    for (const r of new Set(want)) {
      const need = want.filter((x) => x === r).length;
      const got = have.filter((x) => x === r).length;
      assert.ok(got >= need, `${area} ${k}: CPUの手札に ${r} が ${need} 枚(実際 ${got})`);
    }
  }
assert.equal(pickJosekiKing("sky", () => 0.9), "10");
assert.equal(pickJosekiKing("palace", () => 0.99), "K");

/** 1局を回す。cpu は後手(1)。人間役は通常CPU */
function playGame(area, k, seed, { cap = 60, invariance = false } = {}) {
  Math.random = seeded(seed);
  const deck = josekiDeck(area, k);
  let s = reducer(
    { phase: "intro" },
    {
      type: "START_SETUP",
      size: 9,
      setupMode: "simultaneous",
      deck,
      areas: true,
      loadouts: [{}, { [k]: "fixture-skin:foil" }],
      ruleVersion: GAME_RULE_VERSION,
    },
  );
  assert.equal(s.phase, "dice", `${area} ${k}: START_SETUP が通る`);
  const act = (st, p) =>
    p === 1 ? josekiCpuAction(st, 1, area, k) : cpuInformedAction(st, 0);
  let slowest = 0;
  let checks = 0;
  for (let guard = 0; s.phase !== "gameover" && guard < 3000; guard++) {
    if (s.captureReveal) {
      s = reducer(s, { type: "DISMISS_CAPTURE" });
      continue;
    }
    if (s.interstitial) {
      s = reducer(s, { type: "DISMISS_INTERSTITIAL" });
      continue;
    }
    if (s.setupEffects) {
      s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" });
      continue;
    }
    if (s.phase === "dice") {
      const a =
        s.diceIdx <= 1 && s.dice[s.diceIdx] === null
          ? { type: "ROLL_DICE_SINGLE", value: s.diceIdx === 0 ? 6 : 1 }
          : s.diceIdx === 2
            ? { type: "GOTO_MULLIGAN" }
            : s.diceIdx === 3
              ? { type: "REROLL_DICE" }
              : { type: "NEXT_DICE_STEP" };
      s = reducer(s, a);
      continue;
    }
    if (s.phase === "mulligan") {
      const p = s.mulliganIdx;
      const a = act(s, p);
      assert.equal(a?.type, "CONFIRM_MULLIGAN", `${area} ${k}: 引き直し`);
      s = reducer(s, enrichAction(a, s));
      continue;
    }
    if (s.phase === "setup") {
      for (const p of [0, 1]) {
        if (s.setupDone[p]) continue;
        const a = act(s, p);
        assert.equal(a?.type, "SETUP_CONFIRM", `${area} ${k}: 布陣(${p})`);
        const next = reducer(s, a);
        assert.ok(next.setupDone[p], `${area} ${k}: 布陣が受理される(${p})`);
        s = next;
      }
      continue;
    }
    if (s.phase === "play") {
      if (s.turnNo >= cap) break;
      const p = s.currentTurn;
      let a;
      if (p === 1) {
        const t0 = Date.now();
        Math.random = seeded(seed + s.turnNo);
        a = josekiCpuAction(s, 1, area, k);
        slowest = Math.max(slowest, Date.now() - t0);
        if (invariance && a && s.turnNo % 3 === 0 && !automaticAreaAction(s)) {
          // 相手の正体不明の駒の数字と王の印を入れ替えても、同じ手になる
          const altered = structuredClone(s);
          for (const q of Object.values(altered.pieces)) {
            if (q.owner !== 0 || !q.alive || isKnownTo(s, 1, q)) continue;
            q.rank = RANKS[(RANKS.indexOf(q.rank) + 5) % 12];
            q.isKing = !q.isKing;
            altered.board[q.row][q.col] = q;
          }
          Math.random = seeded(seed + s.turnNo);
          const b = josekiCpuAction(altered, 1, area, k);
          assert.deepEqual(
            b,
            a,
            `${area} ${k} 手番${s.turnNo}: 伏せ札を入れ替えても同じ手`,
          );
          checks++;
        }
        Math.random = seeded(seed * 3 + s.turnNo);
      } else a = automaticAreaAction(s) || cpuInformedAction(s, 0);
      assert.ok(a, `${area} ${k} 手番${s.turnNo}: 手がある(${p})`);
      if (a.type === "__CPU_SHUFFLE") {
        s = reducer(s, { type: "SELECT_PIECE", id: a.aceId });
        for (const id of a.pickIds) s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id });
        a = { type: "CONFIRM_SHUFFLE", aId: a.aceId, pickIds: a.pickIds };
      }
      const next = reducer(s, enrichAction({ ...a, elapsedMs: 0 }, s));
      assert.notEqual(next, s, `${area} ${k} 手番${s.turnNo}: ${a.type} が拒否されない(${p})`);
      s = { ...next, replay: [] };
      continue;
    }
    throw new Error(`${area} ${k}: 想定外の phase ${s.phase}`);
  }
  Math.random = realRandom;
  return { s, slowest, checks };
}

let totalChecks = 0;
for (const area of JOSEKI_AREAS) {
  JOSEKI_KINGS[area].forEach((k, i) => {
    const { s, slowest, checks } = playGame(area, k, 100 + i, {
      cap: i === 0 ? 40 : 20,
      invariance: i === 0,
    });
    assert.equal(kingRankOf(s, 1), k, `${area}: CPUの王が ${k}`);
    assert.equal(s.areas?.[1]?.type, area, `${area}: CPUの盤に ${area} が立つ`);
    assert.ok(slowest < 2000, `${area} ${k}: 1手 ${slowest}ms(2秒以内)`);
    totalChecks += checks;
    console.log(
      `${area} ${k}: 王=${kingRankOf(s, 1)} エリア=${s.areas[1].type} 採用=${JSON.stringify(s.players[1].armyRankCounts)} 手番${s.turnNo} ${s.phase === "gameover" ? `勝者${s.winner}(${s.endReason || "king"})` : "打ち切り"} 最長${slowest}ms 不変性${checks}回`,
    );
  });
}
assert.ok(totalChecks >= 12, `伏せ札の不変性を十分な回数見た(${totalChecks})`);
// 知らないエリアは通常CPUに戻る
{
  Math.random = seeded(3);
  const deck = josekiDeck("sky", "10");
  const s = reducer(
    { phase: "intro" },
    { type: "START_SETUP", size: 9, setupMode: "simultaneous", deck, areas: true, loadouts: [{}, {}], ruleVersion: GAME_RULE_VERSION },
  );
  Math.random = realRandom;
  assert.equal(josekiCpuAction(s, 1, "nowhere"), cpuInformedAction(s, 1), "未知のエリアは通常CPU");
  assert.equal(josekiDeck("nowhere", "10"), null);
}
// 画面の配線: エリアを選ぶ欄と、選んだエリアの受け渡しは、フォイルを初めて手に入れた人(foilRevealed)にだけ
{
  const src = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  const gate = /onCpuArea=\{\s*d && !tut && foilRevealed\(collection\)/;
  assert.ok(gate.test(src), "CPUのエリアを選ぶ欄は foilRevealed で隠す");
  const pass = /cpuArea=\{\s*d && !tut && i === 9 && foilRevealed\(collection\) \? cpuArea : null/;
  assert.ok(pass.test(src), "選んだエリアの受け渡しも foilRevealed で止める");
}
console.log("定石CPU: 山札・王とエリア・布陣・対局・伏せ札の不変性・思考時間・フォイル前は隠す OK");
