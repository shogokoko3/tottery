/**
 * 導入の振り分け(src/game/intro.js。2026-10-01 本人の指示)を確かめる。
 *
 *   タイトル → 語り2枚 → はじめの一局 → 結果 → 名前 → 門の語り → 10連 → ストーリー一覧
 *
 * 見ること:
 *   A. 次に出す段(introStep)の表。いまのテスター・合言葉つき・中断・フェーズ2 の人・壊れた記録
 *   B. 本物の記録(profile.js の recordGame・saveName、collection の markFirstPull)で導入を通す。
 *      どこでやめても、次の起動で続きへ戻る(前へ戻らない・名前と10連をくり返さない)
 *   C. はじめの一局をストーリーとして渡す形(firstGameStory)と、ストーリー1つ目の行き先(firstGameStage)
 *   D. 称号の知らせを止める場面(introHoldsTitles)と、語りを見たかの控え
 *   E. 画面(screens.jsx)の配線: タイトル・語り・名前・門の語り・10連・一覧・はじめの一局の出入り
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
  INTRO_STEPS,
  firstGameDone,
  firstGameStage,
  firstGameStory,
  introHoldsTitles,
  introStep,
  markPrologueSeen,
  prologueSeen,
} = await import("../src/game/intro.js");
const { FIRST_GAME } = await import("../src/game/tutorial.js");
const { STORY_AXES, stageSize } = await import("../src/game/phase.js");
const { STORY_XP, stageOf } = await import("../src/game/story.js");
const { firstPullDone, markFirstPull } = await import("../src/skins/first-pull.js");
const { loadProfile, recordGame, resetAccount, saveName } = await import("../src/game/profile.js");
const { isRewardChapter } = await import("../src/game/tutorial-reward.js");

const story = (p1 = [], extra = {}) => ({ name: "", phase: 1, story: { 1: p1, 2: [], 3: [] }, ...extra });
const pulled = { firstPullDone: true };
const fresh = {};

console.log("A. 次に出す段");
is("段は4つ(語り・一局・名前・門の語り)", [...INTRO_STEPS], ["prologue", "first-game", "name", "gate"]);
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
  for (const name of ["", "x"])
    for (const p1 of [[], ["23"], ["45"], [...STORY_AXES]])
      for (const phase of [1, 2, 3])
        for (const col of [fresh, pulled])
          for (const pr of [false, true])
            for (const room of [false, true])
              for (const deferred of [false, true])
                seen.add(introStep({ profile: { name, phase, story: { 1: p1, 2: [], 3: [] } }, collection: col, prologueSeen: pr, room, deferred }));
  is("返すのは4つの段か null だけ(全組)", [...seen].every((s) => s === null || INTRO_STEPS.includes(s)), true);
  is("4つの段がどれも起こりうる", INTRO_STEPS.every((s) => seen.has(s)), true);
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
  // 合言葉つきで開いた人: その起動は名前を聞いて部屋へ。次の起動で導入(名前は聞き直さない)
  resetAccount();
  is("合言葉つきの起動は導入を出さない", introStep({ profile: loadProfile(), collection: {}, room: true }), null);
  saveName("合言葉の人");
  const steps = [];
  let collection = {};
  let seen = false;
  for (let g = 0; g < 8; g++) {
    const step = introStep({ profile: loadProfile(), collection, prologueSeen: seen });
    if (!step) break;
    steps.push(step);
    if (step === "prologue") seen = true;
    if (step === "first-game") recordGame(true, { deferXpNotice: true, xp: STORY_XP, story: { axis: "23", phase: 1 } });
    if (step === "gate") collection = markFirstPull(collection);
  }
  is("次の起動の導入は 語り → 一局 → 門の語り(名前は飛ばす)", steps, ["prologue", "first-game", "gate"]);
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
  is("名前の画面は2か所だけ(勝ったあと・名前の壁。合言葉つきの起動も名前の壁)", (screens.match(/<NameSetupScreen\b/g) || []).length, 2);
  is("タイトルの「ゲームスタート」は導入の続きへ", screens.includes("home: <HomeScreen onStart={startFromTitle} />"), true);
  is(
    "タイトルからの振り分けは introStep(語りの控え・合言葉・中断を渡す)。済んでいればホーム",
    /introStep\(\{\s*profile: loadProfile\(\),\s*collection: getCollection\(\),\s*prologueSeen: prologueSeen\(\),\s*room: !!pendingRoom,\s*deferred: introDeferred,\s*\}\);\s*if \(step\) goIntro\(step\);\s*else t\("menu"\);/.test(fn("startFromTitle")),
    true,
  );
  // roomFromLocation は読んだ合言葉を URL から消す。2回呼ぶと2回目が空になり、部屋へ行けなくなる(画面で確かめて見つけた)
  is("合言葉は起動で1回だけ読む", (screens.match(/roomFromLocation\(\)/g) || []).length, 1);
  is("合言葉つきで開いた起動は、導入を押し付けない", /\[pendingRoom, setPendingRoom\] = \(0, useState\)\(\(\) => roomFromLocation\(\)\),\s*(\/\/[^\n]*\n\s*)*\[introDeferred, setIntroDeferred\] = \(0, useState\)\(\(\) => !!pendingRoom\)/.test(screens), true);
  is("合言葉つきで開いたらすぐ部屋へ(名前が無ければ名前の壁が先)", /useEffect\(\(\) => \{\s*if \(pendingRoom\) t\("room"\);\s*\}, \[pendingRoom\]\);/.test(screens), true);
  is(
    "語りを読み終えたら(読み飛ばしても)控えを残して、はじめの一局へ",
    /if \(intro === "prologue"\)[\s\S]{0,200}<Prologue\s+kind="intro"\s+onDone=\{\(\) => \{\s*markPrologueSeen\(\);\s*startFirstGame\(\);/.test(screens),
    true,
  );
  is(
    "勝ったあとの名前は「はじめての勝利」の形。決めたら導入の続き(門の語り)へ",
    /if \(intro === "name"\)[\s\S]{0,200}<NameSetupScreen\s+afterWin\s+onDone=\{\(\) => \{\s*setNamed\(!0\);\s*const step = introStep\(\{ profile: loadProfile\(\), collection: getCollection\(\), prologueSeen: true \}\);\s*if \(step\) goIntro\(step\);\s*else showStory\(\);/.test(screens),
    true,
  );
  is(
    "門の語りのあとは初回の10連(戻り先はストーリー)",
    /if \(intro === "gate"\)[\s\S]{0,200}<Prologue\s+kind="gate"\s+onDone=\{\(\) => \{\s*setIntro\(null\);\s*setFirstPullMode\(!0\);\s*setSkinsTab\("gacha"\);\s*setSkinsFrom\("story"\);\s*t\("skins"\);/.test(screens),
    true,
  );
  is(
    "10連の結果を閉じたら、次の相手を紹介。未クリアがなければ一覧へ",
    /if \(firstPullMode\) \{\s*(\/\/[^\n]*\n\s*)*setFirstPullMode\(!1\);\s*showStory\(\);\s*const next = nextStage\(loadProfile\(\)\);\s*if \(next\) openStage\(next.axis\);\s*return;\s*\}/.test(screens),
    true,
  );
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
    "一局を離れるとき: 勝っていれば導入の続き、中断ならこの起動のあいだ押し付けない",
    /if \(firstGameDone\(profile\)\) \{\s*const step = introStep\(\{ profile, collection: getCollection\(\), prologueSeen: true \}\);\s*if \(step\) \{\s*goIntro\(step\);\s*return;\s*\}\s*\} else setIntroDeferred\(!0\);/.test(fn("leaveFirstGame")),
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
  is("「門へ進む」は10連がまだの人だけ", screens.includes("onGate={firstGame && !firstPullDone(collection) ? () => leaveFirstGame() : null}"), true);
  is("はじめの一局はもう一度を出さない(作り直すと台本の盤にならない)", screens.includes("onRetryStory={story && !tut ? () => (showStory(), openStage(story.axis)) : null}"), true);
  is("はじめの一局の駒は装備中の見た目", screens.includes("(tut.loadouts || (firstGame ? [collection.equipped, {}] : [{}, {}])).map(sanitizeLoadout)"), true);
  is("導入と相手の紹介のあいだ称号の知らせを止める", /useTitleNoticeHold\(\s*introHoldsTitles\(\{ intro, screen: e, firstGame: tut === FIRST_GAME, firstPull: firstPullMode, stageIntro: storyIntro \}\),\s*\);/.test(screens), true);
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
