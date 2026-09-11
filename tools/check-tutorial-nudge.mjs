// チュートリアルへの誘い(src/game/tutorial-nudge.js)の検査。くどくならない線を見張る
import assert from "node:assert/strict";
import {
  homeTutorialNudge,
  markFirstTutorialOffered,
  nextTutorial,
  shouldOfferFirstTutorial,
} from "../src/game/tutorial-nudge.js";

const profile = (cleared) => ({ cleared });
const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

assert.equal(nextTutorial(profile([])).id, 1);
assert.equal(nextTutorial(profile([1, 2, 3])).id, 4);
assert.equal(nextTutorial(profile([1, 2, 4])).id, 3, "飛ばした話があればそこへ");
assert.equal(nextTutorial(profile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), null);

assert.equal(homeTutorialNudge(profile([])).kind, "start");
assert.match(homeTutorialNudge(profile([])).text, /第1話/);
assert.equal(homeTutorialNudge(profile([1])).kind, "next");
assert.match(homeTutorialNudge(profile([1])).text, /第2話/);
assert.equal(homeTutorialNudge(profile([1, 2, 3, 4, 5, 6, 7])).kind, "next");
assert.equal(homeTutorialNudge(profile([1, 2, 3, 4, 5, 6, 7, 8])), null, "第8話まで終えたら誘わない");
assert.equal(homeTutorialNudge(profile([1, 2, 3, 4, 5, 6, 7, 8, 9])), null);

{
  const s = mem();
  assert.equal(shouldOfferFirstTutorial(profile([]), s), true, "初回は出す");
  markFirstTutorialOffered(s);
  assert.equal(shouldOfferFirstTutorial(profile([]), s), false, "一度出したら出さない");
  assert.equal(shouldOfferFirstTutorial(profile([1]), mem()), false, "第1話を終えていれば出さない");
  const broken = { getItem: () => { throw new Error("no storage"); }, setItem: () => { throw new Error("no storage"); } };
  assert.equal(shouldOfferFirstTutorial(profile([]), broken), false, "保存できない端末では出さない(毎回出るのを避ける)");
  markFirstTutorialOffered(broken);
}
console.log("チュートリアルへの誘い: 次の話・釦の一言・一度きりの案内 OK");
