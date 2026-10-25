import {hasAliceRules,aliceKing,aliceSkin,aliceBoard,emptyCells} from "./alice-rules.js";
import { RANKS, ORTH, DIAG, KNIGHT_OFFSETS } from "./constants.js";
import { getLegalMoves, inBounds, kingRankOf } from "./board.js";

import { hasAdjudicationRules } from "./rule-version.js";
export { ADJUDICATION_RULE_VERSION } from "./rule-version.js";

export function rankValue(rank) {
  return RANKS.indexOf(rank) + 1;
}

/** 両者が最初に採用した札。捕獲・継承・Kの補充で更新してはいけない。 */
export function withInitialArmies(state) {
  const ranks = [0, 1].map((owner) =>
    Object.values(state.pieces)
      .filter((piece) => piece.alive && piece.owner === owner)
      .map((piece) => piece.rank)
      .sort((a, b) => rankValue(a) - rankValue(b)),
  );
  return {
    ...state,
    initialArmyRanks: ranks,
    initialArmyTotals: ranks.map((army) =>
      army.reduce((sum, rank) => sum + rankValue(rank), 0),
    ),
  };
}

/** 王の追加行動・継承先の選択・予備札配置が済んだ通常の手番だけを見る。 */
export function isAdjudicationBoundary(state) {
  return (
    state.phase === "play" &&
    state.winner == null &&
    !state.extraMoveFor &&
    !state.extraUsed &&
    !state.pendingKingChoice &&
    !state.kPlacement && !state.aliceRevive && !state.aliceRecruit?.length
  );
}

/**
 * 実際の合法手がない。Aは敵を含めた生存3枚があれば入れ替えられる。
 * 追加行動の途中にはスキップがあるため、呼び出し側で通常手番に限る。
 */
export function hasLegalAction(state) {
  const k=aliceKing(state,state.currentTurn);
  if(k && ["8","9"].includes(k.rank) && emptyCells(state,state.currentTurn).length)return true;
  const living = Object.values(state.pieces).filter((piece) => piece.alive);
  return living.some((piece) => {
    if (piece.owner !== state.currentTurn) return false;
    // 氷のエリアで凍った駒は指せない(src/game/areas.js)
    if (piece.frozenUntil != null && (state.turnNo || 0) < piece.frozenUntil)
      return false;
    if (piece.rank === "A" && !piece.movementRank) return piece.aliceSkin ? false : living.length >= 3;
    return (
      getLegalMoves(
        piece,
        aliceBoard(state,state.currentTurn),
        state.boardSize,
        state.players[piece.owner].armyRankCounts,
        kingRankOf(state, piece.owner),
      ).length > 0
    );
  });
}

/**
 * 障害物を取り払った盤で、いつか居られるマスの上限を作る。
 * 2〜5の距離拡張は同じ直線上なので、最小の歩幅を繰り返せば含まれる。
 * 6〜9の王には空きマスへ進めない手もあるが、ここでは進めると仮定する。
 * 実際より広い領域同士さえ届かなければ、遮蔽物や捕獲順に依存しない。
 */
function reachSteps(piece) {
  switch (piece.rank) {
    case "A":
      return [];
    case "2":
    case "4":
    case "8":
    case "J":
      return ORTH;
    case "3":
    case "5":
    case "9":
      return DIAG;
    case "6":
      return ORTH.map(([row, col]) => [row * 2, col * 2]);
    case "7":
      return DIAG.map(([row, col]) => [row * 2, col * 2]);
    case "10":
      return KNIGHT_OFFSETS;
    case "Q":
      // 王Qは縦横1マスにも進めるので、通常Qの色制限では判定できない。
      return piece.isKing ? [...DIAG, ...ORTH] : DIAG;
    case "K":
      return [...ORTH, ...DIAG, ...KNIGHT_OFFSETS];
    default:
      return null;
  }
}

export function futureReach(piece, size) {
  const steps = reachSteps(piece);
  if (!steps || !inBounds(piece.row, piece.col, size)) return null;
  const seen = new Set([piece.row * size + piece.col]);
  const queue = [[piece.row, piece.col]];
  for (let i = 0; i < queue.length; i++) {
    const [row, col] = queue[i];
    for (const [dr, dc] of steps) {
      const r = row + dr,
        c = col + dc,
        key = r * size + c;
      if (!inBounds(r, c, size) || seen.has(key)) continue;
      seen.add(key);
      queue.push([r, c]);
    }
  }
  return seen;
}

/**
 * 両方の王が、将来も相手のどの駒にも接触できないことを証明できる場合。
 * 一般駒同士の撃破は許すが、王を取る/王が取って道連れになる経路はない。
 * 王が倒れないため継承も起きず、他の撃破で残る駒の領域は広がらない。
 * Aの入れ替えとKの召喚にはこの証明を使わず、判定しない。
 */
