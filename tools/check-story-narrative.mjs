import assert from "node:assert/strict";
import { STORY_AXES } from "../src/game/phase.js";
import {
  CHRONICLE,
  STORY_ARCS,
  STORY_PHASES,
  storyArc,
  storyEpisode,
  storyPages,
  episodeAccess,
} from "../src/game/story-narrative.js";
import { stageOf, storyRival } from "../src/game/story.js";
import { STORY_PHRASES, storyPhrases } from "../src/game/story-phrases.js";
import { phrasesOf } from "../src/ui/phrase-split.js";

assert.deepEqual(
  STORY_ARCS.map((a) => a.axis),
  STORY_AXES,
);
assert.equal(Object.keys(STORY_PHASES).length, 3);
const titles = new Set();
for (const arc of STORY_ARCS) {
  assert.deepEqual(arc.ranks, stageOf(arc.axis).ranks);
  assert.deepEqual(
    arc.characters.map((c) => c.rank),
    arc.ranks,
  );
  for (const phase of [1, 2, 3]) {
    const e = storyEpisode(arc.axis, phase);
    assert.ok(e.title && e.hook && e.place && e.next);
    if (phase > 1)
      assert.ok(e.recap, `${arc.axis}/${phase}: previous chapter context`);
    assert.equal(e.before.length, 4);
    assert.equal(e.before.at(-1).speaker, "あなた");
    assert.ok(e.purpose?.goal && e.purpose.reason && e.purpose.kind);
    if (phase > 1) assert.ok(e.purpose.leadership);
    if (phase === 3) {
      assert.ok(e.purpose.rivalIdeal && e.purpose.playerIdeal);
      assert.notEqual(e.purpose.rivalIdeal, e.purpose.playerIdeal);
      assert.ok(!JSON.stringify(e).includes("演習"));
    }
    assert.equal(e.after.length, 2);
    const rival = storyRival(arc.axis, phase);
    assert.equal(rival.quote, e.before[2].text);
    assert.equal(rival.quoteSpeaker, e.before[2].speaker);
    for (const page of [...e.before, ...e.after]) {
      if (page.speaker !== "語り") {
        assert.ok(page.text.startsWith("「") && page.text.endsWith("」"));
        assert.equal((page.text.match(/「/g) || []).length, 1);
        assert.equal((page.text.match(/」/g) || []).length, 1);
        assert.equal(
          (page.text.match(/『/g) || []).length,
          (page.text.match(/』/g) || []).length,
        );
      } else assert.ok(!page.text.startsWith("「"));
      assert.ok(
        page.speaker && page.text.length >= 20 && page.text.length < 160,
      );
    }
    assert.ok(!titles.has(e.title));
    titles.add(e.title);
    assert.equal(storyRival(arc.axis, phase).name, arc.cast);
    assert.equal(storyRival(arc.axis, phase).skin, false);
    // Reading cannot unlock later phases, endings, rewards or modify the account.
    const profile = { phase, story: { 1: [], 2: [], 3: [] }, xp: 500 };
    const original = JSON.stringify(profile);
    assert.deepEqual(storyPages(profile, arc.axis, phase), e.before);
    assert.deepEqual(storyPages(profile, arc.axis, phase, "after"), []);
    if (phase < 3)
      assert.deepEqual(storyPages(profile, arc.axis, phase + 1), []);
    assert.equal(JSON.stringify(profile), original);
    profile.story[phase].push(arc.axis);
    assert.deepEqual(storyPages(profile, arc.axis, phase, "after"), e.after);
    assert.deepEqual(episodeAccess(profile, arc.axis, phase), {
      available: true,
      cleared: true,
    });
    // Existing saves unlock the same endings; advancing does not remove old chapters.
    profile.phase = 3;
    assert.deepEqual(storyPages(profile, arc.axis, phase, "after"), e.after);
  }
}
assert.equal(titles.size, 21);
assert.equal(storyArc("A"), null); // Ninja is the connecting narrator, not an eighth battle/reward.
assert.deepEqual(storyPages({}, "missing", 1), []);
assert.deepEqual(storyPages(null, "23", 1, "after"), []);

