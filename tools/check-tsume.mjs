import assert from "node:assert/strict";
import { normalize } from "../src/skins/collection.js";
import {
  TSUME_QUESTIONS,
  createTsumePosition,
  applyTsumeAction,
  tsumeWon,
  isTsumeAnswer,
  clearDailyTsume,
  TSUME_ORDERS,
  tsumeMoves,
} from "../src/game/tsume.js";
import {
  dailyTsume,
  joinDailyTsume,
  tsumeReceipt,
  sanitizeTsumeProgress,
  tsumeCandidates,
} from "../src/game/tsume-daily.js";
import {
  squareName,
  emptyBoard,
  getLegalMoves,
  maxAdopt,
} from "../src/game/board.js";
import { RANKS } from "../src/game/constants.js";
import { endAction, initialState } from "../src/game/reducer.js";

const start = Date.parse("2026-09-08T06:00:00+09:00");
const dayAt = (i) => start + i * 86400000;
const sequence = Array.from(
  { length: 3650 },
  (_, i) => dailyTsume(dayAt(i)).questionId,
);
assert.equal(sequence[0], 1, "公開済みの9/8の問題は変わらない");
assert.equal(new Set(sequence).size, 30, "全30問が抽選対象");
for (let i = 0; i < sequence.length; i++) {
  assert.ok(sequence[i] >= 1 && sequence[i] <= 30);
  assert.ok(
    !sequence.slice(Math.max(0, i - 15), i).includes(sequence[i]),
    `日${i}: 直近15問を再出題しない`,
  );
}
assert.equal(tsumeCandidates([]).length, 30);
assert.equal(tsumeCandidates([1]).length, 29);
assert.deepEqual(
  tsumeCandidates(Array.from({ length: 15 }, (_, i) => i + 1)),
  Array.from({ length: 15 }, (_, i) => i + 16),
);
assert.deepEqual(
  tsumeCandidates(Array.from({ length: 16 }, (_, i) => i + 1)),
  [1, ...Array.from({ length: 14 }, (_, i) => i + 17)],
  "16問前の問題は抽選に戻る",
);
assert.notDeepEqual(
  sequence.slice(0, 30),
  sequence.slice(30, 60),
  "30日周期の繰り返しにしない",
);
const fresh = await import("../src/game/tsume-daily.js?fresh-random-schedule");
for (const i of [3649, 16, 15, 1, 0, 366, 29, 500])
  assert.deepEqual(
    fresh.dailyTsume(dayAt(i)),
    dailyTsume(dayAt(i)),
    "別の起動・日付を飛ばす・過去に戻る場合も出題は一致する",
  );
const times = new Map();
for (let i = 0; i < 365; i++)
  if (!times.has(sequence[i])) times.set(sequence[i], dayAt(i));
