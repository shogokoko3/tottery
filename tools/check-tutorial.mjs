/**
 * チュートリアルの台本を、画面と同じ手順で最後まで通す。
 *
 * 画面がやっていることをそのまま真似る:
 *   - 台本の1枚に need があれば、その操作だけを行う
 *   - need が無ければ「次へ」を押したものとして進める
 *   - 台本が待っているあいだは、相手が台本どおりに指す
 *
 * これが通れば、誰が遊んでも同じ盤面・同じ順番になる。
 */
import { reducer } from "../src/game/reducer.js";
import { getLegalMoves } from "../src/game/board.js";
import { cpuAction } from "../src/game/cpu.js";
import {
  FREE_ACTIONS,
  TUTORIALS,
  currentStepIndex,
  foeAction,
  matchesNeed,
  upcomingNeedStep,
} from "../src/game/tutorial.js";

let fail = 0;
function ok(label, cond, extra) {
  console.log(
    `  ${cond ? "ok  " : "FAIL"} ${label}${cond || !extra ? "" : ` — ${extra}`}`,
  );
  if (!cond) fail++;
}

const legalOf = (s, owner) => (piece) =>
  getLegalMoves(piece, s.board, s.boardSize, s.players[owner].armyRankCounts);

/** 台本が待っているあいだ、画面の流れを進めるだけの操作 */
function flowAction(s) {
  if (s.captureReveal) return { type: "DISMISS_CAPTURE" };
  if (s.interstitial) return { type: "DISMISS_INTERSTITIAL" };
  if (s.pendingKingChoice && s.pendingKingChoice.owner === 0)
    return s.pendingKingChoice.acknowledged
      ? { type: "CHOOSE_HEIR", id: s.pendingKingChoice.candidateIds[0] }
      : { type: "ACK_KING_CHOICE" };
  if (s.phase === "dice") {
    if (s.diceIdx === 0 && s.dice[0] !== null)
      return { type: "NEXT_DICE_STEP" };
    if (s.diceIdx === 2) return { type: "GOTO_MULLIGAN" };
    if (s.diceIdx === 3) return { type: "REROLL_DICE" };
  }
  if (s.phase === "play" && s.kPlacement && s.kPlacement.owner === 0) {
    for (let r = 0; r < s.boardSize; r++)
      for (let c = 0; c < s.boardSize; c++)
        if (!s.board[r][c])
          return { type: "PLACE_RESERVE_CARD", row: r, col: c };
    return { type: "SKIP_RESERVE_PLACEMENT" };
  }
  return null;
}

/** need を、reducer が受け取れる形に仕上げる */
function actionFor(need, s, tut) {
  const act = { ...need };
  if (act.type === "ROLL_DICE_SINGLE" && act.value == null)
    act.value = tut.dice[s.diceIdx] || 1;
  if (act.type === "CONFIRM_MULLIGAN" && !act.reserveOrder)
    act.reserveOrder = [...tut.reserveOrder];
  if (act.type === "CONFIRM_SHUFFLE" && !act.order && tut.shuffleOrder)
    act.order = [...tut.shuffleOrder];
  // 画面では、まず A をタップして入れ替えを始める
  if (act.type === "TOGGLE_SHUFFLE_PICK" && !s.shuffleMode) {
    const ace = Object.values(s.pieces).find(
      (p) => p.owner === 0 && p.alive && p.rank === "A",
    );
    return ace ? { type: "SELECT_PIECE", id: ace.id } : null;
  }
  if (act.type === "MOVE_PIECE") {
    const piece = s.pieces[act.pieceId];
    if (!piece || !piece.alive) return null;
    const hit = legalOf(
      s,
      0,
    )(piece).find((m) => m.row === act.row && m.col === act.col);
    if (!hit) return null;
    act.captures = hit.captures;
  }
  if (
    act.type === "SETUP_PLACE_CARD" ||
    act.type === "SETUP_GOTO_KING_STEP" ||
    act.type === "SETUP_PICK_KING" ||
    act.type === "SETUP_CONFIRM"
  )
    act.player = 0;
  return act;
}

