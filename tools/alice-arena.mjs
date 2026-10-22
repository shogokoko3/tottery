/**
 * シーズン2(不思議の国のアリス)の戦い方を、CPU 同士の 9×9 で試す闘技場。
 * alice-lab.mjs(王の効果ごとの比較)と違い、**サイコロ・引き直し・布陣・王の選定まで全部 CPU に任せる**。
 * 「相手の盤面効果を見て戦い方を変える」「引き直し・布陣で駒の力を引き出す」の試行錯誤に使う。
 *
 *   node tools/alice-arena.mjs                      # 既定: series・mirror(各 PAIRS 組)
 *   GAMES=400 MODES=series,mirror,alice-king,hero-king node tools/alice-arena.mjs
 *   PROFILE=baseline node tools/alice-arena.mjs     # CPU の知恵の切り替え(globalThis.TOTTERY_ALICE_CPU)
 *   OUT=reports/alice-tactics/run.jsonl node tools/alice-arena.mjs   # 1局1行の記録(振り返り用)
 *
 * 比べ方(どれも同じ配札で席を入れ替えた2局を1組にして、配札の偏りを消す)
 *   series     : アリス全部(フォイル) 対 最初のシリーズ全部(フォイル)。王は両者 CPU が選ぶ
 *   mirror     : アリス 対 アリス。王は CPU が選ぶ(どの王が勝ちやすいかを見る)
 *   alice-king : アリス側の王を数字ごとに固定。相手(最初のシリーズ)は CPU が王を選ぶ
 *   hero-king  : 最初のシリーズ側の王を数字ごとに固定。アリス側は CPU が王を選ぶ
 *
 * CPU はゲームと同じ cpuInformedAction(公開情報と見抜いた情報だけで指す)。
 * 1手の考える時間は THINK_MS(既定 5000)。
 */
import { reducer } from "../src/game/reducer.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { enrichAction } from "../src/game/actions.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { aliceSetupFix } from "../src/game/cpu-alice.js";
import { chooseArmyPlan, arrangeArmy, strategicDiscards } from "../src/game/cpu-strategy.js";
import { capDiscards } from "../src/game/cpu.js";
import { buildDeck, armySlots } from "../src/game/board.js";
import { SKINS } from "../src/skins/catalog.js";
import fs from "node:fs";

const GAMES = Number(process.env.GAMES || 400);
const PAIRS = Math.max(1, Math.floor(GAMES / 2));
const THINK_MS = Number(process.env.THINK_MS || 5000);
const MODES = (process.argv[2] || process.env.MODES || "series,mirror").split(",");
const SEED0 = Number(process.env.SEED || 1000);
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
// RANKS=2,3 のように、王を固定するモードで測る数字を絞れる
const ONLY = process.env.RANKS ? new Set(process.env.RANKS.split(",")) : null;
const pickRanks = (list) => list.filter((r) => !ONLY || ONLY.has(r));

// CPU の知恵の切り替え。cpu-alice.js / cpu-strategy.js が globalThis.TOTTERY_ALICE_CPU を読む
if (process.env.PROFILE) {
  const profiles = JSON.parse(fs.readFileSync(new URL("./alice-arena-profiles.json", import.meta.url), "utf8"));
  if (!profiles[process.env.PROFILE]) throw new Error(`PROFILE ${process.env.PROFILE} がありません`);
  globalThis.TOTTERY_ALICE_CPU = profiles[process.env.PROFILE];
  console.log(`PROFILE=${process.env.PROFILE} ${JSON.stringify(globalThis.TOTTERY_ALICE_CPU)}`);
}

