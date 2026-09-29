/**
 * はじめての10連と、チュートリアルの褒美(2026-09-28 本人の指示)を確かめる。
 *
 *   - 名前を決めた直後、チュートリアルより先に10連を引く
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
  // 名前 → **語り** → 10連(2026-09-28 本人の指示で、あいだに語りが入った)
  is(
    "名前を決めたら、チュートリアルより先に語りへ",
    /if \(!firstPullDone\(getCollection\(\)\)\) \{[\s\S]{0,120}setPrologue\(!0\);/.test(screens),
    true,
  );
  is(
    "語りを終えたら、そのまま10連へ",
    /if \(prologue\)[\s\S]{0,400}setFirstPullMode\(!0\);[\s\S]{0,200}t\("skins"\);/.test(screens),
    true,
  );
  is("10連から戻るときに第1話へ誘う", /if \(firstPullMode\) \{/.test(screens), true);
  const skins = read("src/ui/skins.jsx");
  is("初回だけの引き方がある", /const rollFirst = async/.test(skins), true);
  is("チケットを使わない", /applyPull\(s, firstPullResult\(\), \{ free: true \}\)/.test(skins), true);
  is("控えを立てる", /markFirstPull\(/.test(skins), true);
  is(
    "すでに引いていれば二度目は出さない",
    /if \(!firstPull \|\| firstPullDone\(collection\)/.test(skins),
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
