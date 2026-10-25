/**
 * プレイヤーの自動配置(2026-10-25 本人の指示「今までの AI に覚えさせてきた戦略をベースに自動配置」)。
 * src/game/auto-setup.js が CPU の布陣の手順(chooseArmyPlan → arrangeArmy → 5×5 は shieldKing)で陣を作り、
 * reducer が placementOk を通してから使う。
 *
 * 見ること:
 *   A. 5×5・9×9 で、自動配置の陣が実際に置ける(枠が埋まる・自陣・採用上限)
 *   B. 王は後列にいる。前の自動配置(乱数)と比べて、初手で王に届く形が減る
 *   C. おすすめの陣のまま王選びへ進むと、その陣の王が選ばれている。並べ替えたら選ばれない
 *   D. 時間切れ(keep)で、置いた札があるときは置いた札を動かさない
 *   E. 細工した placement(自陣の外・枠の数違い)は受けない
 */
import assert from "node:assert/strict";
import { initialState, reducer, autoPickKing } from "../src/game/reducer.js";
import { armySlots, territoryRows, getLegalMoves, emptyBoard } from "../src/game/board.js";
import { strategicSetup, autoArrangeAction } from "../src/game/auto-setup.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";

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

/** サイコロと引き直しを済ませて布陣の段まで進める */
function toSetup(size, seed) {
  Math.random = seeded(seed);
  let s = reducer(initialState(), { type: "START_SETUP", size, setupMode: "simultaneous", ruleVersion: GAME_RULE_VERSION });
  for (let g = 0; s.phase === "dice" && g < 12; g++)
    s = reducer(s, s.diceIdx <= 1 && s.dice[s.diceIdx] === null ? { type: "ROLL_DICE_SINGLE", value: s.diceIdx === 0 ? 6 : 1, player: s.diceIdx } : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : { type: "NEXT_DICE_STEP" });
  for (let g = 0; s.phase === "mulligan" && g < 4; g++) s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: [], reserveOrder: s.reserve.map((c) => c.id) });
  assert.equal(s.phase, "setup", "布陣の段まで進む");
  return s;
}

/**
 * 王の晒され度: 相手の自陣のどこかに、どれかの数字の駒が1枚いたとして、初手で王のマスへ届く組み合わせの数。
 * 相手の伏せ札は知らないので、全部の数字・全部の升で数える(shieldKing と同じ考え)
 */
