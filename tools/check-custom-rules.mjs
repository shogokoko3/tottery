import assert from "node:assert/strict";
import fs from "node:fs";
import { initialState, reducer } from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";
import { armySlots, totalSlots } from "../src/game/board.js";
import { RANKS } from "../src/game/constants.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { automaticAreaAction } from "../src/game/area-presentation.js";
import {
  armySizeFor,
  handSizeFor,
  normalizeCustom,
  normalizeRanks,
  toggleRank,
  isDefaultCustom,
  customSummary,
  loadoutsForCustom,
  rankListText,
  DEFAULT_CUSTOM,
} from "../src/game/custom-rules.js";
import { GAME_RULE_VERSION, hasCustomRules } from "../src/game/rule-version.js";

// ---- 数の決まり ----
assert.equal(armySizeFor(9, 13), 9);
assert.equal(armySizeFor(5, 13), 5);
assert.equal(armySizeFor(9, 8), 5);
assert.equal(armySizeFor(9, 4), 3, "3枚を下回らない");
assert.equal(armySizeFor(5, 4), 3);
assert.equal(handSizeFor(9, 13), 13);
assert.equal(handSizeFor(9, 4), 4, "予備札が8枚残る(16-8)");
assert.equal(handSizeFor(9, 6), 8);
for (let n = 4; n <= 13; n++) {
  const army = armySizeFor(9, n), hand = handSizeFor(9, n);
  assert.ok(hand >= army && 4 * n - 2 * hand >= 8, `${n}種類: 手札${hand}・駒${army}・予備${4 * n - 2 * hand}`);
}
assert.equal(normalizeRanks(["2", "3", "4"]), null, "4種類未満は不可");
assert.equal(normalizeRanks(["J", "Q", "K", "A"]), null, "J・Q・K 以外が2種類未満は不可");
assert.deepEqual(normalizeRanks(["K", "2", "A", "5", "bogus"]), ["A", "2", "5", "K"], "RANKS の順に直す");
assert.equal(toggleRank(["2", "3", "4", "5"], "5"), null, "最低条件を割る切り替えは null");
assert.deepEqual(toggleRank(["2", "3", "4", "5"], "J"), ["2", "3", "4", "5", "J"]);
assert.equal(rankListText(["2", "3", "4", "5", "7", "J", "K"]), "2〜5・7・J・K");
assert.equal(normalizeCustom(null, 9), null);
assert.equal(normalizeCustom("x", 9), null);
{
  const c = normalizeCustom({ ranks: ["2", "3", "4", "5"], areas: "bogus", reveal: { count: 99, king: 1, choose: true } }, 9);
  assert.deepEqual(c, { ranks: ["2", "3", "4", "5"], areas: "both", reveal: { count: 2, king: false, choose: true } }, "言い値を整える(公開は駒-1まで)");
  assert.equal(isDefaultCustom(c), false);
  assert.equal(isDefaultCustom(normalizeCustom(DEFAULT_CUSTOM, 9)), true);
  assert.equal(customSummary(normalizeCustom(DEFAULT_CUSTOM, 9), 9), "クラシック");
  assert.match(customSummary(c, 9), /札 2〜5\(駒 3枚・手札 4枚\) \/ 公開 2枚\(自分で選ぶ\)/);
}
assert.deepEqual(loadoutsForCustom({ areas: "guest" }, [{ K: "a:foil" }, { K: "b:foil" }]), [{ K: "a" }, { K: "b:foil" }]);
assert.deepEqual(loadoutsForCustom({ areas: "none" }, [{ K: "a:foil" }, { K: "b:foil" }]), [{ K: "a" }, { K: "b" }]);
assert.deepEqual(loadoutsForCustom(null, [{ K: "a:foil" }, {}]), [{ K: "a:foil" }, {}]);
assert.ok(hasCustomRules(GAME_RULE_VERSION) && !hasCustomRules(16));

