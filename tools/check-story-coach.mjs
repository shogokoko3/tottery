/**
 * ストーリー2つ目の手当て(src/game/story-coach.js。2026-10-01 本人の指示)と、
 * フェーズ1 のストーリーの時間制限なし(src/game/story.js storyUntimed)を確かめる。
 *
 *   はじめの一局のあとの最初の CPU 戦(ふつうは四と五の王)の初回だけ、
 *   サイコロ・引き直し・陣で一言ずつ。引き直しは「このまま」を光らせ、陣はおすすめの陣を並べた状態から始める。
 *   一度見せた一言は二度と出さない。フェーズ1 のストーリーは毎回、時計を動かさない
 *
 * 見ること:
 *   A. 手当てを出す相手(storyCoachPlan の表)。導入を通った人・テスター・台本・オンライン・フェーズ2・3・見せた場面
 *   B. 文。本人の決めの文・1文1行・20字まで・「このまま」・「13枚から5枚」が本物の盤と合うこと
 *   C. 場面(coachScene・coachArranges)を本物の reducer で通す。全7ステージ × 局を変えて、
 *      サイコロ → 引き直し(このまま)→ おすすめの陣 → 王を選ぶ → 確定 → 対局 が止まらない
 *   D. 見せた控え(coachSeen・markCoachSeen)。読めない端末・壊れた控え・書けない端末
 *   E. 通し。導入を通った人は1局目だけ、途中でやめた人は残りの場面だけ、テスターには出ない
 *   F. 時計(storyUntimed)。フェーズ1 だけ
 *   G. 画面の部品(StoryCoachNote・DiceDuo・PlaceStep・ClockBar)を描く
 *   H. 配線(game.jsx)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

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

// profile.js・intro.js は localStorage を読むので、先に偽物を置く
const mem = new Map();
const memStore = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.localStorage = memStore;
if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.window.dispatchEvent) globalThis.window.dispatchEvent = () => true;
if (!globalThis.window.addEventListener) globalThis.window.addEventListener = () => {};

const { COACH_LINES, COACH_SCENES, COACH_WAIT_LINES, KEEP_LABEL, coachArranges, coachScene, coachSeen, markCoachSeen, storyCoachPlan } = await import(
  "../src/game/story-coach.js"
);
const { STORY_STAGES, stageSetup, storyDeal, storyLesson, storyUntimed, pickStoryKing, storyCpuArea } = await import("../src/game/story.js");
const { firstGameStory, markPrologueSeen, prologueSeen } = await import("../src/game/intro.js");
const { FIRST_GAME, TUTORIALS } = await import("../src/game/tutorial.js");
const { reducer, autoPickKing } = await import("../src/game/reducer.js");
const { enrichAction } = await import("../src/game/actions.js");
const { armySlots } = await import("../src/game/board.js");
const { GAME_RULE_VERSION } = await import("../src/game/rule-version.js");
const { josekiCpuAction } = await import("../src/game/cpu-joseki.js");
const { STORAGE_PREFIX } = await import("../src/game/forget.js");

const stage = (axis, phase = 1) => ({ axis, phase, size: phase === 1 ? 5 : 9, king: axis === "k" ? "K" : null, title: "x" });
const all = Object.freeze({ dice: COACH_LINES.dice, mulligan: COACH_LINES.mulligan, setup: COACH_LINES.setup });

/* =====================================================================
   A. 手当てを出す相手
   ===================================================================== */
console.log("A. 手当てを出す相手(storyCoachPlan)");
{
  const plan = (o) => storyCoachPlan({ story: stage("45"), introSeen: true, seen: [], ...o });
  is("導入を通った人の四と五の王(フェーズ1): 3つの場面とも", plan({}), all);
  is("ほかのステージを先に選んでも同じ(全7ステージ。二と三の王の2回目も)", STORY_STAGES.every((s) => JSON.stringify(plan({ story: stage(s.axis) })) === JSON.stringify(all)), true);
  is("はじめの一局(台本つき)には出さない", plan({ story: firstGameStory(), tutorial: FIRST_GAME }), null);
  is("第1〜13話(台本)には出さない", TUTORIALS.every((t) => plan({ story: null, tutorial: t }) === null && plan({ tutorial: t }) === null), true);
  is("ストーリーでない対局(CPU 戦・同じ端末)には出さない", plan({ story: null }), null);
  is("オンラインには出さない", plan({ network: { code: "x" } }), null);
  is("フェーズ2・3 のストーリーには出さない", [plan({ story: stage("45", 2) }), plan({ story: stage("45", 3) })], [null, null]);
  is("導入の語りを通っていない人(いまのテスター)には出さない", plan({ introSeen: false }), null);
  is("3つとも見せたら出さない", plan({ seen: [...COACH_SCENES] }), null);
  is("サイコロだけ見せた(引き直しでやめた)なら、引き直しと陣だけ", plan({ seen: ["dice"] }), { dice: null, mulligan: COACH_LINES.mulligan, setup: COACH_LINES.setup });
  is("陣だけ残っていれば陣だけ", plan({ seen: ["dice", "mulligan"] }), { dice: null, mulligan: null, setup: COACH_LINES.setup });
  is("知らない控えは数えない", plan({ seen: ["foo", "dice"] }), { dice: null, mulligan: COACH_LINES.mulligan, setup: COACH_LINES.setup });
  is("返り値は凍らせてある(画面が書き換えない)", Object.isFrozen(plan({})), true);
  is("引数なしでも落ちない", storyCoachPlan(), null);
}

