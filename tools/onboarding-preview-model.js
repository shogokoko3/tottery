// Preview-only state. Uses the real rules without profile, wallet or network writes.
import { reducer } from "../src/game/reducer.js";
import { getLegalMoves, kingRankOf } from "../src/game/board.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { FIRST_GAME, openingState, currentStepIndex, tutorialGate, foeAction, foeHeld, stepLines } from "../src/game/tutorial.js";

export const PREVIEW_DRAW = ["dragon-knight", "pirate-female", "zombie-male", "elf-male", "pirate-male", "zombie-female", "elf-female", "zombie-male", "pirate-female", "pirate-male"];
export const previewProfile = name => ({ name: name || "旅人", phase: 1, introFirstGameDone: true, story: { 1: [], 2: [], 3: [] }, phaseWins: { 1: 0 }, plays: 1, wins: 1 });
export const trialIndex = model => currentStepIndex(FIRST_GAME, model.state, model.step);
export const trialStep = model => FIRST_GAME.steps[trialIndex(model)];
export function trialMoves(model, piece) {
  if (!piece || !piece.alive) return [];
  const s = model.state;
  return getLegalMoves(piece, s.board, s.boardSize, s.players[piece.owner].armyRankCounts, kingRankOf(s, piece.owner));
}
function settle(model) {
  let state = model.state;
  for (let i = 0; i < 8 && state.interstitial; i++) state = reducer(state, { type: "DISMISS_INTERSTITIAL" });
  if (state.captureReveal) state = reducer(state, { type: "DISMISS_CAPTURE" });
  return { ...model, state, step: Math.max(model.step, currentStepIndex(FIRST_GAME, state, model.step)) };
}
function runFoe(model) {
  let next = model;
  for (let i = 0; i < 8; i++) {
    if (foeHeld(FIRST_GAME, trialIndex(next), next.state)) break;
    const action = foeAction(next.state, FIRST_GAME, next.foe, piece => trialMoves(next, piece));
    if (!action) break;
    const state = reducer(next.state, action);
    if (state === next.state) break;
    const clueMove = action.type === "MOVE_PIECE" && next.foe === 0 ? state.lastMove : next.clueMove;
    next = settle({ ...next, state, clueMove, foe: next.foe + (action.type === "MOVE_PIECE" ? 1 : 0) });
  }
  return next;
}
export function createTrial() {
  return settle({ state: openingState(FIRST_GAME, GAME_RULE_VERSION), step: 0, foe: 0, clueMove: null, nudge: [] });
}
export function trialAction(model, input) {
  const action = input.type === "MOVE_PIECE" && !input.pieceId ? { ...input, pieceId: model.state.selectedId } : input;
  const blocked = tutorialGate(FIRST_GAME, trialIndex(model), model.state, action);
  if (blocked) return { ...model, nudge: blocked.nudge };
  return runFoe(settle({ ...model, state: reducer(model.state, action), nudge: [] }));
}
export function trialContinue(model) {
  if (trialStep(model)?.need) return model;
  return runFoe(settle({ ...model, step: trialIndex(model) + 1, nudge: [] }));
}
export function trialCoach(model) {
  return model.nudge.length ? model.nudge : stepLines(trialStep(model), model.state);
}
