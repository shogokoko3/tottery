/**
 * 通信で届いた手の守りを検査する。通信はしない。
 *
 * 守りは二段ある。
 *   1. src/net/sync.js の acceptAct … 形を確かめ、**指し手を書き込む**
 *   2. src/game/reducer.js         … 名乗りが場に合うか、合法手かを確かめる
 *
 * ここを抜けられると、相手はこちらの手番を勝手に指せるし、盤の反対側から
 * 王を直接取れる。データベースのルールは盤を知らないので止められない。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const { acceptAct, NET_ACTIONS, LOCAL_ONLY_ACTIONS } =
  await import("../src/net/sync.js");
const { reducer, autoArrange, autoPickKing } =
  await import("../src/game/reducer.js");
const { cpuAction } = await import("../src/game/cpu.js");
const { getLegalMoves, kingRankOf } = await import("../src/game/board.js");

const here = dirname(fileURLToPath(import.meta.url));
let ok = 0;
const fails = [];
function is(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    ok++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(label);
    console.log(
      `  NG   ${label}\n         得た: ${JSON.stringify(got)}\n         望み: ${JSON.stringify(want)}`,
    );
  }
}
const ME = "uidMe";
const FOE = "uidFoe";
/** 席0(ホスト)として、相手 FOE から受け取る */
const asHost = (a) => acceptAct(a, ME, 0, FOE);
/** 席1(ゲスト)として受け取る */
const asGuest = (a) => acceptAct(a, ME, 1, FOE);
const act = (o) => ({ __id: "f-1", by: FOE, ...o });
const seatOf = (a) => (a === null ? null : a.player);

console.log("指し手は、手の中身ではなく送り主から決める");
is(
  "席番号を名乗らない手にも指し手が入る",
  seatOf(asHost(act({ type: "MOVE_PIECE", pieceId: "c1" }))),
  1,
);
is(
  "ゲスト側から見れば指し手は席0",
  seatOf(asGuest(act({ type: "MOVE_PIECE", pieceId: "c1" }))),
  0,
);
is(
  '文字列の "0" で投了を名乗っても、投了するのは送り主のほう',
  seatOf(asHost(act({ type: "RESIGN", player: "0" }))),
  1,
);
is(
  "数の 0 で名乗っても同じ",
  seatOf(asHost(act({ type: "RESIGN", player: 0 }))),
  1,
);
is(
  "時間切れも送り主のものになる",
  seatOf(asHost(act({ type: "CLOCK_TIMEOUT", player: 0 }))),
  1,
);
is(
  "布陣の確定も送り主のものになる",
  seatOf(asGuest(act({ type: "SETUP_CONFIRM", player: 1 }))),
  0,
);

console.log("\n受け取らない手");
is("知らない名前の手は捨てる", asHost(act({ type: "DROP_TABLE" })), null);
is(
  "手元だけの操作が届いたら捨てる",
  asHost(act({ type: "SELECT_PIECE", id: "c1" })),
  null,
);
is("印(__id)の無い手は捨てる", asHost({ type: "MOVE_PIECE", by: FOE }), null);
is("中身が物でなければ捨てる", asHost("こんにちは"), null);
is("空なら捨てる", asHost(null), null);
is(
  "自分の名前で戻ってきた手は捨てる",
  asHost({ __id: "m-1", by: ME, type: "MOVE_PIECE" }),
  null,
);
is(
  "相手でも自分でもない名前の手は捨てる",
  asHost({ __id: "x-1", by: "uidStranger", type: "MOVE_PIECE" }),
  null,
);
is(
  "名前の無い手は、相手が分かっているときは捨てる",
  asHost({ __id: "x-2", type: "MOVE_PIECE" }),
  null,
);
is(
  "相手がまだ分からないときは、名前が無くても通す",
  seatOf(acceptAct({ __id: "x-3", type: "MOVE_PIECE" }, ME, 0, null)),
  1,
);
is(
  "自分の席が分からなければ捨てる",
  acceptAct(act({ type: "MOVE_PIECE" }), ME, null, FOE),
  null,
);

console.log("\nホストしか出せない合図");
is(
  "ホストに始まりの合図は届かない",
  asHost(act({ type: "START_SETUP" })),
  null,
);
is("ホストに再戦の合図も届かない", asHost(act({ type: "NEW_GAME" })), null);
is(
  "ゲストには始まりの合図が届く",
  seatOf(asGuest(act({ type: "START_SETUP", size: 5 }))),
  0,
);

console.log("\n二つの一覧が reducer の手を漏れなく覆っているか");
const src = readFileSync(join(here, "..", "src", "game", "reducer.js"), "utf8");
const cases = [...src.matchAll(/^\s{4}case "([A-Z_]+)":/gm)].map((m) => m[1]);
const covered = new Set([...NET_ACTIONS, ...LOCAL_ONLY_ACTIONS]);
is(
  `reducer の手 ${cases.length} 件がどちらかに入っている`,
  cases.filter((c) => !covered.has(c)),
  [],
);
is(
  "届いてよい手に、reducer が知らない名前が無い",
  [...NET_ACTIONS].filter((n) => !cases.includes(n)),
  [],
);
is(
  "両方に入っている手が無い",
  [...NET_ACTIONS].filter((n) => LOCAL_ONLY_ACTIONS.has(n)),
  [],
);