// ---- 対局: 使う札を絞ると山札・駒・手札が変わり、CPU 同士で最後まで進む ----
function seeded(seed) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
}
function play(custom, size, { seed = 7, maxTurns = 400 } = {}) {
  const realRandom = Math.random;
  Math.random = seeded(seed);
  try {
    let s = reducer(
      initialState(),
      enrichAction(
        {
          type: "START_SETUP",
          size,
          setupMode: "simultaneous",
          ruleVersion: GAME_RULE_VERSION,
          custom,
          ...(custom && custom.areas !== "none" && size === 9
            ? { areas: true, loadouts: loadoutsForCustom(custom, [{ K: "k0:foil" }, { K: "k1:foil" }]) }
            : {}),
        },
        initialState(),
      ),
    );
    assert.equal(s.phase, "dice", "始まる");
    const c = normalizeCustom(custom, size);
    const ranks = c ? c.ranks : RANKS;
    assert.ok([...s.players[0].hand, ...s.players[1].hand, ...s.reserve].every((card) => ranks.includes(card.rank)), "山札は使う札だけ");
    assert.equal(s.players[0].hand.length + s.players[1].hand.length + s.reserve.length, ranks.length * 4);
    assert.equal(armySlots(s), c ? armySizeFor(size, ranks.length) : totalSlots(size));
    assert.equal(
      s.players[0].hand.length,
      c ? handSizeFor(size, ranks.length) : Math.max(totalSlots(size), Math.min(13, Math.floor((ranks.length * 4) / 3))),
    );
    for (let guard = 0; s.phase !== "gameover" && guard < 3000; guard++) {
      if (s.captureReveal) { s = reducer(s, { type: "DISMISS_CAPTURE" }); continue; }
      if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
      if (s.setupEffects) { s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" }); continue; }
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
        const a = cpuInformedAction(s, s.mulliganIdx);
        assert.equal(a?.type, "CONFIRM_MULLIGAN", "引き直し");
        s = reducer(s, enrichAction(a, s));
        continue;
      }
      if (s.phase === "setup") {
        for (const p of [0, 1]) {
          if (s.setupDone[p]) continue;
          const a = cpuInformedAction(s, p);
          assert.equal(a?.type, "SETUP_CONFIRM", `布陣(${p})`);
          const next = reducer(s, a);
          assert.ok(next.setupDone[p], `布陣が受理される(${p})`);
          s = next;
        }
        continue;
      }
      if (s.phase === "play") {
        if (s.turnNo >= maxTurns) break;
        const p = s.currentTurn;
        let a = automaticAreaAction(s) || cpuInformedAction(s, p);
        assert.ok(a, `手番${s.turnNo}: 手がある(${p})`);
        if (a.type === "__CPU_SHUFFLE") {
          s = reducer(s, { type: "SELECT_PIECE", id: a.aceId });
          for (const id of a.pickIds) s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id });
          a = { type: "CONFIRM_SHUFFLE", aId: a.aceId, pickIds: a.pickIds };
        }
        const next = reducer(s, enrichAction({ ...a, elapsedMs: 0 }, s));
        assert.notEqual(next, s, `手番${s.turnNo}: ${a.type} が拒否されない(${p})`);
        s = { ...next, replay: [] };
        continue;
      }
      throw new Error(`想定外の phase ${s.phase}`);
    }
    return s;
  } finally {
    Math.random = realRandom;
  }
}
{
  const custom = { ranks: ["2", "3", "4", "5", "6", "7"], areas: "both", reveal: { count: 0, king: false, choose: false } };
  const s = play(custom, 9, { seed: 11, maxTurns: 6 });
  assert.ok(s.phase === "play" || s.phase === "gameover", `6種類の札で布陣を越えて対局に入る(${s.phase})`);
  for (const i of [0, 1]) assert.equal(s.initialArmyRanks ? s.initialArmyRanks[i].length : Object.values(s.pieces).filter((p) => p.owner === i).length, 4, "駒は 4 枚ずつ");
  const full = play(custom, 9, { seed: 12 });
  assert.ok(full.phase === "gameover" || full.turnNo >= 400, `最後まで進む(${full.phase} 手番${full.turnNo})`);
}
{
  // 公開: 王を除いて 2 枚、王も
  const custom = { ranks: RANKS, areas: "both", reveal: { count: 2, king: true, choose: false } };
  const s = play(custom, 5, { seed: 3, maxTurns: 0 });
  assert.ok(s.phase === "play", `対局に入る(${s.phase})`);
  for (const i of [0, 1]) {
    const mine = Object.values(s.pieces).filter((p) => p.owner === i);
    const shown = mine.filter((p) => p.revealed);
    assert.equal(shown.length, 3, `${i}: 2枚＋王が公開`);
    assert.ok(shown.some((p) => p.isKing), "王も公開");
  }
  assert.ok(s.log.some((l) => /詳細設定: .*3枚公開された\(王を含む\)/.test(l)));
}
{
  // 自分で選ぶ: 布陣の確定に revealIds を載せる。形が違えば断る。無ければランダム
  const custom = { ranks: RANKS, areas: "both", reveal: { count: 1, king: false, choose: true } };
  let s = reducer(initialState(), enrichAction({ type: "START_SETUP", size: 5, setupMode: "simultaneous", ruleVersion: GAME_RULE_VERSION, custom }, initialState()));
  assert.equal(s.custom.reveal.choose, true);
  // サイコロ・引き直しを進めて布陣へ
  let guard = 0;
  while (s.phase !== "setup" && guard++ < 60) {
    if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
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
    s = reducer(s, enrichAction(cpuInformedAction(s, s.mulliganIdx), s));
  }
  assert.equal(s.phase, "setup");
  for (const who of [0, 1]) {
    s = reducer(s, { type: "SETUP_AUTO_ARRANGE", player: who });
    s = reducer(s, { type: "SETUP_GOTO_KING_STEP", player: who });
    const king = Object.keys(s.setupPlacements[who]).find((id) => s.players[who].hand.find((c) => c.id === id).rank !== "K") || Object.keys(s.setupPlacements[who])[0];
    s = reducer(s, { type: "SETUP_PICK_KING", player: who, cardId: king });
    if (!s.setupPickKings[who]) {
      const k = Object.keys(s.setupPlacements[who]).find((id) => s.players[who].hand.find((c) => c.id === id).rank === "K");
      s = reducer(s, { type: "SETUP_PICK_KING", player: who, cardId: k });
    }
    const kingId = s.setupPickKings[who];
    const other = Object.keys(s.setupPlacements[who]).find((id) => id !== kingId);
    if (who === 0) {
      assert.equal(reducer(s, { type: "SETUP_CONFIRM", player: who, revealIds: [kingId] }), s, "王は公開に選べない");
      assert.equal(reducer(s, { type: "SETUP_CONFIRM", player: who, revealIds: [other, other] }), s, "枚数が違えば断る");
      s = reducer(s, { type: "SETUP_CONFIRM", player: who, revealIds: [other] });
      assert.deepEqual(s.setupReveals[0], [other], "選んだ駒を控える");
    } else {
      s = reducer(s, { type: "SETUP_CONFIRM", player: who });
      assert.equal(s.setupReveals[1], null, "選ばなければランダム(CPU)");
    }
  }
  assert.equal(s.phase, "play");
  const shown0 = Object.values(s.pieces).filter((p) => p.owner === 0 && p.revealed);
  assert.equal(shown0.length, 1);
  assert.equal(shown0[0].id, s.setupReveals[0][0], "自分で選んだ駒が公開される");
  assert.equal(Object.values(s.pieces).filter((p) => p.owner === 1 && p.revealed && !p.isKing).length, 1, "相手はランダムに 1 枚");
}
{
  // クラシック(custom 無し)は今までどおり
  const s = reducer(initialState(), enrichAction({ type: "START_SETUP", size: 9, setupMode: "simultaneous", ruleVersion: GAME_RULE_VERSION }, initialState()));
  assert.equal(s.custom, null);
  assert.equal(armySlots(s), 9);
  assert.equal(s.players[0].hand.length, 13);
}

