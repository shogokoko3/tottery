/**
 * オンライン対戦の同期ルール。
 * 相手に送らなくてよい「自分の画面の中だけの操作」と、
 * 送る前にローカル状態を畳み込む必要があるアクションを定義する。
 */

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
 * 相手から届いてよい手。
 *
 * 届いた手は相手の端末が名乗っているだけで、何も保証がない。ここに無い
 * 名前は捨てる。盤に関わらない手(LOCAL_ONLY_ACTIONS)はそもそも送らない
 * ので、届いたなら細工されている。
 */
export const NET_ACTIONS = new Set([
  "START_SETUP",
  "ROLL_DICE_SINGLE",
  "NEXT_DICE_STEP",
  "REROLL_DICE",
  "GOTO_MULLIGAN",
  "CONFIRM_MULLIGAN",
  "SETUP_CONFIRM",
  "CLOCK_TIMEOUT",
  "CONFIRM_SHUFFLE",
  "MOVE_PIECE",
  "CHOOSE_HEIR",
  "PLACE_RESERVE_CARD",
  "SKIP_RESERVE_PLACEMENT",
  "SKIP_EXTRA_ACTION",
  "RESIGN",
  "NEW_GAME",
]);

/** ホストしか始められない手。ホスト側には届かないはず */
export const HOST_ONLY_ACTIONS = new Set(["START_SETUP", "NEW_GAME"]);

/**
 * 届いた手を、そのまま使ってよい形に直す。使えないなら null。
 *
 * @param act   受け取ったもの
 * @param me    自分の uid（無ければ null）
 * @param seat  自分の席番号（0 か 1）
 */
export function acceptAct(act, me, seat) {
  if (!act || typeof act !== "object") return null;
  if (typeof act.__id !== "string" || !act.__id) return null;
  if (typeof act.type !== "string" || !NET_ACTIONS.has(act.type)) return null;
  // 自分が指した手は、手元でもう反映してある
  if (me && act.by === me) return null;
  // 始まりの合図はホストが出す。自分がホストなら、届くはずがない
  if (seat === 0 && HOST_ONLY_ACTIONS.has(act.type)) return null;
  if (act.player === undefined || act.player === null) return act;
  // JSON は型を保つので、"0" のような文字列で送られると
  // 厳密等価の照合をすり抜ける。数に直してから照らす
  const who = Number(act.player);
  if (who !== 0 && who !== 1) return null;
  // 投了・時間切れ・布陣の確定は、どれも指した本人の席番号を名乗る。
  // 自分の席番号で届いたなら細工されている
  if (who === seat) return null;
  return who === act.player ? act : { ...act, player: who };
}

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
