/**
 * ストーリーのフェーズ3(2026-10-26 本人の指示「盤面は、55」「相手も、王の力が使える」「エリア効果は、自分だけ」
 * 「55のエリア効果は、ストーリー限定にして、貸し出しが基本」「１話目なら土、２話目なら海のように」「推奨の駒を選んだ時のみ」「フォイルを所持している時はそれに応じて」)。
 *
 * 見ること:
 *   A. ストーリーのフェーズ3 の旗で始めた 5×5 の対局で、エリアが立つのはプレイヤーの席だけ。おすすめの駒(第1話なら2か3)を王にすると、
 *      フォイルが無くても話のエリア(第1話は土、第2話は海…)。フォイルを着けた札を王にすると、そのフォイルのエリア。それ以外は無し
 *   B. 相手(CPU)の王も王の力を持つ
 *   C. 通信の手に載った席の旗・貸し出しは受けない(オンラインはいままでどおり 9×9 で装備しだい)
 *   D. 旗の無い 5×5 の対局(CPU戦・同じ端末)にはエリアが立たない
 *   E. 対局中の知らせ: 自分で使うエリアは「使える」、自動のエリアは働いた番に一言(areaChance)
 */
import assert from "node:assert/strict";
import { initialState, reducer } from "../src/game/reducer.js";
import { kingPowersOn } from "../src/game/board.js";
import { AREA_BY_RANK } from "../src/game/areas.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { storySetupFlags } from "../src/game/phase.js";
import { storyStartFlags } from "../src/game/story.js";
import { areaChance } from "../src/game/king-power-hint.js";

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

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** 布陣まで済ませて対局を始める。kingRank を王にできる手札が配られるまで種を回す */
function playWith(flags, kingRank, extra = {}) {
  for (let seed = 1; seed < 400; seed++) {
    Math.random = seeded(seed);
    let s = reducer(initialState(), { type: "START_SETUP", size: 5, setupMode: "simultaneous", ruleVersion: GAME_RULE_VERSION, ...flags, ...extra });
    for (let g = 0; s.phase === "dice" && g < 12; g++)
      s = reducer(s, s.diceIdx <= 1 && s.dice[s.diceIdx] === null ? { type: "ROLL_DICE_SINGLE", value: s.diceIdx === 0 ? 6 : 1, player: s.diceIdx } : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : { type: "NEXT_DICE_STEP" });
    for (let g = 0; s.phase === "mulligan" && g < 4; g++) s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: [], reserveOrder: s.reserve.map((c) => c.id) });
    let found = true;
    for (const p of [0, 1]) {
      s = reducer(s, { type: "SETUP_AUTO_ARRANGE", player: p });
      s = reducer(s, { type: "SETUP_GOTO_KING_STEP", player: p });
      const ids = Object.keys(s.setupPlacements[p]);
      const rk = (id) => s.players[p].hand.find((c) => c.id === id).rank;
      const want = p === 0 ? kingRank : "2";
      const pick = ids.find((id) => rk(id) === want) || (p === 1 ? ids.find((id) => rk(id) === "K") || ids[0] : null);
      if (!pick || ids.some((id) => rk(id) === "K" && rk(pick) !== "K")) { found = false; break; }
      s = reducer(s, { type: "SETUP_PICK_KING", player: p, cardId: pick });
      s = reducer(s, { type: "SETUP_CONFIRM", player: p });
    }
    if (found && s.phase !== "setup") return s;
  }
  throw new Error(`no seed for ${kingRank}`);
}

