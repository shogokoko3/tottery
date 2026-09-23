/**
 * オンライン対局を途中でやめる＝降参(相手の勝ちで成績を清算)。本人の指示 2026-09-16。
 *  - やめる確認(QuitConfirm)は、オンラインなら「降参になる・持ち点を清算する」と伝える
 *  - やめる操作は quitGame を通り、オンラインで対局中なら RESIGN を送ってから抜ける
 *  - 手元・CPU はそのまま抜ける(RESIGN しない)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const game = readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
const overlays = readFileSync(new URL("../src/ui/overlays.jsx", import.meta.url), "utf8");

const quit = game.slice(game.indexOf("function quitGame()"), game.indexOf("function quitGame()") + 900);
assert.ok(quit.includes('a.phase === "play" || a.phase === "setup"'), "対局中(布陣・対局)だけ降参にする");
assert.ok(quit.includes("(!!network || !!bot)"), "オンラインと Bot のランダムマッチが対象");
assert.ok(/<QuitConfirm\s+network=\{network \|\| bot\}/.test(game), "確認の文言は Bot 相手でもオンライン用");
assert.ok(/y\(\{ type: "RESIGN", player: P \}\)/.test(quit), "降参の手を送る");
assert.ok(/setTimeout\(leaveGame, QUIT_RESIGN_GRACE_MS\)/.test(quit), "届くのを待ってから抜ける");
assert.ok(/if \(!inPlay\) \{\s*leaveGame\(\);\s*return;/.test(quit), "手元・CPU・終局後はそのまま抜ける");
assert.ok(/onQuit=\{\(\) => \{\s*\(r\(!1\), quitGame\(\)\);/.test(game), "やめる確認の「やめる」が quitGame を呼ぶ");
const qc = overlays.slice(overlays.indexOf("export function QuitConfirm"));
assert.ok(qc.includes("降参") && qc.includes("レート"), "確認の文言に降参と持ち点の清算");
assert.ok(qc.includes("降参してホームに戻る"), "オンラインのボタンは「降参してホームに戻る」");
assert.ok(qc.includes("今の対局は最初からやり直しになります。"), "手元の文言は従来どおり");
console.log("途中でやめる＝降参: 文言・RESIGN 送信・待ってから片付け・手元はそのまま OK");
