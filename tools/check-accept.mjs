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
const { hasAnyMove } = await import("../src/game/reducer.js");

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

console.log("\n場面に合わない手");
{
  const t = (label, act) =>
    is(label, reducer(g0, { ...act, player: foe }) === g0, true);
  t("対局中にサイコロは振れない", { type: "ROLL_DICE_SINGLE", value: 6 });
  t("対局中に目の確定は送れない", { type: "NEXT_DICE_STEP" });
  t("対局中に振り直しは送れない", { type: "REROLL_DICE" });
  t("対局中に引き直しへは戻せない", { type: "GOTO_MULLIGAN" });
  t("対局中に引き直しの確定は送れない", { type: "CONFIRM_MULLIGAN" });
  t("対局中に布陣の確定は送れない", { type: "SETUP_CONFIRM", placement: {} });
  t("対局中に始まりの合図は送れない", { type: "START_SETUP", size: 5 });
  t("終わっていないのに再戦は送れない", { type: "NEW_GAME" });
}

console.log("\n手番の横取りで時計が削られないか");
{
  const before = g0.clocks ? [...g0.clocks] : null;
  const after = reducer(g0, {
    type: "SKIP_EXTRA_ACTION",
    player: foe,
    elapsedMs: 999999999,
  });
  is("番でない側の手では時計は減らない", after === g0, true);
  if (before) is("時計はそのまま", after.clocks[me], before[me]);
  else ok++;
}

console.log("\n入れ替え(A の能力)");
{
  const mineAlive = alive(me);
  const ace = mineAlive.find((x) => x.rank === "A");
  const notAce = mineAlive.find((x) => x.rank !== "A");
  if (notAce) {
    const others = mineAlive.filter((x) => x.id !== notAce.id).slice(0, 2);
    if (others.length === 2) {
      const after = reducer(g0, {
        type: "CONFIRM_SHUFFLE",
        player: me,
        aId: notAce.id,
        pickIds: others.map((x) => x.id),
      });
      is("A でない駒では入れ替えられない", after === g0, true);
    } else ok++;
  } else ok++;
  if (ace) {
    const others = alive(me)
      .filter((x) => x.id !== ace.id)
      .slice(0, 2);
    if (others.length === 2) {
      const after = reducer(g0, {
        type: "CONFIRM_SHUFFLE",
        player: me,
        aId: ace.id,
        pickIds: [others[0].id, others[0].id],
      });
      is("同じ駒を2つ並べては入れ替えられない", after === g0, true);
      const bad = reducer(g0, {
        type: "CONFIRM_SHUFFLE",
        player: me,
        aId: ace.id,
        pickIds: others.map((x) => x.id),
        order: [0, 0, 0],
      });
      is("並べ替えでない順番は通らない", bad === g0, true);
    } else ok += 2;
  } else ok += 2;
  const foeAce = alive(foe).find((x) => x.rank === "A");
  if (foeAce) {
    const others = alive(me).slice(0, 2);
    const after = reducer(g0, {
      type: "CONFIRM_SHUFFLE",
      player: me,
      aId: foeAce.id,
      pickIds: others.map((x) => x.id),
    });
    is("相手の A では入れ替えられない", after === g0, true);
  } else ok++;
}

