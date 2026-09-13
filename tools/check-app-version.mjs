/**
 * 強制アップデート(最低ビルド番号)の判定を確かめる。
 * サーバーの純関数だけを見る(通信・端末は見ない)。フェイルオープンが要。
 */
import assert from "node:assert/strict";
import {
  needsUpdate,
  minAppBuild,
  appStoreUrl,
  MIN_APP_BUILD_DEFAULT,
} from "../src/server/app-version.js";

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

console.log("最低ビルド番号の読み取り");
is("既定は0(ブロックしない)", MIN_APP_BUILD_DEFAULT, 0);
is("環境変数が未設定なら0", minAppBuild({}), 0);
is("空文字は0", minAppBuild({ MIN_APP_BUILD: "" }), 0);
is("正の整数を読む", minAppBuild({ MIN_APP_BUILD: "202609140130" }), 202609140130);
is("負の値は0", minAppBuild({ MIN_APP_BUILD: "-5" }), 0);
is("数字でない値は0", minAppBuild({ MIN_APP_BUILD: "abc" }), 0);

console.log("\n更新が要るかの判定(フェイルオープン)");
is("最低未満はブロック", needsUpdate(100, 200), true);
is("最低ちょうどは通す", needsUpdate(200, 200), false);
is("最低超えは通す", needsUpdate(300, 200), false);
is("最低が0なら通す(未設定)", needsUpdate(100, 0), false);
is("アプリ番号が0なら通す(不明)", needsUpdate(0, 200), false);
is("壊れた値は通す", needsUpdate(NaN, 200), false);
is("両方壊れても通す", needsUpdate("x", "y"), false);
is("桁の違う番号も数として比べる", needsUpdate(202609131000, 202609140000), true);

console.log("\nApp Store のURL");
is("URLの形が正しい", /^https:\/\/apps\.apple\.com\/app\/id\d+$/.test(appStoreUrl()), true);

console.log(`\n${ok} ok / ${fail.length} NG`);
process.exit(fail.length ? 1 : 0);
