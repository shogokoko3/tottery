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
import { isFlush, isStraight } from "../src/game/bonus.js";
import { SUIT_SYMBOL } from "../src/game/constants.js";

/**
 * 布陣ボーナスを教える話で、何が起きるはずか。
 * どちらの布陣がそろい、誰の駒がめくれ、引き直しで何を引くか。
 */
const BONUS_EXPECT = {
  7: {
    straight: 0,
    swapped: true,
    drewRank: "7",
    // 後手だからこそ、相手の捨て札を見てから決められる
    youAreSecond: true,
    foeDiscards: ["4♦", "6♣"],
    // この回で覚えることをストレートひとつに絞る。
    // 相手側で何かそろうと、学ぶことが混ざってしまう
    noReveal: true,
    foeNoBonus: true,
  },
  8: {
    flush: 0,
    swapped: false,
    revealedOwner: 1,
    drewRank: "J",
    youAreSecond: true,
    foeDiscards: ["4♣", "3♦"],
    // 案内で名前を挙げている札が、実際にめくれるか
    revealedCard: "10♦",
  },
};
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
      scripted: !tut.bonus,
    },
  );
  ok("手札が配れる", s.players[0].hand.length === tut.handSize);
  // 布陣ボーナスは知らせ終えると消えるので、出た瞬間に控えておく
  let bonusSeen = null;
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
    if (s.setupEffects && !bonusSeen) bonusSeen = s.setupEffects;
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
  // CPU は1手も指さない。1手でも混ざると毎回ちがう盤面になり、
  // 決まった盤面を前提に書いた案内と噛み合わなくなる
  ok(
    "相手の手が台本だけで足りる(CPUは1手も指さない)",
    usedCpu === 0,
    `台本が足りず CPU が ${usedCpu} 手 必要だった`,
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
  // 話ごとに「これが起きるはず／起きないはず」を見る。
  // 1話でひとつだけ教えるので、隣の話の効果が混ざっていないかも見張る
  const EVENTS = {
    1: { none: ["新しい王", "道連れ"] },
    2: { must: ["に新しい王が立った"], none: ["道連れ"] },
    3: { must: ["道連れ"], none: ["新しい王"] },
  };
  const want = EVENTS[tut.id];
  if (want) {
    const log = s.log.join("\n");
    for (const w of want.must || [])
      ok(`記録に「${w}」が出る`, log.includes(w), s.log.slice(-6).join(" / "));
    for (const w of want.none || [])
      ok(`「${w}」は起きない`, !log.includes(w), s.log.slice(-6).join(" / "));
  }
  if (tut.bonus) {
    // 布陣ボーナスを教える回。話ごとに、何が起きるはずかを決めてある
    const want = BONUS_EXPECT[tut.id];
    void 0;
    const army = (i) => Object.values(s.pieces).filter((p) => p.owner === i);
    ok("布陣ボーナスが起きる", !!bonusSeen);
    if (want && want.youAreSecond)
      ok(
        "サイコロでは必ず後手になる",
        tut.dice[0] < tut.dice[1],
        `${tut.dice[0]} vs ${tut.dice[1]}`,
      );
    if (want && want.foeDiscards) {
      const shown = s.players[1].discard.map(
        (c) => `${c.rank}${SUIT_SYMBOL[c.suit]}`,
      );
      ok(
        `相手の捨て札が ${want.foeDiscards.join("・")} になる`,
        want.foeDiscards.every((c) => shown.includes(c)),
        shown.join(","),
      );
      ok(
        "相手の捨て札にスペードが混ざらない",
        tut.id !== 8 || !shown.some((c) => c.includes("♠")),
        shown.join(","),
      );
    }
    if (want && want.foeNoBonus) {
      ok(
        "相手の布陣は何もそろえない",
        !isStraight(army(1)) && !isFlush(army(1)),
        `${army(1)
          .map((p) => p.rank)
          .join(",")} / ${army(1)
          .map((p) => p.suit[0])
          .join(",")}`,
      );
    }
    if (want && want.noReveal) {
      ok(
        "駒は1枚もめくれない",
        (bonusSeen.revealed || []).length === 0,
        JSON.stringify(bonusSeen.revealed),
      );
    }
    if (want && want.revealedCard) {
      const shown = (bonusSeen.revealed || []).map(
        (r) => `${r.rank}${SUIT_SYMBOL[r.suit]}`,
      );
      ok(
        `案内どおり ${want.revealedCard} がめくれる`,
        shown.includes(want.revealedCard),
        shown.join(","),
      );
    }
    if (want && bonusSeen) {
      if (want.straight !== undefined)
        ok(
          `${want.straight === 0 ? "あなた" : "相手"}の布陣がストレートになる`,
          isStraight(army(want.straight)),
          army(want.straight)
            .map((p) => p.rank)
            .join(","),
        );
      if (want.flush !== undefined)
        ok(
          `${want.flush === 0 ? "あなた" : "相手"}の布陣がフラッシュになる`,
          isFlush(army(want.flush)),
          army(want.flush)
            .map((p) => p.suit[0])
            .join(","),
        );
      ok(
        want.swapped ? "先手と後手が入れ替わる" : "先手はそのまま",
        bonusSeen.swapped === want.swapped,
        JSON.stringify(bonusSeen.swapped),
      );
      if (want.revealedOwner !== undefined)
        ok(
          `${want.revealedOwner === 0 ? "あなた" : "相手"}の駒がめくれる`,
          (bonusSeen.revealed || []).some(
            (r) => r.owner === want.revealedOwner,
          ),
          JSON.stringify(bonusSeen.revealed),
        );
      ok(
        `引き直しで ${want.drewRank} を引いている`,
        army(0).some((p) => p.rank === want.drewRank),
        army(0)
          .map((p) => p.rank)
          .join(","),
      );
    }
  }
}

console.log(fail ? `\n${fail} 件の失敗` : "\nすべて通りました");
process.exit(fail ? 1 : 0);
