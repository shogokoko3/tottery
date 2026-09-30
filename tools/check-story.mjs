/**
 * ストーリー(src/game/story.js)の決まりを確かめる。設計は ストーリーとフェーズ.md
 */
import assert from "node:assert/strict";
import { STORY_STAGES, STORY_XP, stageOf, stageIntro, stageSetup, storyList, nextStage, ranksLabel, storyFreshClear, pickStoryKing, storyCpuArea, storyDeck, stageAfter, nextStageAfter } from "../src/game/story.js";
import { reducer } from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";
import { kingRankOf } from "../src/game/board.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { cpuInformedAction } from "../src/game/cpu-informed.js";
import { automaticAreaAction } from "../src/game/area-presentation.js";
import { josekiCpuAction } from "../src/game/cpu-joseki.js";
import { STORY_AXES, STORY_TICKETS, PHASE_EPOCH, clearAxis } from "../src/game/phase.js";
import { MOVE_TEXT, KING_TEXT, RANKS } from "../src/game/constants.js";
import { AREA_BY_RANK, AREA_INFO } from "../src/game/areas.js";

let ok = 0;
const fail = [];
const is = (label, got, want) => {
  try { assert.deepEqual(got, want); ok++; console.log(`  ok   ${label}`); }
  catch { fail.push(label); console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); }
};

console.log("ステージの並び");
is("軸は phase.js の STORY_AXES と同じ順", STORY_STAGES.map((s) => s.axis), [...STORY_AXES]);
is("6 ステージで A 以外の全部の数字を一度ずつ", STORY_STAGES.flatMap((s) => s.ranks).sort(), RANKS.filter((r) => r !== "A").sort());
is("どの軸も同じエリアに属する(軸=エリア)", STORY_STAGES.every((s) => new Set(s.ranks.map((r) => AREA_BY_RANK[r])).size === 1), true);
is("名前と一言がある", STORY_STAGES.every((s) => s.name && s.tagline), true);
is("知らない軸は null", stageOf("xx"), null);
is("並びで次のステージ", [stageAfter("23").axis, stageAfter("10").axis, stageAfter("jqk"), stageAfter("xx")], ["45", "jqk", null, null]);
{
  const p = { phase: 1, story: { 1: ["jqk"], 2: [], 3: [] } };
  is("対局後の次のステージは未クリアの中から(J・Q・K を先に勝っても 2・3 へ)", nextStageAfter(p, "jqk").axis, "23");
  is("いまの軸の次から探す(4・5 の後は 6・7)", nextStageAfter({ phase: 1, story: { 1: ["45"], 2: [], 3: [] } }, "45").axis, "67");
  is("末尾まで無ければ先頭へ戻る", nextStageAfter({ phase: 1, story: { 1: ["10", "jqk"], 2: [], 3: [] } }, "10").axis, "23");
  is("全部クリア済みなら null", nextStageAfter({ phase: 1, story: { 1: [...STORY_AXES], 2: [], 3: [] } }, "23"), null);
}
is("数字の読み", [ranksLabel(["2", "3"]), ranksLabel(["10"])], ["2 か 3", "10"]);

console.log("\n始める前の説明(フェーズで中身が変わる)");
for (const s of STORY_STAGES) {
  const i1 = stageIntro(s.axis, 1), i2 = stageIntro(s.axis, 2), i3 = stageIntro(s.axis, 3);
  is(`${s.axis}: フェーズ1は駒の動き方だけ(MOVE_TEXT をそのまま)`, i1.items.map((x) => x.text), s.ranks.map((r) => MOVE_TEXT[r]));
  is(`${s.axis}: フェーズ1は王の力に触れない`, i1.items.some((x) => KING_TEXT[x.rank] && x.text === KING_TEXT[x.rank]) || /王の力|継承|道連れ|まとめて取|2回/.test(i1.items.map((x) => x.text).join("")), false);
  is(`${s.axis}: フェーズ2は王の力(KING_TEXT をそのまま)`, i2.items.map((x) => x.text), s.ranks.map((r) => KING_TEXT[r]));
  const area = AREA_INFO[AREA_BY_RANK[s.ranks[0]]];
  is(`${s.axis}: フェーズ3はエリア(AREA_INFO をそのまま)`, i3.items[0].text.includes(area.text) && i3.title.includes(area.name), true);
  is(`${s.axis}: どのフェーズも相手の王の数字を先に言う`, [i1.lead, i2.lead, i3.lead].every((l) => l.includes(ranksLabel(s.ranks))), true);
}
is("知らない軸の説明は null", stageIntro("xx", 1), null);
is("変なフェーズは既定(1)の説明", stageIntro("23", 9).title, stageIntro("23", 1).title);

