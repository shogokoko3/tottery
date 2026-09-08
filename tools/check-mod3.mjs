/**
 * 修正3で入れた reducer の変更を確かめる。
 * 同時配置・持ち時間・撃破マスの3点。
 */
import {
  reducer,
  autoArrange,
  autoPickKing,
  CLOCK_INITIAL_MS,
  CLOCK_INCREMENT_MS,
} from "../src/game/reducer.js";
import { getLegalMoves, kingRankOf, totalSlots } from "../src/game/board.js";
import { cpuAction } from "../src/game/cpu.js";

let pass = 0;
let fail = 0;
function ok(label, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

/** サイコロ〜引き直しまでを一気に進める */
function toSetup(setupMode) {
  let s = reducer(undefined_state(), {
    type: "START_SETUP",
    size: 5,
    setupMode,
  });
  s = reducer(s, { type: "ROLL_DICE_SINGLE", value: 6 });
  s = reducer(s, { type: "NEXT_DICE_STEP" });
  s = reducer(s, { type: "ROLL_DICE_SINGLE", value: 2 });
  s = reducer(s, { type: "NEXT_DICE_STEP" });
  s = reducer(s, { type: "GOTO_MULLIGAN" });
  s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: [] });
  s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: [] });
  return s;
}
function undefined_state() {
  return { phase: "intro" };
}

function confirmFor(s, idx) {
  const placement = autoArrange(s, idx, null, null, null);
  const kingId = autoPickKing(s, idx, placement);
  return reducer(s, { type: "SETUP_CONFIRM", player: idx, placement, kingId });
}

console.log("同時配置");
{
  let s = toSetup("simultaneous");
  ok("布陣フェーズに入る", s.phase === "setup");
  ok("端末受け渡しは出さない", s.interstitial === null);
  ok("両者とも未確定", !s.setupDone[0] && !s.setupDone[1]);

  // 後手(1)が先に確定できる
  let a = confirmFor(s, 1);
  ok("後手が先に確定できる", a.setupDone[1] === true && a.phase === "setup");
  a = confirmFor(a, 0);
  ok("両者そろって対局開始", a.phase === "play");

  // 同じ布陣を逆順に確定しても、同じ盤面になる
  const plan = [0, 1].map((idx) => {
    const placement = autoArrange(s, idx, null, null, null);
    return { idx, placement, kingId: autoPickKing(s, idx, placement) };
  });
  const apply = (st, o) =>
    reducer(st, { type: "SETUP_CONFIRM", ...o, player: o.idx });
  a = apply(apply(s, plan[1]), plan[0]);
  let b = apply(apply(s, plan[0]), plan[1]);
  const cells = (st) =>
    st.board
      .map((r) =>
        r.map((p) => (p ? `${p.owner}${p.rank}${p.suit}` : "-")).join(","),
      )
      .join("|");
  ok(
    "確定の順番が変わっても盤面は同じ",
    cells(a) === cells(b),
    cells(a) + " vs " + cells(b),
  );
  ok("先手から始まる", a.currentTurn === a.firstPlayer);
  ok(
    "先手に10秒加算されている",
    a.clocks[a.firstPlayer] === CLOCK_INITIAL_MS + CLOCK_INCREMENT_MS &&
      a.clocks[1 - a.firstPlayer] === CLOCK_INITIAL_MS,
    JSON.stringify(a.clocks),
  );
}

console.log("順番に置くモード");
{
  let s = toSetup("sequential");
  ok(
    "先手の受け渡し画面が出る",
    !!s.interstitial && s.interstitial.forPlayer === s.firstPlayer,
  );
  ok("先に置くのは先手", s.setupIdx === s.firstPlayer);
  // 後手が先に確定しようとしても通らない
  const sneak = confirmFor(s, 1 - s.firstPlayer);
  ok("番でない側は確定できない", sneak.setupDone[1 - s.firstPlayer] === false);
  let a = confirmFor(s, s.firstPlayer);
  ok(
    "確定すると相手に番が移る",
    a.setupIdx === 1 - s.firstPlayer && a.phase === "setup",
  );
  a = confirmFor(a, a.setupIdx);
  ok("2人目の確定で対局開始", a.phase === "play");
}

