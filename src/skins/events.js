import { byId, sanitizeLoadout } from "./catalog.js";

/** その手で、相手の王が倒れたか */
function killedKing(before, after, byOwner) {
  return Object.values(before?.pieces || {}).some(
    (p) =>
      p.alive &&
      p.isKing &&
      (byOwner === undefined || p.owner !== byOwner) &&
      after?.pieces?.[p.id]?.alive === false,
  );
}

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
  // ただし相手の王を取った手だけは、伏せたままでも相手に見せる。
  // 勝敗が決まる場面であり、2・3なら王位が移る大きな山場なので、
  // ここは正体を明かしてでも両方の画面で演出を通す。
  if (
    viewer !== null &&
    actor.owner !== viewer &&
    !actor.revealed &&
    !killedKing(before, after, actor.owner)
  )
    return null;
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

/**
 * 王位継承の映像。
 *
 * 王の2・3が倒れると、同じ数字の駒が跡を継いで対局が続く。
 * 倒された側の、その数字のスキンを流す。取った側の映像のあとに続けるので、
 * 「取られた → 立ち上がった」がひと続きに見える。
 *
 * 誰の画面でも同じものを流す。倒れた王の数字は取った時点で公開されるし、
 * 跡を継げるのは決まりどおり同じ数字だけなので、これで新しく漏れる話は無い。
 */
export function successionFilm(before, after, loadouts) {
  if (before?.phase !== "play") return null;
  const move = after?.lastMove;
  // 包囲(lastMove を更新しない)でも王は倒れるので、手の種類では絞らない。
  // 同じ盤を2度描いたときに二重に流さないことだけ見る
  if (move && move.seq === before.lastMove?.seq && !after?.captureReveal)
    return null;
  const fallen = Object.values(before.pieces || {}).find(
    (p) =>
      p.alive &&
      p.isKing &&
      (p.rank === "2" || p.rank === "3") &&
      after?.pieces?.[p.id]?.alive === false,
  );
  if (!fallen) return null;
  // 跡継ぎが立った(または、これから選ぶ)ときだけ。決着したなら流さない
  const heirId = after?.players?.[fallen.owner]?.kingId;
  const crowned = heirId && heirId !== fallen.id;
  const choosing = after?.pendingKingChoice?.owner === fallen.owner;
  if (!crowned && !choosing) return null;
  const skin = byId(sanitizeLoadout(loadouts?.[fallen.owner])[fallen.rank]);
  return skin?.video ? skin : null;
}

/**
 * その手で流す映像を、流す順に並べて返す。
 * 取った側の映像 → 王位継承の映像。両方あれば続けて流れる。
 */
export function filmsFor(before, after, loadouts, viewer = null) {
  return [
    captureFilm(before, after, loadouts, viewer),
    successionFilm(before, after, loadouts),
  ].filter(Boolean);
}