console.log("\n対局の設定");
is("フェーズ1: 5×5・CPU の軸・力なし・エリアなし", stageSetup("23", 1), { size: 5, cpuAxis: ["2", "3"], kingPowers: false, areas: false });
is("フェーズ2: 力あり(旗なし)・エリアなし", stageSetup("45", 2), { size: 5, cpuAxis: ["4", "5"], areas: false });
is("フェーズ3: エリアあり", stageSetup("jqk", 3), { size: 5, cpuAxis: ["J", "Q", "K"], areas: true });
is("知らない軸は null", stageSetup("xx", 1), null);

console.log("\n一覧と次のステージ");
{
  let p = { phase: 1 };
  is("はじめは何もクリアしていない", storyList(p).map((s) => s.cleared), [false, false, false, false, false, false]);
  is("褒美はチケット 10 枚と xp", [storyList(p)[0].tickets, storyList(p)[0].xp], [STORY_TICKETS, STORY_XP]);
  is("次は 2・3", nextStage(p).axis, "23");
  p = clearAxis(p, "23");
  is("2・3 を終えたら次は 4・5", nextStage(p).axis, "45");
  for (const a of STORY_AXES) p = clearAxis(p, a);
  is("全部終えたら次は無い", nextStage(p), null);
  is("フェーズ 2 に上がると一覧は最初から", storyList({ ...p, phase: 2 }).every((s) => !s.cleared), true);
}

console.log("\n対局の終わり(recordGame の story)");
{
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  if (!globalThis.window) globalThis.window = globalThis;
  if (!globalThis.window.dispatchEvent) globalThis.window.dispatchEvent = () => true;
  if (!globalThis.window.addEventListener) globalThis.window.addEventListener = () => {};
  const { loadProfile, recordGame } = await import("../src/game/profile.js");
  const save = (p) => mem.set("tottery.account.v1", JSON.stringify(p));
  save({ ...loadProfile(), phase: 1 });
  is("はじめは 2・3 が未クリア", storyFreshClear(loadProfile(), "23"), true);
  recordGame(false, { story: { axis: "23", phase: 1 }, xp: 0 });
  is("負けたらクリアにならない", loadProfile().story[1], []);
  recordGame(true, { story: { axis: "23", phase: 1 }, xp: STORY_XP });
  is("勝ったらその軸がクリアに", loadProfile().story[1], ["23"]);
  is("もう一度勝っても増えない", (recordGame(true, { story: { axis: "23", phase: 1 }, xp: 0 }), loadProfile().story[1]), ["23"]);
  is("クリア済みは fresh ではない", storyFreshClear(loadProfile(), "23"), false);
  recordGame(true, { story: { axis: "45", phase: 2 }, xp: 0 });
  is("対局のフェーズが自分と違えば数えない", loadProfile().story, { 1: ["23"], 2: [], 3: [] });
  recordGame(true, { story: { axis: "zz", phase: 1 }, xp: 0 });
  is("知らない軸は数えない", loadProfile().story[1], ["23"]);
  recordGame(true, { online: true, story: { axis: "45", phase: 1 } });
  is("ストーリーの対局はオンラインの勝ちには数えない(手元の CPU 戦なので online は立たない前提)", loadProfile().phaseWins[1], 1);
}

