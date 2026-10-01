/**
 * はじまりの語りと門の語り(src/ui/prologue.jsx)を確かめる。
 *
 * 2026-09-28 本人の指示:
 *   「インストール後にすぐガチャが始まるのはいいが、その前になにか物語性を
 *    織り交ぜて、自然な流れでガチャになる導入口を作りたい」
 * 2026-10-01 本人の指示で作り直した(10連は導入の最後。はじめの一局に勝った褒美):
 *   - 語り2枚(タイトルのあと、はじめの一局の前)。最後の釦は「盤へ」
 *     1枚目「その一枚が、/王かもしれない。」で、伏せ札を自分の指で1枚取る(外れ)
 *   - 門の語り1枚(一局に勝って名前を決めたあと、10連の前)。釦は「門を開く」
 *
 * 守りたいのは「読ませずに進ませる」こと。物語で足止めしない:
 *   - 1枚1つ。見出しは読点ごとの行の配列(text-wrap: balance で語の途中を割らない)
 *   - どこを押しても次へ。ただし伏せ札を取る札は、絵の外を押しても進まない
 *   - いつでも読み飛ばせる。押しっぱなしでも二重に進まない
 *   - 絵の駒の動きはルールどおり(本物の getLegalMoves で確かめる)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { transformSync } from "esbuild";
import { getLegalMoves } from "../src/game/board.js";
import { FIRST_GAME } from "../src/game/tutorial.js";

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

// React・札・設定は、この検査のためだけの偽物に差し替える
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
// 動きを減らす設定(端末)と、設定画面の「対局中の演出」
globalThis.__motion = { reduce: false, motion: "full" };
// JSX は「役・属性・中身」のただの入れ子にする(描かずに中身だけ見たい)。
// 中の部品(TakeArt など)はそのまま呼んで最後まで組み立てる。偽物(Piece)は __name で見分けて呼ばない
globalThis.__h = (type, props, ...children) => {
  if (typeof type === "function" && !type.__name) return type({ ...(props || {}), children });
  return {
    type: typeof type === "function" ? type.__name : type,
    props: props || {},
    children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false),
  };
};
const stub = (name) => {
  const f = (props) => globalThis.__h(name, props);
  f.__name = name;
  return f;
};
globalThis.__stub = stub;

const src = read("src/ui/prologue.jsx")
  .replace(/import \{[^}]*\} from "react";/, "const { useEffect, useRef, useState } = globalThis.__react;")
  // キーの宛先の判定は別の小さな部品。ここでは「自分宛て」で固定する
  .replace(/import \{[^}]*\} from "\.\/key-target\.js";/, "const typing = () => false;")
  .replace(/import \{[^}]*\} from "\.\.\/assets\.js";/, 'const cardBackImg = "back";')
  .replace(/import \{[^}]*\} from "\.\/cards\.jsx";/, "const Piece = globalThis.__stub('Piece');")
  .replace(/import \{[^}]*\} from "\.\/skin-modal\.jsx";/, "const useReducedMotion = () => globalThis.__motion.reduce;")
  .replace(/import \{[^}]*\} from "\.\.\/skins\/store\.js";/, "const useCollection = () => ({ motion: globalThis.__motion.motion });");
is("差し替えていない取り込みが残っていない", /^import /m.test(src), false);
const js = transformSync(src, {
  loader: "jsx",
  jsx: "transform",
  jsxFactory: "globalThis.__h",
  jsxFragment: '"fragment"',
  format: "esm",
}).code;
const { PROLOGUE, GATE, TAKE_ART, kingColumn, Prologue } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);

/** 入れ子の中から、条件に合う最初のもの/すべてを探す */
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
const hasCls = (n, name) => typeof n?.props?.className === "string" && n.props.className.split(" ").includes(name);
const cls = (node, name) => find(node, (n) => hasCls(n, name));
const clsAll = (node, name) => all(node, (n) => hasCls(n, name));
const render = (props) => {
  stateIndex = 0;
  refIndex = 0;
  return Prologue(props);
};
const reset = () => {
  states.length = 0;
  refs.length = 0;
};
const ev = () => {
  const e = { stopped: false, stopPropagation: () => (e.stopped = true) };
  return e;
};

