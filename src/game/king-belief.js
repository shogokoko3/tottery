import { isKnownTo } from "./areas.js";

/** CPUから見える盤面だけを入力にする。未知の駒の数字・王フラグは読み取らない。 */
export function opponentObservations(state, viewer) {
  return Object.values(state.pieces)
    .filter((p) => p.alive && p.owner !== viewer)
    .map((p) => {
      const visible = isKnownTo(state, viewer, p);
      return {
        id: p.id,
        row: p.row,
        col: p.col,
        visible,
        ...(visible ? { rank: p.rank, isKing: !!p.isKing } : {}),
      };
    });
}
/** 公開された王がいれば確定。そうでなければ、王でないと分かった駒を除外。
 * 複数候補への等重みは探索用の仮定であり、厳密な王の確率ではない。
 */
export function inferKingCandidates(observations) {
  const visibleKing = observations.filter((p) => p.visible && p.isKing);
  const candidates = visibleKing.length
    ? visibleKing
    : observations.filter((p) => !p.visible);
  return {
    candidates,
    excluded: observations.length - candidates.length,
    certain: candidates.length === 1,
    inferred: candidates.length === 1 && !candidates[0].visible,
    weight: candidates.length ? 1 / candidates.length : 0,
  };
}
export function opponentKingBelief(state, viewer) {
  return inferKingCandidates(opponentObservations(state, viewer));
}