/* =====================================================================
   B. 文
   ===================================================================== */
console.log("\nB. 文");
{
  // 本人の決め6の文(2026-10-01)。磨くときはここも直す
  is("サイコロ", [...COACH_LINES.dice], ["先手は、サイコロで決まる。"]);
  is("引き直し", [...COACH_LINES.mulligan], ["いらない札は、捨てて引き直せる。", "捨てた札は、相手にも見える。"]);
  // 陣の2行目は、おすすめの陣を並べ終えた画面に合わせた(2026-10-06 見直し。前は「手札から5枚。迷ったら「自動配置」。」)
  is("陣", [...COACH_LINES.setup], ["伏せた一枚に、策がある。", "おすすめの陣を、並べておいた。"]);
  is("陣: おすすめの陣を並べた画面で、これから並べるように言わない・「自動配置」を勧めない", COACH_LINES.setup.some((l) => /自動配置|手札から|迷ったら/.test(l)), false);
  // 引き直しで相手を待つあいだの文(2026-10-06 見直し)。先手は「このまま」で進んだ人にも合う言い方
  is("待つ文(先手)", [...COACH_WAIT_LINES.first], ["あなたの手札は、決まった。", "相手が、捨てる札を選んでいる…"]);
  is("待つ文(後手)", [...COACH_WAIT_LINES.second], ["相手が、捨てる札を選んでいる。", "次は、あなた…"]);
  const waits = [...COACH_WAIT_LINES.first, ...COACH_WAIT_LINES.second];
  is("待つ文: どの行も20字まで・句点か「…」で終わる・「札」(「カード」を使わない)", waits.filter((l) => [...l].length > 20 || !/[。…]$/.test(l) || l.includes("カード")), []);
  is("待つ文: 先手の文は、引き直さなかった人に嘘にならない(「引き直しは済んだ」と言わない)", COACH_WAIT_LINES.first.some((l) => /引き直し/.test(l)), false);
  is("待つ文: です・ます調の決まり文句を使わない", waits.filter((l) => /です|ます|ください/.test(l)), []);
  is("待つ文は凍らせてある", Object.isFrozen(COACH_WAIT_LINES) && Object.isFrozen(COACH_WAIT_LINES.first) && Object.isFrozen(COACH_WAIT_LINES.second), true);
  const lines = COACH_SCENES.flatMap((k) => COACH_LINES[k]);
  is("どの行も20字まで", lines.filter((l) => [...l].length > 20), []);
  is("1文1行(行は句点で終わる)", lines.every((l) => l.endsWith("。")), true);
  is("将棋とほかのゲームの名前を使わない", lines.filter((l) => /将棋|チェス|ポーカー|トランプ/.test(l)), []);
  is("場面は出会う順(サイコロ → 引き直し → 陣)", [...COACH_SCENES], ["dice", "mulligan", "setup"]);
  is("引き直さずに進む釦は「このまま」", KEEP_LABEL, "このまま");
  is("文は凍らせてある", Object.isFrozen(COACH_LINES) && COACH_SCENES.every((k) => Object.isFrozen(COACH_LINES[k])), true);
}

/* =====================================================================
   C. 場面を本物の reducer で通す
   ===================================================================== */
