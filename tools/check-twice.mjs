/**
 * 王の10とAは1ターンに2回行動できる。
 * その2回が、行動ログに2行きちんと残るかを見る。
 *
 * 1行にまとまってしまうと、あとから「2回動いた」ことが読み取れない。
 */
import { reducer, autoArrange, autoPickKing } from "../src/game/reducer.js";
import { cpuAction } from "../src/game/cpu.js";

const problems = [];
const seen = { 10: 0, A: 0 };

function drive(forceRank) {
  for (let g = 0; g < 800 && seen[forceRank] < 5; g++) {
    let s = reducer(
      { phase: "intro" },
      { type: "START_SETUP", size: 5, setupMode: "simultaneous", handSize: 13 },
    );
    let guard = 0;
    let kingId = null;
    while (s.phase !== "gameover" && guard++ < 600) {
      if (s.captureReveal) {
        s = reducer(s, { type: "DISMISS_CAPTURE" });
        continue;
      }
      if (s.setupEffects) {
        s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" });
        continue;
      }
      if (s.interstitial) {
        s = reducer(s, { type: "DISMISS_INTERSTITIAL" });
        continue;
      }
      if (s.phase === "setup") {
        for (const i of [0, 1]) {
          if (s.setupDone[i]) continue;
          const placement = autoArrange(s, i, null, null, null);
          let king = autoPickKing(s, i, placement);
          if (i === 0) {
            // 先手の王を必ず 10 か A にして、2回行動を起こす
            const want = Object.keys(placement).find(
              (id) =>
                s.players[0].hand.find((c) => c.id === id).rank === forceRank,
            );
            if (want) {
              king = want;
              kingId = want;
            }
          }
          s = reducer(s, {
            type: "SETUP_CONFIRM",
            player: i,
            placement,
            kingId: king,
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
      const isSecond = kingId && s.extraMoveFor === kingId;
      const before =
        kingId && s.pieces[kingId] ? s.pieces[kingId].history.length : 0;
      const logBefore = s.log.length;
      const movingKing =
        kingId &&
        act.type === "MOVE_PIECE" &&
        (act.pieceId || s.selectedId) === kingId;

      if (act.type === "__CPU_SHUFFLE") {
        s = reducer(s, { type: "SELECT_PIECE", id: act.aceId });
        s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[0] });
        s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[1] });
        s = reducer(s, {
          type: "CONFIRM_SHUFFLE",
          order: [0, 1, 2],
          elapsedMs: 9000,
        });
      } else s = reducer(s, { ...act, elapsedMs: 9000 });

      // 取らずに動いただけでも、対局の記録に何か残っていないと、
      // 盤の駒が動いた理由をあとから読み取れない
      if (movingKing && forceRank === "10" && s.pieces[kingId]) {
        const added = s.log.slice(logBefore);
        if (!added.length)
          problems.push("王の10が動いたのに対局の記録に何も残らない");
        else if (!added.some((l) => l.includes("1回目") || l.includes("2回目")))
          problems.push(`王の10の記録に何回目か書かれていない「${added[0]}」`);
      }

      if (!isSecond || !kingId || !s.pieces[kingId]) continue;
      const history = s.pieces[kingId].history;
      const added = history.length - before;
      seen[forceRank]++;
      if (added !== 1)
        problems.push(
          `王の${forceRank}: 2回目で行動ログが${added}行しか増えない`,
        );
      else if (!history[history.length - 1].includes("(2回目)"))
        problems.push(
          `王の${forceRank}: 2回目だと分からない「${history[history.length - 1]}」`,
        );
    }
  }
}

drive("10");
drive("A");

for (const rank of ["10", "A"]) {
  if (!seen[rank]) problems.push(`王の${rank}が2回行動する場面を作れなかった`);
  else console.log(`  ok   王の${rank}の2回目が${seen[rank]}件、別の行で残る`);
}

if (problems.length) {
  console.log(`\n${problems.length} 件の問題`);
  [...new Set(problems)].slice(0, 6).forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log("2回行動の記録に問題なし");
