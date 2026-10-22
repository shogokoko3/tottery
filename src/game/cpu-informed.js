import {
  palacePromotion,
  reserveDeployment,
  bestEncirclement,
} from "./cpu-palace.js";
import {
  moveSafety,
  transformationGain,
  unknownThreatMap,
} from "./cpu-tactics.js";
import {
  chooseArmyPlan,
  strategicDiscards,
  arrangeArmy,
} from "./cpu-strategy.js";
import { opponentKingBelief } from "./king-belief.js";
// 公開情報と自分だけが見抜いた情報を使うCPU。伏せ札の数字・王かどうかは評価に使わない。
import { cpuAction, bestShuffle, capDiscards } from "./cpu.js";
import {
  armySlots,
  getLegalMoves,
  kingRankOf,
  territoryRows,
} from "./board.js";
import { canUseArea, isFrozen, isKnownTo, skyCandidates } from "./areas.js";
import { automaticAreaAction } from "./area-presentation.js";
import { shouldUseSea } from "./cpu-sea.js";
import { hasAliceRules } from "./alice-rules.js";
import {
  aliceAdaptScore,
  aliceFreeAction,
  alicePendingAction,
  aliceSetupFix,
  aliceView,
  finishAliceMove,
  teaSummon,
  withoutAliceAceShuffle,
} from "./cpu-alice.js";
/**
 * options.unknownWeight(0〜1): 正体の分からない敵の駒も、その見込みぶんだけ脅威として扱う。
 * 省略時は 0 で従来どおり(正体の分かった駒だけを脅威にする)。検証ツールが渡す。
 */
