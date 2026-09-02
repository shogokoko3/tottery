/**
 * 対局の記録から盤面を振り返るための控えを検査する。
 *
 * 記録の行を押すと、その時点の盤面と「どこから・どこへ・どこが倒れたか」が
 * 出る。ここでは対局を丸ごと回して、次のことを見る。
 *
 *   - 記録に残る出来事の数と、控えた盤面の数が一致する
 *   - 行の文言と控えが同じ順で並ぶ
 *   - 動いた跡(from/to)が盤の内側を指す
 *   - 出発したマスは空になっていて、着地点には動かした側の駒がいる
 *   - 撃破の行には、倒れたマスが必ず付いている
 *
 * あわせて、布陣で盤に出した駒を手札に戻せるかも見る。9×9で戻せない
 * 不具合があったため。
 */
import {
  reducer,
  autoArrange,
  autoPickKing,
  isNotableLog,
} from "../src/game/reducer.js";
import { totalSlots, territoryRows } from "../src/game/board.js";
import { cpuAction } from "../src/game/cpu.js";

const GAMES = Number(process.env.GAMES || 120);
const problems = [];
let events = 0;

function inBoard(c, size) {
  return c && c.row >= 0 && c.row < size && c.col >= 0 && c.col < size;
}

for (let g = 0; g < GAMES; g++) {
  const size = g % 2 === 0 ? 9 : 5;
  let s = reducer(
    { phase: "intro" },
    { type: "START_SETUP", size, setupMode: "simultaneous", handSize: 13 },
  );

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
      continue;
    }
    if (s.phase === "play" && s.clocks[s.currentTurn] <= 0) {
      s = reducer(s, { type: "CLOCK_TIMEOUT", player: s.currentTurn });
      continue;
    }
    let act = cpuAction(s, s.currentTurn);
    if (!act) {
      if (s.phase === "dice")
        act =
          s.dice[s.diceIdx] === null
            ? { type: "ROLL_DICE_SINGLE" }
            : s.diceIdx === 2
              ? { type: "GOTO_MULLIGAN" }
              : s.diceIdx === 3
                ? { type: "REROLL_DICE" }
                : { type: "NEXT_DICE_STEP" };
      else if (s.phase === "mulligan")
        act = { type: "CONFIRM_MULLIGAN", discardIds: [] };
      else break;
    }
    if (act.type === "__CPU_SHUFFLE") {
      s = reducer(s, { type: "SELECT_PIECE", id: act.aceId });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[0] });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[1] });
      s = reducer(s, { type: "CONFIRM_SHUFFLE", elapsedMs: 12000 });
    } else {
      s = reducer(s, { ...act, elapsedMs: 12000 });
    }
  }

  const lines = s.log.filter(isNotableLog);
  const replay = s.replay || [];
  if (lines.length !== replay.length) {
    problems.push(
      `局${g}: 記録${lines.length}行に対し控えが${replay.length}件`,
    );
    continue;
  }
  for (const [i, entry] of replay.entries()) {
    events++;
    if (entry.line !== lines[i]) {
      problems.push(`局${g} ${i}: 行と控えの並びがずれた`);
      continue;
    }
    if (!entry.board || entry.board.length !== size) {
      problems.push(`局${g} ${i}: 盤の控えが無い`);
      continue;
    }
    const m = entry.mark;
    if (!m) {
      problems.push(`局${g} ${i}: 跡が付いていない`);
      continue;
    }
    if (m.from && !inBoard(m.from, size))
      problems.push(`局${g} ${i}: 出発点が盤の外`);
    if (m.to && !inBoard(m.to, size))
      problems.push(`局${g} ${i}: 着地点が盤の外`);
    if (m.from && entry.board[m.from.row][m.from.col])
      problems.push(`局${g} ${i}: 出発したマスに駒が残っている`);
    // 着地点のしるしを出すのは、動いた駒がそこに立っている時だけ。
    // 道連れでその場で倒れた手には着地点を出さない
    if (m.to && !entry.board[m.to.row][m.to.col])
      problems.push(`局${g} ${i}: 着地点に駒がいない`);
    if (
      m.from &&
      !m.to &&
      !(m.taken || []).some((c) => c.row === m.from.row && c.col === m.from.col)
    )
      problems.push(`局${g} ${i}: 着地点も倒れたマスも無い動き`);
    for (const c of m.taken || [])
      if (!inBoard(c, size)) problems.push(`局${g} ${i}: 倒れたマスが盤の外`);
    if (entry.line.includes("撃破") && (m.taken || []).length === 0)
      problems.push(`局${g} ${i}: 撃破なのに倒れたマスが無い`);
  }
}

console.log(`${GAMES}局 / ${events}件の記録を検査`);

// --- 布陣で駒を手札に戻せるか -------------------------------------------
for (const size of [5, 9]) {
  let s = reducer(
    { phase: "intro" },
    { type: "START_SETUP", size, setupMode: "simultaneous", handSize: 13 },
  );
  const [lo] = territoryRows(size, 0);
  const card = s.players[0].hand[0];
  s = reducer(s, {
    type: "SETUP_PLACE_CARD",
    player: 0,
    cardId: card.id,
    row: lo,
    col: 0,
  });
  if (!s.setupPlacements[0][card.id])
    problems.push(`${size}×${size}: 盤に置けなかった`);
  s = reducer(s, { type: "SETUP_UNPLACE_CARD", player: 0, cardId: card.id });
  if (s.setupPlacements[0][card.id])
    problems.push(`${size}×${size}: 手札に戻せなかった`);
  else console.log(`  ok   ${size}×${size} 盤に出した駒を手札に戻せる`);

  // 全部埋めてから戻せるか。9×9は枠がちょうど埋まる
  let placement = autoArrange(s, 0, null, null, null);
  const ids = Object.keys(placement);
  if (ids.length !== totalSlots(size))
    problems.push(`${size}×${size}: 自動配置の枚数が合わない`);
  let t = s;
  for (const id of ids)
    t = reducer(t, {
      type: "SETUP_PLACE_CARD",
      player: 0,
      cardId: id,
      row: placement[id].row,
      col: placement[id].col,
    });
  t = reducer(t, { type: "SETUP_UNPLACE_CARD", player: 0, cardId: ids[0] });
  if (Object.keys(t.setupPlacements[0]).length !== ids.length - 1)
    problems.push(`${size}×${size}: 埋まった状態から戻せなかった`);
  else console.log(`  ok   ${size}×${size} 枠が埋まっていても戻せる`);
}

if (problems.length) {
  console.log(`\n${problems.length} 件の問題`);
  problems.slice(0, 10).forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log("記録の控えに問題なし");
