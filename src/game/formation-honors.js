import { L } from "../i18n/index.js";
// Presentation rewards only. Never attach a formation or its king location to a room.
export const HONOR_VERSION =
  typeof __HONOR_VERSION__ === "undefined" ? "dev" : __HONOR_VERSION__;
export const honorRoot = `honors/${HONOR_VERSION}`;
/**
 * 称号のアイコンの拡張子。build.mjs が埋める。
 * ASSETS=compact(Google Play 版)では webp になる。
 * 絵は同じで、入れ物だけが違う([[Android配信.md]] の「大きさの問題」)
 */
const IMG = typeof __HONOR_IMG_EXT__ === "undefined" ? ".png" : __HONOR_IMG_EXT__;
export const FORMATION_EMBLEMS = [
  ["earth", "heir-hunt", L("軌跡の追跡者"), L("土")],
  ["sea", "kamikaze", L("荒波の航海士"), L("海")],
  ["forest", "elimination", L("静寂な狩人"), L("森")],
  ["ice", "fortress", L("堅牢な要塞"), L("氷")],
  ["sky", "twin-wings", L("双翼の将"), L("空")],
  ["heaven", "royal-road", L("覇道・天界"), L("宮殿")],
  ["hell", "royal-road", L("覇道・魔界"), L("宮殿")],
].map(([theme, titleId, label, area]) => ({
  id: `formation-${theme}`,
  titleId,
  label,
  image: `${honorRoot}/icons/${theme}${IMG}`,
  how: L("{area}の布陣称号を獲得", { area }),
}));

/** Normalize only the owner's visible army into the award's three rows. */
export function formationLayout(state, viewer) {
  const own = Object.values(state.pieces).filter(
    (p) => p.alive && p.owner === viewer,
  );
  const left = Math.min(...own.map((p) => p.col));
  const front =
    viewer === 0
      ? Math.min(...own.map((p) => p.row))
      : Math.max(...own.map((p) => p.row));
  return {
    width: Math.max(...own.map((p) => p.col)) - left + 1,
    cells: own.map((p) => ({
      row: viewer === 0 ? p.row - front : front - p.row,
      col: p.col - left,
      rank: p.rank,
      suit: p.suit,
      king: !!p.isKing,
      ...(p.mark === "palace" ? { promoted: true } : null),
    })),
  };
}