export function cpuInformedAction(state, player, options = {}) {
  // シーズン2: 仲間にする駒・王の帰還は、手番に関係なく待っている側が選ぶ
  if (hasAliceRules(state) && (state.aliceRecruit?.length || state.aliceRevive))
    return alicePendingAction(state, player);
  // 相手の予備札は相手の手番まで待機。こちらの10の2回目は続けられる。
  if (state.kPlacement && state.kPlacement.owner !== state.currentTurn)
    state = { ...state, kPlacement: null };
  if (
    !state.captureReveal &&
    state.kPlacement?.owner === player &&
    state.currentTurn === player
  ) {
    const act = reserveDeployment(state, player);
    if (act) {
      const { score, ...action } = act;
      return action;
    }
  }
  if (state.phase === "mulligan" && state.mulliganIdx === player)
    return {
      type: "CONFIRM_MULLIGAN",
      // 版18以降は半分まで(reducer の線)。超えると弾かれて引き直しから抜けられない
      discardIds: capDiscards(state, strategicDiscards(state, player)),
    };
  if (
    state.phase === "setup" &&
    state.setupPlacements &&
    !state.setupDone[player] &&
    (state.setupMode === "simultaneous" || state.setupIdx === player)
  ) {
    // シーズン2: ハートの王(J・Q・K)ではAを採用できない。Aを外して埋まらなければ、別の数字を王にする
    const tryPlan = (rank) => {
      const plan = chooseArmyPlan(state, player, rank);
      if (!plan) return null;
      const placement = aliceSetupFix(
        state,
        player,
        plan.kingId,
        arrangeArmy(state, player, plan),
      );
      return Object.keys(placement).length >= armySlots(state)
        ? { plan, placement }
        : null;
    };
    let chosen = tryPlan(null);
    if (!chosen && hasAliceRules(state)) {
      const ranks = [
        ...new Set(state.players[player].hand.map((c) => c.rank)),
      ].filter((r) => r !== "A");
      for (const rank of ranks) if ((chosen = tryPlan(rank))) break;
    }
    if (chosen)
      return {
        type: "SETUP_CONFIRM",
        player,
        kingId: chosen.plan.kingId,
        placement: chosen.placement,
      };
  }
  if (
    state.phase !== "play" ||
    state.captureReveal ||
    state.pendingKingChoice ||
    state.kPlacement
  )
    return cpuAction(state, player);
  if (state.currentTurn !== player) return null;
  if (!hasAliceRules(state))
    return automaticAreaAction(state) || informedPlay(state, options);
  // シーズン2: 手番を使わない能力を先に1つずつ使い、それから指す
  const free = aliceFreeAction(state, player);
  if (free) return free;
  const auto = automaticAreaAction(state);
  if (auto) return auto;
  const view = withoutAliceAceShuffle(aliceView(state, player), player);
  const out = informedPlay(view, options);
  const capture =
    out?.type === "MOVE_PIECE" &&
    view.board[out.row]?.[out.col]?.owner === 1 - player;
  const tea = teaSummon(state, player, out ? { score: capture ? 12 : 0 } : null);
  if (tea) return tea;
  return finishAliceMove(state, player, out);
}
const value = {
  A: 5,
  2: 2,
  3: 2,
  4: 3,
  5: 3,
  6: 4,
  7: 4,
  8: 4,
  9: 4,
  10: 5,
  J: 6,
  Q: 6,
  K: 7,
  tea: 4,
};
export function informedPlay(s, options = {}) {
  const player = s.currentTurn;
  const safety = options.unknownWeight
    ? {
        unknownWeight: options.unknownWeight,
        unknownThreats: unknownThreatMap(s, player),
      }
    : {};
  const size = s.boardSize;
  const [lo, hi] = territoryRows(size, 1 - player);
  if (s.pendingKingChoice || s.kPlacement) return cpuAction(s, player);
  const belief = opponentKingBelief(s, player);
  const candidateIds = new Set(belief.candidates.map((p) => p.id));
  const enclosure = bestEncirclement(s, player);
  let moves = [];
  for (const p of Object.values(s.pieces)) {
    if (
      !p.alive ||
      p.owner !== player ||
      p.rank === "A" ||
      isFrozen(s, p) ||
      (s.extraMoveFor && s.extraMoveFor !== p.id) ||
      (s.aliceCommitted && s.aliceCommitted !== p.id)
    )
      continue;
    for (const m of getLegalMoves(
      p,
      s.board,
      size,
      s.players[player].armyRankCounts,
      kingRankOf(s, player),
    )) {
      const target = s.board[m.row][m.col],
        goal = player === 0 ? lo : hi;
      // バリア(グリフォン)を張った相手の駒は取りに行けない
      if (target?.barrier && target.owner !== player) continue;
      let score =
        Math.random() * 0.8 +
        (Math.abs(m.row - goal) < Math.abs(p.row - goal) ? 1.2 : 0) -
        (p.isKing ? 2 : 0);
      // 絞り込んだ王候補への攻撃と接近を評価する。内部の王IDは使わない。
      const capturedIds = new Set(
        (m.captures || [])
          .map((c) => s.board[c.row]?.[c.col]?.id)
          .filter(Boolean),
      );
      if (target && target.owner !== player) capturedIds.add(target.id);
      score +=
        80 *
        belief.weight *
        [...capturedIds].filter((id) => candidateIds.has(id)).length;
      if (belief.excluded > 0 && !capturedIds.size) {
        const distance = (row, col, c) =>
          Math.max(Math.abs(row - c.row), Math.abs(col - c.col));
        score +=
          3 *
          belief.weight *
          belief.candidates.reduce(
            (total, c) =>
              total + distance(p.row, p.col, c) - distance(m.row, m.col, c),
            0,
          );
      }
      if (target && target.owner !== player) {
        score += 12 + Math.max(0, (m.captures?.length || 1) - 1) * 10;
        if (isKnownTo(s, player, target)) {
          score += value[target.rank] * 0.7;

          if (["4", "5"].includes(target.rank) && !target.isKing) {
            const visibleKing = Object.values(s.pieces).find(
              (c) =>
                c.alive &&
                c.owner !== player &&
                isKnownTo(s, player, c) &&
                c.isKing,
            );
            const risk = visibleKing
              ? Number(visibleKing.rank === target.rank)
              : s.areas?.[1 - player]
                ? Number(s.areas[1 - player].type === "sea") * 0.5
                : 0.25;
            score -= risk * (p.isKing ? 100 : value[p.rank] * 2);
          }
        }
      }
      score += moveSafety(s, player, p, m, capturedIds, safety);
      // 相手の技・盤面効果に合わせた足し引き(包囲の回避など。調整値は cpu-alice.js)
      score += aliceAdaptScore(s, player, p, m, capturedIds);
      if (
        p.rank === "10" &&
        !s.extraMoveFor &&
        (p.isKing || p.skyTwice || s.players[player].skyTwice)
      ) {
        const board = s.board.map((row) => row.slice());
        board[p.row][p.col] = null;
        const after = { ...p, row: m.row, col: m.col };
        board[m.row][m.col] = after;
        const follow = getLegalMoves(
          after,
          board,
          size,
          s.players[player].armyRankCounts,
          kingRankOf(s, player),
        );
        const attacks = follow.filter(
          (n) => board[n.row][n.col]?.owner === 1 - player,
        );
        if (attacks.length)
          score +=
            4 +
            45 *
              belief.weight *
              Number(
                attacks.some((n) => candidateIds.has(board[n.row][n.col].id)),
              );
      }
      if (["J", "Q", "K", "10"].includes(p.rank)) {
        const future = bestEncirclement(s, player, {
          ...p,
          row: m.row,
          col: m.col,
        });
        score += Math.min(
          6,
          Math.max(0, (future?.score || 0) - (enclosure?.score || 0)) * 0.2,
        );
      }
      moves.push({
        score,
        type: "MOVE_PIECE",
        pieceId: p.id,
        row: m.row,
        col: m.col,
        captures: m.captures,
      });
    }
  }
  moves.sort((a, b) => b.score - a.score);
  const best = moves[0];
  const can = canUseArea(s, player);
  if (can.ok && can.type === "sea" && shouldUseSea(s, player))
    return { type: "USE_AREA" };
  if (can.ok && can.type === "sky") {
    // Preserve A utility; turn low-value pieces into 10 first. Never reads hidden enemy cards.
    const ids = skyCandidates(s, player).filter(
      (id) => s.pieces[id].rank !== "A" && !isFrozen(s, s.pieces[id]),
    );
    ids.sort(
      (a, b) =>
        transformationGain(s, player, b, "10") -
        transformationGain(s, player, a, "10"),
    );
    // 王を取れる駒の動きを変えない。変身で戦力が落ちる場合は見送る。
    const chosen = ids.find(
      (id) =>
        transformationGain(s, player, id, "10") >= 0 &&
        !(best?.pieceId === id && best.score >= 12),
    );
    if (chosen) return { type: "USE_AREA", pieceId: chosen };
  }
  if (enclosure && enclosure.score > (best?.score || 0))
    return {
      type: "__CPU_SHUFFLE",
      aceId: enclosure.aceId,
      pickIds: enclosure.pickIds,
    };
  if (can.ok && can.type === "palace") {
    const promotion = palacePromotion(
      s,
      player,
      Math.max(best?.score || 0, enclosure?.score || 0),
      best,
    );
    if (promotion)
      return {
        type: "USE_AREA",
        pieceId: promotion.pieceId,
        ...(promotion.promotionSteps
          ? { promotionSteps: promotion.promotionSteps }
          : {}),
      };
  }
  const swap = bestShuffle(s, player);
  if (swap && (!best || best.score < 12)) {
    const frozen = Object.values(s.pieces)
      .filter(
        (p) =>
          p.alive &&
          p.owner === player &&
          p.id !== swap.aceId &&
          isFrozen(s, p),
      )
      .sort((a, b) => value[b.rank] - value[a.rank]);
    const partners = Object.values(s.pieces).filter(
      (p) =>
        p.alive &&
        p.owner === player &&
        p.id !== swap.aceId &&
        !frozen.includes(p) &&
        !p.isKing,
    );
    const rescue = [...frozen, ...partners].slice(0, 2);
    if (frozen.length && rescue.length === 2)
      return {
        type: "__CPU_SHUFFLE",
        aceId: swap.aceId,
        pickIds: rescue.map((p) => p.id),
      };
  }
  if (swap && swap.promising && (!best || best.score < 12))
    return { type: "__CPU_SHUFFLE", ...swap };
  if (best) {
    const { score, ...act } = best;
    return act;
  }
  if (swap) return { type: "__CPU_SHUFFLE", ...swap };
  return cpuAction(s, player);
}