function exposure(state, player, placement, kingId) {
  const size = state.boardSize;
  const [lo, hi] = territoryRows(size, 1 - player);
  const king = placement[kingId];
  let n = 0;
  for (const rank of ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"])
    for (let row = lo; row <= hi; row++)
      for (let col = 0; col < size; col++) {
        const board = emptyBoard(size);
        for (const id of Object.keys(placement)) board[placement[id].row][placement[id].col] = { id, owner: player };
        if (board[row][col]) continue;
        const foe = { id: "foe", rank, suit: "spade", owner: 1 - player, row, col, alive: true, isKing: false };
        board[row][col] = foe;
        if (getLegalMoves(foe, board, size, { [rank]: 1 }, null).some((m) => m.row === king.row && m.col === king.col)) n++;
      }
  return n;
}

for (const size of [5, 9]) {
  console.log(`\n${size}×${size}`);
  const N = size === 5 ? 60 : 20;
  let built = 0, back = 0, oldExp = 0, newExp = 0, oldHits = 0, newHits = 0;
  for (let i = 0; i < N; i++) {
    const s = toSetup(size, 100 + i);
    for (const player of [0, 1]) {
      const plan = strategicSetup(s, player);
      if (!plan) continue;
      const t = reducer(s, autoArrangeAction(s, player));
      if (Object.keys(t.setupPlacements[player]).length === armySlots(s)) built++;
      const [lo, hi] = territoryRows(size, player);
      const backRow = player === 0 ? hi : lo, frontRow = player === 0 ? lo : hi;
      // 5×5 は後列(自陣は2行)。9×9 は前列でなければよい(守りの関係で中段に入ることがある)
      if (size === 5 ? plan.placement[plan.kingId].row === backRow : plan.placement[plan.kingId].row !== frontRow) back++;
      const e = exposure(s, player, plan.placement, plan.kingId);
      newExp += e;
      if (e > 0) newHits++;
      // 前の自動配置(乱数)と、その時の王の決め方(autoPickKing: いちばん強い数字)
      const old = reducer(s, { type: "SETUP_AUTO_ARRANGE", player, cellOrder: null }).setupPlacements[player];
      const oldKing = autoPickKing({ ...s, setupSuggest: [null, null] }, player, old);
      const oe = exposure(s, player, old, oldKing);
      oldExp += oe;
      if (oe > 0) oldHits++;
    }
  }
  is(`A. ${size}×${size}: おすすめの陣で枠が埋まる(${N * 2}陣)`, built, N * 2);
  is(size === 5 ? `B. 5×5: 王は後列(${back}/${N * 2})` : `B. 9×9: 王は前列にいない(${back}/${N * 2})`, back, N * 2);
  console.log(`     初手で王に届く組み合わせ(合計): 前の自動配置 ${oldExp} → おすすめの陣 ${newExp}。届く形がある陣: ${oldHits} → ${newHits}`);
  is(`B. ${size}×${size}: 初手で王に届く形が前の自動配置より少ない`, newExp < oldExp, true);
}

console.log("\nおすすめの陣の王");
{
  const s = toSetup(5, 7);
  const act = autoArrangeAction(s, 0);
  is("C. 手に placement と kingId が載る", [!!act.placement, typeof act.kingId], [true, "string"]);
  let t = reducer(s, act);
  t = reducer(t, { type: "SETUP_GOTO_KING_STEP", player: 0 });
  is("C. そのまま王選びへ進むと、その陣の王が選ばれている", t.setupPickKings[0], act.kingId);
  is("C. 時間切れの自動の王も同じ", autoPickKing(t, 0, t.setupPlacements[0]), act.kingId);
  // 並べ替える(置いた札を1枚外して置き直す)と、選んでおかない
  let u = reducer(s, act);
  const moved = Object.keys(u.setupPlacements[0]).find((id) => id !== act.kingId);
  const at = u.setupPlacements[0][moved];
  u = reducer(u, { type: "SETUP_UNPLACE_CARD", player: 0, cardId: moved });
  const [lo, hi] = territoryRows(5, 0);
  let free = null;
  for (let r = lo; r <= hi && !free; r++) for (let c = 0; c < 5 && !free; c++) if (!Object.values(u.setupPlacements[0]).some((p) => p.row === r && p.col === c) && !(r === at.row && c === at.col)) free = { row: r, col: c };
  u = reducer(u, { type: "SETUP_PLACE_CARD", player: 0, cardId: moved, ...free });
  u = reducer(u, { type: "SETUP_GOTO_KING_STEP", player: 0 });
  is("C. 並べ替えたら、王は選んでおかない", u.setupPickKings[0], null);
}

console.log("\n時間切れと細工");
{
  const s = toSetup(5, 11);
  const card = s.players[0].hand[0];
  const [lo] = territoryRows(5, 0);
  let t = reducer(s, { type: "SETUP_PLACE_CARD", player: 0, cardId: card.id, row: lo, col: 0 });
  const act = autoArrangeAction(t, 0, { keep: true });
  is("D. 置いた札があるときの時間切れは、従来の埋め方(おすすめの陣を載せない)", [act.keep, act.placement], [true, undefined]);
  t = reducer(t, act);
  is("D. 置いた札は動かさない", t.setupPlacements[0][card.id], { row: lo, col: 0 });
  is("D. 枠は埋まる", Object.keys(t.setupPlacements[0]).length, armySlots(s));
  const empty = autoArrangeAction(s, 0, { keep: true });
  is("D. 1枚も置いていない時間切れは、おすすめの陣", !!empty.placement, true);
  // 細工: 相手の陣地に置く
  const good = autoArrangeAction(s, 0);
  const bad = { ...good, placement: Object.fromEntries(Object.entries(good.placement).map(([id, p]) => [id, { row: 0, col: p.col }])) };
  const r = reducer(s, bad);
  is("E. 自陣の外の placement は使わない(従来の自動配置に落ちる)", Object.values(r.setupPlacements[0]).every((p) => p.row >= lo), true);
  const short = { ...good, placement: Object.fromEntries(Object.entries(good.placement).slice(0, 2)) };
  is("E. 枠の数が違う placement は使わない", Object.keys(reducer(s, short).setupPlacements[0]).length, armySlots(s));
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
