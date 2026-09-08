import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Ledger } from "../src/server/ledger.js";
import { verifyMatch } from "../src/server/verify-match.js";
import {
  seasonAt,
  seasonRewards,
  applySeasonReceipts,
  SEASON_BACK,
  SEASON_FRAME,
} from "../src/game/season.js";
import { normalize } from "../src/skins/collection.js";
import {
  initialState,
  reducer,
  autoArrange,
  autoPickKing,
} from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";
import { cpuAction } from "../src/game/cpu.js";
import { ADJUDICATION_RULE_VERSION } from "../src/game/adjudication.js";
import {
  advanceNotes,
  cleanNote,
  noteTarget,
} from "../src/game/private-notes.js";
const db = new DatabaseSync(":memory:");
const sql = (q, ...args) => db.prepare(q).all(...args);
const ledger = new Ledger(sql);
const start = Date.parse("2026-09-01T05:00:00+09:00"),
  end = Date.parse("2026-10-01T05:00:00+09:00");
assert.equal(seasonAt(start - 1).id, "2026-08");
assert.equal(seasonAt(start).id, "2026-09");
assert.equal(seasonAt(end - 1).id, "2026-09");
assert.equal(seasonAt(end).id, "2026-10");
assert.equal(seasonAt(Date.parse("2027-01-01T04:59:59+09:00")).id, "2026-12");
assert.equal(seasonAt(Date.parse("2028-03-01T04:59:59+09:00")).id, "2028-02");
function recordedGame(
  round = 0,
  size = 9,
  ruleVersion = ADJUDICATION_RULE_VERSION,
) {
  let s = initialState(),
    acts = {},
    n = 0;
  function act(a, player) {
    a = enrichAction(
      {
        ...a,
        player,
        __id: `act-${n}`,
        by: player === 0 ? "host" : "guest",
        elapsedMs: 0,
      },
      s,
    );
    acts[String(n++).padStart(5, "0")] = a;
    s = reducer(
      { ...s, captureReveal: null, interstitial: null, setupEffects: null },
      a,
    );
  }
  act({ type: "START_SETUP", size, ruleVersion }, 0);
  act({ type: "ROLL_DICE_SINGLE" }, 0);
  act({ type: "NEXT_DICE_STEP" }, 0);
  act({ type: "ROLL_DICE_SINGLE" }, 1);
  act({ type: "NEXT_DICE_STEP" }, 1);
  while (s.diceIdx === 3) {
    act({ type: "REROLL_DICE" }, 0);
    act({ type: "ROLL_DICE_SINGLE" }, 0);
    act({ type: "NEXT_DICE_STEP" }, 0);
    act({ type: "ROLL_DICE_SINGLE" }, 1);
    act({ type: "NEXT_DICE_STEP" }, 1);
  }
  act({ type: "GOTO_MULLIGAN" }, 0);
  for (let i = 0; i < 2; i++)
    act({ type: "CONFIRM_MULLIGAN", discardIds: [] }, s.mulliganIdx);
  for (const p of [0, 1]) {
    const placement = autoArrange(s, p, null, null, null);
    act(
      {
        type: "SETUP_CONFIRM",
        placement,
        kingId: autoPickKing(s, p, placement),
      },
      p,
    );
  }
  assert.equal(s.phase, "play");
  for (let i = 0; i < 35 && s.phase === "play"; i++) {
    s = { ...s, captureReveal: null, interstitial: null, setupEffects: null };
    if (s.pendingKingChoice) {
      act(
        { type: "CHOOSE_HEIR", id: s.pendingKingChoice.candidateIds[0] },
        s.pendingKingChoice.owner,
      );
      continue;
    }
    let a = cpuAction(s, s.currentTurn);
    if (!a) break;
    if (a.type === "__CPU_SHUFFLE")
      a = { type: "CONFIRM_SHUFFLE", aId: a.aceId, pickIds: a.pickIds };
    act(a, s.currentTurn);
  }
  if (s.phase !== "gameover") act({ type: "RESIGN" }, 1);
  assert.equal(s.phase, "gameover");
  return {
    room: {
      seats: { host: "host", guest: "guest" },
      createdAt: start + 1000,
      round,
      hostName: "試験の赤",
      guestName: "試験の青",
      acts,
    },
    request: { code: "ABCD", createdAt: start + 1000, round, winner: s.winner },
  };
}
const clockGame = recordedGame(0, 9, 2);
assert.deepEqual(
  verifyMatch(clockGame.room, clockGame.request, "host"),
  verifyMatch(clockGame.room, clockGame.request, "guest"),
);
const game = recordedGame();
const verified = verifyMatch(game.room, game.request, "host");
assert.deepEqual(verifyMatch(game.room, game.request, "guest"), verified);
assert.throws(() => verifyMatch(game.room, game.request, "outsider"));
assert.throws(() =>
  verifyMatch(game.room, { ...game.request, round: 1 }, "host"),
);
assert.throws(() =>
  verifyMatch(
    game.room,
    { ...game.request, winner: 1 - game.request.winner },
    "host",
  ),
);
const small = recordedGame(0, 5);
assert.throws(() => verifyMatch(small.room, small.request, "host"));
const unfinished = structuredClone(game);
for (const [k, a] of Object.entries(unfinished.room.acts))
  if (["RESIGN", "CLOCK_TIMEOUT"].includes(a.type))
    delete unfinished.room.acts[k];