for (const tut of TUTORIALS) {
  console.log(tut.title);
  let s = reducer(
    { phase: "intro" },
    {
      type: "START_SETUP",
      size: tut.boardSize,
      setupMode: "simultaneous",
      deck: tut.deck.map((c) => ({ ...c })),
      pool: tut.pool,
      handSize: tut.handSize,
    },
  );
  ok("手札が配れる", s.players[0].hand.length === tut.handSize);
  ok(
    "カードプールが守られている",
    s.players[0].hand.every((c) => tut.pool.includes(c.rank)),
  );

  let watermark = 0;
  let foeIdx = 0;
  let guard = 0;
  let stuck = null;
  let wentBack = null;
  let lastIdx = -1;
  let usedCpu = 0;
  let skipped = 0;

  while (guard++ < 400) {
    // 画面と同じく、盤面から案内の位置を引き直す
    const idx = currentStepIndex(tut, s, watermark);
    if (idx > lastIdx) lastIdx = idx;
    else if (idx < lastIdx)
      wentBack = `${lastIdx + 1}枚目から${idx + 1}枚目へ戻った`;
    if (idx >= tut.steps.length) {
      watermark = idx;
      break;
    }
    const cur = tut.steps[idx];
    // 説明だけの札のときは「次へ」を押さず、先の操作をそのまま指してみる。
    // これで案内が追いつかなければ、画面でも取り残される
    if (!cur.need && (!cur.at || cur.at(s))) {
      const ahead = upcomingNeedStep(tut, idx, s);
      if (ahead) {
        const act = actionFor(ahead.need, s, tut);
        if (act) {
          const before = idx;
          s = reducer(s, act);
          const after = currentStepIndex(tut, s, watermark);
          if (after <= before) {
            stuck = `${idx + 1}枚目の説明中に指しても案内が進まない`;
            break;
          }
          skipped++;
          watermark = after;
          continue;
        }
      }
    }
    if (process.env.TRACE)
      console.log(
        `    [${idx + 1}] phase=${s.phase} turn=${s.currentTurn} kPl=${!!s.kPlacement} rev=${!!s.captureReveal} at=${cur.at ? cur.at(s) : "-"} | ${cur.text.slice(0, 18)}`,
      );
    if (!cur.at || cur.at(s)) {
      if (!cur.need) {
        // 「次へ」を押したのと同じ
        watermark = idx + 1;
        continue;
      }
      const act = actionFor(cur.need, s, tut);
      if (!act) {
        stuck = `${idx + 1}枚目 ${cur.need.type} が指せない`;
        break;
      }
      s = reducer(s, act);
      watermark = Math.max(watermark, idx);
      continue;
    }
    const flow = flowAction(s);
    if (flow) {
      // 画面と同じ関門を通す。ここで弾かれる操作は本物でも通らない
      if (
        cur.need &&
        (!cur.at || cur.at(s)) &&
        !FREE_ACTIONS.has(flow.type) &&
        !matchesNeed(cur.need, flow)
      ) {
        stuck = `${idx + 1}枚目の案内が ${flow.type} を止めてしまう`;
        break;
      }
      s = reducer(s, flow);
      continue;
    }
    const scripted = foeAction(s, tut, foeIdx, legalOf(s, 1));
    // 画面と同じく、台本を使い切ったら CPU が引き継ぐ
    const foe =
      scripted ||
      (s.phase === "play" && s.currentTurn === 1 && !s.captureReveal
        ? cpuAction(s, 1)
        : null);
    if (foe) {
      if (!scripted) usedCpu++;
      if (scripted && foe.type === "MOVE_PIECE") foeIdx++;
      if (foe.type === "__CPU_SHUFFLE") {
        s = reducer(s, { type: "SELECT_PIECE", id: foe.aceId });
        s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: foe.pickIds[0] });
        s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: foe.pickIds[1] });
        s = reducer(s, { type: "CONFIRM_SHUFFLE" });
      } else {
        s = reducer(s, foe);
      }
      continue;
    }
    stuck = `${idx + 1}枚目「${cur.text}」の場面が来ない (phase=${s.phase} turn=${s.currentTurn})`;
    break;
  }
  const step = watermark;

  ok("案内が前に戻らない", !wentBack, wentBack);
  ok(
    "説明中に指しても案内が追いつく",
    stuck === null || !stuck.includes("説明中"),
    stuck,
  );
  console.log(`  説明を読まずに指した回数: ${skipped}`);
  ok(
    "相手の手が台本だけで足りる",
    usedCpu === 0,
    `台本を使い切って CPU が ${usedCpu} 手 引き継いだ`,
  );
  ok(
    "台本が最後まで進む",
    step === tut.steps.length,
    stuck || `${step}/${tut.steps.length}枚`,
  );
  ok(
    "あなたの勝ちで終わる",
    s.winner === 0,
    `winner=${s.winner} phase=${s.phase}`,
  );
  ok(
    "相手の手をすべて使い切らない(余りがあってもよい)",
    foeIdx <= tut.foe.moves.length,
    `${foeIdx}/${tut.foe.moves.length}`,
  );
  console.log(`  相手が指した手: ${foeIdx} / 用意 ${tut.foe.moves.length}`);
}

console.log(fail ? `\n${fail} 件の失敗` : "\nすべて通りました");
process.exit(fail ? 1 : 0);
