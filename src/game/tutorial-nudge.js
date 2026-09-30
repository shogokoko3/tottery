/**
 * チュートリアルへの誘い。くどくならないよう、出す場所は2つだけ。
 *   1. ホームのチュートリアルの釦の一言(進み具合で変わる。第8話まで終えたら元の文に戻る)
 *   2. 名前を決めた直後の一度きりの案内。2026-09-30 から中身は導入(手引き)で、読み終えるとストーリーへ(第1話は通らない)
 * ランダムマッチの入口の条件は online-gate.js(ストーリーのフェーズ1。2026-09-30)。
 * (2026-09-11、本人の依頼「チュートリアルを促すようにしたい。くどくなりすぎない程度に」)
 */
import { TUTORIALS, tutorialMinutes } from "./tutorial.js";
import { hasCleared } from "./profile.js";
// ホームの誘いは第8話まで(ランダムマッチの条件はストーリーに移った。2026-09-30)
const NUDGE_EPISODES = 8;

const SEEN_KEY = "tottery.tutorial-nudge.v1";

/** 次に終えるべき話。全部終えていれば null */
export function nextTutorial(profile) {
  return TUTORIALS.find((t) => !hasCleared(t.id, profile)) || null;
}

/**
 * ホームの釦に添える一言。
 *   { kind: "start", text }  … まだ1話も終えていない(小さな印も出す)
 *   { kind: "next", text }   … 途中(第8話まで)
 *   null                     … 第8話まで終えた(元の文のまま)
 */
export function homeTutorialNudge(profile) {
  const next = nextTutorial(profile);
  if (!next || next.id > NUDGE_EPISODES) return null;
  if (next.id === 1)
    return { kind: "start", text: "まずはここから。第1話は1分ほど", next };
  // 中身と時間が分かる形に(2026-09-25 本人の指示。「次は第N話」だけでは重さが読めない)
  return { kind: "next", text: `次は ${next.title}(約${tutorialMinutes(next)}分)`, next };
}

/** 名前を決めた直後の案内(導入)を出すか。まだ出していないときだけ。前の版で第1話を終えた人には出さない */
export function shouldOfferFirstTutorial(profile, storage = localStorage) {
  if (hasCleared(1, profile)) return false;
  try {
    return storage.getItem(SEEN_KEY) !== "1";
  } catch {
    return false;
  }
}
export function markFirstTutorialOffered(storage = localStorage) {
  try {
    storage.setItem(SEEN_KEY, "1");
  } catch {
    /* 保存できなくても進める */
  }
}
