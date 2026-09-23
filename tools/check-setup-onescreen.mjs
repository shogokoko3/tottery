/**
 * 布陣・王選び・終局を1画面に収める(2026-09-23 本人の指示)。
 *
 * 「引き直し(布陣)の画面で下にスクロールするのが面倒。制限時間も配置中に見えない」
 * 「勝敗結果の画面は全てのボタンが1画面に収まるように」
 *
 * 見出し・先攻後攻・残り時間は1つの帯にまとめて貼り付け、手札は 7枚×2段、終局は釦を下に留める。
 * 舞台の下の 264px の余白(stage-with-sheet)はチュートリアルの帯があるときだけ付ける。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const setup = read("src/ui/setup.jsx");
const cards = read("src/ui/cards.jsx");
const screens = read("src/ui/screens.jsx");
const game = read("src/ui/game.jsx");
const css = read("src/styles.css");

// 布陣・王選び: 見出し＋先攻後攻＋残り時間を1つの帯に
assert.equal((setup.match(/className="setup-wrap setup-wrap-compact"/g) || []).length, 2, "配置と王選びの両方が圧縮版の枠");
assert.equal((setup.match(/<div className="setup-head">/g) || []).length, 2, "帯は2か所");
for (const label of ["布陣の残り時間", "王を選ぶ残り時間"]) {
  const i = setup.indexOf(`label="${label}"`);
  assert.ok(i > 0, `${label} がある`);
  const head = setup.lastIndexOf('<div className="setup-head">', i);
  const headEnd = setup.indexOf("</div>", head);
  assert.ok(head > 0 && headEnd > i, `${label} は帯(.setup-head)の中にある`);
}
assert.match(setup, /<p className="hint setup-hint-line">/, "案内は1行の枠");
assert.doesNotMatch(setup, /手札を自陣へドラッグ。タップで選んでからマスをタップでも置けます/, "長い案内文は残さない");
assert.match(setup, /<span className="setup-adoption-total">\s*採用合計 <strong>\{adoptionTotal\}<\/strong>/, "採用合計は案内の行に並べる");
assert.match(setup, /size=\{hand\.length > 10 \|\| slots > 5 \? "tray" : undefined\}/, "9×9 の手札は tray の大きさ");
assert.match(cards, /size === "tray"[\s\S]{0,200}w: 40,\s*h: 53/, "tray は 40×53(7枚 + 縁で 375px の端末に収まる)");

// CSS: 帯は貼り付き、枠そのものを送る箱にする(根が overflow:hidden で sticky が効かないため)
assert.match(css, /\.setup-wrap-compact \{[^}]*max-height: calc\(100dvh - var\(--top-bar-h, 56px\) - 24px\);[^}]*overflow-y: auto;/, "枠を送る箱にする");
assert.match(css, /\.setup-wrap-compact \.setup-head \{[^}]*position: sticky;[^}]*top: 0;/, "帯は上に貼り付く");
assert.match(css, /\.setup-wrap-compact \.mini-board \{[^}]*width: min\(78vw, 320px, calc\(100dvh - 420px\)\);/, "背の低い端末では盤を詰める");
assert.match(css, /\.setup-wrap-compact \.hand-card \{[^}]*padding: 0;/, "手札の札の余白は 0(7枚が並ぶ)");

// 舞台の下余白はチュートリアルの帯があるときだけ
assert.match(screens, /band = false,/, "GameShell に band がある");
assert.match(screens, /className=\{`stage \$\{band \? "stage-with-sheet" : ""\}`\}/, "stage-with-sheet は band で決める(sheet は常に truthy)");
const sheets = (game.match(/sheet=\{presentationSheet\}/g) || []).length;
const bands = (game.match(/band=\{!!tutSheet\}/g) || []).length;
assert.ok(sheets > 0 && sheets === bands, `sheet と band は対で渡す(${sheets}/${bands})`);

// 終局: 中身だけ送り、釦は下に留める
const panel = game.indexOf('className={`modal-panel gameover-panel');
const body = game.indexOf('<div className="gameover-body">', panel);
const grid = game.indexOf('className="gameover-grid"', body);
assert.ok(panel > 0 && body > panel && grid > body, "終局の札の中に gameover-body、その後に gameover-grid");
assert.ok(game.slice(body, grid).includes("<MasteryGains"), "熟練度まで gameover-body の中");
assert.match(css, /\.gameover-panel \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*overflow: hidden;/, "終局の札は縦の flex");
assert.match(css, /\.gameover-panel > \.gameover-body \{[^}]*flex: 1 1 auto;[^}]*min-height: 0;[^}]*overflow-y: auto;/, "中身だけ送る");
assert.match(css, /\.gameover-panel > \.gameover-grid \{[^}]*flex: none;/, "釦は縮まない(常に見える)");
assert.match(css, /\.gameover-panel \.king-card \{[^}]*width: min\(36vw, 140px\);/, "負けの札は 140px まで");
assert.match(css, /\.gameover-panel \.win-card \{[^}]*width: min\(28vw, 110px\);/, "勝ちの札は 110px まで");

console.log("布陣・王選び・終局を1画面に: 帯の貼り付き・手札 7枚×2段・釦を下に留める・舞台の余白は帯があるときだけ OK");
