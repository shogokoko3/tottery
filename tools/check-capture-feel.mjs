/**
 * 取ったときの手ごたえ(2026-09-28 本人の指示)を確かめる。
 *   - バイブ。王を取ったときと、それ以外で分ける
 *   - まとめ取りの音階。枚数が増えるほど音が上がる
 *   - 門は触れるまで開かない
 *   - 入り切りの印は、説明の文では反応しない
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PATTERNS,
  canVibrate,
  capturePattern,
  vibrate,
} from "../src/game/haptics.js";
import {
  KING_STEP,
  STEPS,
  captureRate,
  fanfareTier,
  flipDelay,
  rateOfStep,
} from "../src/game/capture-fanfare.js";
import { SUMMON_HOLD_AT, SUMMON_TIMING } from "../src/skins/summon-plan.js";

let ok = 0;
const fail = [];
const is = (label, got, want) => {
  try {
    assert.deepEqual(got, want);
    ok++;
    console.log(`  ok   ${label}`);
  } catch {
    fail.push(label);
    console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
  }
};
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

console.log("バイブ");
is("王とそれ以外で違う", capturePattern({ king: true }) !== capturePattern({ king: false }), true);
is("取ったときと取られたときでも違う", capturePattern({ king: true, mine: true }) !== capturePattern({ king: true, mine: false }), true);
is("1枚は短く1回", capturePattern({ count: 1 }), PATTERNS.capture);
is("まとめ取りは刻む", capturePattern({ count: 3 }), PATTERNS.captureMany);
is("王が混ざれば枚数より王を優先", capturePattern({ count: 3, king: true }), PATTERNS.king);
// プラグイン(@capacitor/haptics)を使うので、iPhone でも鳴る。
// Web と Android ではプラグインの中で navigator.vibrate に落ちる
is("プラグインがあれば鳴らせる扱い", canVibrate(), true);
is("知らない型は何もしない", vibrate("そんな型は無い"), false);
is("中身が空でも落ちない", vibrate({}), false);
// iPhone は長さではなく**強さと種類**で指定する
is("ふつうの取りは軽いぶつかり", PATTERNS.capture.kind, "impact");
is("王は**知らせ**の型にして、ぶつかりと明確に変える", PATTERNS.king.kind, "notification");
is("取られたときも知らせだが別の型", PATTERNS.kingLost.type !== PATTERNS.king.type, true);
is("まとめ取りは刻む回数を持つ", PATTERNS.captureMany.repeat > 1, true);
is(
  "navigator.vibrate しか無いところ向けの並びも持つ",
  Object.values(PATTERNS).every((p) => p.web !== undefined),
  true,
);
{
  // Capacitor の Proxy を await しないこと(2026-09-15 に店で踏んだ)
  const src = fs.readFileSync(new URL("../src/game/haptics.js", import.meta.url), "utf8");
  is("プラグインは包んでから使う", /const tap = \{/.test(src), true);
  is("async から Proxy をそのまま返さない", /await Haptics\./.test(src), false);
}

console.log("\nまとめ取りの音階");
is("1枚では音を変えない", captureRate({ index: 0, total: 1 }), 1);
is("段は上がっていく", STEPS.every((v, i) => i === 0 || v > STEPS[i - 1]), true);
is(
  "頭打ち(0.5〜2)に当たらない。当たると全部同じ音になる",
  STEPS.every((v) => rateOfStep(v) > 0.5 && rateOfStep(v) < 2.0001),
  true,
);
{
  const rates = Array.from({ length: 5 }, (_, i) => captureRate({ index: i, total: 5 }));
  is("5枚なら5つとも違う音", new Set(rates).size, 5);
  is("最後がいちばん高い", rates[4] === Math.max(...rates), true);
}
is("王は低く重く(まとめ取りの最後と混ざらない)", KING_STEP < STEPS[0], true);
is("王の音は枚数に関わらず同じ", captureRate({ king: true, total: 9, index: 8 }), rateOfStep(KING_STEP));
is("段の名前", [1, 2, 3, 4, 9].map(fanfareTier), ["single", "multi", "multi", "grand", "grand"]);
is("枚数が多いほど間隔を詰める", flipDelay({ index: 1, total: 6 }) < flipDelay({ index: 1, total: 2 }), true);

console.log("\n配線");
{
  const ov = read("src/ui/overlays.jsx");
  is("撃破の札でバイブ", /vibrateCapture\(/.test(ov), true);
  is("めくりに合わせて音階", /captureRate\(\{ index: flipped - 1/.test(ov), true);
  is(
    "1枚だけのときは鳴らさない(盤の撃破音と二度重ならないように)",
    /if \(defeated\.length <= 1 && !king\) return;/.test(ov),
    true,
  );
  is("枚数を数えて見せる", /capture-count/.test(ov), true);
  is("枚数で見せ方を変える", /capture-\$\{tier\}/.test(ov), true);
}

console.log("\n門は触れるまで開かない");
{
  is("止まるのは門の前", SUMMON_HOLD_AT, SUMMON_TIMING.ascent + SUMMON_TIMING.gate);
  const intro = read("src/ui/summon-intro.jsx");
  is("触れるまで時計を進めない", /!opened\.current && raw >= SUMMON_HOLD_AT/.test(intro), true);
  is("触れる的がある", /summon-gate-touch/.test(intro), true);
  is(
    "押しても離しても開く(どちらも summon-open を投げる)",
    /onPointerUp=/.test(intro) &&
      (intro.match(/dispatchEvent\(new Event\("summon-open"\)\)/g) || []).length >= 2,
    true,
  );
  is("開く合図は根の要素で受ける(検査からも動かせる)", /addEventListener\("summon-open", open\)/.test(intro), true);
  is(
    "待っているあいだは打ち切りの時計を外す(勝手に終わらせない)",
    /setWaiting\(true\);\s*\n\s*\/\/[^\n]*\n\s*clearTimeout\(deadline\);/.test(intro),
    true,
  );
  is("門をスキップは残す", /summon-intro-skip/.test(intro), true);
  // 添え書きは輪の**上**。下に置くと「門をスキップ」と重なっていた(2026-09-28 本人の報告)
  is(
    "添え書きが輪より前に出る",
    intro.indexOf("summon-gate-hint") < intro.indexOf("summon-gate-ring"),
    true,
  );
  is(
    "いちばん下は短い見出しだけ",
    intro.indexOf("summon-gate-ring") < intro.indexOf("summon-gate-label"),
    true,
  );
  const gateCss = read("src/skins/summon-intro.css");
  is(
    "下端はスキップの釦(48px＋下20px)より上で止める",
    /padding: 0 20px calc\(92px \+ env\(safe-area-inset-bottom\)\)/.test(gateCss),
    true,
  );
  is("添え書きに専用の見た目がある", /\.summon-gate-hint \{/.test(gateCss), true);
}

console.log("\n入り切りの印の当たり");
{
  const skins = read("src/ui/skins.jsx");
  const ticket = read("src/ui/ticket-buy.jsx");
  for (const [name, src] of [["召喚の演出を飛ばす", skins], ["買う前に確認する", ticket]]) {
    is(`${name}: 説明を label の外に出した`, /<p className="toggle-note">/.test(src), true);
    is(`${name}: 当たりを狭めた印を使う`, /toggle-hit/.test(src), true);
  }
  is(
    "label の中に説明(<small>)を残していない",
    /<small>[^<]*演出を省き/.test(skins) || /<small>\s*切ると、押した瞬間/.test(ticket),
    false,
  );
  const css = read("src/skins/styles.css");
  is("押せる範囲は中身のぶんだけ", /\.toggle-hit \{[^}]*display: inline-flex/.test(css), true);
  is("説明は押せない", /\.toggle-note \{[^}]*cursor: default/.test(css), true);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
