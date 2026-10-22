/**
 * 王ごとに、CPU が実際に組む「引き直しで残す札・狙う構成・初期配置」の例を出す(戦術まとめ用)。
 *   node tools/alice-setup-examples.mjs            # 全部の王
 *   RANK=2 SEEDS=1000,1001 node tools/alice-setup-examples.mjs
 * 配札は alice-arena と同じ(seed と王の数字で決まる)。相手は読まない。
 */
import { reducer } from "../src/game/reducer.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { chooseArmyPlan, arrangeArmy, strategicDiscards } from "../src/game/cpu-strategy.js";
import { capDiscards } from "../src/game/cpu.js";
import { aliceSetupFix } from "../src/game/cpu-alice.js";
import { buildDeck, territoryRows } from "../src/game/board.js";
import { ALICE_FOIL, HERO_FOIL } from "./alice-arena.mjs";

const RANKS = process.env.RANK ? process.env.RANK.split(",") : ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SEEDS = (process.env.SEEDS || "1000,1003,1007").split(",").map(Number);
let seedState = 1;
const seeded = (seed) => { seedState = seed; return () => (seedState = (seedState * 1103515245 + 12345) % 2147483648) / 2147483648; };
function makeDeck(seed, rank) {
  const rnd = seeded(seed);
  const deck = buildDeck(null);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const a = deck.find((x) => x.rank === rank);
  const rest = deck.filter((c) => c.id !== a.id);
  return [a, ...rest];
}
const SUIT = { heart: "♥", diamond: "♦", spade: "♠", club: "♣" };
const show = (c) => `${c.rank}${SUIT[c.suit] || ""}`;
const order = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const sortCards = (cs) => [...cs].sort((a, b) => order.indexOf(a.rank) - order.indexOf(b.rank));

for (const rank of RANKS) {
  console.log(`\n==================== 王 ${rank} ====================`);
  for (const seed of SEEDS) {
    let s = reducer({ phase: "intro" }, { type: "START_SETUP", size: 9, setupMode: "simultaneous", deck: makeDeck(seed, rank), areas: true, loadouts: [ALICE_FOIL, HERO_FOIL], ruleVersion: GAME_RULE_VERSION });
    // サイコロを飛ばして引き直しへ
    while (s.phase === "dice") {
      if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
      s = reducer(s, s.dice[s.diceIdx] === null && s.diceIdx <= 1 ? { type: "ROLL_DICE_SINGLE" } : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : s.diceIdx === 3 ? { type: "REROLL_DICE" } : { type: "NEXT_DICE_STEP" });
    }
    const me = 0;
    // 引き直し: 自分の番まで相手は何も捨てない
    while (s.phase === "mulligan") {
      if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
      const idx = s.mulliganIdx;
      if (idx === me) {
        const hand = s.players[me].hand;
        const ids = capDiscards(s, strategicDiscards(s, me, rank));
        const kept = hand.filter((c) => !ids.includes(c.id)), thrown = hand.filter((c) => ids.includes(c.id));
        console.log(`seed ${seed}: 手札 ${sortCards(hand).map(show).join(" ")}`);
        console.log(`  捨てる ${sortCards(thrown).map(show).join(" ") || "なし"} / 残す ${sortCards(kept).map(show).join(" ")}`);
        s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: ids });
      } else s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: [] });
    }
    while (s.interstitial || s.setupEffects) s = reducer(s, { type: s.interstitial ? "DISMISS_INTERSTITIAL" : "DISMISS_SETUP_EFFECTS" });
    const plan = chooseArmyPlan(s, me, rank);
    if (!plan) { console.log("  (その数字を王にできる編成が無い)"); continue; }
    const placement = aliceSetupFix(s, me, plan.kingId, arrangeArmy(s, me, plan));
    const hand = s.players[me].hand;
    const counts = {};
    for (const id of Object.keys(placement)) { const r = hand.find((c) => c.id === id).rank; counts[r] = (counts[r] || 0) + 1; }
    console.log(`  引いたあとの手札 ${sortCards(hand).map(show).join(" ")}`);
    console.log(`  構成(9枚) ${order.filter((r) => counts[r]).map((r) => `${r}×${counts[r]}`).join(" ")}  → 王 ${rank}`);
    const [lo, hi] = territoryRows(9, me);
    const grid = Array.from({ length: hi - lo + 1 }, () => Array(9).fill("・"));
    for (const [id, at] of Object.entries(placement)) {
      const c = hand.find((x) => x.id === id);
      grid[at.row - lo][at.col] = (id === plan.kingId ? "王" : "") + c.rank;
    }
    // 席0 の自陣は盤の上側(行 0〜2)。相手側から遠い行を「後列」として上に出す
    console.log("  布陣(上が自陣の後列、下が相手に近い前列。a〜i は左から)");
    console.log("       a    b    c    d    e    f    g    h    i");
    for (let r = grid.length - 1; r >= 0; r--) console.log(`   ${r === grid.length - 1 ? "後" : r === 0 ? "前" : "中"} ` + grid[r].map((x) => x.padStart(4, " ")).join(" "));
  }
}