console.log("\nC. 場面(サイコロ → 引き直し → おすすめの陣 → 王 → 確定 → 対局)");
{
  const realRandom = Math.random;
  const seeded = (seed) => {
    let n = seed >>> 0 || 1;
    return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
  };
  const plan = storyCoachPlan({ story: stage("45"), introSeen: true, seen: [] });
  let games = 0;
  const problems = [];
  const seenScenes = new Set();
  let handOk = 0,
    keepOk = 0,
    arranged = 0,
    backOk = 0;
  for (const st of STORY_STAGES)
    for (let i = 0; i < 10; i++) {
      Math.random = seeded(7000 + i * 31 + st.axis.length);
      const k = pickStoryKing(st.axis);
      const area = storyCpuArea(st.axis, k).type;
      const setup = stageSetup(st.axis, 1);
      const tag = `${st.axis}/${k} #${i}`;
      try {
        let s = reducer(
          { phase: "intro" },
          { type: "START_SETUP", size: setup.size, setupMode: "simultaneous", ...storyDeal({ axis: st.axis, king: k, phase: 1 }), kingPowers: false, ruleVersion: GAME_RULE_VERSION },
        );
        if (s.phase !== "dice") throw new Error("START_SETUP が通らない");
        const order = [];
        const note = (x) => {
          const scene = coachScene(x, 0);
          if (scene && order[order.length - 1] !== scene) order.push(scene);
          if (scene) seenScenes.add(scene);
        };
        const hi = i % 2;
        for (let g = 0; s.phase === "dice" && g < 50; g++) {
          note(s);
          const a =
            s.diceIdx <= 1 && s.dice[s.diceIdx] === null
              ? { type: "ROLL_DICE_SINGLE", value: s.diceIdx === hi ? 6 : 1 }
              : s.diceIdx === 2
                ? { type: "GOTO_MULLIGAN" }
                : s.diceIdx === 3
                  ? { type: "REROLL_DICE" }
                  : { type: "NEXT_DICE_STEP" };
          s = reducer(s, a);
        }
        for (let g = 0; s.phase === "mulligan" && g < 10; g++) {
          note(s);
          if (s.mulliganIdx === 0) {
            // 「このまま」= 1枚も選ばずに確定。手札は変わらず、捨て札も出ない
            const before = s.players[0].hand.map((c) => c.id).sort();
            s = reducer(s, enrichAction({ type: "CONFIRM_MULLIGAN" }, s));
            const after = s.players[0].hand.map((c) => c.id).sort();
            if (JSON.stringify(before) === JSON.stringify(after) && s.players[0].discard.length === 0) keepOk++;
            else problems.push(`${tag}: 「このまま」で手札が変わった`);
          } else {
            const a = josekiCpuAction(s, 1, area, k);
            if (a?.type !== "CONFIRM_MULLIGAN") throw new Error("CPU の引き直しが無い");
            s = reducer(s, enrichAction(a, s));
          }
        }
        if (s.phase !== "setup") throw new Error(`引き直しのあとが setup でない(${s.phase})`);
        // 「13枚から5枚」は本物の盤と合う
        if (s.players[0].hand.length === storyLesson(st.axis).handSize && armySlots(s) === 5) handOk++;
        else problems.push(`${tag}: 手札 ${s.players[0].hand.length} 枚・軍 ${armySlots(s)} 枠`);
        note(s);
        if (coachScene(s, 0) !== "setup" || !coachArranges(plan, s, 0)) problems.push(`${tag}: 並べる段に入っても、おすすめの陣を並べない`);
        s = reducer(s, { type: "SETUP_AUTO_ARRANGE", player: 0 });
        if (Object.keys(s.setupPlacements[0]).length === armySlots(s)) arranged++;
        else problems.push(`${tag}: おすすめの陣が5枚そろわない`);
        if (coachArranges(plan, s, 0)) problems.push(`${tag}: 並べたあとも、もう一度並べようとする`);
        if (coachScene(s, 0) !== "setup") problems.push(`${tag}: 並べたあとも一言は出したまま(並べる段のあいだ)`);
        s = reducer(s, { type: "SETUP_GOTO_KING_STEP", player: 0 });
        if (s.setupSteps[0] !== "king") throw new Error("おすすめの陣から王を選ぶ段へ進めない");
        if (coachScene(s, 0) !== null) problems.push(`${tag}: 王を選ぶ段にも一言を出す`);
        // 「配置に戻る」で戻っても、並べ直しはしない(置いた札はそのまま)
        s = reducer(s, { type: "SETUP_BACK_TO_PLACE", player: 0 });
        if (coachScene(s, 0) === "setup" && !coachArranges(plan, s, 0)) backOk++;
        else problems.push(`${tag}: 配置に戻ったら並べ直す`);
        s = reducer(s, { type: "SETUP_GOTO_KING_STEP", player: 0 });
        const king = autoPickKing(s, 0, s.setupPlacements[0]);
        s = reducer(s, { type: "SETUP_PICK_KING", player: 0, cardId: king });
        s = reducer(s, { type: "SETUP_CONFIRM", player: 0 });
        if (!s.setupDone[0]) throw new Error("おすすめの陣で布陣を確定できない");
        if (coachScene(s, 0) !== null) problems.push(`${tag}: 確定のあとも一言を出す`);
        if (!s.setupDone[1]) {
          const a = josekiCpuAction(s, 1, area, k);
          s = reducer(s, a);
        }
        for (let g = 0; g < 5 && (s.setupEffects || s.interstitial); g++)
          s = reducer(s, { type: s.setupEffects ? "DISMISS_SETUP_EFFECTS" : "DISMISS_INTERSTITIAL" });
        if (s.phase !== "play") throw new Error(`対局に入らない(${s.phase})`);
        if (coachScene(s, 0) !== null) problems.push(`${tag}: 対局中にも一言を出す`);
        if (JSON.stringify(order) !== JSON.stringify(["dice", "mulligan", "setup"])) problems.push(`${tag}: 場面の順 ${order.join("→")}`);
        games++;
      } catch (e) {
        problems.push(`${tag}: ${e.message}`);
      } finally {
        Math.random = realRandom;
      }
    }
  const N = STORY_STAGES.length * 10;
  is(`全7ステージ × 10局で、対局まで止まらない`, [games, problems], [N, []]);
  is("場面はサイコロ・引き直し・陣の3つとも現れる", [...seenScenes].sort(), ["dice", "mulligan", "setup"]);
  is("「このまま」は手札を変えない(捨て札なし)", keepOk, N);
  is("段階に合う手札・軍5枠", handOk, N);
  is("おすすめの陣で5枠がそろう", arranged, N);
  is("配置に戻っても、置いた札を並べ直さない", backOk, N);
  is("手当てが済んだ場面では並べない(陣の控えあり)", coachArranges({ dice: null, mulligan: null, setup: null }, { phase: "setup", setupSteps: ["place", "place"], setupDone: [false, false], setupPlacements: [{}, {}] }, 0), false);
  is("手当てが無ければ並べない", coachArranges(null, { phase: "setup", setupSteps: ["place", "place"], setupDone: [false, false], setupPlacements: [{}, {}] }, 0), false);
  is("場面の外(盤が無い・intro・gameover)は null", [coachScene(null), coachScene({ phase: "intro" }), coachScene({ phase: "gameover" })], [null, null, null]);
}

