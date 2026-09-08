import { AREA_INFO, canUseArea, isFrozen, isKnownTo } from "./areas.js";

export const AREA_GATHER_MS = 480;
export const AREA_EFFECT_MS = 1800;
export const AUTO_AREAS = new Set(["earth", "sea", "forest", "ice"]);
export function automaticAreaAction(state) {
  if (
    state.captureReveal ||
    state.setupEffects ||
    state.kPlacement ||
    state.shuffleMode ||
    state.selectedId
  )
    return null;
  const can = canUseArea(state, state.currentTurn);
  return can.ok && AUTO_AREAS.has(can.type) ? { type: "USE_AREA" } : null;
}
// 今の相手手番も含めて、動けない手番の残りを表示する。
export function frozenTurnsLeft(state, piece) {
  return isFrozen(state, piece)
    ? Math.ceil((piece.frozenUntil - (state.turnNo || 0)) / 2)
    : 0;
}
export function hasVisibleSkyBonus(state, piece, viewer) {
  return (
    !!piece &&
    piece.rank === "10" &&
    isKnownTo(state, viewer, piece) &&
    (!!piece.skyTwice || !!state.players[piece.owner].skyTwice)
  );
}
const position = (p) => (p ? { row: p.row, col: p.col } : null);

/** 演出用には閲覧者に伝えてよい位置だけを渡す。敵側の森の対象IDも含めない。 */
export function areaEvent(before, after, viewer) {
  if (!before || !after.areasEnabled) return null;
  const last = after.lastArea;
  if (last && last.seq !== before.lastArea?.seq) {
    const own = viewer === last.player;
    const ids =
      last.type === "forest" && !own
        ? []
        : (last.pieceIds || [last.pieceId]).filter(Boolean);
    const targets = ids.map((id) => position(after.pieces[id])).filter(Boolean);
    return {
      id: `area-${last.seq}`,
      type: last.type,
      player: last.player,
      targets,
      hit: last.hit,
      extended: last.extended,
      frozenTurns:
        last.type === "ice"
          ? frozenTurnsLeft(after, after.pieces[last.pieceId])
          : null,
      from: last.from,
      to: last.to,
      moves:
        last.type === "sea" ? (last.moves || []).map((m) => ({ ...m })) : [],
      trail:
        last.type === "earth" && before.lastMove
          ? [before.lastMove.from, before.lastMove.to]
          : [],
      own,
      title: AREA_INFO[last.type].name,
    };
  }
  if (
    after.phase === "play" &&
    before.phase !== "play" &&
    after.areas?.some(Boolean)
  )
    return {
      id: "area-birth",
      type: "birth",
      targets: [],
      areas: after.areas.map((a) => a?.type || null),
      title: "盤面にエリアが広がった",
    };
  const targets = Object.values(after.pieces)
    .filter(
      (p) =>
        p.alive && isFrozen(before, before.pieces[p.id]) && !isFrozen(after, p),
    )
    .map(position);
  return targets.length
    ? {
        id: `thaw-${after.turnNo}-${after.lastSwap?.seq || 0}`,
        type: "thaw",
        targets,
        title: "氷が解けた",
      }
    : null;
}

export function areaEventText(event, stage) {
  if (stage === "gather")
    return (
      {
        earth: "足跡をたどっている…",
        sea: "中央に潮流が集まる…",
        forest: "森の気配を探っている…",
        ice: "冷気が集まる…",
        sky: "風が駒を包み込む…",
        palace: "昇格の光が集まる…",
      }[event.type] || ""
    );
  return (
    {
      earth: event.hit
        ? event.own
          ? "正体を見抜いた"
          : "正体を見抜かれた"
        : "足跡は砂に消えた・読み違えた",
      sea: "水流が駒を中央へ引き寄せた",
      forest: event.own
        ? "森が正体を知らせた・自分だけに表示"
        : "森の力で駒を見抜かれた",
      ice: event.extended
        ? `凍結期間を追加・残り${event.frozenTurns}手番`
        : `凍結・相手の${event.frozenTurns}手番は移動できない`,
      sky: "10へ変身・自軍の10は2回行動",
      palace: `${event.from} → ${event.to} に昇格・相手の手番へ`,
      thaw: "再び動けるようになった",
      birth: "陣地にエリアの力が宿った",
    }[event.type] || ""
  );
}