console.log("\n山札と CPU の受け渡し");
{
  is("王は軸から選ぶ(2・3 の回なら 2 か 3)", [pickStoryKing("23", () => 0), pickStoryKing("23", () => 0.99), pickStoryKing("10", () => 0.5), pickStoryKing("jqk", () => 0.5)], ["2", "3", "10", "Q"]);
  is("知らない軸は null", pickStoryKing("xx"), null);
  is("CPU に渡すエリアは軸と1対1", STORY_STAGES.map((s) => storyCpuArea(s.axis, s.ranks[0]).type), ["earth", "sea", "forest", "ice", "sky", "palace"]);
  is("軸に無い王は渡さない", storyCpuArea("23", "K"), null);
  for (const st of STORY_STAGES)
    for (const k of st.ranks) {
      const deck = storyDeck(st.axis, k);
      const cpuHand = deck.slice(13, 26).map((c) => c.rank);
      is(`${st.axis}/${k}: 52枚・重複なし`, [deck.length, new Set(deck.map((c) => c.id)).size], [52, 52]);
      is(`${st.axis}/${k}: CPU の手札に王の数字が 2 枚以上`, cpuHand.filter((r) => r === k).length >= 2, true);
      is(`${st.axis}/${k}: 軸の残りの数字も 1 枚ずつ`, st.ranks.filter((r) => r !== k).every((r) => cpuHand.includes(r)), true);
      is(`${st.axis}/${k}: 積むのは 3 枚まで(手の内を読ませない)`, deck.slice(13, 16).every((c) => st.ranks.includes(c.rank)) && !st.ranks.includes(deck[16].rank) || deck.slice(13, 17).filter((c) => st.ranks.includes(c.rank)).length <= 4, true);
    }
  is("知らない軸の山札は null", storyDeck("xx", "2"), null);
}

console.log("\n5×5 のステージを回す(CPU の王は必ず軸の数字。布陣も対局も止まらない)");
{
  const realRandom = Math.random;
  const seeded = (seed) => { let n = seed >>> 0 || 1; return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296; };
  /** 1局。CPU は後手(1)= 定石CPU。人間役(0)は通常 CPU */
  function play(axis, k, phase, seed, cap = 200) {
    Math.random = seeded(seed);
    const area = storyCpuArea(axis, k).type;
    const setup = stageSetup(axis, phase);
    let s = reducer({ phase: "intro" }, { type: "START_SETUP", size: setup.size, setupMode: "simultaneous", deck: storyDeck(axis, k), ...(setup.kingPowers === false ? { kingPowers: false } : null), ruleVersion: GAME_RULE_VERSION });
    if (s.phase !== "dice") throw new Error(`${axis}/${k}: START_SETUP が通らない`);
    const act = (st, p) => (p === 1 ? josekiCpuAction(st, 1, area, k) : cpuInformedAction(st, 0));
    let stalls = 0;
    for (let guard = 0; s.phase !== "gameover" && guard < 4000; guard++) {
      if (s.captureReveal) { s = reducer(s, { type: "DISMISS_CAPTURE" }); continue; }
      if (s.interstitial) { s = reducer(s, { type: "DISMISS_INTERSTITIAL" }); continue; }
      if (s.setupEffects) { s = reducer(s, { type: "DISMISS_SETUP_EFFECTS" }); continue; }
      if (s.phase === "dice") {
        const a = s.diceIdx <= 1 && s.dice[s.diceIdx] === null ? { type: "ROLL_DICE_SINGLE", value: s.diceIdx === 0 ? 6 : 1 } : s.diceIdx === 2 ? { type: "GOTO_MULLIGAN" } : s.diceIdx === 3 ? { type: "REROLL_DICE" } : { type: "NEXT_DICE_STEP" };
        s = reducer(s, a); continue;
      }
      if (s.phase === "mulligan") {
        const a = act(s, s.mulliganIdx);
        if (a?.type !== "CONFIRM_MULLIGAN") throw new Error(`${axis}/${k}: 引き直しの手が無い`);
        s = reducer(s, enrichAction(a, s)); continue;
      }
      if (s.phase === "setup") {
        for (const p of [0, 1]) {
          if (s.setupDone[p]) continue;
          const a = act(s, p);
          if (a?.type !== "SETUP_CONFIRM") throw new Error(`${axis}/${k}: 布陣の手が無い(${p})`);
          const next = reducer(s, a);
          if (!next.setupDone[p]) throw new Error(`${axis}/${k}: 布陣が受理されない(${p}) ${JSON.stringify(a.placement)}`);
          s = next;
        }
        continue;
      }
      if (s.phase === "play") {
        if (s.turnNo >= cap) break;
        const p = s.currentTurn;
        let a = p === 1 ? act(s, 1) : automaticAreaAction(s) || cpuInformedAction(s, 0);
        if (!a) throw new Error(`${axis}/${k} 手番${s.turnNo}: 手が無い(${p})`);
        if (a.type === "__CPU_SHUFFLE") {
          s = reducer(s, { type: "SELECT_PIECE", id: a.aceId });
          for (const id of a.pickIds) s = reducer(s, { type: "TOGGLE_SHUFFLE_PICK", id });
          a = { type: "CONFIRM_SHUFFLE", aId: a.aceId, pickIds: a.pickIds };
        }
        const next = reducer(s, enrichAction({ ...a, elapsedMs: 0 }, s));
        if (next === s) { stalls++; if (stalls > 3) throw new Error(`${axis}/${k} 手番${s.turnNo}: ${a.type} が拒否され続ける(${p})`); }
        s = { ...next, replay: [] };
        continue;
      }
      throw new Error(`${axis}/${k}: 想定外の phase ${s.phase}`);
    }
    Math.random = realRandom;
    return s;
  }
  const N = 4;
  for (const phase of [1, 2]) {
    let wins = 0, games = 0, ended = 0;
    for (const st of STORY_STAGES)
      for (const k of st.ranks) {
        const kings = [];
        for (let i = 0; i < N; i++) {
          const s = play(st.axis, k, phase, 1000 * phase + i * 17 + st.axis.length);
          kings.push(kingRankOf(s, 1));
          games++;
          if (s.phase === "gameover") { ended++; if (s.winner === 1) wins++; }
          if (phase === 1) is(`${st.axis}/${k} #${i}: 力なしの対局では置いた駒に powers:false`, Object.values(s.pieces).every((q) => q.powers === false), true);
        }
        is(`フェーズ${phase} ${st.axis}/${k}: CPU の王は必ず ${k}(${N}局)`, kings, Array(N).fill(k));
      }
    console.log(`  (参考) フェーズ${phase}: ${games}局中 ${ended}局が決着、CPU(定石)の勝ち ${wins}`);
  }
}