console.log("時間切れの自動配置");
{
  let s = toSetup("simultaneous");
  // 1枚だけ置いた状態から埋める
  const me = s.players[0];
  const first = me.hand[0];
  s = reducer(s, {
    type: "SETUP_PLACE_CARD",
    player: 0,
    cardId: first.id,
    row: 4,
    col: 0,
  });
  const filled = autoArrange(s, 0, null, null, s.setupPlacements[0]);
  ok(
    "置いた駒は動かない",
    filled[first.id] &&
      filled[first.id].row === 4 &&
      filled[first.id].col === 0,
  );
  ok(
    "枚数がそろう",
    Object.keys(filled).length === totalSlots(5),
    Object.keys(filled).length,
  );
  const king = autoPickKing(s, 0, filled);
  ok("王が選ばれる", !!filled[king]);
}

console.log("持ち時間");
{
  let s = toSetup("simultaneous");
  s = confirmFor(s, 0);
  s = confirmFor(s, 1);
  const first = s.currentTurn;
  const before = s.clocks[first];
  // 12秒考えて1手指す
  // 王の10とAは1ターンに2回動けて手番が移らないので、王以外を動かす
  const mine = Object.values(s.pieces).filter(
    (p) => p.owner === first && p.alive && !p.isKing,
  );
  let acted = null;
  for (const p of mine) {
    const mv = getLegalMoves(
      p,
      s.board,
      5,
      s.players[first].armyRankCounts,
      kingRankOf(s, first),
    ).find((m) => !m.capture);
    if (mv) {
      acted = reducer(
        { ...s, selectedId: p.id },
        {
          type: "MOVE_PIECE",
          pieceId: p.id,
          row: mv.row,
          col: mv.col,
          elapsedMs: 12000,
        },
      );
      break;
    }
  }
  ok("動ける駒がある", !!acted);
  ok("手番が移る", acted.currentTurn === 1 - first);
  ok(
    "考えた分だけ減る",
    acted.clocks[first] === before - 12000,
    JSON.stringify(acted.clocks),
  );
  ok(
    "始まる側に10秒足される",
    acted.clocks[1 - first] === CLOCK_INITIAL_MS + CLOCK_INCREMENT_MS,
    JSON.stringify(acted.clocks),
  );

  const dead = reducer(acted, {
    type: "CLOCK_TIMEOUT",
    player: acted.currentTurn,
  });
  ok("時間切れで決着", dead.phase === "gameover" && dead.winner === first);
  ok("時間切れした側が記録される", dead.timeoutBy === acted.currentTurn);

  // 持ち時間より長く考えた手は、その場で負けになる。
  // 手番を終える手として「王の2回目を使わずに終える」を使う。
  // これは extraMoveFor が立っているときにしか出せない手なので、
  // 立った状態を作ってから送る(そうでないと reducer が捨てる)
  const stillMoving = Object.values(acted.pieces).find(
    (x) => x.alive && x.owner === acted.currentTurn,
  );
  const over = reducer(
    { ...acted, selectedId: null, extraMoveFor: stillMoving.id },
    {
      type: "SKIP_EXTRA_ACTION",
      elapsedMs: CLOCK_INITIAL_MS + CLOCK_INCREMENT_MS + 1000,
    },
  );
  ok(
    "持ち時間を超えて考えたら負ける",
    over.phase === "gameover" &&
      over.winner === first &&
      over.timeoutBy === acted.currentTurn,
    `phase=${over.phase} winner=${over.winner} clocks=${JSON.stringify(over.clocks)}`,
  );
}

console.log("CPUが同時配置で自分の布陣を終えられる");
{
  let s = toSetup("simultaneous");
  let guard = 0;
  while (!s.setupDone[1] && guard++ < 30) {
    const act = cpuAction(s, 1);
    if (!act) break;
    s = reducer(s, act);
  }
  ok(
    "CPUが布陣を確定した",
    s.setupDone[1] === true,
    `${guard}手 / setupSteps=${JSON.stringify(s.setupSteps)}`,
  );
  ok("人間側はまだ未確定", s.setupDone[0] === false);
  ok("対局はまだ始まらない", s.phase === "setup");

  // 人間が後から確定して開始
  s = confirmFor(s, 0);
  ok("両者そろって開始", s.phase === "play");

  // 順番モードでも従来どおり動く
  let q = toSetup("sequential");
  guard = 0;
  while (q.phase === "setup" && guard++ < 60) {
    const act = cpuAction(q, 1);
    if (act) {
      q = reducer(q, act);
      continue;
    }
    if (q.setupIdx === 0) q = confirmFor(q, 0);
    else break;
  }
  ok("順番モードでも対局が始まる", q.phase === "play", `phase=${q.phase}`);
}

console.log(`\n${pass} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
