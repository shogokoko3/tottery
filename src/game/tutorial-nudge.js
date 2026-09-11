/**
 * チュートリアルへの誘い。くどくならないよう、出す場所は2つだけ。
 *   1. ホームのチュートリアルの釦の一言(進み具合で変わる。第8話まで終えたら元の文に戻る)
 *   2. 名前を決めた直後の一度きりの案内(第1話を始める／あとで)
 * ランダムマッチの入口の「第8話まで」は online-gate.js のまま。
 * (2026-09-11、本人の依頼「チュートリアルを促すようにしたい。くどくなりすぎない程度に」)
 */
import { TUTORIALS } from "./tutorial.js";
import { hasCleared } from "./profile.js";
import { ONLINE_GATE_EPISODES } from "./online-gate.js";

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
  if (!next || next.id > ONLINE_GATE_EPISODES) return null;
  if (next.id === 1)
    return { kind: "start", text: "まずはここから。第1話は3分ほど", next };
  return { kind: "next", text: `次は ${next.title}`, next };
}

/** 名前を決めた直後の案内を出すか。第1話が未了で、まだ出していないときだけ */
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
