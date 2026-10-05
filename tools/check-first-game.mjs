/**
 * はじめの一局(src/game/tutorial.js の FIRST_GAME。2026-10-01 本人の指示)の検査。
 *
 * 画面と同じ手順で通す: openingState で始め、案内の位置は currentStepIndex で盤面から
 * 引き直し、遊ぶ人の操作は tutorialGate(game.jsx の y() の関門)を通し、相手は
 * foeHeld でなければ foeAction の手を指す。
 *   A. 盤の上の正しさ: 王を選ぶ段で止まる・王の力なし・役なし・初手で取れるのは 4♠ だけ・
 *      相手に取る手が無い・判定にならない
 *   B. 台本の通し: 王5通り × 選び直しのあり・なし × 4♦/5♥ で勝ちまで。holdFoe で相手が止まる・
 *      b4 は関門で止まる・並べ直しは止まる・結果のあなたの王の一行・1手目の空きマスは「そこに、伏せ札は無い。」・
 *      外したあとの取らない手は「取るのは、逃げた一枚。」
 *   C. 押せる操作をすべてたどる: 行き止まりが無く、勝ち以外で終わらない。あなたの番に札の無い場面が無い
 *   D. 文: 各行20字まで・行の出し分け・あと N 手・一言に ▼ を数えさせない
 *   E. 第1〜13話は変わらない(王の力あり・一覧に入らない・関門の文・題)
 */
import { reducer } from "../src/game/reducer.js";
import { getLegalMoves, kingRankOf, squareName } from "../src/game/board.js";
import { isDeadPosition } from "../src/game/adjudication.js";
import { isFlush, isStraight } from "../src/game/bonus.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import {
  ALL_TUTORIALS,
  FIRST_GAME,
  TUTORIALS,
  canStepBack,
  currentStepIndex,
  foeAction,
  foeHeld,
  movesLeft,
  myKingNote,
  openingState,
  stepLines,
  textLines,
  tutorialById,
  tutorialGate,
} from "../src/game/tutorial.js";

let fail = 0;
function ok(label, cond, extra) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) fail++;
}

const tut = FIRST_GAME;
const MY = ["t0", "t1", "t2", "t3", "t4"];
const FOE = ["t5", "t6", "t7", "t8", "t9"];
const SYM = { spade: "♠", heart: "♥", diamond: "♦", club: "♣" };
const nm = (p) => `${p.rank}${SYM[p.suit]}`;
const sq = (r, c) => squareName(r, c, 5);
const legal = (a, p) =>
  getLegalMoves(p, a.board, a.boardSize, a.players[p.owner].armyRankCounts, kingRankOf(a, p.owner));
const capturesOf = (a, ids) =>
  ids
    .filter((id) => a.pieces[id] && a.pieces[id].alive)
    .flatMap((id) => legal(a, a.pieces[id]).filter((m) => m.capture).map((m) => `${id}>${sq(m.row, m.col)}`))
    .sort();
const moveOf = (a, id, row, col) => {
  const hit = legal(a, a.pieces[id]).find((m) => m.row === row && m.col === col);
  return hit ? { type: "MOVE_PIECE", pieceId: id, row, col, captures: hit.captures } : null;
};
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

/* ---------------- 画面の模型(game.jsx と同じ道具を呼ぶ) ---------------- */

