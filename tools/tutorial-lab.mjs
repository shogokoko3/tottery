/**
 * チュートリアルの手順を設計するための道具。
 * 決まった山札・決まった布陣から始めて、与えた手を順に指し、
 * 盤面と合法手を並べて見せる。台本の手順を確かめながら組むために使う。
 *
 * 手札と、そのカードのidを見る(EP は第何話か。既定は1):
 *   node tools/tutorial-lab.mjs
 *   EP=2 node tools/tutorial-lab.mjs
 *
 * 布陣と手順を与えて、成立するか確かめる:
 *   PLAN='{
 *     "me" :{"placement":{"t0":{"row":4,"col":2}, ...},"kingId":"t0"},
 *     "foe":{"placement":{"t6":{"row":0,"col":2}, ...},"kingId":"t6"},
 *     "moves":[{"pieceId":"t4","row":2,"col":0}, ...]
 *   }' node tools/tutorial-lab.mjs
 *
 * moves は先手から交互に並べる。非合法な手があればそこで止まり、
 * その局面で指せる手を一覧にして見せる。
 */
import { reducer } from "../src/game/reducer.js";
import { getLegalMoves, squareName } from "../src/game/board.js";
import { TUTORIALS } from "../src/game/tutorial.js";

const SUIT = { spade: "♠", heart: "♥", diamond: "♦", club: "♣" };
const tut = TUTORIALS[Number(process.env.EP || 1) - 1];

/** 手札の並びをそのまま見せる */
function hands(s) {
  return [0, 1].map((i) =>
    s.players[i].hand.map((c) => `${c.id}=${c.rank}${SUIT[c.suit]}`).join(" "),
  );
}

function show(s) {
  const size = s.boardSize;
  const rows = [];
  for (let r = 0; r < size; r++) {
    const cells = [];
    for (let c = 0; c < size; c++) {
      const p = s.board[r][c];
      cells.push(
        p
          ? `${p.owner === 0 ? "赤" : "青"}${p.rank}${p.isKing ? "王" : " "}`.padEnd(
              4,
            )
          : " ・ ".padEnd(4),
      );
    }
    rows.push(`${size - r} ${cells.join("")}`);
  }
  rows.push(
    `  ${"abcde"
      .slice(0, size)
      .split("")
      .map((x) => ` ${x}  `)
      .join("")}`,
  );
  return rows.join("\n");
}

function moveList(s, owner) {
  const out = [];
  for (const p of Object.values(s.pieces)) {
    if (p.owner !== owner || !p.alive) continue;
    const ms = getLegalMoves(
      p,
      s.board,
      s.boardSize,
      s.players[owner].armyRankCounts,
    );
    if (!ms.length) continue;
    out.push(
      `  ${p.id} ${p.rank}${SUIT[p.suit]}${p.isKing ? "(王)" : ""} @${squareName(p.row, p.col, s.boardSize)} → ` +
        ms
          .map(
            (m) =>
              `${squareName(m.row, m.col, s.boardSize)}${m.capture ? "×" : ""}`,
          )
          .join(" "),
    );
  }
  return out.join("\n") || "  (動ける駒なし)";
}

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
console.log(`― ${tut.title} ―`);
console.log("あなたの手札 :", hands(s)[0]);
console.log("相手の手札   :", hands(s)[1]);

const plan = process.env.PLAN ? JSON.parse(process.env.PLAN) : null;
if (!plan) {
  console.log("\nPLAN を渡すと、その布陣と手順で進めます。");
  process.exit(0);
}

s = reducer(s, {
  type: "SETUP_CONFIRM",
  player: 0,
  placement: plan.me.placement,
  kingId: plan.me.kingId,
});
s = reducer(s, {
  type: "SETUP_CONFIRM",
  player: 1,
  placement: plan.foe.placement,
  kingId: plan.foe.kingId,
});
console.log("\n― 布陣 ―\n" + show(s));
console.log(`\n先手: ${s.currentTurn === 0 ? "あなた" : "相手"}`);

const moves = plan.moves || [];
moves.forEach((mv, i) => {
  const who = s.currentTurn;
  const before = s.pieces[mv.pieceId];
  if (!before || !before.alive) {
    console.log(`\n[${i + 1}] ${mv.pieceId} は盤上にいません`);
    process.exit(1);
  }
  const legal = getLegalMoves(
    before,
    s.board,
    s.boardSize,
    s.players[who].armyRankCounts,
  );
  const hit = legal.find((m) => m.row === mv.row && m.col === mv.col);
  if (!hit) {
    console.log(
      `\n[${i + 1}] 非合法: ${mv.pieceId} → ${squareName(mv.row, mv.col, s.boardSize)}`,
    );
    console.log(moveList(s, who));
    process.exit(1);
  }
  s = reducer(s, {
    type: "MOVE_PIECE",
    pieceId: mv.pieceId,
    row: mv.row,
    col: mv.col,
    captures: hit.captures,
    elapsedMs: 0,
  });
  if (s.captureReveal) s = reducer(s, { type: "DISMISS_CAPTURE" });
  console.log(
    `\n[${i + 1}] ${who === 0 ? "あなた" : "相手"}: ${mv.pieceId} → ${squareName(mv.row, mv.col, s.boardSize)}${hit.capture ? " (取る)" : ""}`,
  );
  console.log(show(s));
  if (s.winner !== null && s.winner !== undefined)
    console.log(`\n決着: ${s.winner === 0 ? "あなたの勝ち" : "相手の勝ち"}`);
});

if (s.winner === null || s.winner === undefined) {
  console.log(`\n次は${s.currentTurn === 0 ? "あなた" : "相手"}の番。合法手:`);
  console.log(moveList(s, s.currentTurn));
}
