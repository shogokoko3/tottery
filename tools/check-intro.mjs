/**
 * 導入の振り分け(src/game/intro.js。2026-10-01 本人の指示)を確かめる。
 *
 *   タイトル → 語り2枚 → はじめの一局 → 結果 → 名前 → 門の語り → 10連 → ストーリー一覧
 *
 * 見ること:
 *   A. 次に出す段(introStep)の表。いまのテスター・前の版のテスター(10連の控えなし)・合言葉つき・中断・
 *      フェーズ2 の人・壊れた記録
 *   B. 本物の記録(profile.js の recordGame・saveName、collection の markFirstPull)で導入を通す。
 *      どこでやめても、次の起動で続きへ戻る(前へ戻らない・名前と10連をくり返さない)。
 *      10連の結果を閉じる前にやめた人は、結果へ戻る("first-pull")
 *   C. はじめの一局をストーリーとして渡す形(firstGameStory)と、ストーリー1つ目の行き先(firstGameStage)
 *   D. 称号の知らせを止める場面(introHoldsTitles)・導入のあとの件数(introTitleQuota)と、語り・導入を始めた控え
 *   E. 画面(screens.jsx)の配線: タイトル・語り・名前(結果の上・戻る)・門の語り・10連・一覧・はじめの一局の出入り・
 *      ガチャの戻り先
 */
import assert from "node:assert/strict";
import fs from "node:fs";

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

// profile.js は localStorage を読むので、先に偽物を置く
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.window.dispatchEvent) globalThis.window.dispatchEvent = () => true;
if (!globalThis.window.addEventListener) globalThis.window.addEventListener = () => {};

const {
  AFTER_INTRO_TITLES,
  INTRO_STEPS,
  earlierTester,
  firstGameDone,
  firstGameStage,
  firstGameStory,
  gateAfterFirstGame,
  introHoldsTitles,
  introStarted,
  introStep,
  introTitleQuota,
  markIntroStarted,
  markPrologueSeen,
  prologueSeen,
} = await import("../src/game/intro.js");
const { FIRST_GAME } = await import("../src/game/tutorial.js");
const { STORY_AXES, stageSize } = await import("../src/game/phase.js");
const { STORY_XP, stageOf } = await import("../src/game/story.js");
const { firstPullDone, firstPullOpen, firstPullResult, markFirstPull } = await import("../src/skins/first-pull.js");
const { applyPull, normalize: normalizeCollection } = await import("../src/skins/collection.js");
const { loadProfile, recordGame, resetAccount, saveName } = await import("../src/game/profile.js");
const { isRewardChapter } = await import("../src/game/tutorial-reward.js");

const story = (p1 = [], extra = {}) => ({ name: "", phase: 1, story: { 1: p1, 2: [], 3: [] }, ...extra });
const pulled = { firstPullDone: true };
const fresh = {};

