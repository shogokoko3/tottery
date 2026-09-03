import { byId, sanitizeLoadout } from "./catalog.js";

// 確定した「取る移動」だけを見る。選択、包囲、引き分け、王位継承、
// CPUの検討、再描画では映像を発火させない。複数取りも1手につき1本。
export function captureFilm(before, after, loadouts, viewer = null) {
  const move = after?.lastMove;
  if (
    before?.phase !== "play" ||
    !["play", "gameover"].includes(after?.phase) ||
    !move?.captured ||
    move.seq === before.lastMove?.seq
  )
    return null;
  const actor = before.board?.[move.from?.row]?.[move.from?.col];
  if (
    !actor?.alive ||
    actor.owner !== move.owner ||
    actor.owner !== before.currentTurn
  )
    return null;
  // 裏向きの相手駒の正体を、専用映像から推測できないようにする。
  if (viewer !== null && actor.owner !== viewer && !actor.revealed) return null;
  const defeated = Object.values(before.pieces || {}).some(
    (p) =>
      p.alive &&
      p.owner !== actor.owner &&
      after.pieces?.[p.id]?.alive === false,
  );
  if (!defeated) return null;
  const skin = byId(sanitizeLoadout(loadouts?.[actor.owner])[actor.rank]);
  return skin?.video ? skin : null;
}
