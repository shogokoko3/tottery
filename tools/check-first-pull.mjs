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
  firstPullOpen,
  firstPullResult,
  markFirstPull,
  firstPullCompanion,
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
import { SKINS } from "../src/skins/catalog.js";
import { namePhrases, phrasesOf } from "../src/ui/phrase-split.js";

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
  // 結果を閉じるまでの控え(2026-10-05 見直し)。閉じる前にアプリを閉じた人を、次の起動で結果へ戻す
  is("引いたら「結果をまだ閉じていない」控えも同じ更新で立つ", [st.firstPullOpen, firstPullOpen(st)], [true, true]);
  is("保存して読み直しても「まだ閉じていない」控えは残る(normalize が落とさない)", [again.firstPullOpen, firstPullOpen(again)], [true, true]);
  const closed = normalize({ ...again, pending: null, firstPullOpen: false });
  is("結果を閉じたら控えは下りる(10連の控えは残る)", [firstPullOpen(closed), firstPullDone(closed)], [false, true]);
  is("「まだ閉じていない」控えだけでは立たない(10連の控えと結果が要る)", [normalize({ firstPullOpen: true }).firstPullOpen, firstPullOpen({ firstPullOpen: true, pending: { results: [{ id: "x" }] } })], [false, false]);
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
    /if \(firstPullMode\) \{\s*(\/\/[^\n]*\n\s*)*setFirstPullMode\(!1\);\s*setSkinsFrom\("menu"\);\s*setAfterIntro\(!0\);\s*showStory\(\);/.test(screens) && !/shouldOfferFirstTutorial/.test(screens),
    true,
  );
  // 10連の画面を開くのは2か所: 門の語りのあとと、結果を閉じる前にやめた人の続き("first-pull"。2026-10-05 見直し)
  is(
    "10連は門の語りのあと(と、結果を閉じる前にやめた人の続き)だけ(名前の直後に引かせない)",
    [
      (screens.match(/setFirstPullMode\(!0\)/g) || []).length,
      /if \(step === "first-pull"\) \{[\s\S]{0,200}setFirstPullMode\(!0\)/.test(screens),
    ],
    [2, true],
  );
  is(
    "「門へ進む」は10連がまだの人だけ(一局を始めるときに門へ進むと決めた人。前の版のテスターには出さない。2026-10-06 見直し)",
    screens.includes("onGate={firstGame && firstGate && !firstPullDone(collection) ? () => leaveFirstGame() : null}"),
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
  is("初回は重複整理を出さない", skins.includes("{!firstResults && collection.pending?.results && ("), true);
  is("結果のあと、次の相手の説明まで進める", screens.includes("const next = nextStage(loadProfile());\n                  if (next) openStage(next.axis);"), true);
  const state = { pending: { results: [{ id: "angel-j" }, { id: "pirate-male" }] }, owned: { "angel-j": 1, "pirate-male": 1 }, equipped: { J: "angel-j", 4: "pirate-male" } };
  is("次のステージで使える装備を先に見せる", firstPullCompanion(state, ["2", "3", "4", "5"]).skin.id, "pirate-male");
  is("まだ使わない数字は後の登場として伝える", firstPullCompanion({ ...state, equipped: { J: "angel-j" } }, ["2", "3", "4", "5"]).available, false);
  is("未装備の英雄を装備済みとは呼ばない", firstPullCompanion({ ...state, equipped: {} }).equipped, false);
  is("結果が無ければ英雄の紹介を出さない", firstPullCompanion({}), null);
  is(
    "初回の結果に一行(着せた英雄だけが駒になる)",
    /\{firstResults && \(\s*<p className="skins-first-pull-note">\s*出会った英雄を、あなたの盤へ。\s*<\/p>/.test(skins),
    true,
  );
  is("初回は「次の対局へ」、全クリア済みなら一覧へ", skins.includes('{firstResults ? (nextStory ? "次の対局へ" : "ストーリーへ") : "結果を確認"}'), true);
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
    /firstPullDone: value\.firstPullDone === true/.test(col) && /firstPullOpen: value\.firstPullOpen === true && value\.firstPullDone === true/.test(col),
    true,
  );
  is(
    "召喚の結果を閉じたら「まだ閉じていない」控えも下ろす(skins.jsx の closeResults)",
    /\{ \.\.\.s, pending: null, firstPullOpen: false \}/.test(skins),
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

console.log("\n10連の言葉と折り返し(2026-10-06 見直し)");
{
  const skins = read("src/ui/skins.jsx");
  // 導入の10連(初回の10連)は導入の言葉の調子で。ふつうのガチャはいままでどおり
  is("10連の演出に導入の印(plain)を渡す", /onFinish=\{finishAcquisition\}\s*reduce=\{reduce \|\| collection\.summonMotion === "skip"\}\s*plain=\{firstResults\}/.test(skins), true);
  const plainCopy = ["すべての札が、現れた。", "輝きが、札に宿っていく…", "札を引き寄せて、めくれ。", "札を引き寄せて、めくれ。指でなぞれば、次々に。"];
  is("10連の演出の文(導入): です・ます調を使わない", plainCopy.every((t) => skins.includes(`"${t}"`)) && plainCopy.every((t) => !/です|ます|ください/.test(t)), true);
  is(
    "ふつうのガチャの演出の文はいままでどおり",
    ["すべての札が現れました。", "札に宿る輝きをお待ちください。", "札を引き寄せてめくるか、指でなぞって次々にめくれます。"].every((t) => skins.includes(`"${t}"`)),
    true,
  );
  is("10連の結果の印は「装備した」(ふつうのガチャは「装備しました」)", /\{firstResults \? "装備した" : "装備しました"\}/.test(skins), true);
  // 札の名は「の」と空白のあとで句に切る(4列の狭い列で「黄昏のレヴナン/ト」と割れた)
  const names = [...new Set(SKINS.map((s) => s.name))];
  const em = (t) => [...t.trim()].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
  is(`札の名(${names.length})は句をつなぐと名と同じ`, names.filter((n) => namePhrases(n).join("") !== n), []);
  is("札の名の句はどれも全角6字ぶんまで(320 幅の4列に入る)", names.flatMap((n) => namePhrases(n)).filter((p) => em(p) > 6), []);
  is("「黄昏のレヴナント」は「黄昏の」「レヴナント」・「癒天使 ラファエル」は「癒天使 」「ラファエル」", [namePhrases("黄昏のレヴナント"), namePhrases("癒天使 ラファエル")], [["黄昏の", "レヴナント"], ["癒天使 ", "ラファエル"]]);
  is("結果の札の名と、盤上の姿の名は句の塊で出す", (skins.match(/<Phrases text=\{namePhrases\((s|companion\.skin)\.name\)\} \/>/g) || []).length, 2);
  is(
    "盤上の姿の一行は句で折り返す(「3 に装備済み。」「手札に来たら、」「陣に加えよう。」)",
    phrasesOf("3 に装備済み。手札に来たら、陣に加えよう。"),
    ["3 に装備済み。", "手札に来たら、", "陣に加えよう。"],
  );
  // 演出の札の名を、所持の札(通常×1・箔—)の上へ上げる(名が所持の札の後ろに隠れていた)
  is(
    "演出の札の名は所持の札の上(所持の札は下端のまま)",
    /\.reveal-front:has\(\.reveal-owned\) \.reveal-name \{[^}]*padding-bottom: calc\(4% \+ 18px\);/.test(read("src/skins/styles.css")) && /\.reveal-owned \{\s*position: absolute;\s*left: 4%;\s*right: 4%;\s*bottom: 3%;/.test(read("src/skins/styles.css")),
    true,
  );
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