console.log("\n布陣の確定");
{
  // 布陣の場面まで戻して、敵陣に置く布陣を送ってみる
  let s0 = reducer(
    { phase: "intro" },
    { type: "START_SETUP", size: 5, setupMode: "simultaneous", handSize: 13 },
  );
  let guard = 0;
  while (s0.phase !== "setup" && guard++ < 60) {
    if (s0.interstitial) {
      s0 = reducer(s0, { type: "DISMISS_INTERSTITIAL" });
      continue;
    }
    if (s0.phase === "dice")
      s0 = reducer(
        s0,
        s0.dice[s0.diceIdx] === null
          ? { type: "ROLL_DICE_SINGLE", value: s0.diceIdx === 0 ? 6 : 1 }
          : s0.diceIdx === 2
            ? { type: "GOTO_MULLIGAN" }
            : s0.diceIdx === 3
              ? { type: "REROLL_DICE" }
              : { type: "NEXT_DICE_STEP" },
      );
    else if (s0.phase === "mulligan")
      s0 = reducer(s0, { type: "CONFIRM_MULLIGAN", discardIds: [] });
    else break;
  }
  is("布陣の場面まで来た", s0.phase, "setup");
  const good = autoArrange(s0, 1, null, null, null);
  const ids = Object.keys(good);
  const kingId = autoPickKing(s0, 1, good);
  const enemy = Object.fromEntries(
    ids.map((id, n) => [id, { row: 4, col: n % 5 }]),
  );
  is(
    "敵陣に布陣できない",
    reducer(s0, {
      type: "SETUP_CONFIRM",
      player: 1,
      placement: enemy,
      kingId,
    }) === s0,
    true,
  );
  const stacked = Object.fromEntries(ids.map((id) => [id, { row: 0, col: 0 }]));
  is(
    "同じマスに重ねられない",
    reducer(s0, {
      type: "SETUP_CONFIRM",
      player: 1,
      placement: stacked,
      kingId,
    }) === s0,
    true,
  );
  const outside = Object.fromEntries(
    ids.map((id) => [id, { row: 99, col: 0 }]),
  );
  let threw = null;
  try {
    is(
      "盤の外には布陣できない",
      reducer(s0, {
        type: "SETUP_CONFIRM",
        player: 1,
        placement: outside,
        kingId,
      }) === s0,
      true,
    );
  } catch (e) {
    threw = e.message;
  }
  is("盤の外の布陣で落ちない", threw, null);
  is(
    "正しい布陣は通る",
    reducer(s0, {
      type: "SETUP_CONFIRM",
      player: 1,
      placement: good,
      kingId,
    }) !== s0,
    true,
  );
}

console.log("\n盤そのものを細工する");
{
  const start = (size) =>
    reducer(
      { phase: "intro" },
      {
        type: "START_SETUP",
        player: 0,
        size,
        setupMode: "simultaneous",
        deck: [],
      },
    );
  is('文字列の "5" では盤を作れない', start("5").phase, "intro");
  is("5でも9でもない大きさは作れない", start(4).phase, "intro");
  is("巨大な盤は作れない", start(3000).phase, "intro");
  is(
    "山札を持たない始まりの合図は受け取らない",
    reducer(
      { phase: "intro" },
      { type: "START_SETUP", player: 0, size: 5, setupMode: "simultaneous" },
    ).phase,
    "intro",
  );
}

console.log("\n乱数の欄が欠けた手");
{
  const dice = reducer(
    { phase: "intro" },
    {
      type: "START_SETUP",
      size: 5,
      setupMode: "simultaneous",
      handSize: 13,
    },
  );
  is("サイコロの場面になった", dice.phase, "dice");
  is(
    "目を持たないサイコロの手は受け取らない",
    reducer(dice, { type: "ROLL_DICE_SINGLE", player: 0 }) === dice,
    true,
  );
  is(
    "目が範囲外でも受け取らない",
    reducer(dice, { type: "ROLL_DICE_SINGLE", player: 0, value: 99 }) === dice,
    true,
  );
  is(
    "目があれば受け取る",
    reducer(dice, { type: "ROLL_DICE_SINGLE", player: 0, value: 3 }) !== dice,
    true,
  );
  is(
    "先手が決まる前に引き直しへは進めない",
    reducer(dice, { type: "GOTO_MULLIGAN", player: 0 }) === dice,
    true,
  );
  is(
    "目がそろっていないのに振り直せない",
    reducer(dice, { type: "REROLL_DICE", player: 0 }) === dice,
    true,
  );
}

console.log("\n「もう一度」の枠と、手番の放棄");
{
  const mineAlive = alive(me);
  const a1 = mineAlive[0];
  const a2 = mineAlive[1];
  is(
    "「もう一度」の枠は、その駒のためのもの",
    a2
      ? reducer(
          { ...g0, extraMoveFor: a1.id },
          {
            type: "MOVE_PIECE",
            player: me,
            pieceId: a2.id,
            row: a2.row,
            col: a2.col,
          },
        ).pieces[a2.id].row === a2.row
      : true,
    true,
  );
  is(
    "1手も指さずに手番は渡せない",
    reducer(g0, { type: "SKIP_EXTRA_ACTION", player: me }) === g0,
    true,
  );
}