assert.equal(times.size, 30);
assert.equal(
  dailyTsume(Date.parse("2026-09-08T04:59:59.999+09:00")).day,
  "2026-09-07",
);
assert.equal(
  dailyTsume(Date.parse("2026-09-08T05:00:00+09:00")).day,
  "2026-09-08",
);
assert.equal(
  dailyTsume(Date.parse("2026-09-09T04:59:59.999+09:00")).questionId,
  1,
);
assert.equal(
  dailyTsume(Date.parse("2026-09-09T05:00:00+09:00")).questionId,
  sequence[1],
);
assert.notEqual(sequence[1], 1);
assert.equal(
  dailyTsume(Date.parse("2026-09-09T20:00:00+09:00")).questionId,
  sequence[1],
  "同じ日は何度起動しても同じ問題",
);
assert.equal(TSUME_QUESTIONS.filter((q) => q.kind === "inference").length, 20);
const coord = (at, size) => ({
  row: size - Number(at.slice(1)),
  col: at.charCodeAt(0) - 97,
});
function worlds(q, observation = q.observation) {
  const result = [];
  for (const rank of RANKS)
    for (const king of [false, true])
      for (const kingRank of RANKS) {
        if (
          (king && kingRank !== rank) ||
          (!king && rank === "K") ||
          (q.knownOtherKing && (king || kingRank !== q.knownOtherKing)) ||
          q.excludedRanks?.includes(rank) ||
          q.excludedRanks?.includes(kingRank)
        )
          continue;
        for (
          let adopted = !king && rank === kingRank ? 2 : 1;
          adopted <= maxAdopt(rank, kingRank);
          adopted++
        ) {
          if (
            !observation.every((m) => {
              const p = {
                id: "x",
                rank,
                isKing: king,
                owner: 0,
                alive: true,
                ...coord(m.from, q.size),
              };
              const board = emptyBoard(q.size);
              board[p.row][p.col] = p;
              for (const target of m.targets || []) {
                const cell = coord(target, q.size);
                board[cell.row][cell.col] = { rank: "2", owner: 1, ...cell };
              }
              const move = getLegalMoves(
                p,
                board,
                q.size,
                { [rank]: adopted },
                kingRank,
              ).find((mv) => squareName(mv.row, mv.col, q.size) === m.to);
              if (!move) return false;
              if (m.captured) {
                const captures = (
                  move.captures || (move.capture ? [coord(m.to, q.size)] : [])
                ).map((c) => squareName(c.row, c.col, q.size));
                if (JSON.stringify(captures) !== JSON.stringify(m.captured))
                  return false;
              }
              if (
                q.sameTurn &&
                endAction(
                  { ...initialState(), phase: "play", pieces: { x: p } },
                  "x",
                ).extraMoveFor !== "x"
              )
                return false;
              return true;
            })
          )
            continue;
          result.push({
            id: rank + ":" + (king ? "king" : "normal"),
            king,
            kingRank,
            adopted,
          });
        }
      }
  return result;
}
const unique = (a) => [...new Set(a)];
for (const q of TSUME_QUESTIONS) {
  const at = times.get(q.id),
    { day } = dailyTsume(at);
  let evidence;
  if (q.kind === "inference") {
    if (q.joint) {
      const x = worlds(
          q,
          q.observation.filter((o) => o.label === "X"),
        ),
        y = worlds(
          q,
          q.observation.filter((o) => o.label === "Y"),
        );
      assert.deepEqual(
        unique(
          x.flatMap((a) =>
            y
              .filter(
                (b) =>
                  a.kingRank === b.kingRank &&
                  Number(a.king) + Number(b.king) === 1,
              )
              .map((b) => a.id + "|" + b.id),
          ),
        ),
        q.expectedJoint,
      );
    } else {
      const values = worlds(q);
      assert.deepEqual(unique(values.map((v) => v.id)), q.expectedCandidates);
      if (q.minimumAdopted)
        assert.equal(
          Math.min(...values.map((v) => v.adopted)),
          q.minimumAdopted,
        );
    }
    evidence = { answer: q.correctOption };
    for (let i = 0; i < q.options.length; i++)
      assert.equal(isTsumeAnswer(q, { answer: i }), i === q.correctOption);
    assert.equal(isTsumeAnswer(q, { answer: String(q.correctOption) }), false);
  } else {
    const actions =
      q.kind === "triangle"
        ? [{ type: "shuffle", from: q.actor, picks: q.picks, order: [1, 2, 0] }]
        : q.solution.map((m) => ({ type: "move", ...m }));
    evidence = { actions };
    let s = createTsumePosition(q);
    for (const action of actions) s = applyTsumeAction(s, action);
    assert.ok(tsumeWon(s), `Q${q.id}: actual victory`);
    assert.equal(
      Object.values(s.pieces).filter((p) => p.owner === 1 && !p.alive).length,
      q.captureCount,
    );
    assert.equal(s.pieces[s.players[1].kingId].alive, false);
    assert.equal(s.captureReveal.defeated.at(-1).isKing, true);
    if (q.kind === "triangle") {
      for (const order of TSUME_ORDERS)
        assert.ok(isTsumeAnswer(q, { actions: [{ ...actions[0], order }] }));
      const picks = q.pieces.filter((p) => p.at !== q.actor).map((p) => p.at);
      const guaranteed = [];
      for (let i = 0; i < picks.length; i++)
        for (const second of picks.slice(i + 1)) {
          const pair = [picks[i], second];
          const variants = TSUME_ORDERS.map((order) => ({
            ...actions[0],
            picks: pair,
            order,
          }));
          const allWin = variants.every((action) =>
            tsumeWon(applyTsumeAction(createTsumePosition(q), action)),
          );
          for (const action of variants)
            assert.equal(isTsumeAnswer(q, { actions: [action] }), allWin);
          if (allWin) guaranteed.push(pair.slice().sort());
        }
      assert.deepEqual(guaranteed, [q.picks.slice().sort()]);
    } else {
      const initial = createTsumePosition(q),
        wins = [];
      for (const piece of Object.values(initial.pieces).filter(
        (p) => p.owner === 0,
      ))
        for (const move of tsumeMoves(initial, piece.id)) {
          const first = {
            type: "move",
            from: squareName(piece.row, piece.col, q.size),
            to: squareName(move.row, move.col, q.size),
          };
          const mid = applyTsumeAction(initial, first);
          if (tsumeWon(mid)) wins.push([first]);
          if (q.kind === "double" && mid.extraMoveFor)
            for (const second of tsumeMoves(mid, mid.extraMoveFor)) {
              const last = {
                type: "move",
                from: first.to,
                to: squareName(second.row, second.col, q.size),
              };
              if (tsumeWon(applyTsumeAction(mid, last)))
                wins.push([first, last]);
            }
        }
      assert.equal(wins.length, 1, `Q${q.id}: unique winning sequence`);
    }
    assert.equal(isTsumeAnswer(q, { actions: [] }), false);
    assert.equal(
      isTsumeAnswer(q, {
        actions: [{ type: "move", from: q.actor, to: "z99" }],
      }),
      false,
    );
    assert.equal(
      isTsumeAnswer(q, { actions: [...actions, actions[0]] }),
      false,
    );
  }
  let collection = normalize({ ether: 9, tickets: 2 });
  assert.throws(() => clearDailyTsume(collection, day, evidence, at));
  collection = normalize(joinDailyTsume(collection, day, at));
  assert.equal(collection.ether, 59);
  assert.equal(collection.tickets, 2);
  assert.equal(joinDailyTsume(collection, day, at), collection);
  assert.throws(() => clearDailyTsume(collection, day, {}, at));
  collection = normalize(clearDailyTsume(collection, day, evidence, at));
  assert.equal(collection.tickets, 3);
  assert.equal(collection.ether, 59);
  assert.equal(tsumeReceipt(collection, day).cleared, true);
  assert.equal(clearDailyTsume(collection, day, evidence, at), collection);
  assert.deepEqual(
    normalize(JSON.parse(JSON.stringify(collection))),
    collection,
  );
  assert.throws(() =>
    clearDailyTsume(collection, day, evidence, at + 86400000),
  );
  console.log(`Q${q.id}: 正解・報酬・再挑戦の重複防止 OK`);
}
assert.deepEqual(
  sanitizeTsumeProgress({
    days: {
      bad: { joined: true, questionId: 1 },
      "2026-09-08": { joined: false, questionId: 1 },
    },
  }),
  { days: {} },
);

