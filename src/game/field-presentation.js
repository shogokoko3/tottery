// Presentation only: never inspect a concealed piece to choose a background.
export function areaTheme(area) {
  if (!area) return null;
  if (area.type === "palace")
    return String(area.skin || "").startsWith("demon-") ? "hell" : "heaven";
  return ["earth", "sea", "forest", "ice", "sky"].includes(area.type)
    ? area.type
    : null;
}

export function boardFieldTheme(state) {
  if (
    state.boardSize !== 9 ||
    !state.areasEnabled ||
    !["play", "gameover"].includes(state.phase)
  )
    return null;
  const themes = (state.areas || []).map(areaTheme);
  // Two fields follow the turn. A single field stays throughout the match.
  return themes[state.currentTurn] || themes[1 - state.currentTurn] || null;
}

export const FIELD_EFFECT_MS = 6000;
export function areaDuration(event) {
  return event.type === "thaw"
    ? 1000
    : event.type === "birth"
      ? 1800
      : FIELD_EFFECT_MS;
}
export function areaApplyMs(event) {
  return event.type === "sea"
    ? 1500
    : event.type === "ice"
      ? 4350
      : ["birth", "thaw"].includes(event.type)
        ? 480
        : ["sky", "palace"].includes(event.type)
          ? 4200
          : 3150;
}

export function areaTransformClass(effect, piece) {
  const e = effect?.event;
  return piece &&
    e &&
    ["sky", "palace"].includes(e.type) &&
    e.targets.some((p) => p.row === piece.row && p.col === piece.col)
    ? ` piece-area-transform piece-area-${e.type}`
    : "";
}