/*
 * 短い文を句(語のまとまり)に切る(2026-10-06 見直し)。画面は句を折り返さない塊(.text-phrase)で出す。
 * iPhone の WebKit は word-break: auto-phrase を知らず、375・320 幅で「積ま/れていた」「救われてき/た。」
 * 「村へ届/ける。」「閉ざされた/門」「明日を分け/る手」「生きるため/の反抗」「刃を向け/る。」と割れた。
 * 切り方は src/game/story-phrases.js(無ければ読点・句点で切る)。句は 320 幅の列に入る字数まで
 * (全角1・半角0.6 で数える)。描いた幅は tools/check-story-fit.mjs(頭なしの Chrome)が測る
 */
const CAPS = {
  年代記の一言: 18,
  フェーズの札の名: 6, // 320 幅は札の左右の余白を詰めて 70px(story-chronicle.css)
  フェーズの目的: 15,
  章の名: 7,
  ステージの一行: 11,
  登場人物の一言: 18,
  あなたの目的: 16,
  次へ続く一言: 19,
  信念: 17,
};
const ems = (s) =>
  [...s].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
const shortTexts = [["年代記の一言", "年代記", CHRONICLE.subtitle]];
for (const p of [1, 2, 3]) {
  shortTexts.push(["フェーズの札の名", `フェーズ${p}`, STORY_PHASES[p].title]);
  if (p > 1)
    shortTexts.push(["フェーズの目的", `フェーズ${p}`, STORY_PHASES[p].purpose]);
}
for (const arc of STORY_ARCS) {
  for (const c of arc.characters)
    shortTexts.push(["登場人物の一言", `${arc.axis} ${c.name}`, c.detail]);
  for (const phase of [1, 2, 3]) {
    const e = storyEpisode(arc.axis, phase);
    const at = `${arc.axis}/${phase}`;
    shortTexts.push(["章の名", at, e.title]);
    shortTexts.push(["ステージの一行", at, e.hook]);
    shortTexts.push(["あなたの目的", at, e.purpose.goal]);
    shortTexts.push(["次へ続く一言", at, e.next]);
    if (e.purpose.rivalIdeal) {
      shortTexts.push(["信念", `${at} 相手`, e.purpose.rivalIdeal]);
      shortTexts.push(["信念", `${at} あなた`, e.purpose.playerIdeal]);
    }
  }
}
const phrasesFor = (text) => phrasesOf(storyPhrases(text));
for (const [kind, at, text] of shortTexts) {
  const phrases = phrasesFor(text);
  assert.equal(phrases.join(""), text, `${kind} ${at}: 句をつなぐと文のまま`);
  for (const phrase of phrases) {
    assert.ok(
      ems(phrase) <= CAPS[kind],
      `${kind} ${at}: 句「${phrase}」が 320 幅の列(全角${CAPS[kind]}字)に入らない。src/game/story-phrases.js で手で切る`,
    );
    assert.ok(
      phrase && !/^[、。?」』)]/.test(phrase),
      `${kind} ${at}: 句「${phrase}」が読点・句点・閉じ括弧で始まる`,
    );
  }
}
// 手で切った並びは、今の文のどれかと同じで(書き換えた文の古い並びを残さない)、読点・句点で切っただけとは違う
const texts = new Set(shortTexts.map(([, , text]) => text));
for (const phrases of STORY_PHRASES) {
  const text = phrases.join("");
  assert.ok(
    texts.has(text),
    `story-phrases.js の「${text}」が今の短い文に無い(文を書き換えたら切り方も直す)`,
  );
  assert.ok(phrases.every((p) => p.length > 0), `「${text}」に空の句`);
  assert.notDeepEqual(
    phrases,
    phrasesOf(text),
    `「${text}」は読点・句点で切るだけでよい(表に書かない)`,
  );
}
assert.equal(new Set(STORY_PHRASES.map((p) => p.join(""))).size, STORY_PHRASES.length);
// 割れていた語は、1つの句の中にある
const ep = (axis, phase) => storyEpisode(axis, phase);
for (const [text, word] of [
  [ep("23", 1).hook, "積まれていた。"],
  [storyArc("45").characters[0].detail, "救われてきた。"],
  [ep("45", 1).purpose.goal, "届ける。"],
  [STORY_PHASES[1].title, "閉ざされた門"],
  [STORY_PHASES[3].title, "分ける手"],
  [CHRONICLE.subtitle, "刃を向ける。"],
  [ep("45", 1).hook, "村があった。"],
  [ep("67", 1).hook, "閉じ込めていた。"],
])
  assert.ok(
    phrasesFor(text).some((p) => p.includes(word)),
    `「${word}」が句の間で切れる: ${phrasesFor(text).join(" | ")}`,
  );
