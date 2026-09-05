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
 * かなめは **「誰が指したか」を手の中身から決めない** こと。
 * 席番号を名乗らない手(MOVE_PIECE など11種)は、名乗りを照らしようがなく
 * 素通りしていた。相手はそれでこちらの手番を勝手に指せた。
 * 対局は二人しかいないので、届いた手の指し手は必ず「相手の席」になる。
 * ここで書き込んでしまえば、盤(reducer)は誰の手かを確かめられる。
 *
 * @param act    受け取ったもの
 * @param me     自分の uid（無ければ null）
 * @param seat   自分の席番号（0 か 1）
 * @param foeUid 相手の uid（分かっていれば。分からなければ null）
 */
export function acceptAct(act, me, seat, foeUid) {
  if (!act || typeof act !== "object") return null;
  if (typeof act.__id !== "string" || !act.__id) return null;
  if (typeof act.type !== "string" || !NET_ACTIONS.has(act.type)) return null;
  if (seat !== 0 && seat !== 1) return null;
  // 自分が指した手は、手元でもう反映してある
  if (me && act.by === me) return null;
  // 相手が分かっているなら、それ以外の名前で来た手は受け取らない
  if (foeUid && act.by !== foeUid) return null;
  // 始まりの合図はホストが出す。自分がホストなら、届くはずがない
  if (seat === 0 && HOST_ONLY_ACTIONS.has(act.type)) return null;
  //
  // 時間切れの申告だけは、席を書き換えてはいけない。
  //
  // これは「送り主が指した手」ではなく「どちらの時計が尽きたか」を
  // 運ぶ手で、待っている側が相手について申告することがある。
  // ここで送り主の席に書き換えると、席0が「席1の時間切れ」と申告した手が
  // 席1の端末では「席0の時間切れ」になり、**二人とも自分が勝者**になる。
  // 本当に尽きているかは、盤を持っている受け取り側が確かめる
  // (src/ui/game.jsx の timeoutSound)
  if (act.type === "CLOCK_TIMEOUT") {
    const who = Number(act.player);
    if (who !== 0 && who !== 1) return null;
    return who === act.player ? act : { ...act, player: who };
  }
  // それ以外の指し手は相手。手が何を名乗っていても、こちらで書き換える
  return { ...act, player: 1 - seat };
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
