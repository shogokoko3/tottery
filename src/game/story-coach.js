/**
 * ストーリー2つ目の手当て(2026-10-01 本人の指示)。
 *
 * はじめの一局(台本)は、サイコロ・引き直し・布陣を台本が裏で済ませる。遊ぶ人がそれらに初めて出会うのは
 * 次の CPU 戦(ふつうは「四と五の王」。ほかのステージを先に選んでも、初めての CPU 戦なら同じ)。その初回だけ:
 *   - サイコロ・引き直し・陣の場面で一言ずつ(COACH_LINES)。一度見せた一言は二度と出さない(場面ごとの控え)
 *   - 引き直しは、引き直さずに進む「このまま」を光らせる
 *   - 陣は、おすすめの陣(自動配置)を並べた状態から始める(並べ替えてよい)
 * 出すのは、導入の語りを通った人だけ(intro.js の prologueSeen)。導入を通らないいまのテスターは、
 * サイコロも引き直しも陣も知っているので出さない。
 * フェーズ1 のストーリーの時間制限なし(story.js の storyUntimed)は、この手当てとは別で毎回。
 * 画面(game.jsx)と検査(tools/check-story-coach.mjs)が同じ関数を呼ぶ
 */
import { normalizePhase } from "./phase.js";

/** 手当ての場面。出会う順 */
export const COACH_SCENES = Object.freeze(["dice", "mulligan", "setup"]);

/** 場面ごとの一言。1文1行(読点の位置で行を切る。各行20字まで) */
export const COACH_LINES = Object.freeze({
  dice: Object.freeze(["先手は、サイコロで決まる。"]),
  mulligan: Object.freeze(["いらない札は、捨てて引き直せる。", "捨てた札は、相手にも見える。"]),
  setup: Object.freeze(["伏せた一枚に、策がある。", "手札から5枚。迷ったら「自動配置」。"]),
});

/** 引き直しで、1枚も選んでいないときの釦(引き直さずに進む)。手当ての対局ではこれを光らせる */
export const KEEP_LABEL = "このまま";

/**
 * この対局で出す手当て。出さないなら null。
 *   { dice, mulligan, setup } … 場面ごとの一言(string[])。null の場面は手当て済み
 *   (一言も、「このまま」の光も、陣の自動配置も出さない)
 * 引数:
 *   story      ストーリーのステージ({ phase, ... })。無ければ出さない
 *   tutorial   台本(はじめの一局・第1〜13話)。台本の対局には出さない
 *   network    オンライン。出さない
 *   introSeen  導入の語りを通ったか(prologueSeen())。通っていない人(いまのテスター)には出さない
 *   seen       もう見せた場面(coachSeen())
 */
export function storyCoachPlan({ story = null, tutorial = null, network = null, introSeen = false, seen = [] } = {}) {
  if (!story || tutorial || network) return null;
  if (normalizePhase(story.phase) !== 1) return null;
  if (!introSeen) return null;
  const done = new Set(seen);
  if (COACH_SCENES.every((k) => done.has(k))) return null;
  return Object.freeze(Object.fromEntries(COACH_SCENES.map((k) => [k, done.has(k) ? null : COACH_LINES[k]])));
}

/**
 * いまの盤が手当てのどの場面か(seat の席から見て)。一言を出し、控えを付ける場面。
 * 陣は自分が並べている段(place)のあいだだけ。王を選ぶ段と確定のあとは出さない(王の選び方は、はじめの一局で済んでいる)
 */
export function coachScene(state, seat = 0) {
  if (!state) return null;
  if (state.phase === "dice") return "dice";
  if (state.phase === "mulligan") return "mulligan";
  if (
    state.phase === "setup" &&
    !(state.setupDone && state.setupDone[seat]) &&
    ((state.setupSteps && state.setupSteps[seat]) || "place") === "place"
  )
    return "setup";
  return null;
}

/** おすすめの陣を並べるか。陣の手当てがあり、自分が並べる段で、まだ1枚も置いていないとき */
export function coachArranges(plan, state, seat = 0) {
  if (!plan || !plan.setup || coachScene(state, seat) !== "setup") return false;
  const placed = state.setupPlacements && state.setupPlacements[seat];
  return !placed || Object.keys(placed).length === 0;
}

/** 見せた場面の控え(端末ごと)。消えても一言がもう一度出るだけ */
const SEEN_KEY = "tottery.storyCoach.v1";
// 保存できなかった場面。この起動のあいだは見せたものとして扱う
const seenThisRun = new Set();

/** もう見せた場面。読めない端末と壊れた控えは「全部見せた」(毎回出るより、出さないほうがよい) */
export function coachSeen(storage = globalThis.localStorage) {
  let saved;
  try {
    saved = storage.getItem(SEEN_KEY);
  } catch {
    return [...COACH_SCENES];
  }
  let list = [];
  if (saved != null) {
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [...COACH_SCENES];
      list = parsed;
    } catch {
      return [...COACH_SCENES];
    }
  }
  return COACH_SCENES.filter((k) => list.includes(k) || seenThisRun.has(k));
}

/** その場面を見せた控えを付ける */
export function markCoachSeen(scene, storage = globalThis.localStorage) {
  if (!COACH_SCENES.includes(scene)) return;
  const next = new Set([...coachSeen(storage), scene]);
  try {
    storage.setItem(SEEN_KEY, JSON.stringify(COACH_SCENES.filter((k) => next.has(k))));
  } catch {
    // 保存(setItem)だけが失敗する端末(容量いっぱいなど)でも、この起動のあいだは二度と出さない
    seenThisRun.add(scene);
  }
}
