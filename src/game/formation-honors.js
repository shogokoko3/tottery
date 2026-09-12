// Presentation rewards only. Never attach a formation or its king location to a room.
export const HONOR_VERSION =
  typeof __HONOR_VERSION__ === "undefined" ? "dev" : __HONOR_VERSION__;
export const honorRoot = `honors/${HONOR_VERSION}`;
export const FORMATION_EMBLEMS = [
  ["earth", "heir-hunt", "軌跡の追跡者", "土"],
  ["sea", "kamikaze", "荒波の航海士", "海"],
  ["forest", "elimination", "静寂な狩人", "森"],
  ["ice", "fortress", "堅牢な要塞", "氷"],
  ["sky", "twin-wings", "双翼の将", "空"],
  ["heaven", "royal-road", "覇道・天界", "宮殿"],
  ["hell", "royal-road", "覇道・魔界", "宮殿"],
].map(([theme, titleId, label, area]) => ({
  id: `formation-${theme}`,
  titleId,
  label,
  image: `${honorRoot}/icons/${theme}.png`,
  how: `${area}の布陣称号を獲得`,
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
    })),
  };
}