console.log("A. 次に出す段");
is("段は5つ(語り・一局・名前・門の語り・10連の結果の続き)", [...INTRO_STEPS], ["prologue", "first-game", "name", "gate", "first-pull"]);
is("はじめての人は語りから", introStep({ profile: story(), collection: fresh }), "prologue");
is("語りを見たら、はじめの一局", introStep({ profile: story(), collection: fresh, prologueSeen: true }), "first-game");
is("一局に勝って名前が無ければ、名前", introStep({ profile: story(["23"]), collection: fresh, prologueSeen: true }), "name");
is("名前を決めたら、門の語り", introStep({ profile: story(["23"], { name: "しょうご" }), collection: fresh, prologueSeen: true }), "gate");
is("10連まで済めば導入は終わり", introStep({ profile: story(["23"], { name: "しょうご" }), collection: pulled, prologueSeen: true }), null);
is(
  "いまのテスター(名前あり・10連済み・二と三の王は未クリア)は導入を通さない",
  introStep({ profile: story([], { name: "テスター" }), collection: pulled }),
  null,
);
is("名前が無くても10連が済んでいれば導入を通さない(名前は名前の壁が聞く)", introStep({ profile: story(), collection: pulled }), null);
is(
  "名前はあるが10連がまだ(前の版で語りの途中でやめた人)は、語り → 一局 → 門の語り(名前は聞き直さない)",
  [
    introStep({ profile: story([], { name: "前の版" }), collection: fresh }),
    introStep({ profile: story([], { name: "前の版" }), collection: fresh, prologueSeen: true }),
    introStep({ profile: story(["23"], { name: "前の版" }), collection: fresh, prologueSeen: true }),
  ],
  ["prologue", "first-game", "gate"],
);
{
  // 前の版から遊んでいるテスター(2026-10-05 見直し)。10連の控えは 2026-09-28 に入り、その版は名前を決めた
  // 直後にしか立てなかった。名前あり・遊んだ跡あり・控えなし・この端末で導入を始めていない人は導入を通さない
  const old = (p1 = [], extra = {}) => story(p1, { name: "古いテスター", plays: 40, cleared: [1, 2, 3], ...extra });
  const traces = { draws: 31 };
  is("前の版のテスター(名前あり・40局・3話クリア・31回引いた・10連の控えなし)は導入を通さない", introStep({ profile: old(), collection: traces }), null);
  is("前の版のテスターで二と三の王をクリア済みでも門(無料10連)を出さない", introStep({ profile: old(["23"]), collection: traces }), null);
  is("前の版のテスターでフェーズ2 でも門を出さない", introStep({ profile: { ...old(), phase: 2 }, collection: traces }), null);
  is(
    "遊んだ跡は対局・チュートリアルのクリア・ガチャのどれか1つでよい",
    [
      earlierTester({ profile: story([], { name: "a", plays: 1 }), collection: fresh }),
      earlierTester({ profile: story([], { name: "a", cleared: [1] }), collection: fresh }),
      earlierTester({ profile: story([], { name: "a" }), collection: { draws: 1 } }),
      earlierTester({ profile: story([], { name: "a" }), collection: fresh }),
    ],
    [true, true, true, false],
  );
  is("名前が無ければ前の版の人とみない(前の版は起動してすぐ名前を聞いていた)", earlierTester({ profile: story([], { plays: 5 }), collection: traces }), false);
  is(
    "この端末で導入を始めた人(語りを見た・合言葉で来た)は、遊んだ跡が付いても導入の続きへ",
    [
      introStep({ profile: story(["23"], { name: "新しい人", plays: 1 }), collection: fresh, prologueSeen: true }),
      introStep({ profile: story([], { name: "合言葉の人", plays: 3 }), collection: fresh, introStarted: true }),
    ],
    ["gate", "prologue"],
  );
}
{
  // 勝ったら導入の続き(門へ進む)へ進むか(2026-10-06 見直し)。一局を始めるときに決める。introStep と同じ決まり
  const old = story([], { name: "古いテスター", plays: 40, cleared: [1, 2, 3] });
  is(
    "門へ進むのは、はじめての人(語りを見た)・合言葉で来た人・名前のまだ無い人だけ",
    [
      gateAfterFirstGame({ profile: story(), collection: fresh, prologueSeen: true }),
      gateAfterFirstGame({ profile: story([], { name: "合言葉の人", plays: 3 }), collection: fresh, introStarted: true }),
      gateAfterFirstGame({ profile: story([], { plays: 2 }), collection: fresh }),
    ],
    [true, true, true],
  );
  is(
    "10連の済んだ人(いまのテスター)・前の版のテスターには門を出さない(ストーリーから台本の一局に勝っても)",
    [
      gateAfterFirstGame({ profile: story([], { name: "テスター", plays: 9 }), collection: pulled, prologueSeen: true }),
      gateAfterFirstGame({ profile: old, collection: { draws: 31 } }),
      gateAfterFirstGame({ profile: old, collection: fresh }),
    ],
    [false, false, false],
  );
  is(
    "前の版のテスターは、タイトルからも(introStep)、ストーリーの一局からも(gateAfterFirstGame)門へ行かない",
    [introStep({ profile: story(["23"], { ...old }), collection: fresh }), gateAfterFirstGame({ profile: old, collection: fresh })],
    [null, false],
  );
}
for (const p of [story(), story(["23"]), story(["23"], { name: "x" }), story([], { name: "x" })])
  is(
    `合言葉つきの起動・中断した起動は押し付けない(${JSON.stringify([p.name, p.story[1]])})`,
    [introStep({ profile: p, collection: fresh, room: true }), introStep({ profile: p, collection: fresh, deferred: true })],
    [null, null],
  );
