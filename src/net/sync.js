/**
 * オンライン対戦の同期ルール。
 * 相手に送らなくてよい「自分の画面の中だけの操作」と、
 * 送る前にローカル状態を畳み込む必要があるアクションを定義する。
 */
import { ADJUDICATION_RULE_VERSION } from "../game/adjudication.js";

/** 古い画面が混ざる対局は、両者が理解できる従来ルールで開始する。 */
export function roomRuleVersion(room) {
  return room?.hostRuleVersion === ADJUDICATION_RULE_VERSION &&
    room?.guestRuleVersion === ADJUDICATION_RULE_VERSION
    ? ADJUDICATION_RULE_VERSION
    : null;
}

/** 手元の表示が変わるだけで、盤面には影響しないアクション */
export const LOCAL_ONLY_ACTIONS = new Set([
  "VIEW_LOG",
  "CLOSE_LOG",
  "SELECT_PIECE",
  "CANCEL_SELECTION",
  "TOGGLE_SHUFFLE_PICK",
  "TOGGLE_MULLIGAN_CARD",
  "SETUP_PLACE_CARD",
  "SETUP_UNPLACE_CARD",
  "SETUP_AUTO_ARRANGE",
  "SETUP_GOTO_KING_STEP",
  "SETUP_BACK_TO_PLACE",
  "SETUP_PICK_KING",
  "ACK_KING_CHOICE",
  "DISMISS_CAPTURE",
  "DISMISS_INTERSTITIAL",
  "DISMISS_SETUP_EFFECTS",
]);

/**
 * 送信前に、手元の選択状態をアクションへ畳み込む。
 * 受け手には選択途中の状態が無いので、確定操作は自己完結させる必要がある。
 */
export function withLocalContext(action, state) {
  switch (action.type) {
    case "CONFIRM_MULLIGAN":
      return {
        ...action,
        discardIds: [
          ...(state.players[state.mulliganIdx]._mulliganSelected || []),
        ],
      };
    case "SETUP_CONFIRM": {
      // 同時配置では相手の布陣を受け取っていないので、自分の分を丸ごと積んで送る
      const idx =
        action.player === 1 || action.player === 0
          ? action.player
          : state.setupIdx;
      return {
        ...action,
        player: idx,
        placement: action.placement || state.setupPlacements[idx],
        kingId: action.kingId || state.setupPickKings[idx],
      };
    }
    case "CONFIRM_SHUFFLE":
      return {
        ...action,
        aId: state.shuffleMode && state.shuffleMode.aId,
        pickIds: state.shuffleMode ? [...state.shuffleMode.picks] : [],
      };
    case "MOVE_PIECE":
      return { ...action, pieceId: state.selectedId };
    default:
      return action;
  }
}
