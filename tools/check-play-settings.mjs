/**
 * 対局中の操作の設定(2026-09-28 本人の指示)を確かめる。
 *
 *  - 駒を動かす前に確認を挟む。**既定は on**、設定で切れる
 *  - 同じ駒をもう一度タップしたら選択を解ける(選び直せる)
 *  - 相手の駒を取る手は、設定に関わらず前から確認を挟んでいる
 */
import assert from "node:assert/strict";
import fs from "node:fs";

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};
// savePlaySettings は window へ知らせる。無いところでも落ちないことを見る
const events = [];
globalThis.window = {
  dispatchEvent: (e) => events.push(e),
  CustomEvent: class {},
};
globalThis.CustomEvent = class {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

const { loadPlaySettings, savePlaySettings, confirmMoveOn, PLAY_DEFAULTS, PLAY_SETTINGS_KEY } =
  await import("../src/game/play-settings.js");

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

console.log("設定の読み書き");
is("既定は「確認する」", PLAY_DEFAULTS.confirmMove, true);
is("保存が無ければ既定", loadPlaySettings(), { confirmMove: true });
is("confirmMoveOn も既定で true", confirmMoveOn(), true);
savePlaySettings({ confirmMove: false });
is("切ったら false", loadPlaySettings().confirmMove, false);
is("保存先は tottery.play.v1", PLAY_SETTINGS_KEY, "tottery.play.v1");
is("切り替えを画面へ知らせる", events.at(-1)?.type, "tottery:play-settings");
is("知らせに中身が乗る", events.at(-1)?.detail, { confirmMove: false });
savePlaySettings({ confirmMove: true });
is("戻せる", loadPlaySettings().confirmMove, true);
store[PLAY_SETTINGS_KEY] = "こわれた";
is("壊れた保存は既定に戻す", loadPlaySettings(), { confirmMove: true });
store[PLAY_SETTINGS_KEY] = JSON.stringify({});
is("項目が無ければ既定で補う", loadPlaySettings().confirmMove, true);

console.log("\n配線");
const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
const overlays = fs.readFileSync(new URL("../src/ui/overlays.jsx", import.meta.url), "utf8");
is("対局の画面が設定を読む", /loadPlaySettings\(\)\.confirmMove/.test(game), true);
is("設定が on のときだけ確認を挟む", /if \(confirmMove && !tutorial\)/.test(game), true);
is(
  "チュートリアルでは挟まない(台本どおりに動かすため)",
  /!tutorial/.test(game.slice(game.indexOf("if (confirmMove"), game.indexOf("if (confirmMove") + 40)),
  true,
);
is("確認の札を出す", /<MoveConfirm/.test(game), true);
is("確認の札がある", /export function MoveConfirm/.test(overlays), true);
is("設定画面に切り替えがある", /export function PlaySettings/.test(overlays), true);
is("設定の切り替えを画面に出している", /<PlaySettings \/>/.test(overlays), true);
is(
  "取る手は設定に関わらず確認する",
  /if \(mv\.capture\) \{\s*setPendingCapture/.test(game),
  true,
);
is(
  "同じ駒をもう一度タップしたら選択を解く",
  /a\.selectedId === ze\.id\s*\?\s*\{ type: "CANCEL_SELECTION" \}/.test(game),
  true,
);
is(
  "設定を変えたら対局中でも効く",
  /addEventListener\("tottery:play-settings"/.test(game),
  true,
);

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
