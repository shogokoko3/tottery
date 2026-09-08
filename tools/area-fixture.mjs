import { initialState } from "../src/game/reducer.js";
export function areaFixture(type = "ice") {
  const s = initialState(),
    pieces = {},
    board = Array.from({ length: 9 }, () => Array(9).fill(null));
  const specs = [
    ["K", 0, 8, 4, true],
    ["6", 0, 6, 3, false],
    ["10", 0, 7, 5, false],
    ["A", 0, 7, 2, false],
    ["K", 1, 0, 4, true],
    ["8", 1, 2, 3, false],
    ["10", 1, 2, 5, false],
    ["A", 1, 1, 6, false],
  ];
  specs.forEach(([rank, owner, row, col, isKing], i) => {
    const p = {
      id: "fx" + i,
      rank,
      suit: "spade",
      owner,
      row,
      col,
      isKing,
      alive: true,
      revealed: false,
      history: [],
    };
    pieces[p.id] = p;
    board[row][col] = p;
    if (isKing) s.players[owner].kingId = p.id;
  });
  return {
    ...s,
    boardSize: 9,
    board,
    pieces,
    phase: "play",
    currentTurn: 0,
    turnNo: 2,
    setupMode: "simultaneous",
    interstitial: null,
    areasEnabled: true,
    areas: [{ type, uses: 0, used: false }, null],
    known: [{}, {}],
    lastMove: {
      owner: 1,
      from: { row: 1, col: 3 },
      to: { row: 2, col: 3 },
      seq: 1,
    },
  };
}
