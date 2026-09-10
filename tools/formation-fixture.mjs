// 布陣の称号の確認用の盤面。赤(下)が双翼の陣か隅の要塞を組み、青(上)はK王と数体。
import { initialState } from "../src/game/reducer.js";
import { FORMATIONS } from "../src/game/bonus.js";
export function formationFixture(form = "wings") {
  const s = initialState(),
    pieces = {},
    board = Array.from({ length: 9 }, () => Array(9).fill(null));
  const specs = [];
  if (form === "fortress") {
    const ranks = ["9", "Q", "J", "2", "Q", "4", "8", "8", "J"];
    [[8, 0], [8, 1], [8, 2], [7, 0], [7, 1], [7, 2], [6, 0], [6, 1], [6, 2]].forEach(
      ([row, col], i) => specs.push([ranks[i], 0, row, col, i === 0]),
    );
  } else {
    const def =
      FORMATIONS.find((d) => ({ wings: "twin-wings", earth: "heir-hunt", forest: "elimination" })[form] === d.id) ||
      FORMATIONS[0];
    const dx = def.edge ? 0 : 3;
    def.cells.forEach(([depth, col, rank, king]) =>
      specs.push([rank, 0, 6 + depth, col + dx, !!king]),
    );
  }
  specs.push(["K", 1, 0, 4, true], ["6", 1, 2, 3, false], ["10", 1, 2, 5, false], ["A", 1, 1, 6, false]);
  specs.forEach(([rank, owner, row, col, isKing], i) => {
    const p = { id: "fx" + i, rank, suit: "spade", owner, row, col, isKing, alive: true, revealed: false, history: [] };
    pieces[p.id] = p;
    board[row][col] = p;
    if (isKing) s.players[owner].kingId = p.id;
    s.players[owner].armyRankCounts[rank] = (s.players[owner].armyRankCounts[rank] || 0) + 1;
  });
  const area = form === "fortress" ? "ice" : form === "earth" ? "earth" : form === "forest" ? "forest" : "sky";
  return {
    ...s,
    boardSize: 9,
    board,
    pieces,
    phase: "play",
    currentTurn: 0,
    turnNo: 0,
    setupMode: "simultaneous",
    interstitial: null,
    areasEnabled: true,
    ruleVersion: 11,
    areas: [{ type: area, uses: 0, used: false, skin: "fixture-skin:foil" }, null],
    known: [{}, {}],
  };
}
