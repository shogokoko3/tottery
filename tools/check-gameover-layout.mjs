import assert from "node:assert/strict";
import fs from "node:fs";
// 対局後のボタン配置(2026-09-17 本人の指示): 左上 振り返り / 右上 マッチングへ / 左下 ホームへ / 右下 もう一度遊ぶ
const game = fs.readFileSync("src/ui/game.jsx", "utf8");
const screens = fs.readFileSync("src/ui/screens.jsx", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");
const grid = game.slice(game.indexOf('className="gameover-grid"'), game.indexOf("</div>\n", game.indexOf("go-again")));
assert.match(grid, /go-review[`"][\s\S]*?対戦の振り返り/, "左上: 対戦の振り返り");
assert.match(grid, /go-match" onClick=\{onNextMatch\}[\s\S]*?マッチングへ/, "右上: 連戦はマッチングへ");
assert.match(grid, /go-match" onClick=\{onExit\}[\s\S]*?マッチングへ/, "右上: 手元の対局は対戦相手を選ぶ画面へ");
assert.match(grid, /go-home" onClick=\{onHome\}[\s\S]*?ホームへ/, "左下: ホームへ");
assert.match(grid, /go-again"[\s\S]*?onClick=\{rematch\.ask\}[\s\S]*?もう一度遊ぶ/, "右下: オンラインの再戦");
assert.match(grid, /go-again"[\s\S]*?NEW_GAME[\s\S]*?もう一度遊ぶ/, "右下: 手元の再戦");
assert.ok(grid.indexOf("go-review") < grid.indexOf("go-match") && grid.indexOf("go-match") < grid.indexOf("go-home") && grid.indexOf("go-home") < grid.indexOf("go-again"), "並びは 左上→右上→左下→右下");
assert.doesNotMatch(game, /次の相手と対戦する|対局を振り返る<\/button>/, "古い文言を残さない");
assert.match(game, /function goHome\(\) \{\s*tidyRoom\(\);\s*onHome\(\);/, "ホームへ戻る前に部屋を片付ける");
assert.match(game, /onNextMatch=\{\(network \|\| bot\) && onNextMatch \? nextMatch : null\}/, "Bot 戦のあとも連戦できる");
// チュートリアルの終了画面: 左下(go-home)にタイトルへ戻る、右下(go-again)にホームへ(2026-09-21 本人の指示で左右入れ替え)
// チュートリアルのホームへはハブ(menu)、それ以外は従来の goHome
assert.match(screens, /onHome=\{tut \? goMenu : goHome\}/, "チュートリアルのホームへはハブ(menu)へ");
assert.match(screens, /function goMenu\(\) \{\s*\(u\(null\), m\(!1\), setTut\(null\), t\("menu"\)\);/, "goMenu はハブへ戻す");
assert.match(game, /\{tutorial \? \(\s*\/\/[\s\S]*?onExit && \(\s*<button className="btn btn-ghost go-home" onClick=\{onExit\}>\s*\{exitLabel\}/, "チュートリアルは左下にタイトルへ戻る");
assert.match(game, /\{tutorial \? \(\s*\/\/[\s\S]*?onHome && \(\s*<button className="btn btn-ghost go-again" onClick=\{onHome\}>[\s\S]*?ホームへ/, "チュートリアルは右下にホームへ");
for (const [cls, area] of [["go-review", "1 / 1"], ["go-match", "1 / 2"], ["go-home", "2 / 1"], ["go-again", "2 / 2"]])
  assert.match(css, new RegExp(`\\.gameover-grid \\.${cls} \\{ grid-area: ${area.replace(/\//g, "\\/")}; \\}`), `${cls} は ${area}`);
assert.match(css, /\.gameover-grid \.hint \{\s*grid-column: 1 \/ -1;/, "案内文は全幅");
console.log("対局後のボタン配置: 左上 振り返り / 右上 マッチングへ / 左下 ホームへ / 右下 もう一度遊ぶ: OK");