console.log("語りの中身(2026-10-01 本人の決め)");
is("語りは2枚", PROLOGUE.length, 2);
is("1枚目の見出しは読点で切った2行", [...PROLOGUE[0].lines], ["その一枚が、", "王かもしれない。"]);
is("1枚目の本文", PROLOGUE[0].note, "トランプの札を駒に、伏せて戦う一対一。");
is("2枚目の見出し", [...PROLOGUE[1].lines], ["動きを読め。", "隠れた王を討て。"]);
is("2枚目の本文(勝ち方)", PROLOGUE[1].note, "相手の王を取れば、あなたの勝ち。");
is("門の語りは1枚", GATE.length, 1);
is("門の語りの見出し", [...GATE[0].lines], ["はじめての勝ちに、", "門が開く。"]);
is("門の語りの本文", GATE[0].note, "札に宿る英雄を、呼び出そう。");
{
  const cards = [...PROLOGUE, ...GATE];
  is("見出しは行の配列で、1枚1〜2行", cards.every((c) => Array.isArray(c.lines) && c.lines.length >= 1 && c.lines.length <= 2), true);
  is("見出しの行は読点か句点で終わる(行の切れ目 = 文の切れ目)", cards.every((c) => c.lines.every((l) => /[、。]$/.test(l))), true);
  is("1行は20字まで", cards.every((c) => [...c.lines, c.note].every((l) => [...l].length <= 20)), true);
  is("どの札にも言葉が入っている", cards.every((c) => c.lines.every((l) => l.trim()) && c.note.trim()), true);
  const words = cards.map((c) => c.lines.join("") + c.note).join("");
  is("将棋やほかのゲームの名前を使わない", /将棋|チェス|ポーカー|麻雀/.test(words), false);
  is("「名乗らない」は語りから外した", /名乗らない/.test(words), false);
  is("「十人」は使わない(駒が増えるように読める)", /十人/.test(words), false);
  is("鍵が重ならない", new Set(cards.map((c) => c.key)).size, cards.length);
  is("伏せ札を取る触りは1枚目だけ", cards.map((c) => !!c.touch), [true, false, false]);
}

console.log("\n絵の二列はルールどおりに動く(本物の getLegalMoves)");
{
  // 5×5 の盤の奥(3段目)に相手の伏せ札5枚、手前(4段目)にあなたの5枚。王の力なし
  const at = (rank, owner, row, col) => ({ id: `${owner}${col}`, rank, owner, row, col, isKing: false, powers: false, alive: true });
  const board = () => {
    const b = Array.from({ length: 5 }, () => Array(5).fill(null));
    TAKE_ART.mine.forEach(([rank], col) => (b[4][col] = at(rank, 0, 4, col)));
    for (let col = 0; col < 5; col++) b[3][col] = at("9", 1, 3, col);
    return b;
  };
  const canTake = (b, col) =>
    getLegalMoves(b[4][col], b, 5, {}, null).some((m) => m.row === 3 && m.col === col && m.capture);
  is("手前は5枚", TAKE_ART.mine.length, 5);
  is("どの伏せ札を押されても、真正面の駒が縦に1マスで取れる", [0, 1, 2, 3, 4].map((c) => canTake(board(), c)), [true, true, true, true, true]);
  // 1枚目で t 列を取ったあと、2枚目で王の列を取れるか
  const second = [0, 1, 2, 3, 4].map((t) => {
    const b = board();
    const mover = b[4][t];
    b[3][t] = { ...mover, row: 3 };
    b[4][t] = null;
    const k = kingColumn(t);
    return k !== t && canTake(b, k);
  });
  is("2枚目の王は、1枚目と別の列で、真正面の駒がルールどおりに取れる", second, [true, true, true, true, true]);
  is("取らずに進んでも王の列は決まる", kingColumn(null), 2);
  is("1枚目でめくれるのは王ではない 9♦", [...TAKE_ART.taken], ["9", "diamond"]);
  // はじめの一局と札を分ける(同じ札が出ると、語りと一局の食い違いに見える)
  const fg = new Set(
    [...Object.keys(FIRST_GAME.opening.placement), ...Object.keys(FIRST_GAME.foe.placement)].map((id) => {
      const c = FIRST_GAME.deck.find((d) => d.id === id);
      return `${c.rank}${c.suit}`;
    }),
  );
  const art = [...TAKE_ART.mine, TAKE_ART.taken, TAKE_ART.king].map(([r, s]) => `${r}${s}`);
  is("はじめの一局の盤に出る10枚を、語りの絵に使わない", art.filter((x) => fg.has(x)), []);
  is("語りの絵の札は重ならない", new Set(art).size, art.length);
}