export function isDeadPosition(state) {
  if (hasAliceRules(state) && ([0,1].some(o=>aliceKing(state,o)) || Object.values(state.pieces).some(p=>p.alive && p.rank==="A" && aliceSkin(state,p.owner,"A")))) return false;
  const living = Object.values(state.pieces).filter((piece) => piece.alive);
  const kings = state.players.map((player, owner) => {
    const king = state.pieces[player.kingId];
    return king?.alive && king.isKing && king.owner === owner ? king : null;
  });
  if (kings.some((king) => !king)) return false;
  if (living.length >= 3 && living.some((piece) => piece.rank === "A"))
    return false;
  if (
    state.reserve.length &&
    kings.some(
      (king) =>
        king.rank === "K" &&
        living.some(
          (piece) =>
            piece.owner === king.owner &&
            (piece.rank === "J" || piece.rank === "Q"),
        ),
    )
  )
    return false;
  const reach = new Map(
    living.map((piece) => [piece.id, futureReach(piece, state.boardSize)]),
  );
  if ([...reach.values()].some((area) => !area)) return false;
  return kings.every((king) =>
    living
      .filter((piece) => piece.owner !== king.owner)
      .every((piece) =>
        [...reach.get(piece.id)].every((cell) => !reach.get(king.id).has(cell)),
      ),
  );
}

/**
 * 決着がつかない局面の判定(2026-10-25 本人の指示「判定の仕組みの精度を上げる」)。
 * 「どちらの王も絶対に討てない」証明(isDeadPosition)だけでは、王や番兵が逃げ回り続ける局面
 * (AI テストプレイで5人中5人が降参した)を終えられない。手元の対局(state.stallRule)では次も判定にする:
 *   - 同じ局面(生きている駒の位置・王・手番)が REPEAT_LIMIT 回目になった
 *   - 駒が1枚も倒れない手番が quietLimit(盤) 続いた(5×5 は両者合わせて40手番、9×9 は60手番)
 * オンラインは載せない(部屋の両者の版がそろわないと従来ルールに落ちる作りなので、版を上げると旧端末との局が判定ごと消える)
 */
export const REPEAT_LIMIT = 3;
export function quietLimit(boardSize) {
  return boardSize >= 9 ? 60 : 40;
}

function positionKey(state) {
  const pieces = Object.values(state.pieces)
    .filter((piece) => piece.alive)
    .map((piece) => `${piece.id}@${piece.row},${piece.col}${piece.isKing ? "*" : ""}`)
    .sort();
  return `${state.currentTurn}|${pieces.join(";")}`;
}

/** 手番の区切りごとに、局面の出現回数と「倒れない手番」を数える。駒が倒れたら数え直す */
export function trackStall(state) {
  if (!state.stallRule) return state;
  const alive = Object.values(state.pieces).filter((piece) => piece.alive).length;
  const prev = state.stall && state.stall.alive === alive ? state.stall : { alive, quiet: -1, seen: {} };
  const key = positionKey(state);
  const seen = { ...prev.seen, [key]: (prev.seen[key] || 0) + 1 };
  return { ...state, stall: { alive, quiet: prev.quiet + 1, seen, repeat: seen[key] } };
}

const REASON_LOG = {
  "dead-position": "互いの王を討てない局面のため",
  "no-legal-action": "動く側に可能な行動がない局面のため",
  repetition: `同じ局面が${REPEAT_LIMIT}回目になったため`,
  "no-progress": "駒が倒れない手番が続いたため",
};

/** 同期された手が完了したときだけ呼ぶ。表示用dismissには依存しない。 */
export function adjudicatePosition(state) {
  if (
    !hasAdjudicationRules(state.ruleVersion) ||
    !isAdjudicationBoundary(state) ||
    !Array.isArray(state.initialArmyTotals) ||
    state.initialArmyTotals.length !== 2 ||
    !state.initialArmyTotals.every((n) => Number.isFinite(n) && n > 0) ||
    !Array.isArray(state.initialArmyRanks)
  )
    return state;
  state = trackStall(state);
  const reason = isDeadPosition(state)
    ? "dead-position"
    : !hasLegalAction(state)
      ? "no-legal-action"
      : state.stall && state.stall.repeat >= REPEAT_LIMIT
        ? "repetition"
        : state.stall && state.stall.quiet >= quietLimit(state.boardSize)
          ? "no-progress"
          : null;
  if (!reason) return state;
  const totals = [...state.initialArmyTotals];
  const winner = totals[0] === totals[1] ? null : totals[0] < totals[1] ? 0 : 1;
  const result =
    winner === null
      ? "同点のため引き分け"
      : `${winner === 0 ? "赤" : "青"}の勝利`;
  return {
    ...state,
    phase: "gameover",
    winner,
    endReason: reason,
    adjudication: {
      reason,
      totals,
      ranks: state.initialArmyRanks.map((ranks) => [...ranks]),
    },
    selectedId: null,
    shuffleMode: null,
    interstitial: null,
    log: [
      ...state.log,
      `${REASON_LOG[reason]}布陣判定: 赤${totals[0]}・青${totals[1]}。${result}`,
    ],
  };
}