assert.ok(
  phrasesOf(storyArc("23").theme).includes("生きるための反抗"),
  "主題「生きるための反抗」は1つの句",
);

/* 画面(story.jsx・story-chronicle.jsx)。短い文は句の塊だけで書く(長い地の文は段落のまま) */
{
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { createRequire } = await import("node:module");
  const { build } = await import("esbuild");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-narrative-"));
  try {
    const outfile = path.join(dir, "view.cjs");
    await build({
      stdin: {
        resolveDir: process.cwd(),
        loader: "jsx",
        contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {StoryScreen, StoryIntro} from './src/ui/story.jsx';
const noop=()=>{};
export const screen=()=>renderToStaticMarkup(<StoryScreen onBack={noop} onStart={noop} onGuide={noop} />);
export const intro=(axis, phase)=>renderToStaticMarkup(<StoryIntro axis={axis} phase={phase} onStart={noop} onBack={noop} />);`,
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
    const noop = () => {};
    const mem = new Map();
    Object.assign(globalThis, {
      localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) },
      sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => true,
      matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
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
      },
    });
    globalThis.window = globalThis;
    const { screen, intro } = createRequire(import.meta.url)(outfile);
    const { PHASE_EPOCH } = await import("../src/game/phase.js");
    const save = (p) => mem.set("tottery.account.v1", JSON.stringify({ name: "t", phaseEpoch: PHASE_EPOCH, phaseWins: { 1: 5, 2: 5, 3: 0 }, ...p }));
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    const spans = (phrases) => phrases.map((p) => `<span class="text-phrase">${esc(p)}</span>`).join("");
    // 句の塊で出ている(つなぐと文)。2つ以上の句の文は、切らないまま出ているところが無い
    const phrased = (html, text, where) => {
      const phrases = phrasesFor(text);
      assert.ok(html.includes(spans(phrases)), `${where}: 「${text}」を句の塊(${phrases.join(" | ")})で出す`);
      if (phrases.length > 1) assert.ok(!html.includes(esc(text)), `${where}: 「${text}」を切らずに出しているところがある`);
    };
    const joined = (head, sep, tail) => `<span class="text-phrase">${esc(`${head} ${sep}`)}</span> ${spans(phrasesFor(tail))}`;
    for (const phase of [1, 2, 3]) {
      const story = { 1: [], 2: [], 3: [] };
      for (let p = 1; p < phase; p++) story[p] = [...STORY_AXES];
      story[phase] = ["23"];
      save({ phase, story });
      const h = screen();
      const where = `一覧(フェーズ${phase})`;
      phrased(h, "ストーリー · 七つの立場、三つの時代", where);
      phrased(h, CHRONICLE.subtitle, where);
      for (const p of [1, 2, 3]) assert.ok(h.includes(`<b>${spans(phrasesFor(STORY_PHASES[p].title))}</b>`), `${where}: フェーズの札の名は句の塊だけ`);
      if (phase > 1) assert.ok(h.includes(`<p>${spans(phrasesFor(STORY_PHASES[phase].purpose))}</p>`), `${where}: フェーズの目的は句の塊だけ`);
      else assert.ok(h.includes(`<p>${esc(CHRONICLE.player)}</p>`), `${where}: あなたが戦う理由は段落のまま`);
      for (const arc of STORY_ARCS) {
        const e = storyEpisode(arc.axis, phase);
        assert.ok(h.includes(`<span class="chronicle-role">${joined(arc.role, "／", arc.theme)}</span>`), `${where} ${arc.axis}: 立場と主題は句の塊(「／」は前の句に付ける)`);
        assert.ok(h.includes(`<b>${spans(phrasesFor(e.title))}</b>`), `${where} ${arc.axis}: 章の名は句の塊だけ`);
        assert.ok(h.includes(`<small>${spans(phrasesFor(e.hook))}</small>`), `${where} ${arc.axis}: ステージの一行は句の塊だけ`);
        phrased(h, e.hook, `${where} ${arc.axis}`);
      }
      assert.ok(h.includes(`<small>${joined("✓ クリア済み", "·", "後日談を解放")}</small>`), `${where}: クリアした段の一行は句の塊`);
      assert.equal(h.split(`<small>${joined("初回クリア", "·", "チケット 10枚")}</small>`).length - 1, 6, `${where}: 未クリアの段の一行は句の塊(6つ)`);
    }
    // 閉じた頁(フェーズ1 の人がフェーズ2 を見る画面は札を押して開くので、一言だけ文で見る)
    assert.ok(
      fs.readFileSync(new URL("../src/ui/story.jsx", import.meta.url), "utf8").includes('<Phrases text="この先の頁は、まだ閉じている。" />'),
      "閉じた頁の一言は句の塊",
    );
    for (const arc of STORY_ARCS)
      for (const phase of [1, 2, 3]) {
        save({ phase: 3, story: { 1: [...STORY_AXES], 2: [...STORY_AXES], 3: [] } });
        const h = intro(arc.axis, phase);
        const e = storyEpisode(arc.axis, phase);
        const where = `対局説明 ${arc.axis}/${phase}`;
        // 章の名は物語の頁と対局説明の2か所
        assert.equal(h.split(`<h3>${spans(phrasesFor(e.title))}</h3>`).length - 1, 2, `${where}: 章の名は句の塊だけ(物語の頁と対局説明)`);
        for (const c of arc.characters) assert.ok(h.includes(`<small>${spans(phrasesFor(c.detail))}</small>`), `${where}: 登場人物 ${c.name} の一言は句の塊だけ`);
        // あなたの目的も物語の頁(1枚目)と対局説明の2か所
        assert.equal(h.split(`<p>${spans(phrasesFor(e.purpose.goal))}</p>`).length - 1, 2, `${where}: あなたの目的は句の塊だけ(物語の頁と対局説明)`);
        phrased(h, e.purpose.goal, where);
        assert.ok(h.includes(`<summary>${joined(e.purpose.kind, "·", "対立する理由")}</summary>`), `${where}: 対立する理由の見出しは句の塊`);
        assert.ok(h.includes(`<p>${esc(e.purpose.reason)}</p>`), `${where}: 対立する理由の本文は段落のまま`);
        if (e.purpose.rivalIdeal)
          for (const ideal of [e.purpose.rivalIdeal, e.purpose.playerIdeal]) assert.ok(h.includes(`<dd>${spans(phrasesFor(ideal))}</dd>`), `${where}: 信念は句の塊だけ`);
        assert.ok(h.includes(`<small>${spans(phrasesOf(storyRival(arc.axis, phase).aim))}</small>`), `${where}: この局のねらいは句の塊だけ`);
        assert.ok(h.includes(`<small class="chronicle-kicker">${joined(arc.name, "／", STORY_PHASES[phase].label)}</small>`), `${where}: 物語の頁の小見出しは句の塊`);
        assert.ok(h.includes(esc(storyRival(arc.axis, phase).quote)), `${where}: 挑戦状(台詞)は段落のまま`);
      }
    // 次へ続く一言(後日談の最後の頁)は送った先にしか出ないので、部品の書き方で見る(描いた幅は check-story-fit)
    const chronicle = fs.readFileSync(new URL("../src/ui/story-chronicle.jsx", import.meta.url), "utf8");
    assert.ok(/<\/small>\s*<StoryText text=\{episode\.next\} \/>\s*<\/p>/.test(chronicle), "次へ続く一言は句の塊");
    // 320 幅で札の名「閉ざされた門」(66px)が入るよう、札の左右の余白を詰める(列 70px)
    assert.ok(
      /@media \(max-width: 359px\) \{\s*\.chronicle-phases button \{\s*padding-left: 4px;\s*padding-right: 4px;\s*\}\s*\}/.test(
        fs.readFileSync(new URL("../src/ui/story-chronicle.css", import.meta.url), "utf8"),
      ),
      "320 幅の札の左右の余白は 4px",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
console.log(
  `Story narrative: 21 episodes, normal-character roles, phase locks, endings and old-save replay verified. Short texts: ${shortTexts.length} phrased to fit 320 width (${STORY_PHRASES.length} hand-split).`,
);