if (
  Object.keys(unfinished.room.acts).length < Object.keys(game.room.acts).length
)
  assert.throws(() => verifyMatch(unfinished.room, unfinished.request, "host"));
const duplicate = structuredClone(game);
duplicate.room.acts.zzz = Object.values(game.room.acts)[0];
assert.deepEqual(verifyMatch(duplicate.room, game.request, "host"), verified);
// Ledger only accepts the server's verified match, and updates both seats once.
for (let i = 0; i < 10; i++)
  ledger.record({ ...verified, id: `match-${i}`, winner: 0 }, start + 2000 + i);
ledger.record({ ...verified, id: "match-0", winner: 0 }, start + 9000);
assert.equal(ledger.summary("host", start + 9001).player.rated, 10);
assert.equal(ledger.summary("guest", start + 9001).player.rated, 10);
assert.equal(ledger.summary("host", start + 9001).player.place, 1);
assert.throws(() => ledger.result("outsider", "match-0"));
assert.throws(() =>
  ledger.claim("outsider", "2026-09:participation", start + 9001),
);
const claimed = ledger.claim("host", "2026-09:participation", start + 9001);
ledger.claim("host", "2026-09:participation", start + 9001);
assert.equal(ledger.claims("host").length, 1);
let c = normalize({ tickets: 7 });
c = normalize(applySeasonReceipts(c, claimed));
assert.equal(c.tickets, 9);
c = normalize(applySeasonReceipts(c, claimed));
assert.equal(c.tickets, 9);
assert.throws(() =>
  ledger.equip("guest", SEASON_BACK, SEASON_FRAME, start + 9002),
);
// Reach all tiers, then lose enough games to fall back. Reached rewards remain.
for (let i = 10; i < 120; i++)
  ledger.record(
    { ...verified, id: `match-${i}`, winner: 0 },
    start + 10000 + i,
  );
assert.equal(ledger.summary("host", start + 20000).player.highest, 4);
for (let i = 120; i < 240; i++)
  ledger.record(
    { ...verified, id: `match-${i}`, winner: 1 },
    start + 30000 + i,
  );
const down = ledger.summary("host", start + 40000).player;
assert.equal(down.highest, 4);
assert.ok(down.rating < 1750);
assert.equal(down.best, 1);
ledger.claim("host", "2026-09:soldier", start + 40000);
ledger.claim("host", "2026-09:general", start + 40000);
ledger.claim("host", "2026-09:king", start + 40000);
assert.equal(
  ledger.equip("host", SEASON_BACK, SEASON_FRAME, start + 40001).appearance
    .back,
  SEASON_BACK,
);
assert.throws(() => ledger.claim("host", "2026-09:ten", end - 1));
const ended = ledger.summary("host", end);
assert.equal(ended.season.id, "2026-10");
assert.equal(ended.player, null);
assert.equal(ended.history.length, 1);
ledger.claim("host", "2026-09:ten", end);
const frozen = JSON.stringify(ledger.list("2026-09"));
ledger.record({ ...verified, id: "oct-match", winner: null }, end);
ledger.record({ ...verified, id: "match-0", winner: 0 }, end + 1);
assert.equal(JSON.stringify(ledger.list("2026-09")), frozen);
assert.equal(ledger.summary("host", end + 2).player.rated, 1);
assert.equal(ledger.summary("host", end + 2).player.draws, 1);
assert.equal(ledger.summary("host", end + 2).player.rating, 1500);
// Private notes are square-based and use no hidden IDs to recover a shuffle.
const piece = (row, col, owner = 1) => ({
  row,
  col,
  owner,
  alive: true,
  revealed: false,
});
const state = (pieces, extra = {}) => {
  const board = Array.from({ length: 9 }, () => Array(9).fill(null));
  for (const p of pieces) board[p.row][p.col] = p;
  return { phase: "play", boardSize: 9, board, ...extra };
};
const ps = [piece(1, 1), piece(1, 2), piece(1, 3), piece(3, 3)],
  before = state(ps),
  notes = Object.fromEntries(
    ps.map((p) => [
      `${p.row},${p.col}`,
      cleanNote({ ranks: ["6", "8"], king: true, text: "縦へ移動" }),
    ]),
  );