/* =====================================================================
   D. 見せた控え
   ===================================================================== */
console.log("\nD. 見せた控え(coachSeen・markCoachSeen)");
{
  const store = () => {
    const m = new Map();
    return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  };
  const st = store();
  is("はじめは何も見せていない", coachSeen(st), []);
  markCoachSeen("mulligan", st);
  markCoachSeen("dice", st);
  markCoachSeen("dice", st);
  is("見せた場面を控える(出会う順・重ねない)", coachSeen(st), ["dice", "mulligan"]);
  markCoachSeen("foo", st);
  is("知らない場面は控えない", coachSeen(st), ["dice", "mulligan"]);
  markCoachSeen("setup", st);
  is("3つ見せたら全部", coachSeen(st), ["dice", "mulligan", "setup"]);
  const key = [...st.m.keys()];
  is("控えの鍵は1つで tottery. で始まる(「データを全部消す」で消える)", key.length === 1 && key[0].startsWith(STORAGE_PREFIX), true);
  const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
  is("読めない端末では出さない(毎回出るより、出さないほうがよい)", coachSeen(broken), [...COACH_SCENES]);
  is("読めない端末の手当ては null", storyCoachPlan({ story: stage("45"), introSeen: true, seen: coachSeen(broken) }), null);
  const bad = store();
  bad.setItem(key[0], "{oops");
  is("壊れた控えは「全部見せた」", coachSeen(bad), [...COACH_SCENES]);
  bad.setItem(key[0], '{"dice":true}');
  is("配列でない控えも「全部見せた」", coachSeen(bad), [...COACH_SCENES]);
  // 書けない端末は最後(I)に見る。起動のあいだの控えが、この検査の残りにも効いてしまうため
}

/* =====================================================================
   E. 通し
   ===================================================================== */
console.log("\nE. 通し(導入を通った人・途中でやめた人・テスター)");
{
  mem.clear();
  const plan = () => storyCoachPlan({ story: stage("45"), introSeen: prologueSeen(), seen: coachSeen() });
  // テスター: 語りを見ていない(導入を通らない)
  is("テスター(語りを見ていない)には出さない", plan(), null);
  markPrologueSeen();
  is("導入を通った人の最初の CPU 戦: 3つの場面とも", plan(), all);
  // サイコロと引き直しの場面まで見せて、中断した
  markCoachSeen("dice");
  markCoachSeen("mulligan");
  const again = plan();
  is("途中でやめたら、次の局は残りの場面だけ(陣)", again && [again.dice, again.mulligan, again.setup], [null, null, COACH_LINES.setup]);
  markCoachSeen("setup");
  is("全部見せたら、その次の局からは出さない", plan(), null);
  is("控えは端末の保存に残る", JSON.parse(mem.get("tottery.storyCoach.v1")), ["dice", "mulligan", "setup"]);
  is("フェーズ2 に上がった人には、控えが無くても出さない", (mem.delete("tottery.storyCoach.v1"), storyCoachPlan({ story: stage("45", 2), introSeen: prologueSeen(), seen: coachSeen() })), null);
}