console.log("\n跡継ぎを選ぶまで、ほかの手は出せない");
{
  const waiting = {
    ...g0,
    pendingKingChoice: { owner: me, rank: "2", candidateIds: ["x1", "x2"] },
  };
  is(
    "跡継ぎを選ぶ前に駒は動かせない",
    reducer(waiting, {
      type: "MOVE_PIECE",
      player: me,
      pieceId: myPiece.id,
      row: myPiece.row,
      col: myPiece.col,
    }) === waiting,
    true,
  );
  is(
    "手番も飛ばせない",
    reducer(waiting, { type: "SKIP_EXTRA_ACTION", player: me }) === waiting,
    true,
  );
  is(
    "相手の側の手は止めない",
    reducer(waiting, { type: "SKIP_EXTRA_ACTION", player: foe }) === waiting,
    true,
  );
}

console.log("\n形の違う中身で落とせないか");
{
  const bad = (act) => {
    let threw = null;
    let out;
    try {
      out = reducer(g0, act);
    } catch (e) {
      threw = e.message;
    }
    return { threw, same: out === g0 };
  };
  const c = bad({
    type: "MOVE_PIECE",
    player: me,
    pieceId: myPiece.id,
    row: myPiece.row,
    col: myPiece.col,
    captures: {},
  });
  is("取る駒の形が違っても落ちない", c.threw, null);
  is("その手は捨てられる", c.same, true);
  const d = bad({ type: "CONFIRM_MULLIGAN", player: me, discardIds: 5 });
  is("捨て札の形が違っても落ちない", d.threw, null);
}

console.log("\n取る駒の並びに同じマスを2度");
{
  // 6〜9の王はまとめて取れる。その並びに同じマスを2度書くと、
  // 集合としては合うのに手前の1枚を取らずに通り抜けられる
  const { initialState } = await import("../src/game/reducer.js");
  const { emptyBoard } = await import("../src/game/board.js");
  const st = initialState();
  st.phase = "play";
  st.board = emptyBoard(9);
  st.boardSize = 9;
  st.currentTurn = 1;
  const put = (id, rank, owner, row, col, isKing) => {
    const pc = {
      id,
      rank,
      owner,
      row,
      col,
      isKing,
      suit: "spade",
      alive: true,
      revealed: false,
      history: [],
    };
    st.board[row][col] = pc;
    st.pieces[id] = pc;
    if (isKing) st.players[owner].kingId = id;
    return pc;
  };
  const k1 = put("k1", "6", 1, 0, 0, true);
  put("f1", "4", 0, 2, 0, false);
  put("fk", "J", 0, 4, 0, true);
  const legal = getLegalMoves(
    k1,
    st.board,
    9,
    st.players[1].armyRankCounts,
    kingRankOf(st, 1),
  ).find((m) => m.row === 4 && m.col === 0);
  is("まとめ取りの手がある", !!(legal && legal.captures), true);
  const cheated = reducer(st, {
    type: "MOVE_PIECE",
    player: 1,
    pieceId: "k1",
    row: 4,
    col: 0,
    captures: [
      { row: 2, col: 0 },
      { row: 2, col: 0 },
    ],
  });
  is("同じマスを2度書いた手は通らない", cheated === st, true);
  const honest = reducer(st, {
    type: "MOVE_PIECE",
    player: 1,
    pieceId: "k1",
    row: 4,
    col: 0,
    captures: legal.captures,
  });
  is("正しい並びなら通る", honest !== st, true);
  is(
    "手前の駒もちゃんと倒れる",
    honest.pieces.f1.alive === false || honest.winner !== null,
    true,
  );
}

console.log("\n山札の中身");
{
  const half = [
    { id: "c0", rank: "2", suit: "spade" },
    { id: "c1", rank: "3", suit: "heart" },
    { id: "c2", rank: "4", suit: "club" },
    { id: "c3", rank: "5", suit: "diamond" },
    { id: "c4", rank: "6", suit: "spade" },
  ];
  const start = (deck) =>
    reducer(
      { phase: "intro" },
      {
        type: "START_SETUP",
        player: 0,
        size: 5,
        setupMode: "simultaneous",
        handSize: 5,
        deck,
      },
    ).phase;
  is("id を重ねた山札は受け取らない", start([...half, ...half]), "intro");
  is(
    "数字が知らないものなら受け取らない",
    start([...half, ...half.map((c, i) => ({ ...c, id: "d" + i, rank: "Z" }))]),
    "intro",
  );
  is(
    "中身が物でなければ受け取らない",
    start([...half, "こんにちは", 1, null, {}]),
    "intro",
  );
  is(
    "まともな山札は受け取る",
    start([...half, ...half.map((c, i) => ({ ...c, id: "d" + i }))]),
    "dice",
  );
}