const bySeries = (series, foil) => {
  const out = {};
  for (const s of SKINS.filter((x) => x.series === series)) {
    if (out[s.rank]) continue;
    if (series === "heroes" && s.rank === "10" && s.id !== "dragon-knight") continue;
    out[s.rank] = foil && s.rank !== "A" ? `${s.id}:foil` : s.id;
  }
  if (series === "heroes" && !out["10"]) out["10"] = foil ? "dragon-knight:foil" : "dragon-knight";
  return out;
};
export const HERO_FOIL = bySeries("heroes", true);
export const ALICE_FOIL = bySeries("alice", true);
// 混ぜた装備: レジェンドの王にアリスの A(数字の逆転)を混ぜる。MIX_A=foil なら A のフォイル(革命の扉)
export const HERO_MIX = { ...HERO_FOIL, A: process.env.MIX_A === "foil" ? `${ALICE_FOIL.A}:foil` : ALICE_FOIL.A };

let seedState = 1;
const seeded = (seed) => {
  seedState = seed;
  return () => (seedState = (seedState * 1103515245 + 12345) % 2147483648) / 2147483648;
};
const realRandom = Math.random;

/** 配札。kings=[rank0, rank1] のどちらかが null でなければ、その席の手札にその数字を1枚入れる */
function makeDeck(seed, kings) {
  const rnd = seeded(seed);
  const deck = buildDeck(null);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  if (!kings || (!kings[0] && !kings[1])) return deck;
  const used = new Set();
  const pick = (rank) => {
    if (!rank) return null;
    const c = deck.find((x) => x.rank === rank && !used.has(x.id));
    used.add(c.id);
    return c;
  };
  const a = pick(kings[0]), b = pick(kings[1]);
  const rest = deck.filter((c) => !used.has(c.id));
  const hand0 = a ? [a, ...rest.slice(0, 12)] : rest.slice(0, 13);
  const r1 = a ? rest.slice(12) : rest.slice(13);
  const hand1 = b ? [b, ...r1.slice(0, 12)] : r1.slice(0, 13);
  const r2 = b ? r1.slice(12) : r1.slice(13);
  return [...hand0, ...hand1, ...r2];
}

const SUIT = { heart: "♥", diamond: "♦", spade: "♠", club: "♣" };

