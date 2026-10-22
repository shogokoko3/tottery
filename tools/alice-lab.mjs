/**
 * シーズン2(不思議の国のアリス)の強さを、CPU 同士の 9×9 で測る。
 *
 *   node tools/alice-lab.mjs                 # 全部(王の効果・盤面効果・Aの採用・シリーズ全体)
 *   GAMES=40 node tools/alice-lab.mjs king   # 王の効果だけ、各40局(既定は各1,200局)
 *   OUT=reports/alice-balance/summary.json node tools/alice-lab.mjs   # 結果を JSON にも残す
 *   MODES=king,field node tools/alice-lab.mjs
 *
 * 比べ方(どれも同じ配札で席を入れ替えた2局を1組にして、配札の偏りを消す)
 *   king  : 両者とも同じ数字を王にする。片方だけその数字をアリスのスキン(フォイルなし)、
 *           相手は最初のシリーズのスキン(フォイルなし)。王の効果どうしの比較
 *   field : 両者ともフォイル。片方だけその数字をアリスのフォイル。王の効果＋盤面効果の比較
 *   ace   : 王でないAの比較。片方だけAをアリスのスキン(数字の逆転)、相手は通常のA(入れ替え)
 *   series: シリーズ全体。アリス全部(フォイル) 対 最初のシリーズ全部(フォイル)。王は CPU が選ぶ
 *
 * CPU はゲームと同じ cpuInformedAction(公開情報と見抜いた情報だけで指す)。
 * 1手の考える時間は THINK_MS(既定 5000)。白ウサギの持ち時間の効果に効く。
 * **CPU の腕が浅いので、数字は目安。** 50% から大きく離れたものを見直しの候補にする。
 */
import { reducer, autoArrange } from "../src/game/reducer.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { enrichAction } from "../src/game/actions.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { aliceSetupFix } from "../src/game/cpu-alice.js";
import { buildDeck } from "../src/game/board.js";
import { SKINS } from "../src/skins/catalog.js";

const GAMES = Number(process.env.GAMES || 1200);
const PAIRS = Math.max(1, Math.floor(GAMES / 2));
const THINK_MS = Number(process.env.THINK_MS || 5000);
const MODES = (process.argv[2] || process.env.MODES || "king,field,ace,series").split(",");
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const bySeries = (series, foil) => {
  const out = {};
  for (const s of SKINS.filter((x) => x.series === series)) {
    if (out[s.rank]) continue;
    // 10 は天馬騎士ではなく竜騎士(フォイルのある方)を使う
    if (series === "heroes" && s.rank === "10" && s.id !== "dragon-knight") continue;
    out[s.rank] = foil && s.rank !== "A" ? `${s.id}:foil` : s.id;
  }
  if (series === "heroes" && !out["10"]) out["10"] = foil ? "dragon-knight:foil" : "dragon-knight";
  return out;
};
const HERO = bySeries("heroes", false);
const HERO_FOIL = bySeries("heroes", true);
const ALICE = bySeries("alice", false);
const ALICE_FOIL = bySeries("alice", true);

let seedState = 1;
const seeded = (seed) => {
  seedState = seed;
  return () => (seedState = (seedState * 1103515245 + 12345) % 2147483648) / 2147483648;
};
const realRandom = Math.random;

function makeDeck(seed, kings) {
  const rnd = seeded(seed);
  const deck = buildDeck(null);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  if (!kings) return deck;
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

/** 1局。kings が null なら王は CPU が選ぶ */
function play(seed, kings, loadouts, areas) {
  Math.random = seeded(seed * 7 + 3);
  let s = reducer(
    { phase: "intro" },
    {
      type: "START_SETUP",
      size: 9,
      setupMode: "simultaneous",
      deck: makeDeck(seed, kings),
      areas,
      loadouts,
      ruleVersion: GAME_RULE_VERSION,
    },
  );
  const step = (a) => (s = reducer(s, enrichAction(a, s)));
  const stats = { alice: [0, 0], moves: 0 };
  let guard = 0;
  while (s.phase !== "gameover" && guard++ < 1200) {
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
        if (!kings) {
          const a = cpuInformedAction(s, idx);
          if (a) step(a);
          continue;
        }
        const placement = autoArrange(s, idx, null, null, null);
        const me = s.players[idx];
        let wanted = Object.keys(placement).map((id) => me.hand.find((c) => c.id === id)).find((c) => c && c.rank === kings[idx]);
        if (!wanted) {
          const card = me.hand.find((c) => c.rank === kings[idx]);
          const out = Object.keys(placement).find((id) => me.hand.find((x) => x.id === id)?.rank !== "K");
          if (card && out) { placement[card.id] = placement[out]; delete placement[out]; wanted = card; }
        }
        // K を王にしない編成では K を外す(K は王のときだけ採用できる)
        for (const id of Object.keys(placement)) {
          const c = me.hand.find((x) => x.id === id);
          if (c?.rank === "K" && c.id !== wanted?.id) {
            const spare = me.hand.find((x) => !placement[x.id] && !["K", "A"].includes(x.rank));
            if (spare) placement[spare.id] = placement[id];
            delete placement[id];
          }
        }
        const fixed = aliceSetupFix(s, idx, wanted?.id, placement);
        const before = s;
        step({ type: "SETUP_CONFIRM", player: idx, placement: fixed, kingId: wanted?.id });
        // ハートの王でAを外すと札が足りない配札など、決めた王で布陣できない局は数えない
        if (s === before) { Math.random = realRandom; return { winner: null, setupFailed: true, stats }; }
      }
      continue;
    }
    if (s.clocks?.[s.currentTurn] <= 0) { s = reducer(s, { type: "CLOCK_TIMEOUT", player: s.currentTurn }); continue; }
    let act = cpuInformedAction(s, s.currentTurn) || cpuInformedAction(s, 1 - s.currentTurn);
    if (!act) break;
    if (act.type === "__CPU_SHUFFLE") {
      s = reducer(s, { type: "SELECT_PIECE", id: act.aceId });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[0] });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[1] });
      act = { type: "CONFIRM_SHUFFLE", aId: act.aceId, pickIds: act.pickIds };
    }
    const before = s;
    if (act.type === "ALICE_ACTION") stats.alice[act.player ?? s.currentTurn]++;
    if (act.type === "MOVE_PIECE") stats.moves++;
    step({ ...act, elapsedMs: act.type === "MOVE_PIECE" || act.type === "CONFIRM_SHUFFLE" ? THINK_MS : 0 });
    if (s === before) { stats.stuck = act; break; }
  }
  Math.random = realRandom;
  return { winner: s.phase === "gameover" ? s.winner : null, stats, reason: s.log?.slice(-1)[0] };
}

