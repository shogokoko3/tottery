/**
 * はじまりの語り(src/ui/prologue.jsx)を確かめる。
 *
 * 2026-09-28 本人の指示:
 *   「インストール後にすぐガチャが始まるのはいいが、その前になにか物語性を
 *    織り交ぜて、自然な流れでガチャになる導入口を作りたい」
 *
 * 守りたいのは「読ませずに進ませる」こと。物語で足止めしない:
 *   - 1枚1〜2行。長い文章にしない
 *   - どこを押しても次へ。最後の1枚だけ「門へ進む」
 *   - いつでも読み飛ばせる。押しっぱなしでも二重に進まない
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";

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

// React と絵は、この検査のためだけの偽物に差し替える
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
// JSX は「役・属性・中身」のただの入れ子にする(描かずに中身だけ見たい)
globalThis.__h = (type, props, ...children) => ({
  type,
  props: props || {},
  children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false),
});

const src = read("src/ui/prologue.jsx")
  .replace(/import \{[^}]*\} from "react";/, "const { useEffect, useRef, useState } = globalThis.__react;")
  .replace(/import \{[^}]*\} from "\.\.\/assets\.js";/, 'const titleBgImg = "bg";');
const js = transformSync(src, {
  loader: "jsx",
  jsx: "transform",
  jsxFactory: "globalThis.__h",
  jsxFragment: '"fragment"',
  format: "esm",
}).code;
const { PROLOGUE, Prologue } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);

/** 入れ子の中から、条件に合う最初のものを探す */
const find = (node, ok) => {
  if (!node || typeof node !== "object") return null;
  if (ok(node)) return node;
  for (const c of node.children || []) {
    const hit = find(c, ok);
    if (hit) return hit;
  }
  return null;
};
const texts = (node, into = []) => {
  if (typeof node === "string") into.push(node);
  else if (node && typeof node === "object") for (const c of node.children || []) texts(c, into);
  return into;
};
const cls = (node, name) =>
  find(node, (n) => typeof n.props?.className === "string" && n.props.className.split(" ").includes(name));
const render = (onDone) => {
  stateIndex = 0;
  refIndex = 0;
  return Prologue({ onDone });
};
const reset = () => {
  states.length = 0;
  refs.length = 0;
};

console.log("語りの中身");
is("札がある", PROLOGUE.length > 0, true);
is("1枚は1〜2行", PROLOGUE.every((c) => c.lines.length >= 1 && c.lines.length <= 2), true);
is(
  "1行は読み切れる長さ(40字まで)",
  PROLOGUE.every((c) => c.lines.every((l) => l.length <= 40) && (c.note?.length ?? 0) <= 40),
  true,
);
is("どの札にも言葉が入っている", PROLOGUE.every((c) => c.lines.every((l) => l.trim())), true);
is("最後は門へつながる", /門/.test(PROLOGUE[PROLOGUE.length - 1].lines.join("")), true);

console.log("\n進み方");
{
  reset();
  let done = 0;
  let tree = render(() => done++);
  // 1枚目が出ている
  is("はじめは1枚目", texts(cls(tree, "prologue-text")).includes(PROLOGUE[0].lines[0]), true);
  is("最後でなければ「つづき」", texts(cls(tree, "prologue-next")).join(""), "つづき");
  // どこを押しても次へ
  for (let i = 1; i < PROLOGUE.length; i++) {
    tree.props.onClick();
    tree = render(() => done++);
  }
  is("押した数だけ進む", texts(cls(tree, "prologue-text")).includes(PROLOGUE.at(-1).lines[0]), true);
  is("最後の札は「門へ進む」", texts(cls(tree, "prologue-next")).join(""), "門へ進む");
  is("途中では終わらない", done, 0);
  tree.props.onClick();
  is("最後を押すと召喚へ", done, 1);
  // 連打しても二度は呼ばない(門が二重に開かない)
  tree = render(() => done++);
  tree.props.onClick();
  tree.props.onClick();
  is("連打しても一度きり", done, 1);
}

console.log("\n読み飛ばし");
{
  reset();
  let done = 0;
  const tree = render(() => done++);
  const skip = cls(tree, "prologue-skip");
  is("読み飛ばす釦がある", !!skip, true);
  let stopped = false;
  skip.props.onClick({ stopPropagation: () => (stopped = true) });
  is("1枚目からでも召喚へ行ける", done, 1);
  is("下の「次へ」に触らない", stopped, true);
  is("読み飛ばしに説明がある", typeof skip.props["aria-label"], "string");
}

console.log("\n配線");
{
  const screens = read("src/ui/screens.jsx");
  is("名前のあとに語りを出す", /setPrologue\(!0\);/.test(screens), true);
  is("語りは10連の前だけ", /if \(!firstPullDone\(getCollection\(\)\)\)/.test(screens), true);
  const css = read("src/styles.css");
  is("見た目が用意されている", /\.prologue\b/.test(css), true);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
