/**
 * フェーズ(2026-09-30 本人の指示。設計は ストーリーとフェーズ.md)。
 *
 *   1  駒の動きだけ(王の力なし)
 *   2  王の力あり
 *   3  フォイルの能力(王のエリア効果)あり
 *
 * 昇格は「そのフェーズのストーリー(6軸)を全部クリア」+「そのフェーズでオンライン5勝」。
 * 持ち点(レート)はフェーズ3だけ。フェーズ1・2 のオンラインは 5×5 に限る
 * (持ち点の対象が「ランダムマッチかつ 9×9」で決まっているので、台帳を触らずに済む)。
 *
 * ここは**決まりごとだけ**を持つ。profile の読み書きは profile.js、対局への反映は
 * START_SETUP(kingPowers / areas)と掲示(phase / size)で行う。
 */

export const PHASES = Object.freeze([1, 2, 3]);
export const PHASE_MAX = 3;

/**
 * 既定のフェーズ。**ストーリーが載るまでは 3**(いまの挙動のまま)。
 * ストーリー公開時に 1 へ切り替える(既存プレイヤーも最初から、が本人の決め)
 */
export const DEFAULT_PHASE = 3;

/** ストーリーの軸(王の数字の組)。この順に並ぶ。ステージの中身は story.js(これから) */
export const STORY_AXES = Object.freeze(["23", "45", "67", "89", "10", "jqk"]);

/** 昇格に要るオンライン勝利数(そのフェーズで) */
export const PROMOTION_WINS = 5;

/** フェーズとして正しい値なら返し、そうでなければ既定 */
export function normalizePhase(value) {
  return PHASES.includes(value) ? value : DEFAULT_PHASE;
}

/** profile からいまのフェーズ */
export function phaseOf(profile) {
  return normalizePhase(profile?.phase);
}

/** そのフェーズの対局の決まり */
export function rulesForPhase(phase) {
  const p = normalizePhase(phase);
  return Object.freeze({
    // 王の力(継承・道連れ・伸び・まとめ取り・2回目・J/Q の+1・K の予備札)
    kingPowers: p >= 2,
    // 王のエリア効果(フォイルの能力)。9×9 で王のフォイルがあるときだけ立つのは今までどおり
    areas: p >= 3,
    // オンラインで選べる盤。持ち点の対象(9×9)はフェーズ3だけ
    sizes: p >= 3 ? [5, 9] : [5],
  });
}

/** START_SETUP に載せる旗。フェーズ3(旗なし)は今までどおりの形にして、古い記録・端末と揃える */
export function setupFlagsForPhase(phase) {
  const r = rulesForPhase(phase);
  return r.kingPowers ? {} : { kingPowers: false };
}

/** phaseWins の形をそろえる { 1: n, 2: n, 3: n } */
export function normalizePhaseWins(raw) {
  const out = {};
  for (const p of PHASES) {
    const n = raw && Number.isInteger(raw[p]) && raw[p] >= 0 ? raw[p] : 0;
    out[p] = n;
  }
  return out;
}

/** story の形をそろえる { 1: [軸id], 2: [...], 3: [...] }(知らない軸は落とす) */
export function normalizeStory(raw) {
  const out = {};
  for (const p of PHASES) {
    const list = raw && Array.isArray(raw[p]) ? raw[p] : [];
    out[p] = [...new Set(list.filter((id) => STORY_AXES.includes(id)))];
  }
  return out;
}

/** そのフェーズで何が足りないか。画面の「昇格まであと…」に使う */
export function promotionStatus(profile) {
  const phase = phaseOf(profile);
  const story = normalizeStory(profile?.story);
  const wins = normalizePhaseWins(profile?.phaseWins);
  const clearedAxes = story[phase];
  return Object.freeze({
    phase,
    last: phase >= PHASE_MAX,
    axesCleared: clearedAxes.length,
    axesTotal: STORY_AXES.length,
    axesLeft: STORY_AXES.filter((a) => !clearedAxes.includes(a)),
    wins: wins[phase],
    winsNeeded: PROMOTION_WINS,
    winsLeft: Math.max(0, PROMOTION_WINS - wins[phase]),
  });
}

/** 昇格できるか(最後のフェーズでは常に false) */
export function canPromote(profile) {
  const s = promotionStatus(profile);
  return !s.last && s.axesLeft.length === 0 && s.winsLeft === 0;
}

/** 昇格した profile を返す(できなければそのまま)。保存は呼ぶ側 */
export function promote(profile) {
  if (!canPromote(profile)) return profile;
  return { ...profile, phase: phaseOf(profile) + 1 };
}

/** ストーリーの軸をクリアした profile を返す(そのフェーズの分に足す。二度は足さない) */
export function clearAxis(profile, axis) {
  if (!STORY_AXES.includes(axis)) return profile;
  const phase = phaseOf(profile);
  const story = normalizeStory(profile?.story);
  if (story[phase].includes(axis)) return profile;
  return { ...profile, story: { ...story, [phase]: [...story[phase], axis] } };
}

/** オンラインで1勝した profile を返す(そのフェーズの分に足す) */
export function addPhaseWin(profile) {
  const phase = phaseOf(profile);
  const wins = normalizePhaseWins(profile?.phaseWins);
  return { ...profile, phaseWins: { ...wins, [phase]: wins[phase] + 1 } };
}

/** 掲示(lobby)の1件がこの盤・このフェーズの相手か。旧端末の掲示(phase なし)はフェーズ3扱い */
export function lobbyMatchesPhase(entry, phase) {
  const p = normalizePhase(phase);
  const theirs = entry && Number.isInteger(entry.phase) ? entry.phase : PHASE_MAX;
  return theirs === p;
}