is(
  "フェーズ2 の人(フェーズ1 を全部クリア済み)は一局を済んだものとする(台本の一局はフェーズ1 だけ)",
  [
    introStep({ profile: { name: "", phase: 2, story: { 1: [], 2: [], 3: [] } }, collection: fresh }),
    introStep({ profile: { name: "x", phase: 2, story: { 1: [], 2: [], 3: [] } }, collection: fresh }),
  ],
  ["name", "gate"],
);
is("壊れた記録・空でも落ちない(はじめから)", [introStep({ profile: null, collection: null }), introStep()], ["prologue", "prologue"]);
is("記録の story が壊れていても落ちない", introStep({ profile: { phase: 1, story: { 1: ["zz", 3] } }, collection: fresh, prologueSeen: true }), "first-game");
is("フェーズ2 の二と三の王のクリアは、はじめの一局に数えない", firstGameDone({ phase: 1, story: { 1: [], 2: ["23"], 3: [] } }), false);
{
  // 返す段は INTRO_STEPS か null だけ(画面が知らない段を返さない)
  const seen = new Set();
  const opened = { firstPullDone: true, firstPullOpen: true, pending: { results: [{ id: "x", isNew: true }] } };
  for (const name of ["", "x"])
    for (const p1 of [[], ["23"], ["45"], [...STORY_AXES]])
      for (const phase of [1, 2, 3])
        for (const col of [fresh, pulled, opened, { draws: 3 }])
          for (const plays of [0, 4])
            for (const pr of [false, true])
              for (const started of [false, true])
                for (const room of [false, true])
                  for (const deferred of [false, true])
                    seen.add(introStep({ profile: { name, phase, plays, story: { 1: p1, 2: [], 3: [] } }, collection: col, prologueSeen: pr, introStarted: started, room, deferred }));
  is("返すのは5つの段か null だけ(全組)", [...seen].every((s) => s === null || INTRO_STEPS.includes(s)), true);
  is("5つの段がどれも起こりうる", INTRO_STEPS.every((s) => seen.has(s)), true);
}

console.log("\nB. 本物の記録で導入を通す(どこでやめても続きへ)");
{
  resetAccount();
  mem.clear();
  let collection = {};
  let seenPrologue = false;
  // 起動するたびの段。語りを見たかは端末の控え(ここでは関数の外に持つ)
  const launch = () => introStep({ profile: loadProfile(), collection, prologueSeen: seenPrologue });
  const walked = [];
  const points = [];
  for (let guard = 0; guard < 10; guard++) {
    const step = launch();
    // 同じ所でやめて開き直しても、同じ段に戻る
    points.push([step, launch()]);
    if (!step) break;
    walked.push(step);
    if (step === "prologue") seenPrologue = true;
    else if (step === "first-game") {
      // game.jsx と同じ形で記録する(台本とストーリーを同時に受けたら、ストーリーとして。チュートリアルは付けない)
      const s = firstGameStory();
      recordGame(true, { online: false, matchId: null, kingRank: "4", deferXpNotice: true, xp: STORY_XP, story: { axis: s.axis, phase: s.phase } });
    } else if (step === "name") saveName("しょうご");
    else if (step === "gate") collection = markFirstPull(collection);
  }
  is("段は語り → 一局 → 名前 → 門の語り の順に一度ずつ", walked, ["prologue", "first-game", "name", "gate"]);
  is("どこでやめても、開き直すと同じ段(続き)に戻る", points.every(([a, b]) => a === b), true);
  is("終えたあとは何度開いても導入は出ない", [launch(), launch()], [null, null]);
  const after = loadProfile();
  is("一局はストーリー「二と三の王」のクリアとして残る", after.story[1], ["23"]);
  is("チュートリアルの話としては残らない(話のチケットの道に乗らない)", after.cleared, []);
  is("台本の id は話の番号ではない(チュートリアルの褒美の道に送れない)", isRewardChapter(FIRST_GAME.id), false);
  is("一局の経験値はステージのもの(STORY_XP)", after.xp, STORY_XP);
  is("名前と10連の控えが残る", [after.name, firstPullDone(collection)], ["しょうご", true]);
}
{
  // 一局を中断した: その起動のあいだは押し付けない。次の起動で一局から(語りはもう出さない)
  resetAccount();
  const profile = loadProfile();
  is("中断した起動はタイトルからホームへ", introStep({ profile, collection: {}, prologueSeen: true, deferred: true }), null);
  is("次の起動で、はじめの一局から", introStep({ profile, collection: {}, prologueSeen: true }), "first-game");
}
{
  // 合言葉つきで開いた人: その起動は名前を聞いて部屋へ。次の起動で導入(名前は聞き直さない)。
  // 部屋で遊んだあと(遊んだ跡が付いても)、前の版のテスターとは見分ける(導入を始めた控え。2026-10-05 見直し)
  resetAccount();
  is("合言葉つきの起動は導入を出さない", introStep({ profile: loadProfile(), collection: {}, room: true }), null);
  const m = new Map();
  const st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  markIntroStarted(st);
  saveName("合言葉の人");
  recordGame(true, { online: true, matchId: "room-1", deferXpNotice: true });
  is("部屋で遊ぶと遊んだ跡が付く", loadProfile().plays, 1);
  is("控えが無ければ、前の版のテスターと見分けられない(導入を通さない)", introStep({ profile: loadProfile(), collection: {} }), null);
  is("控えは端末に残る(語りを見た控えとは別の値。語りはまだ出す)", [m.get("tottery.intro.v1"), prologueSeen(st)], ["room", false]);
  const steps = [];
  let collection = {};
  let seen = false;
  for (let g = 0; g < 8; g++) {
    const step = introStep({ profile: loadProfile(), collection, prologueSeen: seen, introStarted: introStarted(st) });
    if (!step) break;
    steps.push(step);
    if (step === "prologue") seen = true;
    if (step === "first-game") recordGame(true, { deferXpNotice: true, xp: STORY_XP, story: { axis: "23", phase: 1 } });
    if (step === "gate") collection = markFirstPull(collection);
  }
  is("次の起動の導入は 語り → 一局 → 門の語り(名前は飛ばす)", steps, ["prologue", "first-game", "gate"]);
  // markPrologueSeen はこの起動の控えも立てる(D の「はじめは語りを見ていない」が崩れる)ので、端末の控えだけを置く
  st.setItem("tottery.intro.v1", "prologue");
  is("語りを見た控えは、合言葉の控えで上書きしない", (markIntroStarted(st), m.get("tottery.intro.v1")), "prologue");
}
{
  // 10連の結果を閉じる前にアプリを閉じた人(2026-10-05 見直し)。skins.jsx の rollFirst と同じ形で引く
  // (markFirstPull(applyPull(...)) を1回の更新で保存する)。保存の形は normalizeCollection を通す
  const profile = story(["23"], { name: "しょうご", plays: 1 });
  let col = normalizeCollection(markFirstPull(applyPull(normalizeCollection({}), firstPullResult(() => 0.5), { free: true })));
  is("引いた直後に閉じて開き直すと、10連の結果へ戻る", [introStep({ profile, collection: col, prologueSeen: true }), firstPullOpen(col)], ["first-pull", true]);
  is("結果へ戻る段は、合言葉つき・中断の起動では出さない", [introStep({ profile, collection: col, room: true }), introStep({ profile, collection: col, deferred: true })], [null, null]);
  const kept = col.pending.results;
  // 結果を閉じた(skins.jsx の closeResults と同じ: 結果と控えを下ろす)
  col = normalizeCollection({ ...col, pending: null, firstPullOpen: false });
  is("結果を閉じたあとは導入を出さない", [introStep({ profile, collection: col, prologueSeen: true }), firstPullDone(col)], [null, true]);
  // ふつうのガチャの結果を残して閉じた人(10連の控えはあるが、まだ閉じていない控えは無い)
  const normal = normalizeCollection({ ...col, pending: { results: kept } });
  is("ふつうのガチャの結果が残っているだけなら、導入を出さない", [introStep({ profile, collection: normal, prologueSeen: true }), !!normal.pending], [null, true]);
  is("控えだけ残って結果が無ければ(ふつうの画面で閉じた)、戻さない", firstPullOpen({ firstPullDone: true, firstPullOpen: true, pending: null }), false);
}