const idxOf = (m) => currentStepIndex(tut, m.a, m.tutStep);
/** 盤の上の自動(交代の画面は台本の対局では出さない)と、進んだところまでを覚える */
function settle(m) {
  let a = m.a;
  for (let g = 0; g < 10 && a.interstitial; g++) a = reducer(a, { type: "DISMISS_INTERSTITIAL" });
  const next = { ...m, a };
  return { ...next, tutStep: Math.max(next.tutStep, idxOf(next)) };
}
/** y(): 関門を通れば reducer へ。止まれば一言を返す */
function press(m, E) {
  // 画面と同じ: マスを押した手は、選んでいる駒(selectedId)を pieceId に足してから関門へ(game.jsx の y())
  if (E.type === "MOVE_PIECE" && !E.pieceId && m.a.selectedId) E = { ...E, pieceId: m.a.selectedId };
  const g = tutorialGate(tut, idxOf(m), m.a, E);
  if (g) return { blocked: g.nudge, m };
  return { m: settle({ ...m, a: reducer(m.a, E) }) };
}
/** 台本の相手の effect。holdFoe の札のあいだは指さない */
function foeTick(m) {
  if (foeHeld(tut, idxOf(m), m.a)) return null;
  const act = foeAction(m.a, tut, m.foeIdx, (p) => legal(m.a, p));
  if (!act) return null;
  const a = reducer(m.a, act);
  if (a === m.a) return null;
  return settle({ ...m, a, foeIdx: m.foeIdx + (act.type === "MOVE_PIECE" ? 1 : 0) });
}
function runFoe(m) {
  for (let g = 0; g < 10; g++) {
    const n = foeTick(m);
    if (!n) return m;
    m = n;
  }
  return m;
}
/** いま出ている札(場面が来ていなければ null) */
function active(m) {
  const st = tut.steps[idxOf(m)];
  return st && (!st.at || st.at(m.a)) ? st : null;
}
const start = () => settle({ a: openingState(tut, GAME_RULE_VERSION), tutStep: 0, foeIdx: 0 });

/* =====================================================================
   A. 盤の上の正しさ
   ===================================================================== */
console.log("A. 盤の上の正しさ");
{
  const m = start();
  const a = m.a;
  ok("一覧(TUTORIALS・ALL_TUTORIALS)に入らない", !ALL_TUTORIALS.includes(tut) && !tutorialById(tut.id));
  ok("フェーズ1・ストーリー二と三の王の初回", tut.phase === 1 && tut.storyAxis === "23");
  ok(
    "opening は王を選ぶ段で止まる(相手は確定済み・あなたは未確定)",
    a.phase === "setup" && a.setupSteps[0] === "king" && a.setupDone[1] && !a.setupDone[0] && a.setupPickKings[0] === null,
    `${a.phase} ${JSON.stringify(a.setupSteps)} ${JSON.stringify(a.setupDone)}`,
  );
  ok("サイコロ: あなたが先手", a.firstPlayer === 0, `firstPlayer=${a.firstPlayer}`);
  ok("引き直し: 捨て札なし", a.players[0].discard.length === 0 && a.players[1].discard.length === 0);
  ok(
    "並べてあるのは5枚(c2 4♠・c1 5♥・e1 4♦・a2 3♣・b1 2♥)",
    MY.every((id) => same(a.setupPlacements[0][id], tut.opening.placement[id])) &&
      Object.keys(a.setupPlacements[0]).length === 5,
  );
  ok("王の力なし(kingPowers:false)", a.kingPowers === false);
  ok("案内は1枚目(王を選ぶ)から", idxOf(m) === 0);
}