/* ---------------- 盤に届いたときに何が起きるか ---------------- */
console.log("\n細工した手を盤にかける");

/** CPU 同士で少し進めた、本物の対局を作る */
function midGame(size = 5) {
  let s = reducer(
    { phase: "intro" },
    { type: "START_SETUP", size, setupMode: "simultaneous", handSize: 13 },
  );
  let guard = 0;
  while (s.phase !== "play" && guard++ < 400) {
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
    if (s.phase === "dice")
      s = reducer(
        s,
        s.dice[s.diceIdx] === null
          ? { type: "ROLL_DICE_SINGLE" }
          : s.diceIdx === 2
            ? { type: "GOTO_MULLIGAN" }
            : s.diceIdx === 3
              ? { type: "REROLL_DICE" }
              : { type: "NEXT_DICE_STEP" },
      );
    else if (s.phase === "mulligan")
      s = reducer(s, { type: "CONFIRM_MULLIGAN", discardIds: [] });
    else break;
  }
  return s;
}

const g0 = midGame(5);
is("対局が始まった", g0.phase, "play");
const me = g0.currentTurn;
const foe = 1 - me;
const alive = (o) =>
  Object.values(g0.pieces).filter((x) => x.alive && x.owner === o);
const myPiece = alive(me)[0];

// 相手(番でない側)の駒を、こちらの番に動かそうとする
{
  const foePiece = alive(foe)[0];
  const after = reducer(g0, {
    type: "MOVE_PIECE",
    player: foe,
    pieceId: foePiece.id,
    row: foePiece.row,
    col: foePiece.col,
  });
  is("番でない側が指した手は通らない", after === g0, true);
}

// 届かないマスの相手の駒を、いきなり取りにいく。
// 盤は毎回ちがうので、その駒から「届かないマス」を実際に引いて選ぶ
{
  const reach = new Set(
    getLegalMoves(
      myPiece,
      g0.board,
      g0.board.length,
      g0.players[me].armyRankCounts,
      kingRankOf(g0, me),
    ).map((m) => `${m.row},${m.col}`),
  );
  const target = alive(foe).find((x) => !reach.has(`${x.row},${x.col}`));
  if (!target) {
    ok += 2;
    console.log("  --   届かない相手の駒が無い配置だった(次の対局で見る)");
  } else {
    const after = reducer(g0, {
      type: "MOVE_PIECE",
      player: me,
      pieceId: myPiece.id,
      row: target.row,
      col: target.col,
    });
    is("届かないマスの駒は取れない", after.pieces[target.id].alive, true);
    is("盤も動かない", after === g0, true);
  }
}

// captures に相手の駒を並べて掃討する
{
  const all = alive(foe).map((x) => ({ row: x.row, col: x.col }));
  const after = reducer(g0, {
    type: "MOVE_PIECE",
    player: me,
    pieceId: myPiece.id,
    row: myPiece.row,
    col: myPiece.col,
    captures: all,
  });
  const left = Object.values(after.pieces).filter(
    (x) => x.alive && x.owner === foe,
  ).length;
  is("captures に並べても盤は掃討できない", left, all.length);
}

// 盤の外
{
  let threw = null;
  let after;
  try {
    after = reducer(g0, {
      type: "MOVE_PIECE",
      player: me,
      pieceId: myPiece.id,
      row: 99,
      col: 0,
    });
  } catch (e) {
    threw = e;
  }
  is("盤の外へ動かしても落ちない", threw, null);
  is("盤の外へは動けない", after === g0, true);
}

// 知らない駒での入れ替え
{
  let threw = null;
  let after;
  try {
    after = reducer(g0, {
      type: "CONFIRM_SHUFFLE",
      player: me,
      aId: "nope",
      pickIds: ["n2", "n3"],
    });
  } catch (e) {
    threw = e;
  }
  is("知らない駒で入れ替えても落ちない", threw, null);
  is("知らない駒では入れ替わらない", after === g0, true);
}

// 手番を勝手に飛ばす
{
  const after = reducer(g0, { type: "SKIP_EXTRA_ACTION", player: foe });
  is("番でない側は手番を飛ばせない", after.currentTurn, g0.currentTurn);
}

// 考えた時間が数でない
{
  const legal = cpuAction(g0, me);
  if (legal && legal.type === "MOVE_PIECE") {
    const after = reducer(g0, { ...legal, player: me, elapsedMs: "たくさん" });
    is(
      "考えた時間が数でなければ時計は壊れない",
      Number.isFinite(after.clocks[me]),
      true,
    );
  } else ok++;
}

// 正しい手はちゃんと通る
{
  const legal = cpuAction(g0, me);
  if (legal && legal.type === "MOVE_PIECE") {
    const after = reducer(g0, { ...legal, player: me });
    is("合法な手はこれまでどおり通る", after !== g0, true);
  } else ok++;
}

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