console.log("\n跡継ぎが全滅したとき");
{
  const { initialState } = await import("../src/game/reducer.js");
  const { emptyBoard } = await import("../src/game/board.js");
  const st = initialState();
  st.phase = "play";
  st.board = emptyBoard(9);
  st.boardSize = 9;
  st.currentTurn = 1;
  const put = (id, rank, owner, row, col, isKing) => {
    const pc = {
      id,
      rank,
      owner,
      row,
      col,
      isKing,
      suit: "spade",
      alive: true,
      revealed: false,
      history: [],
    };
    st.board[row][col] = pc;
    st.pieces[id] = pc;
    if (isKing) st.players[owner].kingId = id;
    return pc;
  };
  const k1 = put("k1", "6", 1, 0, 0, true);
  put("a0", "2", 0, 2, 0, true);
  put("a1", "2", 0, 4, 0, false);
  put("a2", "2", 0, 6, 0, false);
  put("a3", "2", 0, 8, 0, false);
  const mv = getLegalMoves(
    k1,
    st.board,
    9,
    st.players[1].armyRankCounts,
    kingRankOf(st, 1),
  ).find((m) => m.row === 8 && m.col === 0);
  if (mv && mv.captures && mv.captures.length === 4) {
    const after = reducer(st, {
      type: "MOVE_PIECE",
      player: 1,
      pieceId: "k1",
      row: 8,
      col: 0,
      captures: mv.captures,
    });
    is("王も跡継ぎも全部倒れたら決着する", after.winner, 1);
    is("選ぶ場面は残らない", after.pendingKingChoice, null);
  } else ok += 2;
}

console.log("\n指せる手が無いとき");
{
  // A の駒は自分では動けない(入れ替えの起点になるだけ)。
  // A だけが残った側には、指せる手がひとつも無い
  const { initialState } = await import("../src/game/reducer.js");
  const { emptyBoard } = await import("../src/game/board.js");
  const st = initialState();
  st.phase = "play";
  st.board = emptyBoard(5);
  st.boardSize = 5;
  st.currentTurn = 0;
  const put = (id, rank, owner, row, col, isKing) => {
    const pc = {
      id,
      rank,
      owner,
      row,
      col,
      isKing,
      suit: "spade",
      alive: true,
      revealed: false,
      history: [],
    };
    st.board[row][col] = pc;
    st.pieces[id] = pc;
    if (isKing) st.players[owner].kingId = id;
    return pc;
  };
  put("k", "A", 0, 0, 0, true);
  put("f", "J", 1, 4, 4, true);
  const stuck = !hasAnyMove(st, 0);
  is("Aだけが残ると指せる手が無い", stuck, true);
  if (stuck)
    is(
      "そのときは手番を渡せる",
      reducer(st, { type: "SKIP_EXTRA_ACTION", player: 0 }).currentTurn,
      1,
    );
  else ok++;
}

console.log("\n王も空きマスへ動ける");
{
  const { initialState } = await import("../src/game/reducer.js");
  const { emptyBoard } = await import("../src/game/board.js");
  const st = initialState();
  st.phase = "play";
  st.board = emptyBoard(5);
  st.boardSize = 5;
  const put = (id, rank, owner, row, col, isKing) => {
    const pc = {
      id,
      rank,
      owner,
      row,
      col,
      isKing,
      suit: "spade",
      alive: true,
      revealed: false,
      history: [],
    };
    st.board[row][col] = pc;
    st.pieces[id] = pc;
    if (isKing) st.players[owner].kingId = id;
    return pc;
  };
  const k = put("k", "6", 0, 2, 2, true);
  put("far", "J", 1, 1, 4, true);
  const mv = getLegalMoves(
    k,
    st.board,
    5,
    st.players[0].armyRankCounts,
    kingRankOf(st, 0),
  );
  is("敵が線上にいなくても動ける", mv.length > 0, true);
  is(
    "そのときは何も取らない",
    mv.every((m) => !m.capture),
    true,
  );
  is("指せる手がある", hasAnyMove(st, 0), true);
}

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
