import { aliceAreaGameFixture } from "./alice-area-game-fixture.mjs";
import { syncAlice } from "../src/game/alice-rules.js";
import { initAreas } from "../src/game/areas.js";

export function areaControlsFixture() {
  const q = new URLSearchParams(location.search);
  const theme = q.get("area") || "alice-tea";
  let s = aliceAreaGameFixture(["sky", "palace"].includes(theme) ? "sea" : theme);
  if (["sky", "palace"].includes(theme)) {
    const king = { ...s.pieces["own-0"], rank: theme === "sky" ? "10" : "Q" };
    s.pieces[king.id] = king; s.board[king.row][king.col] = king;
    s = initAreas(s);
  }
  if (q.has("normal")) {
    s.areaLoadouts[0] = Object.fromEntries(Object.entries(s.areaLoadouts[0]).map(([rank, id]) => [rank, id.replace(/:foil$/, "")]));
    s = syncAlice(s);
  }
  if (q.has("target")) {
    const old = s.pieces["foe-1"];
    const piece = q.get("target") === "cup" ? { ...old, rank: "tea", suit: null, tea: true, teaMovement: "orth" }
      : { ...old, rank: "A", revealed: false };
    s.pieces[piece.id] = piece; s.board[piece.row][piece.col] = piece;
  }
  if (q.has("full")) for (const [row, col] of [[6,0], [6,1]]) {
    const piece = { ...s.pieces["own-1"], id: `extra-${col}`, row, col };
    s.pieces[piece.id] = piece; s.board[row][col] = piece;
  }
  if (q.has("far")) {
    const army = Object.values(s.pieces).filter(p => p.owner === 0 && !p.isKing);
    for (const p of army) s.board[p.row][p.col] = null;
    for (const [col, p] of army.entries()) {
      const moved = { ...p, row: 4, col };
      s.pieces[p.id] = moved; s.board[moved.row][moved.col] = moved;
    }
  }
  if (q.has("turn")) s.currentTurn = 1;
  if (q.get("seat") === "1") {
    s.pieces = Object.fromEntries(Object.entries(s.pieces).map(([id, p]) => [id, { ...p, owner: 1 - p.owner }]));
    s.board = s.board.map(row => row.map(p => p ? s.pieces[p.id] : null));
    s.players = s.players.toReversed().map((p, idx) => ({ ...p, idx }));
    s.areaLoadouts.reverse(); s.areas.reverse(); s.currentTurn = 1;
  }
  return syncAlice(s);
}