// ---- 配線 ----
const screens = fs.readFileSync("src/ui/screens.jsx", "utf8");
const game = fs.readFileSync("src/ui/game.jsx", "utf8");
const setup = fs.readFileSync("src/ui/setup.jsx", "utf8");
assert.match(screens, /const customUnlocked = !!onCustom && foilRevealed\(getCollection\(\)\);/, "詳細設定はフォイルを持つ人だけ");
assert.match(screens, /フォイルを手に入れてエリアを解放すると使えます/, "持つ前は鍵つき");
assert.doesNotMatch(screens, /詳細設定\(開発中\)/);
assert.match(screens, /custom=\{o === "online" \? null : customRules\}/, "ランダムマッチには出さない");
assert.match(screens, /custom=\{!tut && !bot && !\(a && a\.random\) \? customRules : null\}/, "対局へ渡すのも CPU・同じ端末・フレンドだけ");
assert.match(game, /\(!network \|\| hasCustomRules\(network\.ruleVersion\)\)/, "通信は版17から");
assert.match(game, /loadouts: loadoutsForCustom\(customRules, skins\)/, "エリアの側は装備で伝える");
assert.match(game, /!\(customRules && customRules\.areas === "none"\)/);
assert.match(setup, /const slots = armySlots\(state\);/, "布陣の枠は armySlots");
assert.match(setup, /revealIds: chosenReveals/, "自分で選んだ公開を確定に載せる");
for (const f of ["src/game/cpu.js", "src/game/cpu-joseki.js", "src/game/cpu-strategy.js"])
  assert.doesNotMatch(fs.readFileSync(f, "utf8"), /totalSlots\(state\.boardSize\)/, `${f} は armySlots を読む`);
const rules = JSON.parse(fs.readFileSync("firebase-rules.json", "utf8"));
const acts = rules.rules.rooms.$code.acts.$aid;
assert.ok(acts.custom && acts.custom.ranks && acts.custom.reveal && acts.revealIds, "Firebase のルールに custom / revealIds");
console.log("詳細設定: 数の決まり・言い値の整え・札を絞った対局・公開(ランダム/王/自分で選ぶ)・クラシック不変・配線・ルール: OK");
