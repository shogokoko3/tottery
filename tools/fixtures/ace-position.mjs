import { initialState } from "../../src/game/reducer.js";
import { emptyBoard } from "../../src/game/board.js";

export function acePosition({
  size = 9,
  count = 10,
  king = false,
  mixed = false,
  succession = false,
} = {}) {
  const state = initialState();
  Object.assign(state, {
    phase: "play",
    boardSize: size,
    board: emptyBoard(size),
    setupMode: "simultaneous",
    setupDone: [true, true],
  });
  const add = (id, rank, owner, row, col, isKing = false) => {
    const piece = {
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
    state.pieces[id] = piece;
    state.board[row][col] = piece;
    if (isKing) state.players[owner].kingId = id;
    return piece;
  };
  const cells =
    size === 9
      ? [
          [1, 4],
          [7, 1],
          [7, 7],
        ]
      : [
          [0, 2],
          [4, 0],
          [4, 4],
        ];
  add("ace", "A", 0, ...cells[0], king);
  add("left", "8", 0, ...cells[1]);
  add("right", "9", mixed ? 1 : 0, ...cells[2]);
  const targets =
    size === 9
      ? [
          [3, 4],
          [4, 3],
          [4, 4],
          [4, 5],
          [5, 3],
          [5, 4],
          [5, 5],
          [6, 2],
          [6, 3],
          [6, 5],
        ]
      : [[2, 2]];
  targets
    .slice(0, count)
    .forEach(([r, c], i) => add(`target-${i}`, String(4 + (i % 6)), 1, r, c));
  add("ally", "6", 0, size === 9 ? 6 : 3, size === 9 ? 4 : 2);
  if (!king) add("king-0", "K", 0, size - 1, 1, true);
  add("king-1", "K", 1, 0, size - 1, true);
  add("outside", "7", 1, 0, 0);
  state.shuffleMode = { aId: "ace", picks: ["left", "right"] };
  if (succession) {
    state.pieces["king-1"].isKing = false;
    state.pieces["target-0"].rank = "2";
    state.pieces["target-0"].isKing = true;
    state.players[1].kingId = "target-0";
    add("heir-1", "2", 1, 1, 0);
    add("heir-2", "2", 1, 1, size - 1);
  }
  for (let owner = 0; owner < 2; owner++) {
    state.players[owner].armyRankCounts = {};
    for (const piece of Object.values(state.pieces).filter(
      (p) => p.owner === owner,
    ))
      state.players[owner].armyRankCounts[piece.rank] =
        (state.players[owner].armyRankCounts[piece.rank] || 0) + 1;
  }
  return state;
}