// 王5通りで、盤の上の言い分を合法手で確かめる
for (const king of MY) {
  let s = openingState(tut, GAME_RULE_VERSION);
  s = reducer(s, { type: "SETUP_PICK_KING", player: 0, cardId: king });
  s = reducer(s, { type: "SETUP_CONFIRM", player: 0 });
  for (let g = 0; g < 10 && s.interstitial; g++) s = reducer(s, { type: "DISMISS_INTERSTITIAL" });
  const label = `王=${nm(s.pieces[king])}`;
  ok(`${label}: 対局が始まる(あなたの番)`, s.phase === "play" && s.currentTurn === 0, s.phase);
  ok(`${label}: 全駒が王の力なし`, Object.values(s.pieces).every((p) => p.powers === false));
  const armies = [0, 1].map((o) => Object.values(s.pieces).filter((p) => p.owner === o));
  ok(
    `${label}: 役が出ない(ストレート・フラッシュなし)`,
    !s.setupEffects && armies.every((x) => !isStraight(x) && !isFlush(x)),
  );
  ok(`${label}: 初手で取れるのは 4♠ c2→c4 だけ`, same(capturesOf(s, MY), ["t0>c4"]), capturesOf(s, MY).join(","));
  ok(`${label}: 判定にならない(始め)`, !isDeadPosition(s));
  s = reducer(s, moveOf(s, "t0", 1, 2));
  ok(`${label}: 取った 2♣ は王ではない`, !s.pieces.t5.alive && !s.pieces.t5.isKing && !!s.captureReveal);
  s = reducer(s, { type: "DISMISS_CAPTURE" });
  ok(`${label}: 4♠ が b4 と d4 を両取り`, same(capturesOf(s, ["t0"]), ["t0>b4", "t0>d4"]), capturesOf(s, ["t0"]).join(","));
  ok(`${label}: 相手に取る手が無い`, capturesOf(s, FOE).length === 0, capturesOf(s, FOE).join(","));
  const reach = new Set(legal(s, s.pieces.t0).map((mv) => sq(mv.row, mv.col)));
  const safe = legal(s, s.pieces.t6)
    .map((mv) => sq(mv.row, mv.col))
    .filter((c) => !reach.has(c));
  ok(`${label}: 3♦ の逃げ場で 4♠ の届かないのは e3 だけ`, same(safe, ["e3"]), safe.join(","));
  ok(`${label}: 判定にならない(相手の番)`, !isDeadPosition(s));
  const act = foeAction(s, tut, 0, (p) => legal(s, p));
  ok(`${label}: 台本の相手の手は 3♦ d4→e3`, !!act && act.pieceId === "t6" && act.row === 2 && act.col === 4, JSON.stringify(act));
  s = reducer(s, act);
  ok(`${label}: 判定にならない(2手目の前)`, s.phase === "play" && s.currentTurn === 0 && !isDeadPosition(s));
  ok(
    `${label}: 取れる手は e3(4♦・5♥)と b4(4♠)だけ`,
    same(capturesOf(s, MY), ["t0>b4", "t1>e3", "t2>e3"]),
    capturesOf(s, MY).join(","),
  );
}

/* =====================================================================
   B. 台本の通し(王5通り × 選び直しのあり・なし × 4♦/5♥)
   ===================================================================== */