console.log("A. エリアはプレイヤーの席だけ。おすすめの駒を王にしたときだけ話のエリアを貸す。フォイルならそのエリア");
// 第1話(二と三)は 2 か 3 を王にすると土、第2話(四と五)は海、第4話(八と九)は氷(2026-10-26 本人の指示)
for (const [axis, king, want, lent] of [["23", "2", "earth", true], ["45", "4", "sea", true], ["89", "8", "ice", true], ["23", "8", null, null]]) {
  const s = playWith(storyStartFlags({ axis, phase: 3 }), king);
  is(`第${axis}話(王=${king}): 5×5 でエリアの決まりが働く`, [s.boardSize, s.areasEnabled], [5, true]);
  is(`第${axis}話(王=${king}): プレイヤーの席は ${want || "無し"}、相手の席は無し`, [s.areas[0]?.type ?? null, s.areas[0]?.lent ?? null, s.areas[1]], [want, lent, null]);
}
{
  // フォイルを着けた札を王にすれば、おすすめの駒でなくても、そのフォイルのエリア
  const s = playWith(storyStartFlags({ axis: "23", phase: 3 }), "8", { loadouts: [{ 8: "fixture-8:foil" }, {}] });
  is("第1話でフォイルを着けた8を王に: 氷のエリア(貸し出しでない)", [s.areas[0]?.type, s.areas[0]?.lent], ["ice", false]);
  const t = playWith(storyStartFlags({ axis: "23", phase: 3 }), "8", { loadouts: [{ 8: "fixture-8" }, {}] });
  is("フォイルでないスキンでは付かない", t.areas[0], null);
}
is("話ごとのエリアの種類は、数字のエリアだけ受ける", reducer(initialState(), { type: "START_SETUP", size: 5, setupMode: "simultaneous", ruleVersion: GAME_RULE_VERSION, ...storySetupFlags(3), areaTypes: ["alice-maze", "earth"] }).areaTypes, [null, "earth"]);

console.log("B. 相手の王も王の力を持つ");
{
  const s = playWith(storyStartFlags({ axis: "89", phase: 3 }), "8");
  is("王の力の旗は両方(真偽値で真)", s.kingPowers !== false && !(Array.isArray(s.kingPowers) && s.kingPowers.includes(false)), true);
  const king = s.pieces[s.players[1].kingId];
  is("相手の席にも王の力が働く(kingPowersOn)", kingPowersOn(s, 1), true);
  is("相手の王の駒に力なしの印が付かない", king.powers === false, false);
}

console.log("C. 通信の手の席の旗・貸し出しは受けない");
{
  const s = reducer(initialState(), { type: "START_SETUP", size: 5, setupMode: "simultaneous", ruleVersion: GAME_RULE_VERSION, ...storySetupFlags(3), __id: "net-1" });
  is("通信の手では 5×5 のエリアが立たない", [s.areasEnabled, s.areaSeats, s.areaLend], [false, null, false]);
}

console.log("D. 旗の無い 5×5 にはエリアが立たない");
{
  const s = playWith({ areas: true }, "8");
  is("CPU戦などの 5×5(旗なし)", [s.areasEnabled, s.areas[0], s.areas[1]], [false, null, null]);
}

console.log("E. 対局中の知らせ");
{
  const s = playWith(storyStartFlags({ axis: "45", phase: 3 }), "4");
  const mine = { ...s, currentTurn: 0, phase: "play", interstitial: null, captureReveal: null, setupEffects: null };
  const c = areaChance(mine, 0);
  is("海のエリア(自分で使う)は、使える番に「使える」", c && [c.kind, c.type], ["area-ready", "sea"]);
  is("相手の番には知らせない", areaChance({ ...mine, currentTurn: 1 }, 0), null);
  const s8 = playWith(storyStartFlags({ axis: "89", phase: 3 }), "8");
  const fired = { ...s8, currentTurn: 0, phase: "play", turnNo: 4, areas: [{ ...s8.areas[0], lastUsedTurn: 4 }, null], lastArea: { player: 0, type: "ice", seq: 1, pieceIds: ["x"] } };
  is("氷のエリア(自動)は、働いた番に一言", areaChance(fired, 0)?.kind, "area-fired");
  is("働いていない番には一言を出さない", areaChance({ ...fired, turnNo: 5 }, 0), null);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.log(`NG: ${fail.join(", ")}`);
  process.exit(1);
}
