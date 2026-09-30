/**
 * 各話の「最後の1手」の手前まで台本どおりに進め、その局面で勝てる手を数える。
 * 自分で考える1手(choose)をどの話に置けるか、正解がいくつあるかを見るための道具。
 *   node tools/tutorial-finale-lab.mjs
 */
import { reducer } from "../src/game/reducer.js";
import { ADJUDICATION_RULE_VERSION } from "../src/game/adjudication.js";
import { getLegalMoves, kingRankOf, squareName } from "../src/game/board.js";
import { SUIT_SYMBOL } from "../src/game/constants.js";
import { pathToFileURL } from "node:url";
import { TUTORIALS, currentStepIndex, foeAction, openingState } from "../src/game/tutorial.js";

const legalOf = (s, owner) => (p) =>
  getLegalMoves(p, s.board, s.boardSize, s.players[owner].armyRankCounts, kingRankOf(s, owner));

export function flow(s) {
  if (s.captureReveal) return { type: "DISMISS_CAPTURE" };
  if (s.interstitial) return { type: "DISMISS_INTERSTITIAL" };
  if (s.setupEffects) return { type: "DISMISS_SETUP_EFFECTS" };
  if (s.pendingKingChoice && s.pendingKingChoice.owner === 0)
    return s.pendingKingChoice.acknowledged
      ? { type: "CHOOSE_HEIR", id: s.pendingKingChoice.candidateIds[0] }
      : { type: "ACK_KING_CHOICE" };
  if (s.phase === "dice") {
    if (s.diceIdx === 0 && s.dice[0] !== null) return { type: "NEXT_DICE_STEP" };
    if (s.diceIdx === 2) return { type: "GOTO_MULLIGAN" };
    if (s.diceIdx === 3) return { type: "REROLL_DICE" };
  }
  return null;
}

function act(need, s, tut) {
  const a = { ...need };
  delete a.choose;
  if (a.type === "ROLL_DICE_SINGLE") a.value = tut.dice[s.diceIdx] || 1;
  if (a.type === "CONFIRM_MULLIGAN") a.reserveOrder = [...tut.reserveOrder];
  if (a.type === "CONFIRM_SHUFFLE" && tut.shuffleOrder) a.order = [...tut.shuffleOrder];
  if (a.type === "TOGGLE_SHUFFLE_PICK" && !s.shuffleMode) {
    const ace = Object.values(s.pieces).find((p) => p.owner === 0 && p.alive && p.rank === "A");
    return { type: "SELECT_PIECE", id: ace.id };
  }
  if (a.type === "MOVE_PIECE") {
    const hit = legalOf(s, 0)(s.pieces[a.pieceId]).find((m) => m.row === a.row && m.col === a.col);
    if (!hit) return null;
    a.captures = hit.captures;
  }
  if (/^SETUP_/.test(a.type)) a.player = 0;
  return a;
}

/** 最後の need の手前の局面を返す */
export function beforeFinale(tut) {
  const lastNeed = tut.steps.map((x, i) => (x.need ? i : -1)).filter((i) => i >= 0).pop();
  let s = tut.opening
    ? openingState(tut, ADJUDICATION_RULE_VERSION)
    : reducer({ phase: "intro" }, { type: "START_SETUP", ruleVersion: ADJUDICATION_RULE_VERSION, size: tut.boardSize, setupMode: "simultaneous", deck: tut.deck.map((c) => ({ ...c })), pool: tut.pool, handSize: tut.handSize, scripted: !tut.bonus });
  let mark = 0, foeIdx = 0;
  for (let g = 0; g < 400; g++) {
    mark = currentStepIndex(tut, s, mark);
    const cur = tut.steps[mark];
    if (!cur) return null;
    const ready = !cur.at || cur.at(s);
    if (mark >= lastNeed && ready && cur.need) return { s, step: cur };
    if (ready && !cur.need) { mark++; continue; }
    if (ready && cur.need) {
      const a = act(cur.need, s, tut);
      if (!a) return null;
      s = reducer(s, a);
      continue;
    }
    const f = flow(s);
    if (f) { s = reducer(s, f); continue; }
    const foe = foeAction(s, tut, foeIdx, legalOf(s, 1));
    if (!foe) return null;
    if (foe.type === "MOVE_PIECE") foeIdx++;
    s = reducer(s, foe);
  }
  return null;
}

/** その局面で、target の駒を取る自分の手をすべて並べ、勝てるかを見る */
export function winningCaptures(s, targetId) {
  const out = [];
  for (const p of Object.values(s.pieces)) {
    if (p.owner !== 0 || !p.alive) continue;
    for (const m of legalOf(s, 0)(p)) {
      const caps = m.captures || [];
      const t0 = s.pieces[targetId];
      const hits = caps.some((c) => c.row === t0.row && c.col === t0.col) || (m.row === t0.row && m.col === t0.col);
      if (!hits) continue;
      let t = reducer(s, { type: "MOVE_PIECE", pieceId: p.id, row: m.row, col: m.col, captures: m.captures });
      for (let g = 0; g < 10 && flow(t); g++) t = reducer(t, flow(t));
      out.push({ pieceId: p.id, rank: p.rank, suit: p.suit, row: m.row, col: m.col, win: t.phase === "gameover" && t.winner === 0 });
    }
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const tut of TUTORIALS) {
    const at = beforeFinale(tut);
    if (!at) { console.log(`${tut.title}: 最後の手の手前まで進めない`); continue; }
    const { s, step } = at;
    if (step.need.type !== "MOVE_PIECE") { console.log(`${tut.title}: 最後は ${step.need.type}(対象外)`); continue; }
    const target = s.board[step.need.row][step.need.col];
    const kingHere = target && s.players[1].kingId === target.id;
    const list = target ? winningCaptures(s, target.id) : [];
    const size = s.boardSize;
    console.log(`${tut.title}: 的 ${squareName(step.need.row, step.need.col, size)}(${target ? target.rank + SUIT_SYMBOL[target.suit] : "空"}${kingHere ? "・王" : ""}) 取れる手 ${list.length} / 勝てる手 ${list.filter((x) => x.win).length}`);
    for (const x of list) console.log(`    ${x.rank}${SUIT_SYMBOL[x.suit]} ${squareName(s.pieces[x.pieceId].row, s.pieces[x.pieceId].col, size)}→${squareName(x.row, x.col, size)} ${x.win ? "勝ち" : "決着せず"}`);
  }
}
