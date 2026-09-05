/**
 * 本物の対局で出る手が、ぜんぶルールを通るかを確かめる。
 *
 * 手の中身は「知らない欄は置けない」形に締めてある。締めすぎると、
 * 正しい手が弾かれてオンライン対戦が止まる。**締めた側が壊していないか**を
 * ここで見張る。CPU 同士の対局を回し、送られるはずの手を1つずつ
 * ルールの評価器にかける。通信はしない。
 */
import { canWrite } from "./check-rules.mjs";
import { reducer, autoArrange, autoPickKing } from "../src/game/reducer.js";
import { cpuAction } from "../src/game/cpu.js";
import { enrichAction } from "../src/game/actions.js";
import { withLocalContext, LOCAL_ONLY_ACTIONS } from "../src/net/sync.js";
import { ADJUDICATION_RULE_VERSION } from "../src/game/adjudication.js";
import { territoryRows } from "../src/game/board.js";

const NOW = 1_700_000_000_000;
const ROOM = {
  rooms: {
    ABCD: { members: { uidA: true, uidB: true }, createdAt: NOW - 60_000 },
  },
};
const KEY = "-NxxxxxxxxxxxxxxxxxA";
let ok = 0;
const bad = [];
let checked = 0;
const seen = new Set();

/** 送られる形にして、ルールを通るか見る */
function fits(act, seat) {
  if (LOCAL_ONLY_ACTIONS.has(act.type)) return;
  const uid = seat === 0 ? "uidA" : "uidB";
  const sent = { ...act, by: uid, __id: `${uid}-${++checked}` };
  delete sent.__state;
  delete sent.__foe;
  for (const k of Object.keys(sent)) seen.add(k);
  if (!canWrite(ROOM, ["rooms", "ABCD", "acts", KEY], { uid }, sent)) {
    const key = `${act.type}: ${Object.keys(sent).sort().join(",")}`;
    if (!bad.includes(key)) bad.push(key);
  } else ok++;
}

for (let g = 0; g < 40; g++) {
  const size = g % 2 === 0 ? 9 : 5;
  const start = {
    type: "START_SETUP",
    size,
    setupMode: "simultaneous",
    handSize: 13,
    ruleVersion: ADJUDICATION_RULE_VERSION,
  };
  let s = reducer({ phase: "intro" }, enrichAction(start, {}));
  fits(enrichAction(start, {}), 0);
  let guard = 0;
  while (s.phase !== "gameover" && guard++ < 700) {
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
        const act = {
          type: "SETUP_CONFIRM",
          player: idx,
          placement,
          kingId: autoPickKing(s, idx, placement),
        };
        fits(act, idx);
        s = reducer(s, act);
      }
      continue;
    }
    if (s.phase === "dice") {
      const a =
        s.dice[s.diceIdx] === null
          ? { type: "ROLL_DICE_SINGLE" }
          : s.diceIdx === 2
            ? { type: "GOTO_MULLIGAN" }
            : s.diceIdx === 3
              ? { type: "REROLL_DICE" }
              : { type: "NEXT_DICE_STEP" };
      const sent = enrichAction(a, s);
      fits(sent, s.diceIdx === 1 ? 1 : 0);
      s = reducer(s, sent);
      continue;
    }
    if (s.phase === "mulligan") {
      const sent = enrichAction(
        { type: "CONFIRM_MULLIGAN", discardIds: [] },
        s,
      );
      fits(sent, s.mulliganIdx);
      s = reducer(s, sent);
      continue;
    }
    if (s.kPlacement && s.kPlacement.owner === s.currentTurn) {
      const owner = s.kPlacement.owner;
      const [lo, hi] = territoryRows(s.boardSize, owner);
      let placed = false;
      for (let r = lo; r <= hi && !placed; r++)
        for (let c = 0; c < s.boardSize && !placed; c++)
          if (!s.board[r][c]) {
            const a = {
              type: "PLACE_RESERVE_CARD",
              row: r,
              col: c,
              cardId: s.kPlacement.cards[0].id,
            };
            fits(a, owner);
            s = reducer(s, a);
            placed = true;
          }
      if (!placed) {
        const a = { type: "SKIP_RESERVE_PLACEMENT" };
        fits(a, owner);
        s = reducer(s, a);
      }
      continue;
    }
    if (s.pendingKingChoice) {
      const a = {
        type: "CHOOSE_HEIR",
        id: s.pendingKingChoice.candidateIds[0],
      };
      fits(a, s.pendingKingChoice.owner);
      s = reducer(s, a);
      continue;
    }
    const before = s;
    const act = cpuAction(s, s.currentTurn);
    if (!act) break;
    if (act.type === "__CPU_SHUFFLE") {
      s = reducer(s, { type: "SELECT_PIECE", id: act.aceId });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[0] });
      s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id: act.pickIds[1] });
      const sent = enrichAction(
        withLocalContext({ type: "CONFIRM_SHUFFLE" }, s),
        s,
      );
      fits(sent, s.currentTurn);
      s = reducer(s, sent);
    } else {
      const sent = { ...act, elapsedMs: 1000 };
      fits(sent, s.currentTurn);
      s = reducer(s, sent);
    }
    if (s === before) break;
  }
  // 投了と時間切れも通ること
  fits({ type: "RESIGN", player: 0 }, 0);
  fits({ type: "CLOCK_TIMEOUT", player: 1 }, 1);
  fits({ type: "NEW_GAME" }, 0);
}

console.log(`本物の対局で出た手 ${checked} 件をルールにかけた`);
console.log(`  現れた欄: ${[...seen].sort().join(", ")}`);
if (bad.length) {
  console.log(`\n  NG   ルールに弾かれる手が ${bad.length} 種あります:`);
  for (const b of bad) console.log(`         ${b}`);
  console.log(`\n${ok} ok / ${bad.length} fail`);
  process.exit(1);
}
console.log(`\n${ok} ok / 0 fail`);