console.log("\n画面(src/ui/story.jsx)");
{
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { createRequire } = await import("node:module");
  const { build } = await import("esbuild");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-story-"));
  try {
    const outfile = path.join(dir, "view.cjs");
    await build({
      stdin: {
        resolveDir: process.cwd(),
        loader: "jsx",
        contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {StoryScreen, StoryIntro, storyTileNote} from './src/ui/story.jsx';
const noop=()=>{};
export const screen=()=>renderToStaticMarkup(<StoryScreen onBack={noop} onStart={noop} />);
export const intro=(axis, phase)=>renderToStaticMarkup(<StoryIntro axis={axis} phase={phase} onStart={noop} onBack={noop} />);
export { storyTileNote };`,
      },
      bundle: true, platform: "node", format: "cjs", jsx: "automatic", outfile, logLevel: "silent",
      define: { __FIELD_FILES__: "{}", __BUILD_VERSION__: '"check"' },
      loader: { ".css": "text", ".png": "dataurl", ".jpg": "dataurl", ".webp": "dataurl", ".mp4": "dataurl", ".mp3": "dataurl", ".svg": "dataurl" },
    });
    const noop = () => {};
    const mem = new Map();
    Object.assign(globalThis, {
      localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) },
      sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
      addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true,
      matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
      requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout,
      innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, scrollTo: noop,
      location: { protocol: "http:", hostname: "localhost", host: "localhost", href: "http://localhost/", search: "", origin: "http://localhost", pathname: "/" },
      document: {
        addEventListener: noop, removeEventListener: noop, visibilityState: "visible", hidden: false,
        body: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop },
        documentElement: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, setAttribute: noop, getAttribute: () => null },
        createElement: () => ({ style: {}, setAttribute: noop, getAttribute: () => null, appendChild: noop, remove: noop, getContext: () => null, classList: { add: noop, remove: noop } }),
        querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
        head: { appendChild: noop }, fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
      },
    });
    globalThis.window = globalThis;
    if (typeof globalThis.Image === "undefined") globalThis.Image = class { set src(_) {} };
    if (typeof globalThis.Audio === "undefined") globalThis.Audio = class { play() {} pause() {} };
    const { screen, intro, storyTileNote } = createRequire(import.meta.url)(outfile);
    const base = { name: "t", phase: 1, phaseEpoch: PHASE_EPOCH, phaseWins: { 1: 0, 2: 0, 3: 0 }, story: { 1: [], 2: [], 3: [] } };
    const save = (p) => mem.set("tottery.account.v1", JSON.stringify(p));
    save(base);
    let h = screen();
    is("見出しとフェーズ", h.includes("<h2>ストーリー</h2>") && h.includes("フェーズ <!-- -->1") || h.includes("フェーズ 1"), true);
    is("6 ステージが並ぶ", (h.match(/class="story-stage /g) || []).length, 6);
    is("最初は 2・3 が次のステージ", /story-stage[^"]*is-next[^>]*>(?:(?!<\/button>).)*二と三の王/s.test(h), true);
    is("未クリアの段には褒美(チケット 10枚)", (h.match(/チケット <!-- -->10<!-- -->枚|チケット 10枚/g) || []).length, 6);
    is("昇格の条件が書いてある", h.includes("昇格の条件") && h.includes("6ステージ全部のクリア"), true);
    is("ホームに戻る", h.includes("ホームに戻る"), true);
    save({ ...base, story: { 1: ["23", "45"], 2: [], 3: [] } });
    h = screen();
    is("クリアした段には印", (h.match(/is-cleared/g) || []).length, 2);
    is("次は 6・7", /is-next[^>]*>(?:(?!<\/button>).)*六と七の王/s.test(h), true);
    save({ ...base, story: { 1: [...STORY_AXES], 2: [], 3: [] }, phaseWins: { 1: 5, 2: 0, 3: 0 } });
    h = screen();
    is("条件を満たすと「フェーズ 2 へ進む」の釦", h.includes("フェーズ <!-- -->2<!-- --> へ進む") || h.includes("フェーズ 2 へ進む"), true);
    save({ ...base, phase: 3, story: { 1: [], 2: [], 3: [...STORY_AXES] } });
    h = screen();
    is("最後のフェーズでは昇格の欄が無い", !h.includes("昇格の条件") && h.includes("最後のフェーズ"), true);
    for (const st of STORY_STAGES) {
      const i1 = intro(st.axis, 1), i2 = intro(st.axis, 2), i3 = intro(st.axis, 3);
      is(`${st.axis}: 前口上に相手の王の数字`, [i1, i2, i3].every((x) => x.includes(`相手の王は ${ranksLabel(st.ranks)}`) || x.includes(`相手の王は <!-- -->${ranksLabel(st.ranks)}`)), true);
      is(`${st.axis}: フェーズ1は動き方(王の力の文は出ない)`, st.ranks.every((r) => i1.includes(MOVE_TEXT[r].slice(0, 12))) && !st.ranks.some((r) => i1.includes(KING_TEXT[r].slice(0, 12))), true);
      is(`${st.axis}: フェーズ2は王の力`, st.ranks.every((r) => i2.includes(KING_TEXT[r].slice(0, 12))), true);
      is(`${st.axis}: フェーズ3はエリア`, i3.includes(AREA_INFO[AREA_BY_RANK[st.ranks[0]]].name), true);
      is(`${st.axis}: 「はじめる」と「戻る」`, i1.includes("はじめる") && i1.includes("戻る"), true);
    }
    is("ホームのタイルの一言(次のステージ)", storyTileNote(base).includes("二と三の王"), true);
    is("ホームのタイルの一言(昇格できる)", storyTileNote({ ...base, story: { 1: [...STORY_AXES], 2: [], 3: [] }, phaseWins: { 1: 5, 2: 0, 3: 0 } }), "フェーズ 2 へ進めます");
    is("ホームのタイルの一言(全クリア・最後)", storyTileNote({ ...base, phase: 3, story: { 1: [], 2: [], 3: [...STORY_AXES] } }), "全ステージクリア");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log("\n配線(game.jsx / screens.jsx)");
{
  const fs = await import("node:fs");
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  const screens = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  is("GameCore に story プロップ(と次へ・やり直しの受け口)", /\n  story = null,\n  onNextStory = null,\n  onRetryStory = null,\n  round = 0,/.test(game), true);
  is("CPU はストーリーなら軸の王の定石CPU", game.includes("const foeArea = story ? storyCpuArea(story.axis, story.king) : cpuArea;") && game.includes("josekiCpuAction(a, T, foeArea.type, foeArea.king)"), true);
  is("START_SETUP にフェーズの旗(フェーズ1は王の力なし)", game.includes("...setupFlagsForPhase(phase),"), true);
  is("フェーズは チュートリアル=全部の決まり / 通信=部屋 / ストーリー=ステージ / 手元=profile", game.includes("const phase = tutorial ? PHASE_MAX : network ? onlinePhase(network.phase) : story ? story.phase : phaseOf(loadProfile());"), true);
  is("フェーズ<3 では手元の 9×9 でもエリアと定石の山札を載せない", (game.match(/rulesForPhase\(phase\)\.areas &&/g) || []).length >= 2, true);
  is("ストーリーは軸の札を積んだ山札", /\.\.\.\(story && cpu && !network && !tutorial\s*\? \{ deck: storyDeck\(story\.axis, story\.king\) \}/.test(game), true);
  is("ゲストは部屋のフェーズで決め直す", game.includes("phase: onlinePhase(network.phase),"), true);
  is("勝てばクリアの記録(profile.story)。xp ははじめてのクリアだけ", /\.\.\.\(story\s*\? \{ \.\.\.\(won && freshStory \? \{ xp: STORY_XP \} : null\), story: \{ axis: story\.axis, phase: story\.phase \} \}/.test(game), true);
  is("はじめてのクリアだけ褒美(先に fresh を取る。基準は recordGame と同じ)", /const freshStory =\s*!!story && won === true && phaseOf\(loadProfile\(\)\) === story\.phase && storyFreshClear\(loadProfile\(\), story\.axis\);/.test(game) && game.includes("if (freshStory) grantStoryReward(story.phase, story.axis).catch(() => {});"), true);
  is("次のステージは未クリアの中から、全部済みなら allCleared", game.includes("const next = nextStageAfter(afterProfile, story.axis);") && game.includes("allCleared: !nextStage(afterProfile),"), true);
  is("前の局の結果を持ち越さない", /if \(a\.phase !== "gameover"\) \{\s*recordedRef\.current = false;\s*\/\/[^\n]*\n\s*setStoryResult\(null\);/.test(game), true);
  is("もう一度遊ぶ・次のステージへ は説明から(onRetryStory / onNextStory)", game.includes("onClick={onRetryStory}") && game.includes("onClick={() => onNextStory(story.next.axis)}") && screens.includes("onRetryStory={story ? () => (showStory(), setStoryIntro(story.axis)) : null}") && screens.includes("onNextStory={(axis) => (showStory(), setStoryIntro(axis))}"), true);
  is("ストーリーを始めるとき相手の装備とエリアを引きずらない", screens.includes("setCpuSkins(createCpuLoadout()), setCpuArea(null), setRound(0),"), true);
  is("ランダムのホストは相手を断るとき部屋も消す", /guestPhaseOf\(g\.data\) !== myPhase[\s\S]{0,300}deleteRoom\(d\);/.test(screens), true);
  is("オンラインの勝ちは部屋のフェーズを添えて数える", game.includes("...(network ? { phase: onlinePhase(network.phase) } : null),"), true);
  is("対局後の見出しは「ステージクリア!」", game.includes('"ステージクリア!"') && game.includes("次のステージへ") && game.includes("ストーリーへ"), true);
  is("ホームのタイルはストーリー(チュートリアルの場所)", /tone="story"[\s\S]*?label="ストーリー"[\s\S]*?note=\{storyTileNote\(profile\)\}[\s\S]*?onClick=\{onStory\}/.test(screens) && !/tone="tutorial"/.test(screens), true);
  is("ストーリーの画面とステージ前の1枚", screens.includes("<StoryScreen onBack={() => t(\"menu\")} onStart={(axis) => setStoryIntro(axis)} />") && screens.includes("<StoryIntro"), true);
  is("ステージは 5×5・札を絞らない・王は軸から", screens.includes("boardSize={tut ? tut.boardSize : story ? 5 : i}") && screens.includes("pool={!a && !tut && !bot && !story ? localPool : null}") && screens.includes("king: pickStoryKing(axis)"), true);
  is("GameCore に story を渡す", screens.includes("story={story}"), true);
  is("対局を離れるときは story を消す", (screens.match(/setStory\(null\)/g) || []).length >= 7, true);
  is("チュートリアルの配線は残す(検査の正規表現がそのまま)", screens.includes("tutorial={tut}") && screens.includes("onTutorial={showTutorials}") && screens.includes("<TutorialSelect"), true);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) { console.error("NG: " + fail.join(", ")); process.exit(1); }