// Real collection store: atomic receipts, concurrent clicks and failed persistence.
const memory = new Map();
let fail = false;
globalThis.localStorage = {
  getItem: (k) => memory.get(k) || null,
  setItem: (k, v) => {
    if (fail) throw Error("storage failed");
    memory.set(k, v);
  },
};
const { updateCollection, getCollection } =
  await import("../src/skins/store.js");
const { day } = dailyTsume(start);
await Promise.all(
  Array.from({ length: 12 }, () =>
    updateCollection((c) => joinDailyTsume(c, day, start)),
  ),
);
assert.equal(getCollection().ether, 50);
fail = true;
await assert.rejects(
  updateCollection((c) => clearDailyTsume(c, day, { answer: 2 }, start)),
);
assert.equal(getCollection().tickets, 0);
assert.equal(tsumeReceipt(getCollection(), day).cleared, false);
fail = false;
await Promise.all(
  Array.from({ length: 12 }, () =>
    updateCollection((c) => clearDailyTsume(c, day, { answer: 2 }, start)),
  ),
);
assert.equal(getCollection().tickets, 1);
const tomorrow = dailyTsume(start + 86400000);
await updateCollection((c) =>
  joinDailyTsume(c, tomorrow.day, start + 86400000),
);
assert.equal(getCollection().ether, 100);
assert.equal(getCollection().tickets, 1);
console.log(
  "10年分の直近15問除外・ランダム出題の再現性・全30問・朝5時更新・報酬保存の検証 OK",
);
