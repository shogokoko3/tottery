import { shuffle, buildDeck } from "./board.js";

/**
 * 手番の乱数をアクション側に焼き込む。
 * オンライン対戦では両者が同じアクション列を再生するので、
 * 乱数の結果はここで確定させ、reducer は決定的に動かす。
 */
export function enrichAction(action, state) {
  switch (action.type) {
    case "START_SETUP":
      return { ...action, deck: shuffle(buildDeck()).map((c) => ({ ...c })) };
    case "ROLL_DICE_SINGLE":
      return { ...action, value: 1 + Math.floor(Math.random() * 6) };
    case "CONFIRM_MULLIGAN":
      return {
        ...action,
        reserveOrder: shuffle(state.reserve).map((c) => c.id),
      };
    case "CONFIRM_SHUFFLE":
      return { ...action, order: shuffle([0, 1, 2]) };
    default:
      return action;
  }
}
