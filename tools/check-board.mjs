/**
 * 盤面の整合性を、対局を丸ごと回しながら毎手たしかめる。
 *
 * 盤(board)と駒(pieces)は同じ事実を二重に持っているので、ずれると
 * 「駒が消える」「二重に立つ」「倒したはずが残る」といった不具合になる。
 * ここでは毎手、次のことを見る。
 *
 *   - 盤に置かれた駒は、駒側の座標と一致する
 *   - 生きている駒は必ず盤の上にいて、倒れた駒は盤に残らない
 *   - 同じマスに2つ立たない
 *   - 駒の総数が変わらない(盤上 + 失った駒)
 *   - 王は生きているか、継承待ちのどちらか
 *   - 生成された手はすべて盤の内側を指す
 */
import { reducer, autoArrange, autoPickKing } from "../src/game/reducer.js";
import {
  getLegalMoves,
  inBounds,
  kingRankOf,
  totalSlots,
} from "../src/game/board.js";
import { cpuAction } from "../src/game/cpu.js";
import { CARD_POOLS } from "../src/game/constants.js";

const GAMES = Number(process.env.GAMES || 240);
let problems = [];
let steps = 0;

function checkState(s, where) {
  // 布陣が始まるまで盤は空。見るものがない
  if (!s.board || !s.board.length) return;
  const seen = new Map();
  for (const [id, p] of Object.entries(s.pieces)) {
    if (p.alive) {
      if (!inBounds(p.row, p.col, s.boardSize))
        problems.push(`${where}: ${id} が盤の外 (${p.row},${p.col})`);
      else {
        const onBoard = s.board[p.row][p.col];
        if (!onBoard || onBoard.id !== id)
          problems.push(
            `${where}: ${id} が盤に載っていない (${p.row},${p.col})`,
          );
        const key = `${p.row}-${p.col}`;
        if (seen.has(key))
          problems.push(
            `${where}: ${key} に ${seen.get(key)} と ${id} が重なった`,
          );
        seen.set(key, id);
      }
    }
  }
  for (let r = 0; r < s.boardSize; r++)
    for (let c = 0; c < s.boardSize; c++) {
      const p = s.board[r][c];
      if (!p) continue;
      const real = s.pieces[p.id];
      if (!real) problems.push(`${where}: 盤の ${r},${c} に知らない駒`);
      else if (!real.alive)
        problems.push(`${where}: 倒れた ${p.id} が ${r},${c} に残っている`);
      else if (real.row !== r || real.col !== c)
        problems.push(`${where}: ${p.id} の座標がずれている`);
    }

  const alive = Object.values(s.pieces).filter((p) => p.alive).length;
  const lost = s.players.reduce((n, p) => n + p.capturedOwn.length, 0);
  const total = Object.keys(s.pieces).length;
  if (alive + lost !== total)
    problems.push(`${where}: 駒の数が合わない 生存${alive}+失${lost}≠${total}`);

  for (const [i, pl] of s.players.entries()) {
    if (s.phase !== "play" && s.phase !== "gameover") continue;
    if (!pl.kingId) {
      const waiting = s.pendingKingChoice && s.pendingKingChoice.owner === i;
      if (!waiting && s.winner === null)
        problems.push(`${where}: ${i} の王がいないのに続いている`);
      continue;
    }
    const king = s.pieces[pl.kingId];
    if (king && !king.alive && s.winner === null)
      problems.push(`${where}: ${i} の王が倒れたのに続いている`);
  }

  if (s.phase === "play")
    for (const p of Object.values(s.pieces)) {
      if (!p.alive) continue;
      for (const m of getLegalMoves(
        p,
        s.board,
        s.boardSize,
        s.players[p.owner].armyRankCounts,
        kingRankOf(s, p.owner),
      )) {
        if (!inBounds(m.row, m.col, s.boardSize))
          problems.push(`${where}: ${p.id} の手が盤の外 (${m.row},${m.col})`);
        const target = s.board[m.row][m.col];
        if (target && target.owner === p.owner && m.capture !== undefined)
          problems.push(`${where}: ${p.id} が味方の上へ動ける`);
      }
    }
}

const POOLS = [null, CARD_POOLS.basic, CARD_POOLS.numbers, CARD_POOLS.court];

for (let g = 0; g < GAMES; g++) {
  const size = g % 3 === 0 ? 9 : 5;
  const pool = POOLS[g % POOLS.length];
  const handSize =
    pool === CARD_POOLS.basic ? Math.max(totalSlots(size), 6) : 13;
  let s = reducer(
    { phase: "intro" },
    { type: "START_SETUP", size, setupMode: "simultaneous", pool, handSize },
  );
  checkState(s, `局${g} 開始`);

  let guard = 0;
  while (s.phase !== "gameover" && guard++ < 900) {
    if (s.captureReveal) {
      s = reducer(s, { type: "DISMISS_CAPTURE" });
      continue;
    }
    if (s.interstitial) {
      s = reducer(s, { type: "DISMISS_INTERSTITIAL" });
      continue;
    }
    if (s.phase === "setup") {
      for (const idx of [0, 1]) {
        if (s.setupDone[idx]) continue;
        const placement = autoArrange(s, idx, null, null, null);
        s = reducer(s, {
          type: "SETUP_CONFIRM",
          player: idx,
          placement,
          kingId: autoPickKing(s, idx, placement),
        });
      }
      checkState(s, `局${g} 布陣後`);
      continue;
    }
    if (s.phase === "play" && s.clocks[s.currentTurn] <= 0) {
      s = reducer(s, { type: "CLOCK_TIMEOUT", player: s.currentTurn });
      continue;
    }
    let act = cpuAction(s, s.currentTurn);
    if (!act) {
      if (s.phase === "dice") {
        act =
          s.dice[s.diceIdx] === null
            ? { type: "ROLL_DICE_SINGLE" }
            : s.diceIdx === 2
              ? { type: "GOTO_MULLIGAN" }
              : s.diceIdx === 3
                ? { type: "REROLL_DICE" }
                : { type: "NEXT_DICE_STEP" };
      } else if (s.phase === "mulligan") {
        act = { type: "CONFIRM_MULLIGAN", discardIds: [] };
      } else break;
    }
    if (act.type === "__CPU_SHUFFLE") {
      s = reducer(s, { type: "SELECT_PIECE", id: act.aceId });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[0] });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[1] });
      s = reducer(s, { type: "CONFIRM_SHUFFLE", elapsedMs: 12000 });
    } else {
      s = reducer(s, { ...act, elapsedMs: 12000 });
    }
    steps++;
    checkState(s, `局${g} ${act.type}`);
    if (problems.length > 6) break;
  }
  if (problems.length > 6) break;
}

console.log(`${GAMES}局 / ${steps}手を検査`);
if (problems.length) {
  console.log(`\n${problems.length} 件の不整合`);
  problems.slice(0, 10).forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log("盤面の不整合なし");
