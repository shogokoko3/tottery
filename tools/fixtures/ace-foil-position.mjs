import { acePosition } from "./ace-position.mjs";
import { ACE_FOIL_SKIN_ID } from "../../src/game/ace-foil.js";
import { GAME_RULE_VERSION } from "../../src/game/rule-version.js";

/** Local preview only. Equipment lives in the fixture and never grants a purchase. */
export function aceFoilPosition({
  enemyOnly = false,
  frozen = false,
  ...options
} = {}) {
  const state = acePosition({ ...options, size: 9, count: 0 });
  Object.assign(state, {
    ruleVersion: GAME_RULE_VERSION,
    areasEnabled: true,
    areaLoadouts: [{ A: ACE_FOIL_SKIN_ID }, {}],
    shuffleMode: null,
  });
  const foe = {
    id: "foe-ace",
    rank: "A",
    suit: "heart",
    owner: 1,
    row: 3,
    col: 7,
    alive: true,
    isKing: false,
    revealed: false,
    history: [],
  };
  state.pieces[foe.id] = foe;
  state.board[foe.row][foe.col] = foe;
  if (enemyOnly) {
    for (const id of ["left", "right", "ally"]) {
      const piece = state.pieces[id];
      state.board[piece.row][piece.col] = null;
      delete state.pieces[id];
    }
  }
  if (frozen) state.pieces["king-1"].frozenUntil = 6;
  return state;
}