console.log("\nB. 台本の通し");
/** 1通りを最後まで指す。食い違いを文で返す(途中で止まっても例外にしない) */
function playThrough(king, repick, finisher, miss = false) {
  const errs = [];
  const want = (cond, what) => {
    if (!cond) errs.push(what);
    return !!cond;
  };
  try {
    let m = start();
    // 1枚目: 王を選ぶ。並べ直しは止まる
    for (const type of ["SETUP_BACK_TO_PLACE", "SETUP_UNPLACE_CARD"])
      want(press(m, { type, player: 0, cardId: "t3" }).blocked, `王を選ぶ札で ${type} が止まらない`);
    want(press(m, { type: "SETUP_CONFIRM", player: 0 }).blocked, "王を選ぶ前の確定が止まらない");
    const first = repick ? MY.find((id) => id !== king) : king;
    let r = press(m, { type: "SETUP_PICK_KING", player: 0, cardId: first });
    want(!r.blocked, `王に ${first} を選べない`);
    m = r.m;
    want(idxOf(m) === 1, `王を選んでも確定の札へ進まない(${idxOf(m)})`);
    // 2枚目: 確定。選び直しは通る(also)。並べ直しは止まる
    for (const type of ["SETUP_BACK_TO_PLACE", "SETUP_UNPLACE_CARD"])
      want(press(m, { type, player: 0, cardId: "t3" }).blocked, `確定の札で ${type} が止まらない`);
    if (repick) {
      r = press(m, { type: "SETUP_PICK_KING", player: 0, cardId: king });
      want(!r.blocked, "確定の札で選び直しが止まる");
      m = r.m;
      want(idxOf(m) === 1 && m.a.setupPickKings[0] === king, "選び直しで札がずれる");
    }
    r = press(m, { type: "SETUP_CONFIRM", player: 0 });
    want(!r.blocked, "確定が止まる");
    m = runFoe(r.m);
    want(m.a.phase === "play" && m.a.currentTurn === 0 && m.a.players[0].kingId === king, "確定しても対局が始まらない");
    want(m.a.kingPowers === false, "王の力が付いている");
    // 3枚目: 4♠ で c4 を取る。4♠ を選ぶと文が変わる。ほかの駒は止まる
    want(idxOf(m) === 2 && same(stepLines(active(m), m.a), textLines(tut.steps[2].text)), "1手目の札が出ない");
    want(movesLeft(tut, idxOf(m)) === 2, "1手目で「あと 2 手」にならない");
    const other = moveOf(m.a, "t1", 3, 3);
    r = press(m, other);
    want(same(r.blocked, textLines(tut.steps[2].nudge)), `ほかの駒の手が止まらない(${JSON.stringify(r.blocked)})`);
    const sel = settle({ ...m, a: reducer(m.a, { type: "SELECT_PIECE", id: "t0" }) });
    want(same(stepLines(active(sel), sel.a), textLines(tut.steps[2].picked)), "4♠ を選んでも文が変わらない");
    // 4♠ で c4 以外の空きマスへ動かすと、台本の一言(wrongCell)で止まり、札は picked のまま(2026-10-05 見直し)
    const empties = legal(m.a, m.a.pieces.t0).filter((mv) => !mv.capture);
    want(same(empties.map((mv) => sq(mv.row, mv.col)).sort(), ["b2", "c3", "d2", "e2"]), `4♠ の空きマスが c3・b2・d2・e2 でない(${empties.map((mv) => sq(mv.row, mv.col))})`);
    for (const mv of empties) {
      const direct = press(m, { type: "MOVE_PIECE", pieceId: "t0", row: mv.row, col: mv.col, captures: mv.captures });
      want(same(direct.blocked, textLines(tut.steps[2].wrongCell)), `4♠→${sq(mv.row, mv.col)} が「そこに、伏せ札は無い。」で止まらない(${JSON.stringify(direct.blocked)})`);
      // 画面と同じ形: 4♠ を選んでから、pieceId を付けずにマスを押す
      const viaSel = press(sel, { type: "MOVE_PIECE", row: mv.row, col: mv.col, captures: mv.captures });
      want(same(viaSel.blocked, textLines(tut.steps[2].wrongCell)), `選んでから ${sq(mv.row, mv.col)} を押しても台本の一言で止まらない`);
      want(same(stepLines(active(viaSel.m), viaSel.m.a), textLines(tut.steps[2].picked)), "止めたあと札が picked のままでない");
    }
    r = press(sel, { type: "MOVE_PIECE", pieceId: "t0", row: 1, col: 2 });
    want(!r.blocked, "4♠ c2→c4 が止まる");
    m = runFoe(r.m);
    want(!!m.a.captureReveal && !m.a.pieces.t5.alive, "2♣ を取れない");
    r = press(m, { type: "DISMISS_CAPTURE" });
    m = runFoe(r.m);
    // 4枚目: 相手を待たせる札。「つづき」を押すまで相手は指さない
    const held = active(m);
    if (!want(!!held && held.holdFoe && foeHeld(tut, idxOf(m), m.a), "相手を待たせる札が出ない")) return errs;
    want(m.a.currentTurn === 1 && m.a.pieces.t6.row === 1 && m.a.pieces.t6.col === 3, "相手が待たずに指した");
    const holdText = king === "t0" ? held.kingAlt.text : held.text;
    want(same(stepLines(held, m.a), textLines(holdText)), "待つ札の文が王の札で出し分けられない");
    want(!canStepBack(tut, idxOf(m), m.a), "待つ札に「前の説明へ」が出る");
    m = runFoe(settle({ ...m, tutStep: idxOf(m) + 1 }));
    want(m.a.pieces.t6.row === 2 && m.a.pieces.t6.col === 4 && m.a.currentTurn === 0, "「つづき」のあと相手が e3 へ逃げない");
    // 5枚目: どちらの札も取れる。外れたら実際の撃破を見て、次の手で読み直せる。
    const pick = active(m);
    if (!want(!!pick && pick.need && pick.need.choose && idxOf(m) === 4, "自分で考える1手の札が出ない")) return errs;
    want(movesLeft(tut, idxOf(m)) === 1, "2手目で「あと 1 手」にならない");
    want(!canStepBack(tut, idxOf(m), m.a), "自分で考える1手に「前の説明へ」が出る");
    r = press(m, moveOf(m.a, "t0", 1, 1));
    want(!r.blocked && !r.m.a.pieces.t9.alive && !!r.m.a.captureReveal, "b4 を選んでも外れの札を取れない");
    if (miss) {
      m = runFoe(press(r.m, { type: "DISMISS_CAPTURE" }).m);
      want(m.a.currentTurn === 0 && m.foeIdx === 2, "外れたあと相手が動かずに止まる");
      want(same(stepLines(active(m), m.a), pick.afterMiss.text), "外れたあとの手がかりが出ない");
      want(m.a.players[0].kingId === king && m.a.pieces[king].alive, "外れた分岐で自分の王が失われる");
    }
    r = press(m, moveOf(m.a, "t0", 2, miss ? 1 : 2));
    // 外したあとは、残された一枚(5♦)はもう盤に無い。取らない手の一言は逃げた一枚だけを指す(2026-10-05 見直し)
    const notCapture = miss ? pick.afterMiss.notCapture : pick.need.choose.notCapture;
    want(same(r.blocked, textLines(notCapture)), `取らない手が止まらない・一言が場面に合わない(${JSON.stringify(r.blocked)})`);
    for (const [id, row, col] of [["t4", 4, 0], ["t3", 2, 1], ["t2", 3, 4]]) {
      const mv = moveOf(m.a, id, row, col);
      if (mv) want(!!press(m, mv).blocked, `取らない手 ${id}→${sq(row, col)} が通る`);
    }
    want(!isDeadPosition(m.a), "2手目の前に判定になる");
    r = press(m, moveOf(m.a, finisher, 2, 4));
    want(!r.blocked, `${finisher} で e3 を取る手が止まる`);
    m = r.m;
    want(m.a.phase === "gameover" && m.a.winner === 0 && !m.a.adjudication, `勝ちで終わらない(${m.a.phase} ${m.a.winner})`);
    want(m.a.pieces[king].alive && m.a.pieces[king].isKing, "あなたの王が生きていない");
    m = settle({ ...m, a: reducer(m.a, { type: "DISMISS_CAPTURE" }) });
    want(!!active(m) && active(m).end && same(stepLines(active(m), m.a), miss ? tut.steps[5].afterMiss.text : tut.steps[5].text), "選択に合う結びの札が出ない");
    // 結果のあなたの王の一行。王が自分で討つと表になる(reducer の名乗り)
    const struck = king === finisher;
    want(!!m.a.pieces[king].revealed === struck, "王が討ったときだけ表になる、が成り立たない");
    want(myKingNote(tut, m.a) === (struck ? tut.kingNote.struck : tut.kingNote.hidden), "結果のあなたの王の一行が合わない");
  } catch (e) {
    errs.push(`途中で止まった: ${e.message}`);
  }
  return errs;
}
const won = [];
for (const king of MY)
  for (const repick of [false, true])
    for (const finisher of ["t2", "t1"]) for (const miss of [false, true]) {
      const label = `王=${king}${repick ? "(選び直し)" : ""}・${miss ? "外してから" : "一度で"} ${finisher === "t2" ? "4♦" : "5♥"} で討つ`;
      const errs = playThrough(king, repick, finisher, miss);
      if (!errs.length) won.push(label);
      ok(label, errs.length === 0, errs.join(" / "));
    }