assert.equal(noteTarget(before, "1,1", 0), true);
assert.equal(noteTarget(before, "1,1", 1), false);
assert.equal(noteTarget(before, "1,1", null), false);
for (const order of [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]) {
  const after = state(
    [
      ...order.map((i, j) => ({ ...ps[i], row: ps[j].row, col: ps[j].col })),
      ps[3],
    ],
    { lastSwap: { cells: ps.slice(0, 3) } },
  );
  assert.deepEqual(Object.keys(advanceNotes(notes, before, after, 0)), ["3,3"]);
}
const move = { from: ps[0], to: { row: 2, col: 1 }, owner: 1 };
const moved = state([{ ...ps[0], row: 2 }, ...ps.slice(1)], { lastMove: move });
const follow = advanceNotes(notes, before, moved, 0);
assert.ok(follow["2,1"]);
assert.ok(!follow["1,1"]);
assert.ok(follow["3,3"]);
assert.ok(
  !advanceNotes(
    notes,
    before,
    state(ps.map((p, i) => ({ ...p, revealed: i === 0 }))),
    0,
  )["1,1"],
);
assert.ok(!advanceNotes(notes, before, state(ps.slice(1)), 0)["1,1"]);
assert.deepEqual(
  advanceNotes(notes, before, { ...before, phase: "gameover" }, 0),
  {},
);
assert.equal(cleanNote({ text: "a".repeat(100) }).text.length, 40);
console.log(
  "PASS: month boundaries, replay verification, match deduplication, rewards, tier retention, archives, cosmetics, and private-note anonymity",
);

// Exercise the HTTP boundary and the actual Durable Object handler without network.
const { default: worker, SeasonLedger } =
  await import("../src/server/worker.js");
const runtimeDb = new DatabaseSync(":memory:");
const object = new SeasonLedger({
  storage: {
    sql: {
      exec: (query, ...p) => ({
        toArray: () => runtimeDb.prepare(query).all(...p),
      }),
    },
    transactionSync: (fn) => {
      runtimeDb.exec("BEGIN");
      try {
        const r = fn();
        runtimeDb.exec("COMMIT");
        return r;
      } catch (e) {
        runtimeDb.exec("ROLLBACK");
        throw e;
      }
    },
  },
});
const env = { SEASONS: { idFromName: (x) => x, get: () => object } };
const request = (op, body = {}, token = "host") =>
  new Request(`https://game.example/api/season/${op}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
const originalFetch = globalThis.fetch;
let roomReads = 0;
globalThis.fetch = async (url, init) => {
  if (url.startsWith("https://identitytoolkit.googleapis.com/")) {
    const token = JSON.parse(init.body).idToken;
    return token === "invalid"
      ? Response.json({}, { status: 400 })
      : Response.json({ users: [{ localId: token }] });
  }
  if (url.includes("/rooms/ABCD.json?auth=")) {
    roomReads++;
    return Response.json(game.room);
  }
  throw Error("unexpected external request");
};
try {
  assert.equal(
    (
      await worker.fetch(
        new Request("https://game.example/api/season/summary", {
          method: "POST",
          body: "{}",
        }),
        env,
      )
    ).status,
    401,
  );
  assert.equal(
    (await worker.fetch(request("summary", {}, "invalid"), env)).status,
    401,
  );
  const summary = await (
    await worker.fetch(request("summary", { uid: "forged-user" }), env)
  ).json();
  assert.equal(summary.uid, "host");
  const first = await worker.fetch(request("finish", game.request), env);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).player.rated, 1);
  const repeated = await worker.fetch(
    request("finish", game.request, "guest"),
    env,
  );
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).player.rated, 1);
  assert.equal(roomReads, 1);
  assert.equal(
    (await worker.fetch(request("finish", game.request, "outsider"), env))
      .status,
    400,
  );
  const malicious = await worker.fetch(
    request("equip", { back: "moon-crest", frame: "gold-laurel" }),
    env,
  );
  assert.equal(malicious.status, 400);
  assert.equal(
    (
      await worker.fetch(
        new Request("https://game.example/api/season/health"),
        env,
      )
    ).status,
    200,
  );
} finally {
  globalThis.fetch = originalFetch;
  runtimeDb.close();
}

// Every hidden rank, including kings, must produce exactly the same card back.
const { build } = await import("esbuild");
const { writeFileSync, rmSync } = await import("node:fs");
const { fileURLToPath } = await import("node:url");
const renderPath = fileURLToPath(
  new URL("./.season-render-check.mjs", import.meta.url),
);
try {
  const result = await build({
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    jsx: "automatic",
    loader: { ".png": "dataurl", ".webp": "dataurl", ".css": "text" },
    external: ["react", "react-dom/server"],
    stdin: {
      resolveDir: process.cwd(),
      loader: "jsx",
      contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {Piece} from './src/ui/cards.jsx';import {SeatsProvider} from './src/ui/names.jsx';export function hidden(rank,isKing){return renderToStaticMarkup(<SeatsProvider value={{backs:[null,'moon-crest']}}><Piece viewer={0} piece={{rank,suit:'spade',owner:1,alive:true,revealed:false,isKing}} size="xs"/></SeatsProvider>)}`,
    },
  });
  writeFileSync(renderPath, result.outputFiles[0].text);
  const { hidden } = await import(renderPath),
    baseline = hidden("A", false);
  assert.ok(baseline.includes("card-back-moon"));
  for (const rank of [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ])
    for (const king of [false, true])
      assert.equal(hidden(rank, king), baseline);
} finally {
  rmSync(renderPath, { force: true });
}
console.log(
  "PASS: authenticated API boundary, actual ledger transactions, retry after room deletion, and identical backs for all hidden ranks",
);
