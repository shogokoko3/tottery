import { areaTheme } from "./field-presentation.js";
import { L } from "../i18n/index.js";
import {
  AREA_INFO,
  canUseArea,
  isFrozen,
  isKnownTo,
  seaPullsOwn,
} from "./areas.js";

export const AREA_GATHER_MS = 480;
export const AREA_EFFECT_MS = 6000;
export const AUTO_AREAS = new Set(["earth", "forest", "ice"]);
export function isAutomaticArea(state, type) {
  // 開始済みの対局では海の旧来の自動発動を保つ。
  return AUTO_AREAS.has(type) || (type === "sea" && !(state.ruleVersion >= 10));
}
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
  return can.ok && isAutomaticArea(state, can.type)
    ? { type: "USE_AREA" }
    : null;
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
      theme: areaTheme(after.areas?.[last.player]),
      player: last.player,
      targets,
      hit: last.hit,
      extended: last.extended,
      frozenTurns:
        last.type === "ice"
          ? frozenTurnsLeft(after, after.pieces[last.pieceId])
          : null,
      usesTurn: last.usesTurn ?? !(after.ruleVersion >= 7),
      from: last.from,
      to: last.to,
      moves:
        last.type === "sea" ? (last.moves || []).map((m) => ({ ...m })) : [],
      // 版11からは相手の駒だけが流れる。旧対局の再生では両者の駒が流れる
      pullsOwn: last.type === "sea" ? seaPullsOwn(after) : undefined,
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
      title: L("盤面にエリアが広がった"),
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
        title: L("氷が解けた"),
      }
    : null;
}

export function areaEventText(event, stage) {
  if (stage === "gather")
    return (
      {
        earth: L("鬼火が気配をたどっている…"),
        sea: L("中央に潮流が集まる…"),
        forest: L("森の気配を探っている…"),
        ice: L("冷気が集まる…"),
        sky: L("風が駒を包み込む…"),
        palace:
          event.theme === "hell" ? L("昇格の炎が集まる…") : L("昇格の光が集まる…"),
      }[event.type] || ""
    );
  return (
    {
      earth: event.hit
        ? event.own
          ? L("正体を見抜いた")
          : L("正体を見抜かれた")
        : L("鬼火が静かに消えた・読み違えた"),
      sea:
        event.pullsOwn === false
          ? event.own
            ? L("水流が相手の駒を中央へ引き寄せた")
            : L("水流が自分の駒を中央へ引き寄せた")
          : L("水流が駒を中央へ引き寄せた"),
      forest: event.own
        ? L("森が正体を知らせた・自分だけに表示")
        : L("森の力で駒を見抜かれた"),
      ice: event.extended
        ? L("凍結を延長・残り{n}ターン", { n: event.frozenTurns })
        : event.own
          ? L("凍結・相手の{n}ターンは動けない", { n: event.frozenTurns })
          : L("凍結・自分の{n}ターンは動けない", { n: event.frozenTurns }),
      sky: event.own ? L("10へ変身・自軍の10は同じ1体で2回行動") : L("10へ変身・相手の10は同じ1体で2回行動"),
      palace:
        event.usesTurn === false
          ? L("{from} → {to} に昇格・続けて駒を動かせる", { from: event.from, to: event.to })
          : L("{from} → {to} に昇格・相手のターンへ", { from: event.from, to: event.to }),
      thaw: L("再び動けるようになった"),
      birth: L("陣地にエリアの力が宿った"),
    }[event.type] || ""
  );
}