ok("外れの分岐も含め40通りすべて勝ちまで通る", won.length === 40, `${won.length}/40`);

/* =====================================================================
   C. 押せる操作をすべてたどる(深さ優先)
   ===================================================================== */
console.log("\nC. 押せる操作をすべてたどる");
function options(m) {
  const a = m.a;
  const out = [];
  if (a.phase === "gameover") return out;
  if (a.captureReveal) return [{ label: "撃破の札を閉じる", E: { type: "DISMISS_CAPTURE" } }];
  const i = idxOf(m);
  const act = active(m);
  if (act && !act.need && !act.end) out.push({ label: `次へ(札${i})`, to: i + 1 });
  if (act && !act.end && canStepBack(tut, i, a)) out.push({ label: `前の説明へ(札${i})`, to: i - 1 });
  if (a.phase === "setup" && !a.setupDone[0]) {
    if (a.setupSteps[0] !== "king") return [{ label: "(並べる場面)", place: true }];
    for (const id of Object.keys(a.setupPlacements[0]))
      out.push({ label: `王に ${id}`, E: { type: "SETUP_PICK_KING", player: 0, cardId: id } });
    out.push({ label: "布陣を確定", E: { type: "SETUP_CONFIRM", player: 0 } });
    out.push({ label: "配置に戻る", E: { type: "SETUP_BACK_TO_PLACE", player: 0 } });
    for (const id of MY) out.push({ label: `手札に戻す ${id}`, E: { type: "SETUP_UNPLACE_CARD", player: 0, cardId: id } });
  }
  if (a.phase === "play" && a.currentTurn === 0 && !a.pendingKingChoice)
    for (const id of MY) {
      const p = a.pieces[id];
      if (!p || !p.alive) continue;
      for (const mv of legal(a, p))
        out.push({
          label: `${nm(p)}${sq(p.row, p.col)}→${sq(mv.row, mv.col)}`,
          E: { type: "MOVE_PIECE", pieceId: id, row: mv.row, col: mv.col, captures: mv.captures },
        });
    }
  return out;
}
function keyOf(m) {
  const a = m.a;
  return JSON.stringify([
    a.phase,
    a.currentTurn,
    a.setupSteps,
    a.setupPickKings,
    a.setupDone,
    a.setupPlacements && Object.keys(a.setupPlacements[0] || {}).length,
    !!a.captureReveal,
    a.winner,
    Object.values(a.pieces || {})
      .map((p) => `${p.id}${p.alive ? p.row * 5 + p.col : "x"}`)
      .join(""),
    m.tutStep,
    m.foeIdx,
  ]);
}
{
  const seen = new Set();
  const res = { states: 0, ends: [], stuck: [], place: [], dead: [], powers: 0, silent: [] };
  const stack = [[start(), []]];
  while (stack.length) {
    let [m, path] = stack.pop();
    m = runFoe(m);
    const k = keyOf(m);
    if (seen.has(k)) continue;
    seen.add(k);
    res.states++;
    const a = m.a;
    if (a.kingPowers !== false) res.powers++;
    if (a.phase === "play" && isDeadPosition(a)) res.dead.push(path);
    // あなたの番に、案内の札が無い場面(はじめの一局の待ちの帯は、撃破の札と相手の番にしか出さない。game.jsx の tutHold)
    if (a.phase === "play" && a.currentTurn === 0 && !a.captureReveal && !active(m) && idxOf(m) < tut.steps.length) res.silent.push(path);
    if (a.phase === "gameover") {
      res.ends.push({ path, winner: a.winner, adj: !!a.adjudication, king: a.players[0].kingId, by: a.lastMove && a.lastMove.pieceId });
      continue;
    }
    const opts = options(m);
    if (opts.some((o) => o.place)) {
      res.place.push(path);
      continue;
    }
    let moved = false;
    for (const o of opts) {
      let n;
      if (o.to !== undefined) n = settle({ ...m, tutStep: o.to });
      else {
        const r = press(m, o.E);
        if (r.blocked) continue;
        n = r.m;
      }
      if (keyOf(n) === keyOf(m)) continue;
      moved = true;
      stack.push([n, [...path, o.label]]);
    }
    // 相手も動かず、あなたにも進める操作が無い
    if (!moved) res.stuck.push(`${path.join(" > ")} | ${a.phase} 手番=${a.currentTurn} 札=${idxOf(m)}`);
  }
  console.log(`  調べた局面 ${res.states}・決着 ${res.ends.length}`);
  ok("行き止まりが無い", res.stuck.length === 0, res.stuck.slice(0, 3).join(" // "));
  ok("並べる場面へ戻れない", res.place.length === 0, res.place.slice(0, 2).map((p) => p.join(" > ")).join(" // "));
  ok("判定の局面が無い", res.dead.length === 0);
  ok("王の力の付いた局面が無い", res.powers === 0);
  ok("あなたの番に案内の札が無い場面が無い(待ちの帯の決まり文句を出さずに済む)", res.silent.length === 0, res.silent.slice(0, 2).map((p) => p.join(" > ")).join(" // "));
  const bad = res.ends.filter((e) => e.winner !== 0 || e.adj);
  ok("勝ち以外の決着が無い", res.ends.length > 0 && bad.length === 0, bad.slice(0, 2).map((e) => e.path.join(" > ")).join(" // "));
  const combos = MY.flatMap((kg) => ["t1", "t2"].map((by) => `${kg}:${by}`));
  const got = new Set(res.ends.map((e) => `${e.king}:${e.by}`));
  ok("王5通り × 4♦/5♥ のどれでも勝てる", combos.every((c) => got.has(c)), combos.filter((c) => !got.has(c)).join(","));
  ok("勝つのは 4♦・5♥ で e3 を討つ手だけ", res.ends.every((e) => e.by === "t1" || e.by === "t2"));
}

