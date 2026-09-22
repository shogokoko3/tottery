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
 *
 * 乱数は種で固定する。以前はここが素の Math.random で、絵札に寄った手札
 * (およそ2500局に1回)を引いたときだけ落ちていた。落ちても手元では再現できず、
 * 「たまに赤くなる検査」になっていた。種を変えて回したいときは SEED=数 を渡す。
 */
import {
  reducer,
  autoArrange,
  autoPickKing,
  canFillBoard,
  isNotableLog,
} from "../src/game/reducer.js";
import { totalSlots, territoryRows } from "../src/game/board.js";
import { cpuAction } from "../src/game/cpu.js";

const GAMES = Number(process.env.GAMES || 120);
const SEED = Number(process.env.SEED || 20260922);
const problems = [];
let events = 0;

/** 種つきの乱数。同じ種なら毎回まったく同じ対局になる */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(SEED);
console.log(`乱数の種: ${SEED}`);

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

// --- 自動配置は、並べきれる手札なら必ず枠をちょうど埋める -----------------
// 採用上限は「K を軍に入れると J・Q が1枚ずつに減る」。札を見た順に決めていくと、
// 先に来た K のせいで J・Q の枠が縮み、埋めきれないことがあった
// (手札 Q3・K2・J3・8×2・3・7・10 で9枠中8枚)。絵札に寄った手札はめったに
// 出ないので、種を変えて多めに引いて確かめる。
const HANDS = Number(process.env.HANDS || 4000);
for (const size of [5, 9]) {
  const slots = totalSlots(size);
  let short = 0;
  let unfillable = 0;
  let firstBad = null;
  for (let seed = 0; seed < HANDS; seed++) {
    Math.random = mulberry32(seed);
    const s = reducer(
      { phase: "intro" },
      { type: "START_SETUP", size, setupMode: "simultaneous", handSize: 13 },
    );
    const hand = s.players[0].hand;
    // 並べきれない手札は配り直される(rescueHand)ので、ここでは数えるだけ
    if (!canFillBoard(hand, slots)) {
      unfillable++;
      continue;
    }
    const n = Object.keys(autoArrange(s, 0, null, null, null)).length;
    if (n !== slots) {
      short++;
      if (!firstBad)
        firstBad = `${n}枚/${slots}枠 手札=${hand.map((c) => c.rank).join(",")}`;
    }
  }
  if (short)
    problems.push(
      `${size}×${size}: 並べきれる手札なのに自動配置が枠を埋めない(${short}/${HANDS}件, 例: ${firstBad})`,
    );
  else
    console.log(
      `  ok   ${size}×${size} 自動配置が${HANDS}通りの手札で枠を埋める(うち${unfillable}通りは配り直しになる手札)`,
    );
}
Math.random = mulberry32(SEED);

if (problems.length) {
  console.log(`\n${problems.length} 件の問題`);
  problems.slice(0, 10).forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log("記録の控えに問題なし");
