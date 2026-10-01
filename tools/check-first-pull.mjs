/**
 * はじめての10連と、チュートリアルの褒美(2026-09-28 本人の指示)を確かめる。
 *
 *   - 導入の最後に引く(2026-10-01 本人の指示。はじめの一局に勝ち → 名前 → 門の語り → 10連 → ストーリー一覧)
 *   - SSR が1枚以上確定・**フォイルは出ない**・フリーズの演出はそのまま
 *   - チケットは使わない。一度きり(開き直しても出ない)
 *   - チュートリアルを1話終えるごとにガチャチケット
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  FIRST_PULL_SIZE,
  drawFirstPull,
  firstPullDone,
  firstPullResult,
  markFirstPull,
} from "../src/skins/first-pull.js";
import { applyPull, normalize } from "../src/skins/collection.js";
import { baseSkinId, byId } from "../src/skins/catalog.js";
import { qualifiesForFreeze, resolveSummonFreeze } from "../src/skins/summon-freeze.js";
import {
  TUTORIAL_TICKETS,
  rewardEventId,
  ticketRewardLabel,
  ticketsForCleared,
  TUTORIAL_REWARD_MAX_ID,
  isRewardChapter,
  chapterFromLegacyId,
} from "../src/game/tutorial-reward.js";
import { ALL_TUTORIALS, TUTORIALS } from "../src/game/tutorial.js";

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
const isSsr = (id) => byId(baseSkinId(id))?.rarity === "SSR";
const isFoil = (id) => id !== baseSkinId(id);

console.log("はじめての10連");
is("10枚引く", FIRST_PULL_SIZE, 10);
{
  // 乱数を一巡させて、どの目でも決まりを守るか見る
  let ssrMin = 99, foils = 0, sizes = new Set();
  for (let i = 0; i < 4000; i++) {
    const ids = drawFirstPull();
    sizes.add(ids.length);
    const ssr = ids.filter(isSsr).length;
    ssrMin = Math.min(ssrMin, ssr);
    foils += ids.filter(isFoil).length;
  }
  is("いつでも10枚", [...sizes], [10]);
  is("SSR は必ず1枚以上", ssrMin >= 1, true);
  is("フォイルは1枚も出ない", foils, 0);
}
{
  // フリーズの演出はそのまま。ただし**フォイルへの昇格だけ**起こさない
  let froze = 0, foils = 0, promoted = 0;
  for (let i = 0; i < 4000; i++) {
    const r = firstPullResult();
    if (r.freeze) {
      froze++;
      // 昇格しているか(もとの並びと変わっているか)
      if (r.skins.some((id, n) => id !== r.freeze.initial[n])) promoted++;
    }
    foils += r.skins.filter(isFoil).length;
  }
  is("フリーズは起きる", froze > 0, true);
  is("フリーズしたときは昇格もする(演出がそのまま働く)", promoted, froze);
  is("それでもフォイルは出ない", foils, 0);
}
{
  // 差し替えの目印が残っていないか(SSR を入れた枠が偏っていないか)
  const slots = new Array(10).fill(0);
  let forced = 0;
  for (let i = 0; i < 6000; i++) {
    const ids = drawFirstPull();
    const at = ids.findIndex(isSsr);
    if (ids.filter(isSsr).length === 1) {
      slots[at]++;
      forced++;
    }
  }
  const max = Math.max(...slots), min = Math.min(...slots);
  is("SSR の場所が1か所に偏らない", max < forced * 0.35, true);
  assert.ok(min > 0, `どの枠にも入りうる(${slots.join(",")})`);
}

console.log("\n一度きり・チケットを使わない");
{
  let st = normalize({ tickets: 0 });
  is("はじめは未実施", firstPullDone(st), false);
  st = markFirstPull(applyPull(st, firstPullResult(), { free: true }));
  is("引いたら控えが立つ", firstPullDone(st), true);
  is("チケットは減らない(0 のまま引ける)", st.tickets, 0);
  is("10枚ぶん所持に入る", st.pending.results.length, 10);
  const again = normalize(JSON.parse(JSON.stringify(st)));
  is("保存して読み直しても控えは残る", firstPullDone(again), true);
}
{
  // 通常の10連は今まで通り、フリーズでフォイルに昇格しうる
  const ssrTen = ["angel-j","angel-q","demon-j","demon-k","angel-k","demon-q","zombie-male","elf-male","pirate-male","viking-male"];
  if (!qualifiesForFreeze(ssrTen)) throw new Error("見本がフリーズの条件を満たしていない");
  let foils = 0;
  for (let i = 0; i < 2000; i++)
    if (resolveSummonFreeze(ssrTen).skins.some(isFoil)) foils++;
  is("通常の10連はフォイルに昇格しうる", foils > 0, true);
  let none = 0;
  for (let i = 0; i < 2000; i++)
    if (resolveSummonFreeze(ssrTen, Math.random, { allowFoil: false }).skins.some(isFoil)) none++;
  is("allowFoil:false なら昇格しない", none, 0);
}
is(
  "allowFoil を渡さなければ今まで通り",
  /allowFoil = true/.test(read("src/skins/summon-freeze.js")),
  true,
);

console.log("\nチュートリアルの褒美");
is("1話ごとの枚数", TUTORIAL_TICKETS, 10);
is("3話ぶん", ticketsForCleared([1, 2, 3]), 30);
is("同じ話は二度数えない", ticketsForCleared([1, 1, 1]), 10);
is("終えていなければ0", ticketsForCleared([]), 0);
is("壊れた値は数えない", ticketsForCleared(["a", null, 2]), 10);
is("全12話ぶん", ticketsForCleared(TUTORIALS.map((t) => t.id)), TUTORIALS.length * 10);
is("目印は話ごとに分かれる", rewardEventId("u", 3) !== rewardEventId("u", 4), true);
is("目印に人が入る", rewardEventId("zz9", 3), "tutorial:zz9:3");
is("褒美のある話の上限は、番外を含めたいちばん大きい話の id", TUTORIAL_REWARD_MAX_ID, Math.max(...ALL_TUTORIALS.map((t) => t.id)));
is("話の番号の判定", [1, TUTORIAL_REWARD_MAX_ID, 0, TUTORIAL_REWARD_MAX_ID + 1, 1.5, "3", null].map(isRewardChapter), [true, true, false, false, false, false, false]);
is(
  "古い端末の id から話の番号を取り出す",
  ["tutorial:abc:3", "tutorial:local:12", "tutorial:abc:13", "tutorial:abc:14", "tutorial:abc:0", "tutorial:3", "login:2026-09-30", "tutorial:abc:3:extra", null].map(chapterFromLegacyId),
  [3, 12, 13, null, null, null, null, null, null],
);
is("一言", ticketRewardLabel(30), "ガチャチケット 30枚");
is("0枚なら出さない", ticketRewardLabel(0), null);

console.log("\n配線");
{
  const screens = read("src/ui/screens.jsx");
  // 10連は導入の最後(2026-10-01 本人の指示)。はじめの一局に勝ち → 名前 → **門の語り** → 10連 → ストーリー一覧。
  // 振り分けは src/game/intro.js(tools/check-intro.mjs)
  is(
    "門の語りを終えたら、そのまま10連へ",
    /if \(intro === "gate"\)[\s\S]{0,400}setFirstPullMode\(!0\);[\s\S]{0,200}t\("skins"\);/.test(screens),
    true,
  );
  is(
    "10連から戻るとストーリー一覧へ(手引きの誘い・ホームではない)",
    /if \(firstPullMode\) \{\s*(\/\/[^\n]*\n\s*)*setFirstPullMode\(!1\);\s*showStory\(\);/.test(screens) && !/shouldOfferFirstTutorial/.test(screens),
    true,
  );
  is(
    "10連は門の語りのあとだけ(名前の直後に引かせない)",
    (screens.match(/setFirstPullMode\(!0\)/g) || []).length,
    1,
  );
  is(
    "「門へ進む」は10連がまだの人だけ",
    screens.includes("onGate={firstGame && !firstPullDone(collection) ? () => leaveFirstGame() : null}"),
    true,
  );
  const skins = read("src/ui/skins.jsx");
  is("初回だけの引き方がある", /const rollFirst = async/.test(skins), true);
  is("チケットを使わない", /applyPull\(s, firstPullResult\(\), \{ free: true \}\)/.test(skins), true);
  is("控えを立てる", /markFirstPull\(/.test(skins), true);
  is(
    "すでに引いていれば二度目は出さない",
    /if \(!firstPull \|\| firstPullDone\(collection\)/.test(skins),
    true,
  );
  // はじめての10連の結果(2026-10-01 本人の指示)。導入の最後なので、駒とのつながりと次の一歩を1つだけ
  is("初回の結果だけを見分ける", /const firstResults = firstPull && !!collection\.pending\?\.results;/.test(skins), true);
  is(
    "初回の結果に一行(着せた英雄だけが駒になる)",
    /\{firstResults && \(\s*<p className="skins-first-pull-note">\s*装備した英雄が、次の一局から駒になる。\s*<\/p>/.test(skins),
    true,
  );
  is("初回の結果の釦は「ストーリーへ」", /\{firstResults \? "ストーリーへ" : "結果を確認"\}/.test(skins), true);
  is(
    "閉じたあと呼ぶ側の onBack へ(閉じるのに失敗したら行かない)",
    /const closeFirstResults = async \(\) => \{\s*const next = await closeResults\(\);\s*if \(next && onBack\) onBack\(\);\s*\};/.test(skins),
    true,
  );
  is("初回の結果は、どの閉じ方でも同じ行き先", /const closeShown = firstResults \? closeFirstResults : closeResults;/.test(skins), true);
  {
    // 結果の枠の閉じ方は3つ(外側・Escape の onClose、×、下の釦)。どれも closeShown を通す
    const modal = skins.slice(skins.indexOf('label={resultLabel}'), skins.indexOf("{foilOffer && !shop && ("));
    is("外側・Escape で閉じても同じ", /onClose=\{closeShown\}/.test(modal), true);
    is("×・下の釦も同じ", (modal.match(/onClick=\{closeShown\}/g) || []).length, 2);
    is("結果の枠の中に、行き先を分けない閉じ方が残っていない", /closeResults\}/.test(modal), false);
  }
  is(
    "一行の見た目が用意されている",
    /\.skins-first-pull-note \{/.test(read("src/skins/styles.css")),
    true,
  );
  const col = read("src/skins/collection.js");
  is(
    "控えは normalize を通る(開き直しても消えない)",
    /firstPullDone: value\.firstPullDone === true/.test(col),
    true,
  );
  const game = read("src/ui/game.jsx");
  is("終えたらチケットを配る", /grantTutorialTickets\(\[tutorial\.id\]/.test(game), true);
  is(
    "二度は配らない(終える前に見ておく)",
    /!loadProfile\(\)\.cleared\.includes\(tutorial\.id\)/.test(game),
    true,
  );
  is(
    "飛ばしたときも同じだけ配る",
    (game.match(/grantTutorialTickets\(after\.skipped/g) || []).length >= 2,
    true,
  );
  is(
    "一覧から全部飛ばしたときも配る",
    /grantTutorialTickets\(after\.skipped/.test(read("src/ui/tutorial.jsx")),
    true,
  );
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