{
  // 前の版のテスター(10連の控えなし・名前あり・遊んだ跡あり)が、ホームからストーリーの二と三の王を開いた(2026-10-06 見直し)。
  // 台本の一局にはなるが、勝っても門(無料10連)へ進まない。一局を始めるときの答えと、勝ったあとの答えが同じ
  resetAccount();
  mem.clear();
  saveName("古いテスター");
  for (let g = 0; g < 3; g++) recordGame(true, { online: false, matchId: null, deferXpNotice: true });
  const col = { draws: 12 };
  // 端末の控えは無い(語りを見ていない・合言葉で来ていない)。introStarted() はこの起動の控えも見るので、
  // 上の合言葉の通しの影響を受けないよう、値で渡す
  const real = () => ({ profile: loadProfile(), collection: col, prologueSeen: false, introStarted: false });
  is("前の版のテスター: タイトルからはホームへ", introStep(real()), null);
  is("前の版のテスター: ストーリー1つ目は台本の一局", firstGameStage(loadProfile(), "23"), true);
  const before = gateAfterFirstGame(real());
  const s = firstGameStory();
  recordGame(true, { online: false, matchId: null, kingRank: "4", deferXpNotice: true, xp: STORY_XP, story: { axis: s.axis, phase: s.phase } });
  is("前の版のテスター: 始めるときも勝ったあとも、門へ進まない", [before, gateAfterFirstGame(real()), introStep(real())], [false, false, null]);
  // はじめての人は、勝つ前に決めた答えのまま門へ(勝って遊んだ跡が付いても変わらない)
  resetAccount();
  mem.clear();
  const fresh1 = () => ({ profile: loadProfile(), collection: {}, prologueSeen: true, introStarted: true });
  const start = gateAfterFirstGame(fresh1());
  recordGame(true, { online: false, matchId: null, kingRank: "4", deferXpNotice: true, xp: STORY_XP, story: { axis: s.axis, phase: s.phase } });
  is("はじめての人: 始めるときも勝ったあとも門へ進む(名前 → 門の語り)", [start, gateAfterFirstGame(fresh1()), introStep(fresh1())], [true, true, "name"]);
}

