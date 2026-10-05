/**
 * 長押しの受け口(src/ui/long-press.js)を確かめる。
 *
 * 2026-09-28 本人の指示「フォイル加工のイラストを長押しすると、
 * スキン画面と同じフォイルの画面へ。閉じたら加工の画面に戻る」。
 *
 * 大事なのは「一覧を送っているだけなのに開かない」ことと、
 * 「離したクリックで開いた画面がすぐ閉じない」こと。
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

// React の useRef / useCallback / useEffect を、この検査のためだけに置き換える
const refs = [];
let refIndex = 0;
// useRef は呼ばれた順に別の入れ物を返す。1つを使い回すとフックが壊れる
globalThis.__hooks = {
  useRef: (v) => {
    const i = refIndex++;
    return (refs[i] ||= { current: v });
  },
  useCallback: (fn) => fn,
  useEffect: () => {},
};
const src = read("src/ui/long-press.js").replace(
  /import \{[^}]*\} from "react";/,
  "const { useCallback, useEffect, useRef } = globalThis.__hooks;",
);
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(src).toString("base64")
);
const { useLongPress, LONG_PRESS_MS } = mod;

const ev = (over = {}) => ({
  button: 0,
  clientX: 100,
  clientY: 100,
  pointerId: 1,
  currentTarget: { setPointerCapture() {} },
  preventDefault() {
    this.prevented = true;
  },
  stopPropagation() {
    this.stopped = true;
  },
  ...over,
});

console.log("長押しの手触り");
is("待つ時間は 0.5 秒(推理メモと同じ)", LONG_PRESS_MS, 500);
{
  refIndex = 0;
  refs.length = 0;
  let fired = 0;
  const h = useLongPress(() => fired++);
  h.onPointerDown(ev());
  is("押しただけでは開かない", fired, 0);
  await new Promise((r) => setTimeout(r, LONG_PRESS_MS + 80));
  is("押し続けると開く", fired, 1);
  // 離したクリックは飲み込む
  const click = ev();
  h.onClickCapture(click);
  is("離したクリックを飲み込む", [click.prevented, click.stopped], [true, true]);
  const next = ev();
  h.onClickCapture(next);
  is("次のふつうのクリックは通す", next.prevented, undefined);
}
{
  refIndex = 0;
  refs.length = 0;
  let fired = 0;
  const h = useLongPress(() => fired++);
  h.onPointerDown(ev());
  h.onPointerMove(ev({ clientX: 140 }));
  await new Promise((r) => setTimeout(r, LONG_PRESS_MS + 80));
  is("指が動いたら開かない(一覧を送っているだけ)", fired, 0);
}
{
  refIndex = 0;
  refs.length = 0;
  let fired = 0;
  const h = useLongPress(() => fired++);
  h.onPointerDown(ev());
  h.onPointerMove(ev({ clientX: 104, clientY: 103 }));
  await new Promise((r) => setTimeout(r, LONG_PRESS_MS + 80));
  is("少しの震えでは取り消さない", fired, 1);
}
{
  refIndex = 0;
  refs.length = 0;
  let fired = 0;
  const h = useLongPress(() => fired++);
  h.onPointerDown(ev());
  h.onPointerUp(ev());
  await new Promise((r) => setTimeout(r, LONG_PRESS_MS + 80));
  is("すぐ離せば開かない(ふつうのタップ)", fired, 0);
}
{
  refIndex = 0;
  refs.length = 0;
  let fired = 0;
  const h = useLongPress(() => fired++);
  const menu = ev();
  h.onContextMenu(menu);
  is("右クリックでも開く(パソコン)", fired, 1);
  is("ブラウザの右クリック札は出さない", menu.prevented, true);
}
{
  refIndex = 0;
  refs.length = 0;
  let fired = 0;
  const h = useLongPress(() => fired++);
  h.onPointerDown(ev({ button: 2 }));
  await new Promise((r) => setTimeout(r, LONG_PRESS_MS + 80));
  is("左ボタン以外では開かない", fired, 0);
}
{
  refIndex = 0;
  refs.length = 0;
  is("enabled:false なら何もしない", Object.keys(useLongPress(() => {}, { enabled: false })), []);
}

console.log("\n配線(フォイル加工)");
{
  const skins = read("src/ui/skins.jsx");
  is("長押しの受け口を使う", /useLongPress/.test(skins), true);
  is(
    "絵の釦すべてに付いている",
    (skins.match(/\{\.\.\.longPress\(/g) || []).length,
    5,
  );
  is(
    "押しても長押しでも同じ詳細へ",
    /const basePress = useLongPress\(\(\) => onPick\(longPressTarget\.current\)\)/.test(skins),
    true,
  );
  is("タップは今まで通り残す", (skins.match(/onClick=\{\(\) => onPick\(/g) || []).length >= 5, true);
  // 閉じると、開く前の画面(加工)に戻る。タブは触らない
  is(
    "閉じても加工の画面のまま(選んだ札を外すだけ)",
    /onClose=\{\(\) => setSelected\(null\)\}/.test(skins),
    true,
  );
}

console.log("\n絵の長押しで iOS の札を出さない");
{
  const css = read("src/styles.css");
  is("根で切る", /\.tottery-root \{\s*-webkit-touch-callout: none;/.test(css), true);
  const template = read("index.template.html");
  is("文字選択をゲーム全体で抑える", /html,body\{[^}]*user-select:none;[^}]*touch-callout:none;/.test(template), true);
  is("入力欄は編集と貼り付けを許可する", /input,textarea,[^}]*user-select:text;[^}]*touch-callout:default;/.test(template), true);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
