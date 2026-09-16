import { shuffle, buildDeck } from "./board.js";
import { AREA_TUNING, forestCandidates, iceCandidates } from "./areas.js";
import { aceFoilCandidates, canUseAceFoil } from "./ace-foil.js";

/**
 * 手番の乱数をアクション側に焼き込む。
 * オンライン対戦では両者が同じアクション列を再生するので、
 * 乱数の結果はここで確定させ、reducer は決定的に動かす。
 */
export function enrichAction(action, state) {
  switch (action.type) {
    case "START_SETUP":
      return {
        ...action,
        deck: shuffle(buildDeck(action.pool)).map((c) => ({ ...c })),
      };
    case "ROLL_DICE_SINGLE":
      return { ...action, value: 1 + Math.floor(Math.random() * 6) };
    case "CONFIRM_MULLIGAN":
      return {
        ...action,
        reserveOrder: shuffle(state.reserve).map((c) => c.id),
      };
    case "CONFIRM_SHUFFLE":
      return { ...action, order: shuffle([0, 1, 2]) };
    case "USE_ACE_FOIL": {
      const player =
        action.player === undefined ? state.currentTurn : action.player;
      const can = canUseAceFoil(state, player, action.aId ?? null);
      if (!can.ok) return action;
      return {
        ...action,
        aId: can.aId,
        pickIds: shuffle(aceFoilCandidates(state, player)).slice(0, 3),
        order: Math.random() < 0.5 ? [1, 2, 0] : [2, 0, 1],
      };
    }
    case "USE_AREA": {
      // 盤面エリアの乱数。土は当たり外れ、森は見抜く駒の並び
      const area = state.areas && state.areas[state.currentTurn];
      if (!area) return action;
      if (area.type === "earth")
        return { ...action, hit: Math.random() < AREA_TUNING.earthOdds };
      if (area.type === "forest")
        return {
          ...action,
          picks: shuffle(forestCandidates(state, state.currentTurn)),
        };
      if (area.type === "ice")
        return {
          ...action,
          picks: shuffle(iceCandidates(state, state.currentTurn)),
        };
      return action;
    }
    default:
      return action;
  }
}