console.log("\nC. はじめの一局をストーリーとして渡す・ストーリー1つ目の行き先");
{
  const s = firstGameStory();
  const king = FIRST_GAME.deck.find((c) => c.id === FIRST_GAME.foe.kingId);
  is("軸は台本の storyAxis(二と三)", s.axis, FIRST_GAME.storyAxis);
  is("フェーズは台本のもの(1)", s.phase, FIRST_GAME.phase);
  is("盤は台本の 5×5(フェーズ1 のステージと同じ)", [s.size, s.size === stageSize(1)], [FIRST_GAME.boardSize, true]);
  is("相手の王は台本の王(3♦)", [s.king, `${king.rank}${king.suit}`], ["3", "3diamond"]);
  is("席の名前はステージの名", s.title, `${stageOf("23").name}の王`);
  is("渡す形は凍らせてある", Object.isFrozen(s), true);
  is("フェーズ1 で二と三の王が未クリアなら、ストーリー1つ目は台本の一局", firstGameStage(story(), "23"), true);
  is("ほかのステージはいつもどおり", STORY_AXES.filter((a) => a !== "23").some((a) => firstGameStage(story(), a)), false);
  is("2回目(クリア済み)からは説明と CPU 戦", firstGameStage(story(["23"]), "23"), false);
  is("いまのテスター(10連済み)でも未クリアなら台本の一局", firstGameStage(story([], { name: "テスター" }), "23"), true);
  is("フェーズ2・3 の二と三の王は台本にしない", [firstGameStage({ phase: 2, story: { 1: [], 2: [], 3: [] } }, "23"), firstGameStage({ phase: 3, story: { 1: [], 2: [], 3: [] } }, "23")], [false, false]);
}

console.log("\nD. 称号の知らせを止める場面・語りを見たかの控え");
{
  is("語り・名前・門の語りのあいだは止める", ["prologue", "name", "gate"].map((intro) => introHoldsTitles({ intro, screen: "home" })), [true, true, true]);
  is("はじめの一局のあいだは止める", introHoldsTitles({ screen: "game", firstGame: true }), true);
  is("初回の10連のあいだは止める", introHoldsTitles({ screen: "skins", firstPull: true }), true);
  is("ストーリー一覧に着いたら放す", introHoldsTitles({ screen: "story" }), false);
  is("相手の紹介の上には称号通知を重ねない", introHoldsTitles({ screen: "story", stageIntro: "45" }), true);
  is("ほかの対局・ふつうのガチャでは止めない", [introHoldsTitles({ screen: "game" }), introHoldsTitles({ screen: "skins" }), introHoldsTitles({})], [false, false, false]);
  is("10連の印が残っていても、ガチャの画面でなければ止めない", introHoldsTitles({ screen: "story", firstPull: true }), false);
  // 導入を終えたあと(10連を閉じてから、この起動でホームを開くまで。2026-10-05 見直し)
  is("導入を終えたあとの次の対局(四と五の王)のあいだは止める", introHoldsTitles({ screen: "game", afterIntro: true }), true);
  is("導入を終えたあとでも、一覧では止めない(件数で絞る)。紹介のあいだは止める", [introHoldsTitles({ screen: "story", afterIntro: true }), introHoldsTitles({ screen: "story", afterIntro: true, stageIntro: "45" })], [false, true]);
  is("導入を終えたあと、一覧では1件だけ", [AFTER_INTRO_TITLES, introTitleQuota({ afterIntro: true, screen: "story" })], [1, 1]);
  is("導入を終えたあとの件数は、対局・ほかの画面でも同じ1件(画面を移っても数え直さない)", ["game", "skins", "tutorial"].map((screen) => introTitleQuota({ afterIntro: true, screen })), [1, 1, 1]);
  is("ホーム(menu)を開いたら数えない(残りを全部出す)", introTitleQuota({ afterIntro: true, screen: "menu" }), null);
  is("導入を終えたあとでなければ数えない", [introTitleQuota({ screen: "story" }), introTitleQuota()], [null, null]);
  const m = new Map();
  const st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  is("はじめは語りを見ていない", prologueSeen(st), false);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  is("読めない端末では見たことにする(毎回語りが出るより、盤へ進む)", prologueSeen(broken), true);
  markPrologueSeen(st);
  is("見たら控えが残る(tottery. で始まる鍵。全部消すと一緒に消える)", [prologueSeen(st), [...m.keys()].every((k) => k.startsWith("tottery."))], [true, true]);
  const full = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  markPrologueSeen(full);
  is("書き込めない端末でも、見たあとは同じ起動のあいだ出さない", prologueSeen(full), true);
  is("読めない端末では導入を始めたことにする(導入の途中の人を外へ出さない)", introStarted(broken), true);
}

