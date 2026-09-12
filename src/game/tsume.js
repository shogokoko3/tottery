import { questions } from "./tsume-questions.js";
import { initialState, reducer } from "./reducer.js";
import { emptyBoard, getLegalMoves, kingRankOf, squareName } from "./board.js";
import { SUITS } from "./constants.js";
import {
  ADJUDICATION_RULE_VERSION,
  withInitialArmies,
} from "./adjudication.js";
import {
  requireTsumeDay,
  sanitizeTsumeProgress,
  TSUME_CLEAR_GEMS,
} from "./tsume-daily.js";

export const TSUME_QUESTIONS = questions;
export const tsumeQuestion = (id) => questions.find((q) => q.id === id);
export const tsumeCoord = (at, size) => ({
  row: size - Number(at.slice(1)),
  col: at.charCodeAt(0) - 97,
});
export const TSUME_ORDERS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

// 通常対局と同じ移動・撃破・勝敗判定を使う。対局報酬のフックは呼ばない。
export function createTsumePosition(q) {
  if (!q || q.kind === "inference") return null;
  let state = {
    ...initialState(),
    phase: "play",
    setupMode: "simultaneous",
    boardSize: q.size,
    board: emptyBoard(q.size),
    ruleVersion: ADJUDICATION_RULE_VERSION,
  };
  const counts = {};
  q.pieces.forEach((p, i) => {
    const n = counts[p.rank] || 0;
    counts[p.rank] = n + 1;
    const piece = {
      id: `tsume-${i}`,
      owner: p.owner,
      rank: p.rank,
      suit: SUITS[n],
      isKing: !!p.king,
      ...tsumeCoord(p.at, q.size),
      alive: true,
      revealed: false,
      history: [],
    };
    state.pieces[piece.id] = piece;
    state.board[piece.row][piece.col] = piece;
    if (piece.isKing) state.players[piece.owner].kingId = piece.id;
    const army = state.players[piece.owner].armyRankCounts;
    army[piece.rank] = (army[piece.rank] || 0) + 1;
  });
  return withInitialArmies(state);
}

export function tsumeMoves(state, id) {
  const piece = state?.pieces[id];
  if (
    !piece?.alive ||
    piece.owner !== 0 ||
    state.currentTurn !== 0 ||
    state.phase !== "play" ||
    (state.extraMoveFor && state.extraMoveFor !== id)
  )
    return [];
  return getLegalMoves(
    piece,
    state.board,
    state.boardSize,
    state.players[0].armyRankCounts,
    kingRankOf(state, 0),
  );
}

export function applyTsumeAction(state, action) {
  if (!state || state.phase !== "play" || state.currentTurn !== 0 || !action)
    return state;
  const ready = { ...state, captureReveal: null, interstitial: null };
  if (action.type === "move") {
    const piece = Object.values(ready.pieces).find(
      (p) =>
        p.alive && squareName(p.row, p.col, state.boardSize) === action.from,
    );
    const move =
      piece &&
      tsumeMoves(ready, piece.id).find(
        (m) => squareName(m.row, m.col, state.boardSize) === action.to,
      );
    if (!move) return state;
    const next = reducer(ready, {
      type: "MOVE_PIECE",
      player: 0,
      pieceId: piece.id,
      ...move,
    });
    return next === ready ? state : next;
  }
  if (action.type === "shuffle") {
    const at = (square) =>
      Object.values(ready.pieces).find(
        (p) => p.alive && squareName(p.row, p.col, state.boardSize) === square,
      );
    const ace = at(action.from);
    if (
      !ace ||
      ace.owner !== 0 ||
      ace.rank !== "A" ||
      !Array.isArray(action.picks) ||
      action.picks.length !== 2 ||
      !action.picks.every((p) => at(p))
    )
      return state;
    if (
      !TSUME_ORDERS.some(
        (order) => JSON.stringify(order) === JSON.stringify(action.order),
      )
    )
      return state;
    const next = reducer(ready, {
      type: "CONFIRM_SHUFFLE",
      player: 0,
      aId: ace.id,
      pickIds: action.picks.map((p) => at(p).id),
      order: action.order,
    });
    return next === ready ? state : next;
  }
  return state;
}

export const tsumeWon = (state) =>
  state?.phase === "gameover" && state.winner === 0 && !state.pendingKingChoice;

export function isTsumeAnswer(q, evidence) {
  if (!q || !evidence) return false;
  if (q.kind === "inference")
    return (
      Number.isInteger(evidence.answer) && evidence.answer === q.correctOption
    );
  if (
    !Array.isArray(evidence.actions) ||
    evidence.actions.length < 1 ||
    evidence.actions.length > (q.kind === "double" ? 2 : 1)
  )
    return false;
  if (q.kind === "triangle") {
    const action = evidence.actions[0];
    // この問題は運に頼らず勝つ条件。実際に出た配置だけで正解にしない。
    if (action?.type !== "shuffle" || action.from !== q.actor) return false;
    if (
      !TSUME_ORDERS.every((order) =>
        tsumeWon(
          applyTsumeAction(createTsumePosition(q), { ...action, order }),
        ),
      )
    )
      return false;
  }
  let state = createTsumePosition(q);
  for (const action of evidence.actions) {
    const next = applyTsumeAction(state, action);
    if (next === state) return false;
    state = next;
  }
  return tsumeWon(state);
}

export function clearDailyTsume(collection, day, evidence, at = Date.now()) {
  const today = requireTsumeDay(day, at);
  const progress = sanitizeTsumeProgress(collection.tsume);
  const receipt = progress.days[day];
  if (!receipt?.joined || receipt.questionId !== today.questionId)
    throw new Error("先に今日の問題への参加を保存してください。");
  if (!isTsumeAnswer(tsumeQuestion(today.questionId), evidence))
    throw new Error("この回答では、まだクリアになりません。");
  if (receipt.cleared) return collection;
  const gems = Number.isSafeInteger(collection.gems) ? collection.gems : 0;
  const gemsFree = Number.isSafeInteger(collection.gemsFree) ? collection.gemsFree : 0;
  return {
    ...collection,
    // クリアで無償ジェム。端末の写しを増やし、サーバーへは画面側が earnGems で送る
    gems: gems + TSUME_CLEAR_GEMS,
    gemsFree: gemsFree + TSUME_CLEAR_GEMS,
    tsume: { days: { ...progress.days, [day]: { ...receipt, cleared: true } } },
  };
}
