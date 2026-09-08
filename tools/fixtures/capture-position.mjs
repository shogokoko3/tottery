import { initialState } from "../../src/game/reducer.js";
import { emptyBoard, getLegalMoves, kingRankOf } from "../../src/game/board.js";

export const CAPTURE_CASES = [
  { id: "own-king", label: "自分の6→未公開2王", size: 5, viewer: 0 },
  { id: "opponent-king", label: "相手視点・未公開6→2王", size: 5, viewer: 1 },
  {
    id: "ordinary",
    label: "普通の駒を取る",
    size: 5,
    viewer: 0,
    ordinary: true,
  },
  { id: "revealed", label: "既公開6→2王", size: 5, viewer: 1, revealed: true },
  {
    id: "multi-last-king",
    label: "9×9・3体取り・王は最後",
    size: 9,
    viewer: 1,
    multi: true,
  },
];

export const CAPTURE_LOADOUTS = [{ 6: "elf-male" }, { 2: "zombie-male" }];

/** Small legal positions for presentation checks. Every king has a living heir. */
export function capturePosition(fixture = CAPTURE_CASES[0]) {
  const size = fixture.size || 5;
  const state = initialState();
  Object.assign(state, {
    phase: "play",
    boardSize: size,
    board: emptyBoard(size),
    setupMode: "simultaneous",
    setupDone: [true, true],
    currentTurn: 0,
  });
  const add = (id, rank, owner, row, col, isKing = false, revealed = false) => {
    const piece = {
      id,
      rank,
      owner,
      row,
      col,
      isKing,
      revealed,
      suit: "spade",
      alive: true,
      history: [],
    };
    state.board[row][col] = piece;
    state.pieces[id] = piece;
    if (isKing) state.players[owner].kingId = id;
  };
  if (fixture.multi) {
    add("elf", "6", 0, 8, 4, true, !!fixture.revealed);
    add("target-1", "8", 1, 6, 4);
    add("target-2", "9", 1, 4, 4);
    add("king-1", "2", 1, 2, 4, true);
    add("heir", "2", 1, 0, 8);
    add("ally", "3", 0, 8, 0);
  } else {
    add("elf", "6", 0, 4, 2, false, !!fixture.revealed);
    add("king-0", "K", 0, 4, 0, true);
    if (fixture.ordinary) {
      add("target-1", "8", 1, 2, 2);
      add("king-1", "K", 1, 0, 4, true);
    } else {
      add("king-1", "2", 1, 2, 2, true);
      add("heir", "2", 1, 0, 4);
    }
  }
  for (let owner = 0; owner < 2; owner++) {
    const counts = {};
    for (const piece of Object.values(state.pieces).filter(
      (p) => p.owner === owner,
    ))
      counts[piece.rank] = (counts[piece.rank] || 0) + 1;
    state.players[owner].armyRankCounts = counts;
  }
  return state;
}

/** Use the game's legal move generator to supply the real capture sequence. */
export function captureMove(state, fixture = CAPTURE_CASES[0]) {
  const actor = state.pieces.elf;
  if (!actor?.alive) throw new Error("確認用の6が盤面にありません。");
  const move = getLegalMoves(
    actor,
    state.board,
    state.boardSize,
    state.players[actor.owner].armyRankCounts,
    kingRankOf(state, actor.owner),
  ).find((m) => m.row === 2 && m.col === (fixture.multi ? 4 : 2) && m.capture);
  if (!move) throw new Error("初期配置に戻してから再生してください。");
  return {
    type: "MOVE_PIECE",
    pieceId: actor.id,
    row: move.row,
    col: move.col,
    captures: move.captures,
    elapsedMs: 0,
  };
}
