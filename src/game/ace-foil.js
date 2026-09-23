import { isFrozen, thaw } from "./areas.js";
import { PLAYER_META } from "./constants.js";
import { ACE_FOIL_RULE_VERSION, hasAreaRules } from "./rule-version.js";

export const ACE_FOIL_SKIN_ID = "genie-magician:foil";

/** 台帳に生きているだけでなく、実際に盤上にいる駒に限る。 */
function deployed(state, piece) {
  return (
    piece.alive &&
    Number.isInteger(piece.row) &&
    Number.isInteger(piece.col) &&
    state.board?.[piece.row]?.[piece.col]?.id === piece.id
  );
}

/** 自分のAと王を全て除く。敵は伏せた王・Aも等しく抽選に入る。 */
export function aceFoilCandidates(state, player = state.currentTurn) {
  return Object.values(state.pieces || {})
    .filter(
      (piece) =>
        deployed(state, piece) &&
        (piece.owner !== player || (piece.rank !== "A" && !piece.isKing)),
    )
    .map((piece) => piece.id)
    .sort();
}

/** 王のエリアと独立した、手番を使わないAフォイルの任意効果。 */
export function canUseAceFoil(state, player = state.currentTurn, aId = null) {
  if (state.phase !== "play" || state.winner != null)
    return { ok: false, why: "対局中ではありません" };
  if (
    !hasAreaRules(state.ruleVersion) ||
    state.ruleVersion < ACE_FOIL_RULE_VERSION ||
    !state.areasEnabled ||
    state.boardSize !== 9 ||
    state.board?.length !== 9
  )
    return { ok: false, why: "エリアありの9×9対戦で使えます" };
  if (state.areaLoadouts?.[player]?.A !== ACE_FOIL_SKIN_ID)
    return { ok: false, why: "Aのフォイルを装備していません" };
  if ((player !== 0 && player !== 1) || state.currentTurn !== player)
    return { ok: false, why: "相手の番です" };
  if (state.setupAck?.some((ack) => !ack))
    return { ok: false, why: "布陣ボーナスの確認を待っています" };
  if (
    state.extraMoveFor ||
    state.extraUsed ||
    state.pendingKingChoice ||
    state.kPlacement?.owner === player
  )
    return { ok: false, why: "通常の行動の前にだけ使えます" };
  if (state.aceFoilUsedTurn?.[player] === (state.turnNo || 0))
    return { ok: false, why: "このターンでは発動済みです" };
  const ace = Object.values(state.pieces || {})
    .filter(
      (piece) =>
        piece.owner === player &&
        piece.rank === "A" &&
        deployed(state, piece) &&
        !isFrozen(state, piece) &&
        (aId === null || piece.id === aId),
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!ace) return { ok: false, why: "動けるAが盤上にいません" };
  if (aceFoilCandidates(state, player).length < 3)
    return { ok: false, why: "入れ替えられる駒が3体必要です" };
  return { ok: true, why: null, aId: ace.id };
}

/** 3体とも元のマスを離れる循環はこの2通りだけ。 */
export function aceFoilOrderOk(order) {
  return (
    Array.isArray(order) &&
    order.length === 3 &&
    ((order[0] === 1 && order[1] === 2 && order[2] === 0) ||
      (order[0] === 2 && order[1] === 0 && order[2] === 1))
  );
}

/** 乱数はenrichActionにのみ置く。再生・通信・サーバー検証は同じ結果を使う。 */
export function useAceFoil(state, action) {
  const player =
    action.player === undefined ? state.currentTurn : action.player;
  if (
    typeof action.aId !== "string" ||
    !canUseAceFoil(state, player, action.aId).ok ||
    !Array.isArray(action.pickIds) ||
    action.pickIds.length !== 3 ||
    new Set(action.pickIds).size !== 3 ||
    !aceFoilOrderOk(action.order)
  )
    return state;
  const eligible = new Set(aceFoilCandidates(state, player));
  if (action.pickIds.some((id) => typeof id !== "string" || !eligible.has(id)))
    return state;
  const cells = action.pickIds.map((id) => ({
    row: state.pieces[id].row,
    col: state.pieces[id].col,
  }));
  const pieces = { ...state.pieces };
  const board = state.board.map((row) => [...row]);
  for (const cell of cells) board[cell.row][cell.col] = null;
  action.pickIds.forEach((id, i) => {
    const base = thaw(pieces[id]);
    const at = cells[action.order[i]];
    const piece = {
      ...base,
      ...at,
      history: [...base.history, "Aのフォイル魔法で位置を入れ替えた"],
    };
    pieces[id] = piece;
    board[at.row][at.col] = piece;
  });
  const used = [...(state.aceFoilUsedTurn || [null, null])];
  used[player] = state.turnNo || 0;
  const seq = (state.seq || 0) + 1;
  return {
    ...state,
    board,
    pieces,
    aceFoilUsedTurn: used,
    seq,
    selectedId: null,
    shuffleMode: null,
    lastMove: null,
    lastSwap: { kind: "ace-foil", cells, owner: player, aId: action.aId, seq },
    log: [
      ...state.log,
      `${PLAYER_META[player].name}がAのフォイル魔法でランダムな3つの駒の位置を入れ替えた`,
    ],
  };
}