console.log("\n語りの進み方");
{
  reset();
  let done = 0;
  let tree = render({ onDone: () => done++ });
  is("はじめは1枚目", texts(cls(tree, "prologue-title")), ["その一枚が、", "王かもしれない。"]);
  is("見出しは1つの見出しにまとめる(読み上げで1文)", cls(tree, "prologue-title").type, "h2");
  is("最後でなければ「つづき」", texts(cls(tree, "prologue-next")).join(""), "つづき");
  is("1枚目は、絵の外を押しても進まない", typeof tree.props.onClick, "undefined");
  is("1枚目は、地に押せる印(指の形)を出さない", hasCls(tree, "is-touch"), true);
  let e = ev();
  cls(tree, "prologue-next").props.onClick(e);
  is("「つづき」は下の画面に伝えない", e.stopped, true);
  tree = render({ onDone: () => done++ });
  is("「つづき」で2枚目へ", texts(cls(tree, "prologue-title")), ["動きを読め。", "隠れた王を討て。"]);
  is("2枚目は最後の札で「盤へ」", texts(cls(tree, "prologue-next")).join(""), "盤へ");
  is("点は2つ", clsAll(tree, "prologue-dots")[0]?.children.length, 2);
  is("途中では終わらない", done, 0);
  is("2枚目はどこを押しても進む", typeof tree.props.onClick, "function");
  tree.props.onClick();
  is("最後を押すと盤へ", done, 1);
  tree = render({ onDone: () => done++ });
  tree.props.onClick();
  cls(tree, "prologue-next").props.onClick(ev());
  is("連打しても一度きり", done, 1);
}

console.log("\n1枚目の触り(伏せ札を1枚取る)");
{
  reset();
  let done = 0;
  let tree = render({ onDone: () => done++ });
  is("はじめの一言は「一枚、取ってみて。」", texts(cls(tree, "prologue-cue")).join(""), "一枚、取ってみて。");
  is("一言は読み上げで追える", cls(tree, "prologue-cue").props["aria-live"], "polite");
  const foes = clsAll(tree, "prologue-foe");
  is("押せる伏せ札が5枚", foes.map((b) => [b.type, b.props.disabled]), Array(5).fill(["button", false]));
  is("伏せ札は裏のまま描く(盤の駒と同じ Piece・相手の駒・あなたから見る)", foes.every((b) => {
    const p = find(b, (n) => n.type === "Piece");
    return p && p.props.piece.owner === 1 && p.props.viewer === 0 && !p.props.revealAll && !p.props.piece.revealed;
  }), true);
  is("伏せ札にはどれか分かる名前がある", foes.every((b) => /伏せ札/.test(b.props["aria-label"] || "")), true);
  is("まだ取っていないあいだは脈打つ", hasCls(cls(tree, "prologue-rows"), "is-inviting"), true);
  is("まだ何も取っていない", clsAll(tree, "is-struck").length, 0);
  const e = ev();
  foes[3].props.onClick(e);
  is("押した指は下の画面に伝えない(進まない)", [e.stopped, done], [true, 0]);
  tree = render({ onDone: () => done++ });
  const cols = clsAll(tree, "prologue-col");
  is("押した列だけ、真正面の駒が取りに行く", cols.map((c) => hasCls(c, "is-struck")), [false, false, false, true, false]);
  const taken = find(cls(cols[3], "prologue-taken"), (n) => n.type === "Piece");
  is("めくれるのは 9♦(王冠なし)", [taken?.props.piece.rank, taken?.props.piece.suit, taken?.props.piece.isKing, taken?.props.revealAll], ["9", "diamond", false, true]);
  is("一言が「外れ。王は、残りの四枚の中。」に変わる", texts(cls(tree, "prologue-cue")).join(""), "外れ。王は、残りの四枚の中。");
  is("取っても札は進まない", texts(cls(tree, "prologue-title")), ["その一枚が、", "王かもしれない。"]);
  is("取ったあとは脈打たない", hasCls(cls(tree, "prologue-rows"), "is-inviting"), false);
  const after = clsAll(tree, "prologue-foe");
  is("一度きり(ほかの伏せ札は押せない)", after.every((b) => b.props.disabled), true);
  after[0].props.onClick(ev());
  tree = render({ onDone: () => done++ });
  is("押せても二枚目はめくれない", clsAll(tree, "prologue-col").map((c) => hasCls(c, "is-struck")), [false, false, false, true, false]);
  // 2枚目: めくれた 9♦ はそのまま、別の列で王冠
  cls(tree, "prologue-next").props.onClick(ev());
  tree = render({ onDone: () => done++ });
  const c2 = clsAll(tree, "prologue-col");
  is("2枚目でも、1枚目で取った列はそのまま(動きは繰り返さない)", [hasCls(c2[3], "is-struck"), hasCls(c2[3], "is-settled")], [true, true]);
  const k = kingColumn(3);
  is("王を取る列は別の列", [hasCls(c2[k], "is-king"), hasCls(c2[k], "is-struck"), hasCls(c2[k], "is-settled")], [true, true, false]);
  const king = find(cls(c2[k], "prologue-taken"), (n) => n.type === "Piece");
  is("王の札は王冠つきで表になる", [king?.props.piece.isKing, king?.props.revealAll, king?.props.piece.owner], [true, true, 1]);
  is("2枚目の伏せ札は押せない", clsAll(tree, "prologue-foe").every((b) => b.props.disabled), true);
  is("2枚目に触りの一言は出さない(場所だけ取って、絵を跳ねさせない)", [!!cls(tree, "prologue-cue"), texts(cls(tree, "prologue-cue")).join("")], [true, ""]);
  is("取った札は読み上げに出さない(絵の飾り)", clsAll(tree, "prologue-taken").every((n) => n.props["aria-hidden"] === "true"), true);
}
{
  // 1枚目で何も取らずに進んだ人にも、2枚目の王は出る
  reset();
  let tree = render({ onDone: () => {} });
  cls(tree, "prologue-next").props.onClick(ev());
  tree = render({ onDone: () => {} });
  const cols = clsAll(tree, "prologue-col");
  is("取らずに進むと、王の列だけが動く", cols.map((c) => hasCls(c, "is-struck")), [false, false, true, false, false]);
}