/* =====================================================================
   D. 文
   ===================================================================== */
console.log("\nD. 文");
{
  const lines = [];
  for (const st of tut.steps) {
    for (const key of ["text", "picked", "nudge"]) lines.push(...textLines(st[key]));
    if (st.kingAlt) lines.push(...textLines(st.kingAlt.text));
    if (st.afterMiss) lines.push(...textLines(st.afterMiss.text), ...textLines(st.afterMiss.notCapture));
    lines.push(...textLines(st.wrongCell));
    const pick = st.need && st.need.choose;
    if (pick) for (const key of ["hint", "wrong", "notCapture", "badge"]) lines.push(...textLines(pick[key]));
  }
  lines.push(...textLines(tut.foeTurn));
  const long = lines.filter((l) => [...l].length > 20);
  ok(`札の文はどれも1行20字まで(${lines.length} 行)`, long.length === 0, long.join(" / "));
  ok("札の文は行の配列で持つ", tut.steps.every((st) => Array.isArray(st.text)));
  ok("文に「将棋」を使わない", !lines.some((l) => l.includes("将棋")));
  ok("始めは「あと 2 手」(王を選ぶ・確定は数えない)", movesLeft(tut, 0) === 2);
  ok("結果の締めの一行", tut.tagline === "一手に、読みを。一枚に、野望を。");
  // 結びの札と決め手の印(2026-10-06 本人の指示)。導入の言葉の調子で
  ok("結びの札は「相手が逃がした一枚は、王だった。」「動きを読めば、王に届く。」", same(tut.steps[5].text, ["相手が逃がした一枚は、王だった。", "動きを読めば、王に届く。"]), JSON.stringify(tut.steps[5].text));
  ok("決め手の札の印は「あなたが読む、一手。」", tut.steps[4].need.choose.badge === "あなたが読む、一手。");
  ok("第1〜13話の決め手は印を持たない(画面の決まりの「自分で考える1手」のまま)", ALL_TUTORIALS.every((t) => t.steps.every((x) => !(x.need && x.need.choose && x.need.choose.badge))));
  const pick = tut.steps[4].need.choose;
  ok("ヒント: 2 か 3・斜めに一歩なら 3 か 5", same(pick.hint, ["相手の王は、2 か 3。", "斜めに一歩なら、3 か 5。"]));
  ok("ヒントの動きの図は 2・3・5", same(pick.hintGuide.ranks, ["2", "3", "5"]));
  ok("自分で考える1手は、答えの駒を初めから光らせない", !tut.steps[4].focus.pieces.includes(tut.steps[4].need.pieceId));
  ok("自分で考える1手は、二枚(e3・b4)に同じ印", same([...tut.steps[4].focus.pieces].sort(), ["t6", "t9"]));
  const hold = tut.steps[3];
  ok("待つ札は ▼ を付けず、光の筋と「つづき」", !hold.focus && same(hold.threat.targets, ["t6", "t9"]) && hold.nextLabel === "つづき");
  // 盤面を渡さなくても、待つ札とは行き来しない(戻ると関門が開いて行き止まる)
  ok("待つ札と自分で考える1手は「前の説明へ」を出さない", !canStepBack(tut, 3) && !canStepBack(tut, 4));
  ok("文字列はそのまま1行", same(textLines("あ"), ["あ"]) && same(textLines(null), []));
  // 取らない手の一言は ▼ を数えさせない(ヒントを開くと、あなたの 4♦ にも ▼ が付いて三つになる)
  const notCaptures = [...textLines(pick.notCapture), ...textLines(tut.steps[4].afterMiss.notCapture)];
  ok("取らない手の一言に ▼ を使わない(外したあとの一言も)", notCaptures.length === 2 && notCaptures.every((l) => !l.includes("▼")), notCaptures.join(" / "));
  ok("外したあとの取らない手は、逃げた一枚だけを指す", same(tut.steps[4].afterMiss.notCapture, ["取るのは、逃げた一枚。"]));
  ok("1手目の空きマスの一言", same(tut.steps[2].wrongCell, ["そこに、伏せ札は無い。"]));
  // 相手の番の帯の一行(game.jsx の tutHold)。決まり文句の「相手の番です。少し待ってください。」を使わない
  ok("相手の番の一行は台本が持つ(です・ます調の決まり文句でない)", Array.isArray(tut.foeTurn) && tut.foeTurn.length === 1 && !/です|ます|ください/.test(tut.foeTurn.join("")), JSON.stringify(tut.foeTurn));
  // 結果のあなたの王の行(2026-10-06 見直し)。行は文字列か句の配列。読点の無い長い行は手で切る
  const notes = [...tut.kingNote.hidden, ...tut.kingNote.struck].map((l) => (Array.isArray(l) ? l.join("") : l));
  ok("結果のあなたの王の行は20字まで・です/ます調でない", notes.every((l) => [...l].length <= 20 && !/です|ます/.test(l)), notes.join(" / "));
  ok("「最後まで伏せたまま。」は「最後まで」「伏せたまま。」の句(320 幅の半分の列で語の途中で割れた)", same(tut.kingNote.hidden, ["あなたの王は、", ["最後まで", "伏せたまま。"]]));
}

