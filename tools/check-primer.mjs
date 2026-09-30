/**
 * はじめての手引き(src/ui/primer.jsx)を確かめる。
 *
 * 2026-09-29 本人の指示。「寿司将棋」の導入を見て:
 *   「どんなゲームなのか、勝利条件はなにか、駒のそれぞれの動かし方の説明など、
 *    導入でまねていきたいところが多かった」
 *
 * 守りたいのは、寿司将棋の導入が分かりやすかった理由そのもの:
 *   - **1ページ = 1つのこと。** 絵1枚と1〜2行だけ
 *   - **どんなゲームか → 勝ち方。** 何をするゲームかを先に渡す
 * 2026-09-30 に導入だけに絞った。駒の動きはストーリーのフェーズ1 で、ステージごとに盤の図で見せる
 * (tools/check-story.mjs が見る)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";
import { MOVE_TEXT } from "../src/game/constants.js";
import { CARD_POOLS } from "../src/game/constants.js";

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

// React・図・札は、この検査のためだけの偽物に差し替える
const states = [];
let stateIndex = 0;
const refs = [];
let refIndex = 0;
globalThis.__react = {
  useState: (init) => {
    const i = stateIndex++;
    if (!(i in states)) states[i] = init;
    return [states[i], (v) => (states[i] = typeof v === "function" ? v(states[i]) : v)];
  },
  useRef: (v) => {
    const i = refIndex++;
    return (refs[i] ||= { current: v });
  },
  useEffect: () => {},
};
globalThis.__h = (type, props, ...children) => {
  // 中の部品(PrimerArt など)はそのまま呼んで、最後まで組み立てる。
  // 偽物(MoveDiagram / CardFace / Piece)は __name が付いているので呼ばない
  if (typeof type === "function" && !type.__name)
    return type({ ...(props || {}), children });
  return {
    type: typeof type === "function" ? type.__name || type.name || "fn" : type,
    props: props || {},
    children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false),
  };
};
const stub = (name) => {
  const f = (props) => globalThis.__h(name, props);
  f.__name = name;
  return f;
};

globalThis.__MOVE_TEXT = MOVE_TEXT;
// data: の中からは相対の取り込みが解けないので、外から渡す
const src = read("src/ui/primer.jsx")
  .replace(/import \{[^}]*\} from "react";/, "const { useEffect, useRef, useState } = globalThis.__react;")
  // キーの宛先の判定は別の小さな部品。ここでは「自分宛て」で固定する
  .replace(/import \{[^}]*\} from "\.\/key-target\.js";/, "const typing = () => false;")
  .replace(/import \{[^}]*\} from "\.\.\/game\/constants\.js";/, "const MOVE_TEXT = globalThis.__MOVE_TEXT;")
  .replace(/import \{[^}]*\} from "\.\/guides\.jsx";/, "const MoveDiagram = globalThis.__stub('MoveDiagram');")
  .replace(/import \{[^}]*\} from "\.\/cards\.jsx";/, "const CardFace = globalThis.__stub('CardFace'), Piece = globalThis.__stub('Piece');");
globalThis.__stub = stub;
const js = transformSync(src, {
  loader: "jsx",
  jsx: "transform",
  jsxFactory: "globalThis.__h",
  jsxFragment: '"fragment"',
  format: "esm",
}).code;
const { PRIMER_PAGES, Primer } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);

const find = (node, ok) => {
  if (!node || typeof node !== "object") return null;
  if (ok(node)) return node;
  for (const c of node.children || []) {
    const hit = find(c, ok);
    if (hit) return hit;
  }
  return null;
};
const all = (node, ok, into = []) => {
  if (node && typeof node === "object") {
    if (ok(node)) into.push(node);
    for (const c of node.children || []) all(c, ok, into);
  }
  return into;
};
const texts = (node, into = []) => {
  if (typeof node === "string") into.push(node);
  else if (node && typeof node === "object") for (const c of node.children || []) texts(c, into);
  return into;
};
const cls = (node, name) =>
  find(node, (n) => typeof n.props?.className === "string" && n.props.className.split(" ").includes(name));
const render = (props) => {
  stateIndex = 0;
  refIndex = 0;
  return Primer(props);
};
const reset = () => {
  states.length = 0;
  refs.length = 0;
};

console.log("手引きの中身");
is("ページがある", PRIMER_PAGES.length > 0, true);
is(
  "1ページは1〜2行",
  PRIMER_PAGES.every((p) => p.lines.length >= 1 && p.lines.length <= 2),
  true,
);
is("題がどれにも付いている", PRIMER_PAGES.every((p) => !!p.title), true);
is("鍵が重ならない", new Set(PRIMER_PAGES.map((p) => p.key)).size, PRIMER_PAGES.length);

console.log("\n導入の中身(寿司将棋のように: どんなゲームか → 勝ち方。2026-09-30 本人の指示)");
is("並び: ようこそ → 1手ずつ → 勝ち方 → 王は伏せたまま → 陣 → あとはストーリーで", PRIMER_PAGES.map((p) => p.key), ["welcome", "turn", "win", "hidden", "setup", "story"]);
is("どんなゲームかを最初に言う", PRIMER_PAGES[0].lines.join("").includes("ボードゲーム"), true);
is("勝ち方を言う(相手の王を討てば勝ち)", PRIMER_PAGES.find((p) => p.key === "win").lines.join("").includes("相手の王を討てば勝ち"), true);
is("駒の動きはここでは見せない(ステージの前に盤の図で見せる)", PRIMER_PAGES.some((p) => p.rank), false);
is("王の力には触れない(フェーズ1 には無い)", PRIMER_PAGES.some((p) => /王の力|力がつき/.test(p.lines.join(""))), false);
is("最後はストーリーへ渡す", /ストーリー/.test(PRIMER_PAGES.at(-1).title) && PRIMER_PAGES.at(-1).lines.join("").includes("2 と 3"), true);
{
  // 絵は盤で使っているものをそのまま。手引きのためだけの絵を持たない
  const srcText = read("src/ui/primer.jsx");
  is("盤の駒(Piece)をそのまま並べる", /<Piece\b/.test(srcText), true);
  is("動ける先を手で塗っていない", /md-reach|md-cell/.test(srcText), false);
  reset();
  states[0] = PRIMER_PAGES.findIndex((p) => p.key === "turn");
  const tree = render({ onDone: () => {} });
  is("「1手ずつ」の絵は自分の駒 ▶ 相手の駒", all(tree, (n) => n.type === "Piece").length, 2);
}

console.log("\n送り方");
{
  reset();
  let done = 0;
  let tree = render({ onDone: () => done++ });
  is("はじめは1ページ目", texts(cls(tree, "primer-text")).includes(PRIMER_PAGES[0].lines[0]), true);
  is("1ページ目は戻れない", cls(tree, "primer-back").props.disabled, true);
  for (let i = 1; i < PRIMER_PAGES.length; i++) {
    cls(tree, "primer-next").props.onClick();
    tree = render({ onDone: () => done++ });
  }
  is("最後まで送れる", texts(cls(tree, "primer-text")).includes(PRIMER_PAGES.at(-1).lines[0]), true);
  is("途中では終わらない", done, 0);
  cls(tree, "primer-next").props.onClick();
  is("最後を押すと終わる", done, 1);
  tree = render({ onDone: () => done++ });
  cls(tree, "primer-next").props.onClick();
  cls(tree, "primer-next").props.onClick();
  is("連打しても一度きり", done, 1);
}
{
  reset();
  let tree = render({ onDone: () => {} });
  cls(tree, "primer-next").props.onClick();
  tree = render({ onDone: () => {} });
  cls(tree, "primer-back").props.onClick();
  tree = render({ onDone: () => {} });
  is("戻れる", texts(cls(tree, "primer-text")).includes(PRIMER_PAGES[0].lines[0]), true);
}
{
  // 最後の一言は呼ぶ側が決める(10連のあとは「ストーリーを始める」、早見表は「とじる」)
  reset();
  states[0] = PRIMER_PAGES.length - 1;
  const tree = render({ onDone: () => {}, doneLabel: "ストーリーを始める" });
  is("最後の一言は呼ぶ側が決める", texts(cls(tree, "primer-next")).join(""), "ストーリーを始める");
  is("読み飛ばしを渡さなければ出さない", !!cls(tree, "primer-skip"), false);
}
{
  reset();
  let skipped = 0;
  const tree = render({ onDone: () => {}, onSkip: () => skipped++ });
  cls(tree, "primer-skip").props.onClick();
  is("読み飛ばせる", skipped, 1);
}

console.log("\n配線");
{
  const screens = read("src/ui/screens.jsx");
  is("はじめての人に手引きを出す", /offerTutorial && \(\s*<Primer/.test(screens), true);
  is("読み終えたらストーリーの最初のステージへ(前は第1話)", /doneLabel="ストーリーを始める"[\s\S]{0,300}markStoryPrimerSeen\(\);\s*showStory\(\);\s*const next = nextStage\(loadProfile\(\)\);\s*if \(next\) setStoryIntro\(next\.axis\);/.test(screens), true);
  is("ストーリーをはじめて開いたら導入を一度だけ", /if \(!storyPrimerSeen\(\)\) setStoryPrimer\("first"\);/.test(screens), true);
  is("ストーリーの「遊び方」から読み返せる", screens.includes('onGuide={() => setStoryPrimer("guide")}') && /storyPrimer && \(\s*<Primer/.test(screens), true);
  is("あとで、も選べる", /onSkip=\{\(\) => setOfferTutorial\(!1\)\}/.test(screens), true);
  const guides = read("src/ui/guides.jsx");
  is("早見表からも読み返せる", /tab === "primer"/.test(guides), true);
  is("早見表に「はじめに」がある", /はじめに/.test(guides), true);
  const css = read("src/styles.css");
  is("見た目が用意されている", /\.primer\b/.test(css), true);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
