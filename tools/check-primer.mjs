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
const { PRIMER_PAGES, Primer, primerLineText, primerPhrases } = await import(
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
// 行ごとの文(<p> の中の句をつないだもの)。2026-10-05 見直しで行の中は句ごとの span になった
const rows = (node) => all(node, (n) => n.type === "p").map((p) => texts(p).join(""));
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
// 題も句の塊で出す(2026-10-06 見直し。320 幅で「トッタリーへようこ/そ」と割れた)。手で切った句をつなぐと題
is("1枚目の題は「トッタリーへ」「ようこそ」の句(つなぐと題)", [...(PRIMER_PAGES[0].titlePhrases || [])], ["トッタリーへ", "ようこそ"]);
is("手で切った題の句は、つなぐと題と同じ", PRIMER_PAGES.every((p) => !p.titlePhrases || p.titlePhrases.join("") === p.title), true);
is(
  "題は句の塊で描く(手で切った句か、読点で切った句)",
  /<h3>\s*\{\(page\.titlePhrases \|\| primerPhrases\(page\.title\)\)\.map\(\(phrase, i\) => \(\s*<span className="text-phrase" key=\{i\}>/.test(fs.readFileSync(new URL("../src/ui/primer.jsx", import.meta.url), "utf8")),
  true,
);
is("鍵が重ならない", new Set(PRIMER_PAGES.map((p) => p.key)).size, PRIMER_PAGES.length);

console.log("\n導入の中身(寿司将棋のように: どんなゲームか → 勝ち方。2026-09-30 本人の指示)");
is("並び: ようこそ → 一手ずつ → 勝ち方 → 討てなくなったら → 王は伏せたまま → 陣 → あとはストーリーで", PRIMER_PAGES.map((p) => p.key), ["welcome", "turn", "win", "judge", "hidden", "setup", "story"]);
is("勝ち方のもう1つ(どちらの王も討てなくなったら、はじめに並べた札の合計が小さいほうの勝ち)", PRIMER_PAGES.find((p) => p.key === "judge").lines.map(primerLineText), ["どちらの王も討てなくなったら、", "はじめに並べた札の合計が、小さいほうの勝ち。"]);
// 1枚目の本文は語り1枚目(prologue.jsx)に合わせ、読点で行を切る(2026-10-01 本人の指示。
// 1行の長文だと「ボードゲ/ーム」と語の途中で折り返していた)
is("どんなゲームかを最初に言う(語り1枚目と同じ言葉)", PRIMER_PAGES[0].lines.join(""), "トランプの札を駒に、伏せて戦う一対一。");
is("1枚目は読点で行を切る", [...PRIMER_PAGES[0].lines], ["トランプの札を駒に、", "伏せて戦う一対一。"]);
is("「王は名乗らない」の題は「王は、伏せたまま」に", PRIMER_PAGES.find((p) => p.key === "hidden").title, "王は、伏せたまま");
is("「名乗らない」の言い回しを使わない", PRIMER_PAGES.some((p) => /名乗らない/.test(p.title + p.lines.map(primerLineText).join(""))), false);
is("勝ち方を言う(相手の王を討てば勝ち)", PRIMER_PAGES.find((p) => p.key === "win").lines.map(primerLineText), ["相手の王を討てば、勝ち。"]);
is("駒の動きはここでは見せない(ステージの前に盤の図で見せる)", PRIMER_PAGES.some((p) => p.rank), false);
is("王の力には触れない(フェーズ1 には無い)", PRIMER_PAGES.some((p) => /王の力|力がつき/.test(p.lines.map(primerLineText).join(""))), false);
{
  // 行の中は句(語のまとまり)ごとの塊で折り返す(2026-10-05 見直し)。iPhone の WebKit は auto-phrase を知らず、
  // 「その駒を取れま/す。」「小さいほう/の勝ちです。」と割れた。句をつないだ文は前と同じ
  const { primerOutroLines } = await import("../src/game/story.js");
  const em = (t) => [...t].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
  const allLines = [
    ...PRIMER_PAGES.flatMap((p) => p.lines),
    ...[1, 2, 3].flatMap((phase) => primerOutroLines({ phase, story: { 1: [], 2: [], 3: [] } })),
  ];
  is("句をつなぐと行の文(読点・句点で切った句も、手で切った句も)", allLines.every((line) => primerPhrases(line).join("") === primerLineText(line)), true);
  // 文の欄は 375 幅で 281px・320 幅で 226px ほど(14px)。1つの句は全角15字ぶんまで
  is("1つの句は全角15字ぶんまで(320 幅の文の欄に入る)", allLines.flatMap(primerPhrases).filter((p) => em(p) > 15), []);
  // 2026-10-06 本人の指示で導入の調子に書き直した。句は読点で切る。読点の無い長い句(「どちらの王も討てなくなったら、」)は手で切る
  is(
    "句は読点で切り、読点の無い長い句は手で切る(討てなくなったら・一手ずつ・あとはストーリーで)",
    [
      primerPhrases(PRIMER_PAGES.find((p) => p.key === "judge").lines[0]),
      primerPhrases(PRIMER_PAGES.find((p) => p.key === "judge").lines[1]),
      primerPhrases(PRIMER_PAGES.find((p) => p.key === "turn").lines[1]),
      primerPhrases(primerOutroLines({ phase: 1, story: { 1: [], 2: [], 3: [] } })[0]),
    ],
    [
      ["どちらの王も", "討てなくなったら、"],
      ["はじめに並べた札の合計が、", "小さいほうの勝ち。"],
      ["相手の駒へ進めば、", "その一枚を取れる。"],
      ["ステージごとに、", "相手の王の動きを覚える。"],
    ],
  );
  // 言葉は導入(語り・はじめの一局)の調子(2026-10-06 本人の指示)。題も本文も、最後の札の差し替え(フェーズ1〜3・全部クリア)も
  const words = [
    ...PRIMER_PAGES.map((p) => p.title),
    ...allLines.map(primerLineText),
    ...primerOutroLines({ phase: 3, story: { 1: [], 2: [], 3: ["23", "45", "67", "89", "10", "jq", "k"] } }).map(primerLineText),
  ];
  is("です・ます調を使わない(題も本文も)", words.filter((w) => /です|ます|ください|でした/.test(w)), []);
  is("「将棋」とほかのゲームの名前を使わない", words.filter((w) => /将棋|チェス|ポーカー|ババ抜き|大富豪/.test(w)), []);
  is("数は漢数字(「1手」「1枚」「1つ」と書かない)", PRIMER_PAGES.flatMap((p) => [p.title, ...p.lines.map(primerLineText)]).filter((w) => /[0-9０-９]/.test(w)), []);
  is("題「1手ずつ」は「一手ずつ」", PRIMER_PAGES.find((p) => p.key === "turn").title, "一手ずつ");
  // 20字を超える行(「はじめに並べた札の合計が、小さいほうの勝ち。」)は、狭い幅で読点のところで折れる
  is("1行は20字前後(22字まで)", words.filter((w) => [...w].length > 22), []);
  is("最後の札の差し替えも導入の調子(全部クリアしたら「ステージは、何度でも遊べる。」)", primerOutroLines({ phase: 3, story: { 1: [], 2: [], 3: ["23", "45", "67", "89", "10", "jq", "k"] } })[1], "ステージは、何度でも遊べる。");
  is("文字列の行は読点・句点のあとで切る", [primerPhrases("次は、二と三の王。"), primerPhrases("王はお互いに伏せたまま。"), primerPhrases("")], [["次は、", "二と三の王。"], ["王はお互いに伏せたまま。"], []]);
}
// 最後の札の2行目は、ストーリー一覧の一行と同じ言い方(2026-10-01。呼ぶ側が次のステージに差し替える)
is("最後はストーリーへ渡す(一覧の一行と同じ「次は、二と三の王。」)", /ストーリー/.test(PRIMER_PAGES.at(-1).title) && PRIMER_PAGES.at(-1).lines.at(-1) === "次は、二と三の王。", true);
{
  // 絵は盤で使っているものをそのまま。手引きのためだけの絵を持たない
  const srcText = read("src/ui/primer.jsx");
  is("盤の駒(Piece)をそのまま並べる", /<Piece\b/.test(srcText), true);
  is("動ける先を手で塗っていない", /md-reach|md-cell/.test(srcText), false);
  reset();
  states[0] = PRIMER_PAGES.findIndex((p) => p.key === "turn");
  const tree = render({ onDone: () => {} });
  is("「一手ずつ」の絵は自分の駒 ▶ 相手の駒", all(tree, (n) => n.type === "Piece").length, 2);
  reset();
  states[0] = PRIMER_PAGES.findIndex((p) => p.key === "judge");
  const judge = render({ onDone: () => {} });
  is("「討てなくなったら」の絵は札の組が2つ(合計の小さいほうが勝ち)", [all(judge, (n) => n.type === "CardFace").length, !!cls(judge, "is-win")], [6, true]);
  reset();
  states[0] = PRIMER_PAGES.length - 1;
  const out = render({ onDone: () => {}, outro: ["一行目", "次は 六と七の王から。"] });
  is("最後の札の文は呼ぶ側が差し替えられる(次に遊ぶステージ)", rows(cls(out, "primer-text")), ["一行目", "次は 六と七の王から。"]);
  {
    // 行の中は句ごとの塊だけ(塊の外に字を置かない)
    reset();
    states[0] = PRIMER_PAGES.findIndex((p) => p.key === "judge");
    const judgeText = cls(render({ onDone: () => {} }), "primer-text");
    const spans = all(judgeText, (n) => n.type === "span");
    is("行の中は句ごとの塊(text-phrase)", spans.length > 0 && spans.every((n) => n.props.className === "text-phrase") && all(judgeText, (n) => n.type === "p").every((p) => p.children.every((c) => typeof c === "object" && c.type === "span")), true);
    is("塊をつなぐと行の文", rows(judgeText), PRIMER_PAGES.find((p) => p.key === "judge").lines.map(primerLineText));
  }
  const src2 = read("src/ui/primer.jsx");
  is("開いたら「つづき」に focus(画面は送らない)", /focus\(\{ preventScroll: true \}\)/.test(src2) && /ref=\{nextRef\}/.test(src2), true);
  is("自分の中に向いた矢印・Escape は受ける", /t\.closest\("\.primer"\)/.test(src2) && /e\.key === "Escape" && onSkip/.test(src2), true);
  is("重ねた画面として読み上げる", /role="dialog" aria-modal="true"/.test(src2), true);
}

console.log("\n送り方");
{
  reset();
  let done = 0;
  let tree = render({ onDone: () => done++ });
  is("はじめは1ページ目", rows(cls(tree, "primer-text")).includes(primerLineText(PRIMER_PAGES[0].lines[0])), true);
  is("1ページ目は戻れない", cls(tree, "primer-back").props.disabled, true);
  for (let i = 1; i < PRIMER_PAGES.length; i++) {
    cls(tree, "primer-next").props.onClick();
    tree = render({ onDone: () => done++ });
  }
  is("最後まで送れる", rows(cls(tree, "primer-text")).includes(primerLineText(PRIMER_PAGES.at(-1).lines[0])), true);
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
  is("戻れる", rows(cls(tree, "primer-text")).includes(primerLineText(PRIMER_PAGES[0].lines[0])), true);
}
{
  // 最後の一言は呼ぶ側が決める。既定は「とじる」(自動で出さなくなり、開いた画面へ閉じて戻るだけ。2026-10-01)
  reset();
  states[0] = PRIMER_PAGES.length - 1;
  const tree = render({ onDone: () => {}, doneLabel: "ステージへ" });
  is("最後の一言は呼ぶ側が決める", texts(cls(tree, "primer-next")).join(""), "ステージへ");
  is("読み飛ばしを渡さなければ出さない", !!cls(tree, "primer-skip"), false);
  reset();
  states[0] = PRIMER_PAGES.length - 1;
  const plain = render({ onDone: () => {}, onSkip: () => {} });
  is("既定は「とじる」(最後の釦も、途中でやめる釦も)", [texts(cls(plain, "primer-next")).join(""), texts(cls(plain, "primer-skip")).join("")], ["とじる", "とじる"]);
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
  // 2026-10-01 本人の指示: 手引き7枚は自動では出さない(導入は語り2枚とはじめの一局。src/game/intro.js)。
  // ストーリー画面の「遊び方」と早見表の「はじめに」に残す
  is("ホームの案内(10連のあと)で自動に出さない", /offerTutorial|doneLabel="ストーリーを始める"/.test(screens), false);
  is("ストーリーをはじめて開いても自動に出さない", /storyPrimerSeen\(\)|setStoryPrimer\("first"\)|storyAfterPrimer/.test(screens), false);
  is("手引きを出すのはストーリーの「遊び方」の1か所だけ(screens.jsx)", (screens.match(/<Primer\b/g) || []).length, 1);
  is("ストーリーの「遊び方」から読み返せる", screens.includes('onGuide={() => setStoryPrimer("guide")}') && /storyPrimer && \(\s*<Primer/.test(screens), true);
  is("「遊び方」は閉じるだけ(最後の釦も途中でやめる釦も「とじる」)", /<Primer\s+outro=\{primerOutroLines\(loadProfile\(\)\)\}\s+doneLabel="とじる"\s+skipLabel="とじる"\s+onSkip=\{\(\) => setStoryPrimer\(null\)\}\s+onDone=\{\(\) => setStoryPrimer\(null\)\}/.test(screens), true);
  is("導入と説明を重ねない", /storyIntro && !storyPrimer && \(/.test(screens), true);
  is("手引きの最後の文は次に遊ぶステージに合わせる(2か所とも)", (screens.match(/outro=\{primerOutroLines\(loadProfile\(\)\)\}/g) || []).length === 1 && read("src/ui/guides.jsx").includes("outro={primerOutroLines(loadProfile())}"), true);
  const guides = read("src/ui/guides.jsx");
  is("早見表からも読み返せる", /tab === "primer"/.test(guides), true);
  is("早見表に「はじめに」がある", /はじめに/.test(guides), true);
  is("早見表の手引きも閉じるだけ", guides.includes('<Primer doneLabel="とじる" onDone={onClose} onSkip={onClose} skipLabel="とじる"'), true);
  const css = read("src/styles.css");
  is("見た目が用意されている", /\.primer\b/.test(css), true);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
