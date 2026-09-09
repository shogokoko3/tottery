/**
 * 盤面エリアの強さを、CPU 同士の 9×9 で測る小さな実験。
 *
 *   node tools/area-lab.mjs            # 各エリア 60局(先後を入れ替えて 30組)
 *   GAMES=200 node tools/area-lab.mjs  # 局数を変える
 *
 * 「片方だけがそのエリアを持つ」対局を回し、持つ側の勝率を出す。
 * 相手はエリア無し。同じ山札で席を入れ替えた2局を1組にして、配札の偏りを消す。
 * 50% から大きく離れたエリアは強すぎる/弱すぎる。数字は AREA_TUNING
 * (src/game/areas.js)で調整する。**CPU の腕が浅いので、目安にとどめること。**
 */
import { reducer, autoArrange, autoPickKing } from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";
import { cpuAction } from "../src/game/cpu.js";
import { buildDeck } from "../src/game/board.js";
import { AREA_BY_RANK, AREA_INFO, AREA_TUNING } from "../src/game/areas.js";

const GAMES = Number(process.env.GAMES || 60);
const PAIRS = Math.max(1, Math.floor(GAMES / 2));
const TYPES = ["earth", "sea", "forest", "ice", "sky", "palace"];
const RANK_OF = Object.fromEntries(TYPES.map((t) => [t, Object.keys(AREA_BY_RANK).find((r) => AREA_BY_RANK[r] === t)]));

let seedState = 1;
const seeded = (seed) => {
  seedState = seed;
  return () => (seedState = (seedState * 1103515245 + 12345) % 2147483648) / 2147483648;
};
const realRandom = Math.random;

/** 決まった種で山札を混ぜ、両者の手札の先頭に望みの王を置く */
function makeDeck(seed, kings) {
  const rnd = seeded(seed);
  const deck = buildDeck(null);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const used = new Set();
  const pick = (rank) => {
    const c = deck.find((x) => x.rank === rank && !used.has(x.id));
    used.add(c.id);
    return c;
  };
  const a = pick(kings[0]), b = pick(kings[1]);
  const rest = deck.filter((c) => !used.has(c.id));
  return [a, ...rest.slice(0, 12), b, ...rest.slice(12)];
}

/** 1局。kings は席ごとの王のランク、skins は席ごとに「エリアを持つか」 */
function play(seed, kings, hasArea) {
  Math.random = seeded(seed * 7 + 3);
  const all = Object.fromEntries(Object.keys(AREA_BY_RANK).map((r) => [r, "skin:foil"]));
  let s = reducer(
    { phase: "intro" },
    {
      type: "START_SETUP",
      size: 9,
      setupMode: "simultaneous",
      deck: makeDeck(seed, kings),
      areas: true,
      loadouts: [hasArea[0] ? all : {}, hasArea[1] ? all : {}],
      ruleVersion: 3,
    },
  );
  const step = (act) => (s = reducer(s, enrichAction(act, s)));
  let guard = 0;
  while (s.phase !== "gameover" && guard++ < 900) {
    if (s.captureReveal) { s = reducer(s, { type: "DISMISS_CAPTURE" }); continue; }
    if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
    if (s.setupEffects) { s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" }); continue; }
    if (s.phase === "dice") {
      step(s.dice[s.diceIdx] === null && s.diceIdx <= 1 ? { type: "ROLL_DICE_SINGLE" }
        : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : s.diceIdx === 3 ? { type: "REROLL_DICE" } : { type: "NEXT_DICE_STEP" });
      continue;
    }
    if (s.phase === "mulligan") { step({ type: "CONFIRM_MULLIGAN", discardIds: [] }); continue; }
    if (s.phase === "setup") {
      for (const idx of [0, 1]) {
        if (s.setupDone[idx]) continue;
        const placement = autoArrange(s, idx, null, null, null);
        const me = s.players[idx];
        let wanted = Object.keys(placement).map((id) => me.hand.find((c) => c.id === id)).find((c) => c && c.rank === kings[idx]);
        if (!wanted) {
          const card = me.hand.find((c) => c.rank === kings[idx]);
          const out = Object.keys(placement).find((id) => me.hand.find((x) => x.id === id)?.rank !== "K");
          if (card && out) { placement[card.id] = placement[out]; delete placement[out]; wanted = card; }
        }
        step({ type: "SETUP_CONFIRM", player: idx, placement, kingId: wanted ? wanted.id : autoPickKing(s, idx, placement) });
      }
      continue;
    }
    if (s.clocks[s.currentTurn] <= 0) { s = reducer(s, { type: "CLOCK_TIMEOUT", player: s.currentTurn }); continue; }
    let act = cpuAction(s, s.currentTurn);
    if (!act) break;
    if (act.type === "__CPU_SHUFFLE") {
      s = reducer(s, { type: "SELECT_PIECE", id: act.aceId });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[0] });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[1] });
      act = { type: "CONFIRM_SHUFFLE", aId: act.aceId, pickIds: act.pickIds };
    }
    const before = s;
    step({ ...act, elapsedMs: 1000 });
    if (s === before) break;
  }
  Math.random = realRandom;
  return { winner: s.phase === "gameover" ? s.winner : null, used: (s.areas || []).map((a) => !!(a && a.uses)) };
}

console.log(`盤面エリアの強さ(CPU同士、9×9、各 ${PAIRS * 2} 局。相手はエリア無し)`);
console.log(`調整: ${JSON.stringify(AREA_TUNING)}\n`);
console.log("エリア      王   持つ側の勝率   勝-敗-分   発動率");
for (const type of TYPES) {
  const rank = RANK_OF[type];
  let win = 0, lose = 0, draw = 0, used = 0, n = 0;
  for (let pair = 0; pair < PAIRS; pair++) {
    // 同じ配札で、エリアを持つ側を席0・席1の両方で試す(王は両者とも同じランク)
    for (const seat of [0, 1]) {
      const r = play(1000 + pair, [rank, rank], seat === 0 ? [true, false] : [false, true]);
      n++;
      if (r.winner === null) draw++;
      else if (r.winner === seat) win++;
      else lose++;
      if (r.used[seat]) used++;
    }
  }
  const rate = ((win + draw / 2) / n) * 100;
  console.log(
    `${AREA_INFO[type].name.padEnd(6, "　")} ${String(rank).padStart(3)}   ${rate.toFixed(1).padStart(6)}%     ${win}-${lose}-${draw}    ${((used / n) * 100).toFixed(0)}%`,
  );
}