console.log("\n動きを減らす設定");
{
  reset();
  is("ふだんは動く", hasCls(render({ onDone: () => {} }), "is-still"), false);
  globalThis.__motion = { reduce: true, motion: "full" };
  reset();
  is("端末の「視差効果を減らす」で止め絵", hasCls(render({ onDone: () => {} }), "is-still"), true);
  globalThis.__motion = { reduce: false, motion: "off" };
  reset();
  is("設定画面の「対局中の演出」オフでも止め絵", hasCls(render({ onDone: () => {} }), "is-still"), true);
  globalThis.__motion = { reduce: false, motion: "full" };
  const css = read("src/styles.css");
  const still = css.match(/\.prologue\.is-still \.prologue-text,[\s\S]*?\{\s*animation: none;\s*\}/)?.[0] || "";
  is(
    "止め絵では、取りに行く・めくる・退く・脈打つ・門の光を止める",
    [".prologue-col .prologue-mine", ".prologue-col .prologue-taken", ".prologue-col .prologue-foe", ".prologue-gate-glow", ".prologue-gate-card", ".prologue-cue"].every((s) => still.includes(s)),
    true,
  );
  is("端末の設定はCSSでも見る(最初の一枚から)", /@media \(prefers-reduced-motion: reduce\) \{\s*\.prologue \.prologue-text,/.test(css), true);
  // 止め絵でも終わりの形が出るように、動きの終わりは keyframes ではなく規則そのものに書く
  is(
    "止め絵でも、取った駒は前へ・取った札は上に退いた形",
    /\.prologue-col\.is-struck \.prologue-mine \{\s*transform: translateY\(calc\(-1 \* var\(--step\)\)\);/.test(css) &&
      /\.prologue-col\.is-struck \.prologue-taken \{[\s\S]*?transform: scale\(0\.8\);/.test(css) &&
      /\.prologue-col\.is-struck \.prologue-foe \{\s*opacity: 0;/.test(css),
    true,
  );
}

console.log("\n読み飛ばし");
{
  reset();
  let done = 0;
  const tree = render({ onDone: () => done++ });
  const skip = cls(tree, "prologue-skip");
  is("読み飛ばす釦がある", !!skip, true);
  const e = ev();
  skip.props.onClick(e);
  is("1枚目からでも盤へ行ける", done, 1);
  is("下の「次へ」に触らない", e.stopped, true);
  is("読み飛ばしの行き先を言う", skip.props["aria-label"], "語りを読み飛ばして盤へ");
}

console.log("\n門の語り");
{
  reset();
  let done = 0;
  let tree = render({ kind: "gate", onDone: () => done++ });
  is("見出し", texts(cls(tree, "prologue-title")), ["はじめての勝ちに、", "門が開く。"]);
  is("釦は「門を開く」", texts(cls(tree, "prologue-next")).join(""), "門を開く");
  is("1枚なので点は出さない", !!cls(tree, "prologue-dots"), false);
  is("札の裏が一枚、金の光の中に", [!!cls(tree, "prologue-gate-glow"), find(cls(tree, "prologue-gate-art"), (n) => n.type === "img")?.props.src], [true, "back"]);
  is("二列の絵も、その下の一言も出さない", [!!cls(tree, "prologue-rows"), !!cls(tree, "prologue-cue")], [false, false]);
  is("名前は「門の語り」", tree.props["aria-label"], "門の語り");
  is("どこを押しても門へ", typeof tree.props.onClick, "function");
  tree.props.onClick();
  is("押すと門へ", done, 1);
  tree = render({ kind: "gate", onDone: () => done++ });
  tree.props.onClick();
  is("連打しても一度きり", done, 1);
  reset();
  done = 0;
  tree = render({ kind: "gate", onDone: () => done++ });
  const skip = cls(tree, "prologue-skip");
  skip.props.onClick(ev());
  is("読み飛ばしても門へ", [done, skip.props["aria-label"]], [1, "語りを読み飛ばして召喚の門へ"]);
}

console.log("\n見た目");
{
  const ui = read("src/ui/prologue.jsx");
  is("背景にタイトル絵(「相手の王を討て」入り)を敷かない", /titleBgImg|prologue-bg/.test(ui), false);
  is("絵は盤の駒と同じ Piece", /<Piece\b/.test(ui), true);
  const css = read("src/styles.css");
  is("見た目が用意されている", /\.prologue \{/.test(css) && /\.prologue-rows \{/.test(css) && /\.prologue-gate-art \{/.test(css), true);
  is("見出しの行は折り返さない(行の配列で渡した切れ目を守る)", /\.prologue-line \{[^}]*display: block;[^}]*white-space: nowrap;/.test(css), true);
  is("背景の絵の決まりを残していない", /\.prologue-bg\b|prologue-drift/.test(css), false);
  is("画面いっぱいに敷く(舞台の余白で枠に見えない・下へはみ出さない)", /\.stage:has\(> \.prologue\) \{\s*min-height: 0;\s*padding: 0;\s*\}/.test(css) && /\.prologue \{[^}]*width: 100%;/.test(css), true);
}

console.log("\n配線");
{
  // 振り分けは src/game/intro.js の introStep(2026-10-01。検査は tools/check-intro.mjs)。
  // 語り → はじめの一局 → 名前 → 門の語り → 10連 → ストーリー一覧
  const screens = read("src/ui/screens.jsx");
  is("語りはタイトルのあと(導入の段 prologue)。読み終えたら、はじめの一局", /if \(intro === "prologue"\)[\s\S]{0,200}<Prologue\s+kind="intro"\s+onDone=\{\(\) => \{\s*markPrologueSeen\(\);\s*startFirstGame\(\);/.test(screens), true);
  is("門の語りは名前のあと(導入の段 gate)。読み終えたら10連", /if \(intro === "gate"\)[\s\S]{0,200}<Prologue\s+kind="gate"\s+onDone=\{\(\) => \{\s*setIntro\(null\);\s*setFirstPullMode\(!0\);/.test(screens), true);
  is("語りは2か所だけ(名前の直後に語りを出していた古い配線は無い)", [(screens.match(/<Prologue\b/g) || []).length, /setPrologue\(/.test(screens)], [2, false]);
  is("合言葉つきで開いた起動は語りも10連も通さず部屋へ(導入は次の起動から)", /\[pendingRoom, setPendingRoom\] = \(0, useState\)\(\(\) => roomFromLocation\(\)\),\s*(\/\/[^\n]*\n\s*)*\[introDeferred, setIntroDeferred\] = \(0, useState\)\(\(\) => !!pendingRoom\)/.test(screens) && !/t\(pendingRoom \? "room" : "home"\)/.test(screens), true);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