console.log("\nE. 画面の配線(screens.jsx)");
{
  const screens = read("src/ui/screens.jsx");
  const fn = (name) => {
    const at = screens.indexOf(`function ${name}(`);
    return at < 0 ? "" : screens.slice(at, screens.indexOf("\n  }\n", at) + 4);
  };
  // 前は if (!named) return (<NameSetupScreen …>) でタイトルより先に名前を聞いていた
  is("起動してすぐ名前を聞かない(名前の画面がタイトルより先に出ない)", /if \(!named\)\s*return\s*\(/.test(screens), false);
  is("名前の画面は2か所だけ(勝ったあと(結果の上とタイトルからの続きで同じもの)・名前の壁。合言葉つきの起動も名前の壁)", (screens.match(/<NameSetupScreen\b/g) || []).length, 2);
  is("タイトルの「ゲームスタート」は導入の続きへ", screens.includes("home: <HomeScreen onStart={startFromTitle} />"), true);
  is(
    "タイトルからの振り分けは introStep(語り・導入を始めた控え・合言葉・中断を渡す)。済んでいればホーム",
    /introStep\(\{\s*profile: loadProfile\(\),\s*collection: getCollection\(\),\s*prologueSeen: prologueSeen\(\),\s*(\/\/[^\n]*\n\s*)*introStarted: introStarted\(\),\s*room: !!pendingRoom,\s*deferred: introDeferred,\s*\}\);\s*if \(step\) goIntro\(step\);\s*else t\("menu"\);/.test(fn("startFromTitle")),
    true,
  );
  // roomFromLocation は読んだ合言葉を URL から消す。2回呼ぶと2回目が空になり、部屋へ行けなくなる(画面で確かめて見つけた)
  is("合言葉は起動で1回だけ読む", (screens.match(/roomFromLocation\(\)/g) || []).length, 1);
  is("合言葉つきで開いた起動は、導入を押し付けない", /\[pendingRoom, setPendingRoom\] = \(0, useState\)\(\(\) => roomFromLocation\(\)\),\s*(\/\/[^\n]*\n\s*)*\[introDeferred, setIntroDeferred\] = \(0, useState\)\(\(\) => !!pendingRoom\)/.test(screens), true);
  is("合言葉つきで開いたらすぐ部屋へ(名前が無ければ名前の壁が先)", /useEffect\(\(\) => \{\s*if \(pendingRoom\) t\("room"\);\s*\}, \[pendingRoom\]\);/.test(screens), true);
  is("合言葉つきで開いた名前のまだ無い人には、導入を始めた控えを残す(起動で一度)", /useEffect\(\(\) => \{\s*if \(pendingRoom && !hasName\(\)\) markIntroStarted\(\);\s*\}, \[\]\);/.test(screens), true);
  is(
    "語りを読み終えたら(読み飛ばしても)控えを残して、はじめの一局へ",
    /if \(intro === "prologue"\)[\s\S]{0,200}<Prologue\s+kind="intro"\s+onDone=\{\(\) => \{\s*markPrologueSeen\(\);\s*startFirstGame\(\);/.test(screens),
    true,
  );
  is(
    "勝ったあとの名前は「はじめての勝利」の形。戻れる。決めたら導入の続き(門の語り)へ",
    /const introName = \(onCancel\) => \(\s*<NameSetupScreen\s+afterWin\s+onCancel=\{onCancel\}\s+onDone=\{\(\) => \{\s*setNamed\(!0\);\s*setNaming\(!1\);\s*const step = introStep\(\{ profile: loadProfile\(\), collection: getCollection\(\), prologueSeen: true \}\);\s*if \(step\) goIntro\(step\);\s*else showStory\(\);/.test(screens),
    true,
  );
  is(
    "タイトルから続けた名前の画面は「戻る」(と上の「トッタリー」)でタイトルへ",
    /if \(intro === "name"\)\s*return \(\s*<GameShell showRules=\{l\} setShowRules=\{n\} onHome=\{\(\) => \(setIntro\(null\), t\("home"\)\)\}>\s*\{introName\(\(\) => \(setIntro\(null\), t\("home"\)\)\)\}/.test(screens),
    true,
  );
  is(
    "結果の「門へ進む」からの名前は、結果の上に重ねる(対局を外さない。「戻る」で結果へ)",
    /if \(step === "name"\) \{\s*setNaming\(!0\);\s*return;\s*\}/.test(fn("leaveFirstGame")) &&
      /cover=\{\s*firstGame && naming \? \(\s*<div className="modal-overlay intro-name-cover">\{introName\(\(\) => setNaming\(!1\)\)\}<\/div>\s*\) : null\s*\}/.test(screens),
    true,
  );
  is("対局は結果の上に cover を出す(GameShell の中。色の決まりが付く)", /\{a\.phase === "gameover" && cover\}\s*<\/div>\s*<\/GameShell>/.test(read("src/ui/game.jsx")), true);
  is(
    "門の語りのあとは初回の10連(戻り先はストーリー)",
    /if \(intro === "gate"\)[\s\S]{0,200}<Prologue\s+kind="gate"\s+onDone=\{\(\) => \{\s*setIntro\(null\);\s*setFirstPullMode\(!0\);\s*setSkinsTab\("gacha"\);\s*setSkinsFrom\("story"\);\s*t\("skins"\);/.test(screens),
    true,
  );
  is(
    "10連の結果を閉じたら、次の相手を紹介。未クリアがなければ一覧へ(ガチャの戻り先は menu に戻し、称号は1件だけに)",
    /if \(firstPullMode\) \{\s*(\/\/[^\n]*\n\s*)*setFirstPullMode\(!1\);\s*setSkinsFrom\("menu"\);\s*setAfterIntro\(!0\);\s*showStory\(\);\s*const next = nextStage\(loadProfile\(\)\);\s*if \(next\) openStage\(next.axis\);\s*return;\s*\}/.test(screens),
    true,
  );
  is(
    "10連の結果の続き(first-pull)は、初回の10連の画面を結果から開く(戻り先は menu)",
    /if \(step === "first-pull"\) \{\s*\(u\(null\), m\(!1\), setTut\(null\), setStory\(null\), setStoryIntro\(null\), setIntro\(null\)\);\s*\(setFirstPullMode\(!0\), setSkinsTab\("gacha"\), setSkinsFrom\("menu"\), t\("skins"\)\);\s*return;\s*\}/.test(fn("goIntro")),
    true,
  );
  is(
    "ホーム・ミッション・バトルパスからのガチャは、戻り先を決めてから開く(ストーリー・ショップを引きずらない)",
    (screens.match(/onSkins=\{\(\) => \(setSkinsFrom\("menu"\), t\("skins"\)\)\}/g) || []).length === 3 && !/onSkins=\{\(\) => t\("skins"\)\}/.test(screens),
    true,
  );
  {
    // ガチャを開く所(t("skins"))はどれも、同じ文の中か直前で戻り先(setSkinsFrom)を決める
    const opens = [...screens.matchAll(/t\("skins"\)/g)].map((hit) => screens.slice(Math.max(0, hit.index - 160), hit.index));
    is(`ガチャを開く所(${opens.length} か所)はどれも戻り先を決める(門の語り・続き・ショップ・ホーム・ミッション)`, opens.every((before) => /setSkinsFrom\("(story|shop|menu)"\)[^;]*;?\s*(t\("skins"|$)|setSkinsFrom\("(story|shop|menu)"\)[\s\S]{0,40}$/.test(before)), true);
  }
  is("ストーリー一覧から開くステージは openStage", /<StoryScreen\s+onBack=\{\(\) => t\("menu"\)\}\s+onStart=\{openStage\}/.test(screens), true);
  is(
    "物語を読んだあとの初回2・3は、これまでどおり台本の一局",
    /if \(firstGameStage\(loadProfile\(\), axis\)\) \{\s*startFirstGame\(\);\s*return;\s*\}/.test(fn("startStory")),
    true,
  );
  is(
    "はじめの一局は台本と story を同時に渡す(相手の装備・エリアは持ち越さない)",
    /setCpuSkins\(\{\}\), setCpuArea\(null\), setRound\(0\), setIntro\(null\),\s*setTut\(FIRST_GAME\), setStory\(firstGameStory\(\)\), m\(!0\), r\("game"\), t\("game"\)/.test(fn("startFirstGame")),
    true,
  );
  is(
    "一局を離れるとき: 勝っていて門へ進むと決めた人は導入の続き、中断ならこの起動のあいだ押し付けない",
    /if \(firstGameDone\(profile\)\) \{\s*(\/\/[^\n]*\n\s*)*const step = firstGate \? introStep\(\{ profile, collection: getCollection\(\), prologueSeen: true \}\) : null;\s*(\/\/[^\n]*\n\s*)*if \(step === "name"\) \{\s*setNaming\(!0\);\s*return;\s*\}\s*if \(step\) \{\s*goIntro\(step\);\s*return;\s*\}\s*\} else setIntroDeferred\(!0\);/.test(fn("leaveFirstGame")),
    true,
  );
  is("導入の段へ出るときは対局の後片付けをする", /\(u\(null\), m\(!1\), setTut\(null\), setStory\(null\), setStoryIntro\(null\), setIntro\(step\), t\("home"\)\)/.test(fn("goIntro")), true);
  is("一局の段は台本の一局を始める", /if \(step === "first-game"\) \{\s*startFirstGame\(\);/.test(fn("goIntro")), true);
  is("はじめの一局を見分ける", screens.includes("const firstGame = tut === FIRST_GAME;"), true);
  is(
    "結果のどの釦・中断・上の「トッタリー」でも leaveFirstGame を通す",
    screens.includes("onTutorialList={firstGame ? () => leaveFirstGame() : story ? showStory : showTutorials}") &&
      screens.includes("onExit={firstGame ? () => leaveFirstGame() : tut ? s : story ? showStory : backToMatching}") &&
      screens.includes('onHome={firstGame ? () => leaveFirstGame("menu") : goMenu}'),
    true,
  );
  is(
    "「門へ進む」は10連がまだの人で、一局を始めるときに導入の続きへ進むと決めた人だけ(前の版のテスターには出さない)",
    screens.includes("onGate={firstGame && firstGate && !firstPullDone(collection) ? () => leaveFirstGame() : null}"),
    true,
  );
  is(
    "一局を始めるときに、門へ進むかを本物の控え(語り・導入を始めた控え)で決める",
    /setFirstGate\(\s*gateAfterFirstGame\(\{ profile: loadProfile\(\), collection: getCollection\(\), prologueSeen: prologueSeen\(\), introStarted: introStarted\(\) \}\),\s*\);/.test(fn("startFirstGame")),
    true,
  );
  is("はじめの一局はもう一度を出さない(作り直すと台本の盤にならない)", screens.includes("onRetryStory={story && !tut ? () => (showStory(), openStage(story.axis)) : null}"), true);
  is("はじめの一局の駒は装備中の見た目", screens.includes("(tut.loadouts || (firstGame ? [collection.equipped, {}] : [{}, {}])).map(sanitizeLoadout)"), true);
  is(
    "導入と相手の紹介のあいだ称号の知らせを止める(導入を終えたあとの対局も)",
    /const introQuiet = introHoldsTitles\(\{ intro, screen: e, firstGame: tut === FIRST_GAME, firstPull: firstPullMode, stageIntro: storyIntro, afterIntro \}\);\s*useTitleNoticeHold\(introQuiet\);/.test(screens),
    true,
  );
  // 同じあいだは通信失敗の帯も出さない(2026-10-06 見直し。門の語りの唯一の釦「門を開く」を覆っていた)
  is(
    "導入のあいだは根に data-intro を立て、通信失敗の帯を隠す",
    /if \(!introQuiet \|\| !root \|\| !root\.removeAttribute\) return undefined;\s*root\.setAttribute\("data-intro", ""\);\s*return \(\) => root\.removeAttribute\("data-intro"\);\s*\}, \[introQuiet\]\);/.test(screens) &&
      /:root\[data-intro\] \.profile-sync-notice \{\s*display: none;\s*\}/.test(read("src/styles.css")),
    true,
  );
  is("通信失敗の帯の文は句ごとに折り返す(文は変えない)", /<Phrases text="成績を保存できていません。通信が戻ると再送します。" \/>/.test(read("src/ui/profile-sync.jsx")), true);
  is(
    "導入を終えたあとは件数を絞り、ホームを開いたら下ろす",
    /useTitleNoticeLimit\(introTitleQuota\(\{ afterIntro, screen: e \}\)\);\s*useEffect\(\(\) => \{\s*if \(e === "menu"\) setAfterIntro\(!1\);\s*\}, \[e\]\);/.test(screens),
    true,
  );
  is("手引きを自動で出さない(ホームの案内・ストーリーの初回)", /offerTutorial|storyPrimerSeen|setStoryPrimer\("first"\)|doneLabel="ストーリーを始める"/.test(screens), false);
  is("ストーリーの「遊び方」からは読める", screens.includes('onGuide={() => setStoryPrimer("guide")}') && /storyPrimer && \(\s*<Primer/.test(screens), true);
  is("語りの控えは導入のモジュールから", /markPrologueSeen,\s*prologueSeen,\s*\} from "\.\.\/game\/intro\.js";/.test(screens), true);
  // 初回の10連のあいだの「ホームに戻る」も onBack(skins.jsx)。前の段の約束
  is("10連の画面は firstPull を受けて、閉じたら onBack(skins.jsx)", /const closeFirstResults = async \(\) => \{\s*const next = await closeResults\(\);\s*if \(next && onBack\) onBack\(\);/.test(read("src/ui/skins.jsx")), true);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