/* =====================================================================
   F. 時計
   ===================================================================== */
console.log("\nF. 時計(storyUntimed)");
{
  is("フェーズ1 のストーリーは時間制限なし(全7ステージ)", STORY_STAGES.every((s) => storyUntimed(stage(s.axis, 1))), true);
  is("フェーズ2・3 は今までどおり", [storyUntimed(stage("45", 2)), storyUntimed(stage("45", 3))], [false, false]);
  is("ストーリーでなければ時計はいつもどおり", [storyUntimed(null), storyUntimed(undefined)], [false, false]);
  is("はじめの一局(ストーリー1つ目の初回)もフェーズ1", storyUntimed(firstGameStory()), true);
}

/* =====================================================================
   G. 画面の部品
   ===================================================================== */
console.log("\nG. 画面の部品");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-story-coach-"));
  let R;
  try {
    const outfile = path.join(dir, "view.cjs");
    await build({
      stdin: {
        resolveDir: process.cwd(),
        loader: "jsx",
        contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {StoryCoachNote} from './src/ui/story.jsx';import {DiceDuo} from './src/ui/dice.jsx';
import {PlaceStep} from './src/ui/setup.jsx';import {ClockBar} from './src/ui/game.jsx';import {SeatsProvider} from './src/ui/names.jsx';
const seats={names:["あなた","四と五の王"],icons:[null,null],titles:[null,null],skins:[{},{}]};
const wrap=(el)=>renderToStaticMarkup(<SeatsProvider value={seats}>{el}</SeatsProvider>);
const noop=()=>{};
export const note=(lines)=>renderToStaticMarkup(<StoryCoachNote lines={lines} />);
export const dice=(lines, plain=false)=>wrap(<DiceDuo dice={[null,null]} me={0} onRoll={noop} remainingMs={null} limitMs={20000} firstPlayer={null} note={lines ? <StoryCoachNote lines={lines} /> : null} plain={plain} />);
export const place=(state, lines, orderPlain=false)=>wrap(<PlaceStep state={state} player={state.players[0]} pIdx={0} size={5} dispatch={noop} remainingMs={null} limitMs={1} note={lines ? <StoryCoachNote lines={lines} /> : null} orderPlain={orderPlain} />);
export const clock=(props)=>wrap(<ClockBar clocks={[300000,300000]} currentTurn={0} viewer={0} extensionUses={[0,0]} {...props} />);`,
      },
      bundle: true,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      outfile,
      logLevel: "silent",
      define: { __FIELD_FILES__: "{}", __BUILD_VERSION__: '"check"' },
      loader: { ".css": "text", ".png": "dataurl", ".jpg": "dataurl", ".webp": "dataurl", ".mp4": "dataurl", ".mp3": "dataurl", ".svg": "dataurl" },
    });
    // 画面の部品は読み込み時にブラウザの窓を触る。描くだけなので、空の窓を置く(check-first-game-screen と同じ)
    const noop = () => {};
    Object.assign(globalThis, {
      sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => true,
      matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
      requestAnimationFrame: (f) => setTimeout(f, 0),
      cancelAnimationFrame: clearTimeout,
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 2,
      scrollTo: noop,
      location: { protocol: "http:", hostname: "localhost", host: "localhost", href: "http://localhost/", search: "", origin: "http://localhost", pathname: "/" },
      document: {
        addEventListener: noop,
        removeEventListener: noop,
        visibilityState: "visible",
        hidden: false,
        body: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop },
        documentElement: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, setAttribute: noop, getAttribute: () => null },
        createElement: () => ({ style: {}, setAttribute: noop, getAttribute: () => null, appendChild: noop, remove: noop, getContext: () => null, classList: { add: noop, remove: noop } }),
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        head: { appendChild: noop },
        fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
      },
    });
    if (typeof globalThis.Image === "undefined") globalThis.Image = class { set src(_) {} };
    if (typeof globalThis.Audio === "undefined") globalThis.Audio = class { play() {} pause() {} };
    R = createRequire(import.meta.url)(outfile);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const { note, dice, place, clock } = R;
  const rows = (html) => [...html.matchAll(/<p class="story-coach" role="status">([\s\S]*?)<\/p>/g)].flatMap((m) => [...m[1].matchAll(/<span>([^<]*)<\/span>/g)].map((x) => x[1]));
  is("一言は1文1行(行ごとの span)", rows(note(COACH_LINES.setup)), [...COACH_LINES.setup]);
  is("一言が無ければ何も出さない", [note(null), note([])], ["", ""]);
  const d = dice(COACH_LINES.dice);
  // 一言は見出しの代わり(見出しと一言で同じことを二度言わない。dice.jsx の {note || <h2>…}。2026-10-05 見直しで名と検査を作りに合わせた)
  is("サイコロ: 一言を1文1行で出す", rows(d), [...COACH_LINES.dice]);
  is("サイコロ: 一言は見出しの代わり(見出しを出さない)・出目より前", !d.includes("サイコロで先手を決めます") && d.indexOf("story-coach") >= 0 && d.indexOf("story-coach") < d.indexOf("dice-duo-sides"), true);
  is("サイコロ: 手当てが無ければ見出しのまま・一言なし", dice(null).includes("サイコロで先手を決めます") && !/story-coach/.test(dice(null)), true);
  is("サイコロ: 時間制限なしなら残り時間の帯なし", /振る残り時間/.test(d), false);
  // 手当ての局のサイコロは導入の言葉の調子(2026-10-06 見直し)。ほかの対局はいままでどおり
  const dp = dice(COACH_LINES.dice, true);
  const text = (html) => html.replace(/<[^>]*>/g, "");
  is("サイコロ(手当ての局): まだ振っていない・相手を待っている(です・ます調を使わない)", /まだ振っていない/.test(text(dp)) && /相手が振るのを待っている…/.test(text(dp)) && !/です|ます|ください/.test(text(dp)), true);
  is("サイコロ(ふつうの対局): いままでどおり", /まだ振っていません/.test(text(dice(null))) && /相手が振るのを待っています…/.test(text(dice(null))), true);
  {
    const src = read("src/ui/dice.jsx");
    is(
      "サイコロ(手当ての局): 出目・同じ目・勝者の文も導入の言い方(「4 が出た」「同じ目。もう一度…」「先手は、あなた。」)",
      /rolled: \(v\) => `\$\{v\} が出た`/.test(src) && /tie: "同じ目。もう一度…"/.test(src) && /`先手は、\$\{firstPlayer === me \? "あなた" : \(names && names\[firstPlayer\]\) \|\| "相手"\}。`/.test(src),
      true,
    );
    const plainSay = (src.match(/const say = plain\s*\? \{([\s\S]*?)\}\s*: \{/) || ["", ""])[1];
    is("サイコロ(手当ての局): 言葉の表にです・ます調が無い", !!plainSay && !/です|ます|ください/.test(plainSay), true);
  }
  // 陣: 本物の reducer で並べる段まで進めた盤
  let s = reducer(
    { phase: "intro" },
    { type: "START_SETUP", size: 5, setupMode: "simultaneous", ...storyDeal({ axis: "45", king: "4", phase: 1 }), kingPowers: false, ruleVersion: GAME_RULE_VERSION },
  );
  for (let g = 0; s.phase === "dice" && g < 20; g++)
    s = reducer(
      s,
      s.diceIdx <= 1 && s.dice[s.diceIdx] === null ? { type: "ROLL_DICE_SINGLE", value: s.diceIdx === 0 ? 6 : 1 } : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : { type: "NEXT_DICE_STEP" },
    );
  for (let g = 0; s.phase === "mulligan" && g < 5; g++)
    s = reducer(s, enrichAction(s.mulliganIdx === 0 ? { type: "CONFIRM_MULLIGAN" } : josekiCpuAction(s, 1, "sea", "4"), s));
  s = reducer(s, { type: "SETUP_AUTO_ARRANGE", player: 0 });
  const p = place(s, COACH_LINES.setup);
  is("陣: 一言を出す", rows(p), [...COACH_LINES.setup]);
  const head = p.slice(p.indexOf('class="setup-head"'), p.indexOf("setup-hint-line"));
  is("陣: 一言は見出しの代わりに帯(.setup-head)の中・先後の前", head.includes("story-coach") && head.indexOf("story-coach") < head.indexOf("setup-order") && !/カードを盤面に配置してね/.test(p), true);
  is("陣: 手当てが無ければ見出しのまま", /カードを盤面に配置してね/.test(place(s, null)), true);
  is("陣: おすすめの陣が並んだ状態(5/5)と「自動配置」「王を選ぶ」", /5<!-- -->\/<!-- -->5|5\/5/.test(p) && /自動配置/.test(p) && /王を選ぶ/.test(p), true);
  is("陣: 時間制限なしなら残り時間の帯なし", /布陣の残り時間/.test(p), false);
  // 先後の一行(2026-10-06 見直し)。手当ての局は「最初の一手は、あなた。」だけ(札・「サイコロの結果、」・です・ます を出さない)
  const pp = place(s, COACH_LINES.setup, true).replace(/<[^>]*>/g, "");
  is("陣(手当ての局): 先後は「最初の一手は、あなた。」の一行だけ", /最初の一手は、あなた。/.test(pp) && !/あなたは先攻|サイコロの結果|先に動きます/.test(pp), true);
  is("陣(ふつうの対局): 先後はいままでどおり", /あなたは先攻/.test(place(s, null).replace(/<[^>]*>/g, "")) && /サイコロの結果、先に動きます/.test(place(s, null).replace(/<[^>]*>/g, "")), true);
  is("陣: 手当てが無ければ一言なし", /story-coach/.test(place(s, null)), false);
  const timed = clock({ ruleVersion: GAME_RULE_VERSION });
  const free = clock({ ruleVersion: GAME_RULE_VERSION, untimed: true });
  is("時計: ふだんは 5:00 と追加の印・決まりの一行", /5:00/.test(timed) && /clock-pips-inline/.test(timed) && /clock-rule-hint/.test(timed), true);
  is("時計: 時間制限なしは「制限なし」(止まった 5:00 を見せない)", /制限なし/.test(free) && !/5:00/.test(free), true);
  is("時計: 時間制限なしは追加の印も決まりの一行も出さない", !/clock-pips-inline/.test(free) && !/clock-rule-hint/.test(free), true);
  is("時計: 手番の光と席の名前は残す", /clock-cell clock-active/.test(free) && /四と五の王/.test(free), true);
  is("時計: 並びの作り(clock-limited)は同じ", (free.match(/clock-limited/g) || []).length === (timed.match(/clock-limited/g) || []).length, true);
}

/* =====================================================================
   H. 配線
   ===================================================================== */
console.log("\nH. 配線(game.jsx)");
{
  const game = read("src/ui/game.jsx");
  const setup = read("src/ui/setup.jsx");
  const css = read("src/styles.css");
  is("時計を止める対局: 台本・テストプレイ・フェーズ1 のストーリー", /const untimedStory = storyUntimed\(story\);\s*const untimed = !!tutorial \|\| testPlay \|\| untimedStory;/.test(game), true);
  is("持ち時間・布陣の時計は untimed で止める(noLimit)", /let noLimit = untimed;/.test(game) && !/let noLimit = !!tutorial \|\| testPlay;/.test(game), true);
  is("サイコロ・引き直しの時計も untimed で止める", /const prepRemaining =\s*simPrep &&\s*!untimed &&/.test(game), true);
  is("手当ては対局の始めに一度だけ決める(導入の語り・見せた控え)", /const \[coach\] = useState\(\(\) =>\s*storyCoachPlan\(\{ story, tutorial, network, introSeen: prologueSeen\(\), seen: coachSeen\(\) \}\),\s*\);/.test(game), true);
  is("一言はいまの場面のもの", /const coachLines = coach \? coach\[coachScene\(a, 0\)\] \|\| null : null;/.test(game), true);
  is(
    "場面に入ったら控えを付け、陣はおすすめの陣を一度だけ並べる",
    /if \(!scene \|\| !coach\[scene\]\) return;\s*markCoachSeen\(scene\);\s*if \(!coachArrangedRef\.current && coachArranges\(coach, a, 0\)\) \{\s*coachArrangedRef\.current = true;\s*y\(\{ type: "SETUP_AUTO_ARRANGE", player: 0 \}\);/.test(game),
    true,
  );
  is("サイコロ(DiceDuo)に一言", /tie=\{a\.diceIdx === 3\}\s*note=\{coachNote\}/.test(game), true);
  is("サイコロ(DiceDuo)は手当ての局で導入の言い方", /note=\{coachNote\}\s*(\/\/[^\n]*\n\s*)*plain=\{!!coach\}/.test(game), true);
  is("陣と王を選ぶ段の先後は手当ての局で導入の言い方", (game.match(/orderPlain=\{!!coach\}/g) || []).length === 2, true);
  is("引き直しは一言を見出しの代わりに表示", /\{coachNote \|\| <h2[^\n]*交換するカードを選んでね<\/h2>\}/.test(game), true);
  is("陣(PlaceStep)に一言・王を選ぶ段(KingStep)には出さない", /<PlaceStep[\s\S]{0,600}?note=\{coachNote\}\s*orderPlain=\{!!coach\}\s*\/>/.test(game) && !/<KingStep[\s\S]{0,900}?note=/.test(game), true);
  is("PlaceStep は note を見出しの代わりに帯へ置く", /<div className="setup-head">\s*(\{\/\*[\s\S]*?\*\/\}\s*)?\{note \|\| \(\s*<h2 style=\{\{ color: PLAYER_META\[pIdx\]\.color \}\}>\s*\{nameOf\(pIdx, names\)\}: カードを盤面に配置してね/.test(setup), true);
  is(
    "引き直し: 1枚も選んでいなければ「このまま」、手当てではそれを光らせる",
    /className=\{`btn btn-primary \$\{coachLines && be\.size === 0 \? "guide-target" : ""\}`\}/.test(game) && /\{be\.size === 0 \? \(\s*<>\s*\{KEEP_LABEL\} <ArrowRight size=\{16\} \/>/.test(game),
    true,
  );
  is("引き直し: 時間制限なしでは時間切れの話をしない", /untimed \? "" : "時間が来たら、選んでいる札のまま引き直します。"/.test(game) && /untimed \? "相手が確定するまでお待ちください。" : "相手が確定するか、時間が来るまでお待ちください。"/.test(game), true);
  is("引き直し: 一言が出ていれば、案内は触り方の1行だけ(同じことを重ねない)", /\? coachLines\s*\? (\/\/[^\n]*\n\s*)*"捨てる札をタップ\(もう一度で取り消し\)。"/.test(game), true);
  // 一言(「いらない札は、捨てて引き直せる。」「捨てた札は、相手にも見える。」)と同じ画面では「札」にそろえる(2026-10-05 見直し)
  is(
    "引き直し: 一言が出ている局の待つ文は「札」の行の配列(COACH_WAIT_LINES)を1行ずつ、行の中は句の塊で",
    /: coachLines\s*\? (\/\/[^\n]*\n\s*)*\(me === a\.firstPlayer\s*\? COACH_WAIT_LINES\.first\s*: COACH_WAIT_LINES\.second\s*\)\.map\(\(line, i\) => \(\s*<span className="tutorial-line-row" key=\{i\}>\s*<Phrases text=\{line\} \/>\s*<\/span>\s*\)\)\s*: me === a\.firstPlayer\s*\? "引き直しは済みました。相手\(後攻\)が交換するカードを選んでいます…"/.test(game),
    true,
  );
  is(
    "引き直し: 一言が出ている局は、手札の下の「お待ちください」を出さない(上の待つ文と二度言わない)",
    /\) : coachLines \? null : \(\s*(\/\/[^\n]*\n\s*)*<p className="hint">\s*\{untimed \? "相手が確定するまでお待ちください。"/.test(game),
    true,
  );
  is(
    "引き直し: 手当ての局の先後の札は「最初の一手は、あなた。」(名前の三人称を使わない)",
    /\{coach \? \(\s*(\/\/[^\n]*\n\s*)*<span>\s*<Phrases text=\{me === a\.firstPlayer \? "最初の一手は、あなた。" : "最初の一手は、相手。"\} \/>\s*<\/span>\s*\) : \(\s*<span>\s*\{playerLabel\(a\.firstPlayer, P, names\)\}が先手・/.test(game),
    true,
  );
  is("引き直し: 一言が出ている局は、捨て札の見出しも「捨てた札」", /が捨てた\$\{coachLines \? "札" : "カード"\}`\}/.test(game), true);
  is("引き直し: 一言の文は「札」(「カード」を使わない)", Object.values(COACH_LINES).flat().every((l) => !l.includes("カード")), true);
  is("対局の時計に untimed を渡す", /<ClockBar[\s\S]{0,400}?untimed=\{untimedStory\}/.test(game), true);
  is("台本の引き直し(順番の画面)の釦はそのまま(第1〜13話の文「引き直して確定」)", (game.match(/\{be\.size\}枚 引き直して確定 <Check size=\{16\} \/>/g) || []).length === 2, true);
  is("CSS: 一言の枠と、時間制限なしの時計", /\.story-coach \{/.test(css) && /\.story-coach span \{[^}]*display: block;/.test(css) && /\.clock-time\.clock-time-untimed \{/.test(css), true);
  is("CSS: 陣では一言のぶん盤を詰める(375×667 で「王を選ぶ」まで1画面)", /\.setup-wrap-compact:has\(\.story-coach\) \.mini-board \{[^}]*width: min\(78vw, 320px, calc\(100dvh - 440px\)\);/.test(css), true);
}

/* =====================================================================
   I. 書けない端末(容量いっぱいなど)。起動のあいだの控えが残るので最後に見る
   ===================================================================== */
console.log("\nI. 書けない端末");
{
  const full = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  is("はじめは何も見せていない", coachSeen(full), []);
  markCoachSeen("dice", full);
  is("書けない端末でも、見せた場面は同じ起動のあいだ出さない", coachSeen(full), ["dice"]);
  is("その局の手当ては残りの場面だけ", storyCoachPlan({ story: stage("45"), introSeen: true, seen: coachSeen(full) }), { dice: null, mulligan: COACH_LINES.mulligan, setup: COACH_LINES.setup });
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
console.log("ストーリー2つ目の手当て: すべて通りました");