/** 同じ配札の先後2局を組にしたブートストラップで、勝率の95%区間を出す */
function interval(pairs) {
  const rnd = seeded(99);
  const rates = [];
  for (let i = 0; i < 2000; i++) {
    let w = 0, l = 0;
    for (let j = 0; j < pairs.length; j++) {
      const p = pairs[Math.floor(rnd() * pairs.length)];
      w += p[0];
      l += p[1];
    }
    rates.push(w + l ? w / (w + l) : 0.5);
  }
  rates.sort((a, b) => a - b);
  return [rates[50] * 100, rates[1949] * 100];
}

/** 席を入れ替えた2局ずつ。tested は「測る側」の装備、base は相手の装備 */
function match(label, kings, tested, base, areas) {
  let win = 0, lose = 0, open = 0, used = 0, stuck = 0, n = 0, skipped = 0;
  const pairs = [];
  for (let pair = 0; pair < PAIRS; pair++) {
    const pw = [0, 0];
    for (const seat of [0, 1]) {
      const loadouts = seat === 0 ? [tested, base] : [base, tested];
      const r = play(1000 + pair, kings, loadouts, areas);
      if (r.setupFailed) { skipped++; continue; }
      n++;
      if (r.winner === null) open++;
      else if (r.winner === seat) { win++; pw[0]++; }
      else { lose++; pw[1]++; }
      used += r.stats.alice[seat];
      if (r.stats.stuck) stuck++;
    }
    pairs.push(pw);
  }
  // 以前の検証(reports/area-tuning)と同じく、勝敗がついた局を分母にする
  const rate = win + lose ? (win / (win + lose)) * 100 : 50;
  const [lo, hi] = interval(pairs);
  const flag = lo > 55 ? "  ← 強い" : hi < 45 ? "  ← 弱い" : "";
  console.log(
    `${label.padEnd(16, "　")} ${rate.toFixed(1).padStart(6)}%  (${lo.toFixed(1)}–${hi.toFixed(1)})  ${String(win).padStart(4)}-${String(lose).padStart(4)}-${String(open).padStart(3)}   能力 ${(used / n).toFixed(1).padStart(5)}回/局${stuck ? `  止まり${stuck}` : ""}${skipped ? `  布陣できず${skipped}` : ""}${flag}`,
  );
  return { label, rate, lo, hi, win, lose, open, n, used: used / n, stuck, skipped };
}

const NAME = Object.fromEntries(SKINS.filter((s) => s.series === "alice").map((s) => [s.rank, s.name]));
const results = {};
console.log(`シーズン2の強さ(CPU同士、9×9、各 ${PAIRS * 2} 局、1手 ${THINK_MS / 1000}秒)\n`);
console.log("比べるもの            アリス側の勝率 (95%区間)  勝-敗-未決着");

if (MODES.includes("king")) {
  console.log("\n■ 王の効果(フォイルなし。両者同じ数字の王。相手は最初のシリーズの王の力)");
  results.king = RANKS.map((r) => match(`${r} ${NAME[r]}`, [r, r], { ...HERO, [r]: ALICE[r] }, HERO, false));
}
if (MODES.includes("field")) {
  console.log("\n■ 王の効果＋盤面効果(フォイル。相手は最初のシリーズの王の力＋エリア)");
  results.field = RANKS.filter((r) => r !== "A").map((r) =>
    match(`${r} ${NAME[r]}`, [r, r], { ...HERO_FOIL, [r]: ALICE_FOIL[r] }, HERO_FOIL, true));
}
if (MODES.includes("ace")) {
  console.log("\n■ 王でないA(アリスの数字の逆転 対 ランプのマジシャンの入れ替え。王は両者とも9)");
  results.ace = [match("A アリス(王でない)", ["9", "9"], { ...HERO, A: ALICE.A }, HERO, false)];
}
if (MODES.includes("series")) {
  console.log("\n■ シリーズ全体(全部フォイル。王は CPU が選ぶ)");
  results.series = [match("アリス 対 最初", null, ALICE_FOIL, HERO_FOIL, true)];
}
if (process.env.OUT) {
  const fs = await import("node:fs");
  fs.writeFileSync(process.env.OUT, JSON.stringify({ games: PAIRS * 2, thinkMs: THINK_MS, results }, null, 2));
}
