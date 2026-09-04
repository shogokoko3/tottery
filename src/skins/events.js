import { byId, sanitizeLoadout } from "./catalog.js";

/**
 * 効果を持つ数字。2・3 は王位継承、4・5 は道連れ。
 * この4つは「効果が出たとき」だけ映像を流し、取ったときには流さない。
 * 取るたびに出していると、本来の見せ場である効果の映像が埋もれる。
 */
const ABILITY_RANKS = new Set(["2", "3", "4", "5"]);

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
  // 2〜5 は取っても流さない。この4つの見せ場は効果のほう
  if (ABILITY_RANKS.has(actor.rank)) return null;
  // 裏向きの相手駒の正体を、専用映像から推測できないようにする。
  //
  // 見るのは「この手が終わった時点で正体が公になっているか」。次の2つ。
  //   表になっている … 王を討った駒は決まりでその場で表になる
  //   倒れている     … 道連れに巻き込まれた駒。失った駒の欄に札が並ぶ
  // どちらも盤か札置き場を見れば分かることなので、映像で隠す意味がない。
  // 映像のほうに数字ごとの例外を置くと、スキンを着けている人だけが正体を
  // 早く割られることになるので、そちらでは何もしない。
  const at = after.pieces?.[actor.id];
  const shown = actor.revealed || at?.revealed || at?.alive === false;
  if (viewer !== null && actor.owner !== viewer && !shown) return null;
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
 * 道連れの映像。
 *
 * 王が4・5のとき、同じ数字の手駒が取られると、取った相手も道連れになる。
 * 倒された側の、その数字のスキンを流す。取った側の映像のあとに続けるので、
 * 「取られた → 道連れにした」がひと続きに見える。
 *
 * 誰の画面でも同じものを流す。道連れをした駒の数字は取られた時点で公開され、
 * 巻き添えになった駒も倒れて表に出るので、これで新しく漏れる話は無い。
 */
export function revengeFilm(before, after, loadouts) {
  const mark = after?.lastRevenge;
  // 同じ印のままなら、この手では起きていない(前の手の印が残っているだけ)
  if (!mark || mark === before?.lastRevenge) return null;
  const skin = byId(sanitizeLoadout(loadouts?.[mark.owner])[mark.rank]);
  return skin?.video ? skin : null;
}

/**
 * その手で流す映像を、流す順に並べて返す。
 *
 *   1. 取った側の映像
 *   2. 道連れの映像(4・5の効果)
 *   3. 王位継承の映像(2・3の効果)
 *
 * 起きたものだけが、この順で続けて流れる。
 */
export function filmsFor(before, after, loadouts, viewer = null) {
  return [
    captureFilm(before, after, loadouts, viewer),
    revengeFilm(before, after, loadouts),
    successionFilm(before, after, loadouts),
  ].filter(Boolean);
}
