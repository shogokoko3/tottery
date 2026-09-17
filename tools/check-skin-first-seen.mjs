/**
 * 「その uid で、その札を初めて見た日」の記録(2026-09-18)。
 *
 * 対局では装備(フォイル)の所持が誰にも検証されていない。フォイルの王で盤面エリアが立つので、
 * 端末の localStorage を書き換えるだけで、1枚も持たずにエリアを立てられる。
 * 検証を始めるには、まず「正しく遊んで手に入れた」記録がサーバーに要る。この検査はその土台を見る。
 *
 * この段階では**何も拒まない**。貯めるだけ。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Wallet } from "../src/server/wallet.js";

const D = new DatabaseSync(":memory:");
const w = new Wallet((q, ...a) => D.prepare(q).all(...a));
const T = 1_800_000_000_000;
const seen = (uid) =>
  D.prepare("SELECT skinId, at FROM skin_first_seen WHERE uid=? ORDER BY skinId")
    .all(uid)
    .map((r) => ({ skinId: r.skinId, at: r.at }));
const mirrorOf = (uid) =>
  D.prepare("SELECT skinId FROM collection_skins WHERE uid=? ORDER BY skinId").all(uid).map((r) => r.skinId);

// 初めての同期で、その日が入る
w.syncCollection("A", ["zombie-male", "pirate-female"], T);
assert.deepEqual(seen("A"), [
  { skinId: "pirate-female", at: T },
  { skinId: "zombie-male", at: T },
], "持っている札に、初めて見た日が入る");

// あとから同期し直しても、初めて見た日は動かない(追記専用)
w.syncCollection("A", ["zombie-male", "pirate-female", "elf-male"], T + 86_400_000);
const after = Object.fromEntries(seen("A").map((r) => [r.skinId, r.at]));
assert.equal(after["zombie-male"], T, "前からある札の日は上書きしない");
assert.equal(after["elf-male"], T + 86_400_000, "増えた札はその日で入る");

// 崩して減っても、初めて見た日は消えない。いまの所持の写しからは消える
w.syncCollection("A", ["elf-male"], T + 172_800_000);
assert.deepEqual(seen("A").map((r) => r.skinId), ["elf-male", "pirate-female", "zombie-male"], "減っても記録は残る");
assert.deepEqual(mirrorOf("A"), ["elf-male"], "いまの所持の写しは入れ直す(購入条件が読むのはこちら)");

// 別の uid とは混ざらない
w.syncCollection("B", ["zombie-male"], T);
assert.deepEqual(seen("B").map((r) => r.skinId), ["zombie-male"]);
assert.equal(seen("A").length, 3, "他人の同期で自分の記録は変わらない");

// 記録を消す(5.1.1(v))と、その uid の分は消える
w.forget("A");
assert.deepEqual(seen("A"), [], "削除の求めでは消す");
assert.deepEqual(mirrorOf("A"), [], "写しも消える");
assert.equal(seen("B").length, 1, "他人の分は残る");

// 壊れた一覧は今までどおり断る(記録も入らない)
for (const bad of [null, "x", ["zombie-male", "zombie-male"], ["not-a-skin"]])
  assert.throws(() => w.syncCollection("C", bad, T), /正しくありません/);
assert.deepEqual(seen("C"), [], "断った同期では記録しない");

// **出どころ**を分ける。端末の申告(declared)とサーバーの証拠(server)。
// 混ぜると、申告した嘘まで証拠になってしまう
{
  const src = () =>
    Object.fromEntries(
      D.prepare("SELECT skinId, source, at FROM skin_first_seen WHERE uid='S'")
        .all()
        .map((r) => [r.skinId, `${r.source}@${r.at}`]),
    );
  w.syncCollection("S", ["zombie-male", "pirate-female"], T);
  assert.deepEqual(src(), {
    "zombie-male": `declared@${T}`,
    "pirate-female": `declared@${T}`,
  }, "端末の同期は申告として入る");
  w.noteSkin("S", "zombie-male", T + 1000, "server");
  assert.equal(src()["zombie-male"], `server@${T}`, "証拠が来たら昇格する。日は動かない");
  w.noteSkin("S", "zombie-male", T + 2000, "declared");
  assert.equal(src()["zombie-male"], `server@${T}`, "あとから申告しても降格しない");
  w.noteSkin("S", "elf-male", T, "server");
  assert.equal(src()["elf-male"], `server@${T}`, "初めから証拠のものもある");
}

// 配線: 端末側
const wallet = fs.readFileSync("src/net/wallet.js", "utf8");
assert.match(wallet, /export async function noteCollection\(\)/, "静かに送る口");
assert.match(wallet, /if \(!Object\.values\(owned\)\.some\(\(n\) => Number\.isSafeInteger\(n\) && n > 0\)\)\s*\n\s*return null;/, "1枚も持っていなければ送らない(写しを空で入れ直さない)");
assert.ok(/export async function noteCollection\(\)[\s\S]*?catch \{[\s\S]*?return null;/.test(wallet), "失敗しても投げない");
const screens = fs.readFileSync("src/ui/screens.jsx", "utf8");
assert.match(screens, /noteCollection\(\);/, "起動時に送る");
const skins = fs.readFileSync("src/ui/skins.jsx", "utf8");
assert.equal((skins.match(/noteCollection\(\);/g) || []).length, 2, "ガチャを引いた2つの道のどちらでも送る");
// この段階では、まだ何も拒まない
const areas = fs.readFileSync("src/game/areas.js", "utf8");
assert.ok(!/first_seen|ownership|所持を確かめ/.test(areas), "ルール層は台帳を見ない(設計どおり)");
const server = fs.readFileSync("src/server/wallet.js", "utf8");
assert.match(server, /INSERT OR IGNORE INTO skin_first_seen/, "上書きしない");
assert.match(server, /noteSkin\(uid, skinId, now, "server"\)/, "サーバーが引いた札は証拠として入れる");
assert.match(server, /noteSkin\(uid, foilId\(baseId\), now, "server"\)/, "買ったフォイルも証拠");
assert.match(server, /UPDATE skin_first_seen SET source='server'/, "証拠は申告より強い");
assert.match(server, /DELETE FROM skin_first_seen WHERE uid=\?/, "削除の求めでは消す");
console.log("所持の記録(第1段階): 初めて見た日・追記専用・減っても残る・削除で消える・壊れた一覧は断る・配線: OK");