/** 1局。kings の席は固定の王(null なら CPU が選ぶ)。記録を返す */
export function play(seed, kings, loadouts, opts = {}) {
  Math.random = seeded(seed * 7 + 3);
  let s = reducer(
    { phase: "intro" },
    { type: "START_SETUP", size: 9, setupMode: "simultaneous", deck: makeDeck(seed, kings), areas: true, loadouts, ruleVersion: GAME_RULE_VERSION },
  );
  const step = (a) => (s = reducer(s, enrichAction(a, s)));
  const rec = { seed, kings: [null, null], areas: [null, null], abilities: [0, 0], fields: [0, 0], moves: 0, captures: [0, 0] };
  let guard = 0;
  while (s.phase !== "gameover" && guard++ < 1500) {
    if (s.captureReveal) { s = reducer(s, { type: "DISMISS_CAPTURE" }); continue; }
    if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
    if (s.setupEffects) { s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" }); continue; }
    if (s.phase === "dice") {
      step(s.dice[s.diceIdx] === null && s.diceIdx <= 1 ? { type: "ROLL_DICE_SINGLE" }
        : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : s.diceIdx === 3 ? { type: "REROLL_DICE" } : { type: "NEXT_DICE_STEP" });
      continue;
    }
    if (s.phase === "mulligan") {
      const idx = s.mulliganIdx;
      const forced = kings?.[idx] || null;
      const ids = forced ? capDiscards(s, strategicDiscards(s, idx, forced)) : cpuInformedAction(s, idx)?.discardIds || [];
      step({ type: "CONFIRM_MULLIGAN", discardIds: ids });
      continue;
    }
    if (s.phase === "setup") {
      for (const idx of [0, 1]) {
        if (s.setupDone[idx]) continue;
        const forced = kings?.[idx] || null;
        let a = null;
        if (forced) {
          const plan = chooseArmyPlan(s, idx, forced);
          if (plan) {
            const placement = aliceSetupFix(s, idx, plan.kingId, arrangeArmy(s, idx, plan));
            if (Object.keys(placement).length >= armySlots(s)) a = { type: "SETUP_CONFIRM", player: idx, kingId: plan.kingId, placement };
          }
          if (!a) { Math.random = realRandom; return { ...rec, winner: null, setupFailed: true }; }
        } else a = cpuInformedAction(s, idx);
        if (a) step(a);
      }
      if (s.phase === "setup" && [0, 1].every((i) => !s.setupDone[i]) && guard > 50) break;
      continue;
    }
    if (!rec.kings[0]) {
      for (const i of [0, 1]) {
        rec.kings[i] = s.pieces[s.players[i].kingId]?.rank || null;
        rec.areas[i] = s.areas?.[i]?.type || null;
        rec[`army${i}`] = Object.entries(s.players[i].armyRankCounts || {}).filter(([, n]) => n).map(([r, n]) => `${r}x${n}`).join(" ");
      }
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
    const who = act.player ?? s.currentTurn;
    if (act.type === "ALICE_ACTION") { rec.abilities[who]++; if (act.kind === "field") rec.fields[who]++; }
    if (act.type === "MOVE_PIECE") {
      rec.moves++;
      const t = s.board[act.row]?.[act.col];
      if (t && t.owner !== who) rec.captures[who]++;
    }
    step({ ...act, elapsedMs: act.type === "MOVE_PIECE" || act.type === "CONFIRM_SHUFFLE" ? THINK_MS : 0 });
    if (s === before) { rec.stuck = JSON.stringify(act).slice(0, 120); break; }
  }
  Math.random = realRandom;
  rec.winner = s.phase === "gameover" ? s.winner : null;
  rec.turns = s.turnNo || 0;
  rec.tail = (s.log || []).slice(-3);
  rec.left = [0, 1].map((i) => Object.values(s.pieces).filter((p) => p.alive && p.owner === i).length);
  if (opts.full) { rec.log = s.log || []; rec.state = s; }
  return rec;
}

/** 同じ配札の先後2局を組にしたブートストラップで、勝率の95%区間を出す */
function interval(pairs) {
  const rnd = seeded(99);
  const rates = [];
  for (let i = 0; i < 2000; i++) {
    let w = 0, l = 0;
    for (let j = 0; j < pairs.length; j++) {
      const p = pairs[Math.floor(rnd() * pairs.length)];
      w += p[0]; l += p[1];
    }
    rates.push(w + l ? w / (w + l) : 0.5);
  }
  rates.sort((a, b) => a - b);
  return [rates[50] * 100, rates[1949] * 100];
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
const out = isMain && process.env.OUT ? fs.createWriteStream(process.env.OUT, { flags: "a" }) : null;
const tag = process.env.TAG || process.env.PROFILE || "";

/** 席を入れ替えた2局ずつ。tested(測る側)が席0 → 席1 の順。kings は [tested側, base側] */
function match(label, mode, testedKing, baseKing, tested, base) {
  let win = 0, lose = 0, open = 0, n = 0, skipped = 0, stuck = 0, turns = 0, used = 0;
  const pairs = [];
  for (let pair = 0; pair < PAIRS; pair++) {
    const pw = [0, 0];
    for (const seat of [0, 1]) {
      const loadouts = seat === 0 ? [tested, base] : [base, tested];
      const kings = seat === 0 ? [testedKing, baseKing] : [baseKing, testedKing];
      const r = play(SEED0 + pair, kings, loadouts);
      if (r.setupFailed) { skipped++; continue; }
      n++;
      turns += r.turns;
      used += r.abilities[seat];
      if (r.stuck) stuck++;
      const result = r.winner === null ? "open" : r.winner === seat ? "win" : "lose";
      if (result === "open") open++;
      else if (result === "win") { win++; pw[0]++; }
      else { lose++; pw[1]++; }
      if (out) {
        const t = seat, b = 1 - seat;
        out.write(JSON.stringify({ tag, mode, label, seed: r.seed, seat, result, testedKing: r.kings[t], baseKing: r.kings[b], testedArea: r.areas[t], baseArea: r.areas[b],
          testedArmy: r[`army${t}`], baseArmy: r[`army${b}`], turns: r.turns, abilities: [r.abilities[t], r.abilities[b]], fields: [r.fields[t], r.fields[b]],
          captures: [r.captures[t], r.captures[b]], left: [r.left[t], r.left[b]], tail: r.tail, stuck: r.stuck || null }) + "\n");
      }
    }
    pairs.push(pw);
  }
  const rate = win + lose ? (win / (win + lose)) * 100 : 50;
  const [lo, hi] = interval(pairs);
  const flag = lo > 55 ? "  ← 強い" : hi < 45 ? "  ← 弱い" : "";
  console.log(`${label.padEnd(18, "　")} ${rate.toFixed(1).padStart(6)}%  (${lo.toFixed(1)}–${hi.toFixed(1)})  ${String(win).padStart(4)}-${String(lose).padStart(4)}-${String(open).padStart(3)}  平均${(turns / Math.max(1, n)).toFixed(0).padStart(3)}手  能力${(used / Math.max(1, n)).toFixed(1).padStart(5)}回/局${stuck ? `  止まり${stuck}` : ""}${skipped ? `  布陣できず${skipped}` : ""}${flag}`);
  return { label, rate, lo, hi, win, lose, open, n };
}

export const NAME = Object.fromEntries(SKINS.filter((s) => s.series === "alice").map((s) => [s.rank, s.name]));
export const HNAME = Object.fromEntries(SKINS.filter((s) => s.series === "heroes" && s.id !== "pegasus-knight").map((s) => [s.rank, s.name]));
if (isMain) {
console.log(`シーズン2の闘技場(CPU同士、9×9、各 ${PAIRS * 2} 局、1手 ${THINK_MS / 1000}秒。引き直し・布陣・王は CPU が決める)\n`);
console.log("比べるもの              測る側の勝率 (95%区間)  勝-敗-未決着");
const results = {};
if (MODES.includes("series")) {
  console.log("\n■ シリーズ全体: アリス(フォイル) 対 最初のシリーズ(フォイル)");
  results.series = [match("アリス 対 最初", "series", null, null, ALICE_FOIL, HERO_FOIL)];
}
if (MODES.includes("mirror")) {
  console.log("\n■ アリス 対 アリス(どちらも CPU が王を選ぶ。席0 が測る側)");
  results.mirror = [match("アリス 対 アリス", "mirror", null, null, ALICE_FOIL, ALICE_FOIL)];
}
if (MODES.includes("alice-king")) {
  console.log("\n■ アリス側の王を固定 対 最初のシリーズ(王は CPU が選ぶ)");
  results.aliceKing = pickRanks(RANKS.filter((r) => r !== "A" || process.env.WITH_ACE)).map((r) => match(`${r} ${NAME[r]}`, "alice-king", r, null, ALICE_FOIL, HERO_FOIL));
}
if (MODES.includes("hero-king")) {
  console.log("\n■ 最初のシリーズ側の王を固定 対 アリス(王は CPU が選ぶ)。勝率は最初のシリーズ側");
  results.heroKing = pickRanks(RANKS.filter((r) => r !== "A")).map((r) => match(`${r} ${HNAME[r]}`, "hero-king", r, null, HERO_FOIL, ALICE_FOIL));
}
if (MODES.includes("matrix")) {
  // 総当たり: アリス側の王 r(固定) 対 最初のシリーズ側の王 q(固定)。相性の表を作る
  console.log("\n■ 総当たり: アリスの王(固定) 対 最初のシリーズの王(固定)。勝率はアリス側");
  results.matrix = [];
  for (const r of pickRanks(RANKS.filter((x) => x !== "A")))
    for (const q of RANKS.filter((x) => x !== "A" && (!process.env.BASE_RANKS || process.env.BASE_RANKS.split(",").includes(x))))
      results.matrix.push(match(`${r} 対 ${q}`, "matrix", r, q, ALICE_FOIL, HERO_FOIL));
}
if (MODES.includes("amatrix")) {
  console.log("\n■ 総当たり: アリスの王(固定) 対 アリスの王(固定)。勝率は測る側(先に書いた王)");
  results.amatrix = [];
  for (const r of pickRanks(RANKS.filter((x) => x !== "A")))
    for (const q of RANKS.filter((x) => x !== "A" && (!process.env.BASE_RANKS || process.env.BASE_RANKS.split(",").includes(x))))
      results.amatrix.push(match(`${r} 対 ${q}`, "amatrix", r, q, ALICE_FOIL, ALICE_FOIL));
}
if (MODES.includes("combo")) {
  // 組み合わせ探し: 王のシリーズ(TESTED=hero|alice)× A のスキン(TESTED_A=hero|alice|alice-foil)を、相手(BASE=hero|alice、王は CPU が選ぶ)に当てる
  const kingSeries = process.env.TESTED === "alice" ? ALICE_FOIL : HERO_FOIL;
  const aVariant = process.env.TESTED_A || "hero";
  const aSkin = aVariant === "alice" ? ALICE_FOIL.A : aVariant === "alice-foil" ? `${ALICE_FOIL.A}:foil` : aVariant === "hero-foil" ? `${HERO_FOIL.A}:foil` : HERO_FOIL.A;
  const tested = { ...kingSeries, A: aSkin };
  const base = process.env.BASE === "alice" ? ALICE_FOIL : HERO_FOIL;
  const label = `${process.env.TESTED === "alice" ? "ア" : "レ"}王＋A:${aVariant}`;
  console.log(`\n■ 組み合わせ: ${label}(固定の王) 対 ${process.env.BASE === "alice" ? "アリス" : "レジェンド"}(王は CPU が選ぶ)`);
  results.combo = pickRanks(RANKS.filter((r) => r !== "A")).map((r) => match(`${r} ${label}`, `combo:${process.env.TESTED || "hero"}:${aVariant}:${process.env.BASE || "hero"}`, r, null, tested, base));
}
if (MODES.includes("mix-vs-hero")) {
  console.log("\n■ レジェンドの王＋アリスの A(固定の王) 対 レジェンド(王は CPU が選ぶ)");
  results.mixHero = pickRanks(RANKS.filter((r) => r !== "A")).map((r) => match(`${r} ${HNAME[r]}＋A`, "mix-vs-hero", r, null, HERO_MIX, HERO_FOIL));
}
if (MODES.includes("mix-vs-alice")) {
  console.log("\n■ レジェンドの王＋アリスの A(固定の王) 対 アリス(王は CPU が選ぶ)");
  results.mixAlice = pickRanks(RANKS.filter((r) => r !== "A")).map((r) => match(`${r} ${HNAME[r]}＋A`, "mix-vs-alice", r, null, HERO_MIX, ALICE_FOIL));
}
if (MODES.includes("hmatrix")) {
  console.log("\n■ 総当たり: 最初のシリーズの王(固定) 対 最初のシリーズの王(固定)。勝率は測る側(先に書いた王)");
  results.hmatrix = [];
  for (const r of pickRanks(RANKS.filter((x) => x !== "A")))
    for (const q of RANKS.filter((x) => x !== "A" && (!process.env.BASE_RANKS || process.env.BASE_RANKS.split(",").includes(x))))
      results.hmatrix.push(match(`${r} 対 ${q}`, "hmatrix", r, q, HERO_FOIL, HERO_FOIL));
}
if (MODES.includes("alice-mirror-king")) {
  console.log("\n■ アリス側の王を固定 対 アリス(相手の王は CPU が選ぶ)");
  results.aliceMirrorKing = pickRanks(RANKS.filter((r) => r !== "A")).map((r) => match(`${r} ${NAME[r]}`, "alice-mirror-king", r, null, ALICE_FOIL, ALICE_FOIL));
}
if (out) out.end();
if (process.env.SUMMARY) fs.writeFileSync(process.env.SUMMARY, JSON.stringify({ games: PAIRS * 2, thinkMs: THINK_MS, profile: process.env.PROFILE || null, results }, null, 2));
}