/* =====================================================================
   E. 第1〜13話は変わらない
   ===================================================================== */
console.log("\nE. 第1〜13話");
{
  const ep1 = TUTORIALS[0];
  ok("第1話の題は「動きで見抜く」(はじめの一局と重ねない)", ep1.title === "第1話 動きで見抜く");
  ok("ほかの題に「はじめの一局」が無い", !ALL_TUTORIALS.some((t) => t.title.includes("はじめの一局")));
  ok("第1〜13話はフェーズを持たない(王の力あり)", ALL_TUTORIALS.every((t) => t.phase === undefined && !t.storyAxis));
  const opened = ALL_TUTORIALS.filter((t) => t.opening);
  ok(
    `盤が並んだところから始まる話(${opened.length} 話)は王の力ありで始まる`,
    opened.every((t) => openingState(t, GAME_RULE_VERSION).kingPowers !== false),
  );
  ok(
    "「あと N 手」は操作をすべて数えたまま",
    ALL_TUTORIALS.every((t) => movesLeft(t, 0) === t.steps.filter((x) => x.need).length),
  );
  ok(
    "「前の説明へ」は読むだけの札にだけ戻れる、のまま",
    ALL_TUTORIALS.every((t) => t.steps.every((_, i) => canStepBack(t, i) === (i > 0 && !t.steps[i - 1].need))),
  );
  // 関門の文: 台本に文が無ければ、いまの決まりの文
  const s = openingState(ep1, GAME_RULE_VERSION);
  const i = currentStepIndex(ep1, s, 0);
  const pass = ep1.steps.findIndex((x) => x.need);
  const okMove = moveOf(s, ep1.steps[pass].need.pieceId, ep1.steps[pass].need.row, ep1.steps[pass].need.col);
  ok("第1話: 指示された手は通る", tutorialGate(ep1, i, s, okMove) === null);
  const wrongMove = moveOf(s, "t0", 3, 0) || moveOf(s, "t0", 3, 1);
  ok(
    "第1話: 台本に無い手は、いまの文で止まる",
    !!wrongMove && same(tutorialGate(ep1, i, s, wrongMove)?.nudge, ["その手はいまは指せません。▼ の付いたところを操作してください。"]),
    JSON.stringify(wrongMove && tutorialGate(ep1, i, s, wrongMove)),
  );
  ok("第1話: 札を手札に戻すのは止めない(lockPlacement が無い)", tutorialGate(ep1, i, s, { type: "SETUP_UNPLACE_CARD", player: 0, cardId: "t0" }) === null);
  ok("第1話: 相手を待たせる札は無い", ALL_TUTORIALS.every((t) => t.steps.every((st) => !st.holdFoe)));
}

console.log(fail ? `\n${fail} 件の失敗` : "\nはじめの一局: すべて通りました");
process.exit(fail ? 1 : 0);
