/**
 * フェーズ(2026-09-30 本人の指示。設計は ストーリーとフェーズ.md)。
 *
 *   1  駒の動きだけ(王の力なし)
 *   2  王の力あり
 *   3  フォイルの能力(王のエリア効果)あり
 *
 * 昇格は「そのフェーズのストーリー(7軸)を全部クリア」+「そのフェーズでオンライン5勝」。
 * 持ち点(レート)はフェーズ3だけ(rankedPhase。game.jsx の ranked と verify-match がフェーズを見る)。
 * オンラインで選べる盤は rulesForPhase().sizes: フェーズ1・2 は 5×5、フェーズ3 は両方(2026-09-30。フェーズ2 は 2026-10-25 に 9×9 → 5×5)。
 *
 * ここは**決まりごとだけ**を持つ。profile の読み書きは profile.js、対局への反映は
 * START_SETUP(kingPowers / areas)と掲示(phase / size)で行う。
 */

export const PHASES = Object.freeze([1, 2, 3]);
export const PHASE_MAX = 3;

/**
 * 既定のフェーズ。ストーリー公開(2026-09-30)で **1** に切り替えた
 * (既存プレイヤーもフォイルの有無に関わらず最初から、が本人の決め。テスト環境なので)。
 * 公開前の端末が保存した phase:3 も PHASE_EPOCH で 1 へ戻す(profile.js loadProfile)
 */
export const DEFAULT_PHASE = 1;

/**
 * フェーズの「世代」。profile.phaseEpoch がこれと違う保存は、フェーズを DEFAULT_PHASE から
 * やり直す(一度きりの移行)。全員を最初からにしたくなったら 1 つ上げる。
 * phaseWins / story は消さない(公開時点では誰も持っていない)
 */
export const PHASE_EPOCH = 1;

/** ストーリーの軸(王の数字の組)。この順に並ぶ。ステージの中身は story.js(これから) */
// J・Q と K は別のステージ(2026-09-30 本人の指示。前は J・Q・K で1つ)
export const STORY_AXES = Object.freeze(["23", "45", "67", "89", "10", "jq", "k"]);

/** 昇格に要るオンライン勝利数(そのフェーズで) */
export const PROMOTION_WINS = 5;

/**
 * ストーリーのステージを1つクリアしたときの褒美(ガチャチケット 10 枚 = 10連ぶん。2026-09-30 本人の指示)。
 * フェーズ×軸ごとに一度きり。**サーバーもこれを見る**(台帳の道 kind=story)
 */
export const STORY_TICKETS = 10;

/** ストーリーの軸として正しいか */
export const isStoryAxis = (axis) => STORY_AXES.includes(axis);

/** 台帳の出来事 id。組むのはサーバー(認証済みの uid から) */
export const storyEventId = (uid, phase, axis) => `story:${uid}:${phase}:${axis}`;

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
    // オンラインで選べる盤(2026-09-30 本人の指示): フェーズ1 は 5×5、フェーズ3 は両方。
    // フェーズ2 は 2026-10-25 本人の指示で 9×9 → 5×5(ストーリーと同じ。AI テストプレイで 9×9 の段差が大きすぎた)。
    // 掲示の決まり(firebase-rules.json の lobby/$code/size)は、移行のあいだフェーズ2 に 5 と 9 の両方を許す。
    // 持ち点(レート)はフェーズ3だけ(game.jsx の ranked と verify-match がフェーズを見る)
    sizes: p >= 3 ? [5, 9] : [5],
  });
}

/**
 * ストーリーのステージの盤。フェーズ1・2 は 5×5、フェーズ3 は 9×9。
 * (2026-09-30 はフェーズ2 から 9×9。2026-10-25 本人の指示でフェーズ2 も 5×5 に。
 *  AI テストプレイで 9×9・王の力・持ち時間が一度に来て、5人中4人がフェーズ2 の第1話で止まったため)
 * オンラインのフェーズ2 も 5×5(rulesForPhase().sizes。2026-10-25 本人の指示)
 */
export function stageSize(phase) {
  return normalizePhase(phase) >= 3 ? 9 : 5;
}

/** 持ち点(レート)に数えるフェーズか。フェーズ3だけ。通信の部屋のフェーズは onlinePhase で読んでから渡す */
export function rankedPhase(phase) {
  return phase === 3;
}

/** START_SETUP に載せる旗。フェーズ3(旗なし)は今までどおりの形にして、古い記録・端末と揃える */
export function setupFlagsForPhase(phase) {
  const r = rulesForPhase(phase);
  return r.kingPowers ? {} : { kingPowers: false };
}

/**
 * ストーリーの対局(CPU 戦)の王の力。フェーズ2 は**プレイヤーの席(0)だけ**に王の力が付く
 * (2026-10-25 本人の指示「王の力は、プレイヤー側のみが発動できるようにします」)。CPU の王は力なしで動く。
 * フェーズ1 はどちらも無し、フェーズ3 はどちらも有り(今までどおり)。オンラインは setupFlagsForPhase のまま
 */
export function storySetupFlags(phase) {
  const p = normalizePhase(phase);
  if (p === 2) return { kingPowers: [true, false] };
  return setupFlagsForPhase(p);
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

