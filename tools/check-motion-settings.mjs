import assert from "node:assert/strict";
import fs from "node:fs";
import { normalize } from "../src/skins/collection.js";
// 演出の設定は2つ(2026-09-17 本人の指示): 対局中の演出は設定画面、召喚の演出はスキン画面の召喚ボタンの横
assert.equal(normalize(null).motion, "full");
assert.equal(normalize(null).summonMotion, "full");
assert.equal(normalize({ motion: "short" }).summonMotion, "skip", "以前の短縮は召喚も飛ばしていたので引き継ぐ");
assert.equal(normalize({ motion: "short" }).motion, "off", "「短縮」は廃止。旧保存は出さないに寄せる");
assert.equal(normalize({ motion: "off" }).motion, "off");
assert.equal(normalize({ motion: "full" }).motion, "full");
assert.equal(normalize({ motion: "off" }).summonMotion, "skip");
assert.equal(normalize({ motion: "short", summonMotion: "full" }).summonMotion, "full", "分けたあとは別々");
assert.equal(normalize({ motion: "full", summonMotion: "skip" }).summonMotion, "skip");
assert.equal(normalize({ summonMotion: "bogus" }).summonMotion, "full");
assert.equal(normalize({ motion: "bogus" }).motion, "full");
const skins = fs.readFileSync("src/ui/skins.jsx", "utf8");
const overlays = fs.readFileSync("src/ui/overlays.jsx", "utf8");
assert.doesNotMatch(skins, /collection\.motion/, "スキン画面は対局中の演出を触らない");
assert.equal((skins.match(/reduce \|\| collection\.summonMotion === "skip"/g) || []).length, 5, "召喚・錬成・盤面獲得の演出は summonMotion で飛ばす");
// 2026-10-11: 下部の固定欄へ召喚とタブを移した。設定はガチャ本文に残すため、
// ソース上で召喚ボタンの直後にあるという旧検査は適用しない。
assert.match(skins, /className="skins-summon-motion toggle-hit"/, "ガチャ画面に召喚演出の設定を残す");
assert.match(skins, /summonMotion = e\.target\.checked \? "skip" : "full"/);
assert.doesNotMatch(skins, /演出の長さ|ガチャ省略/, "スキン画面から「演出の長さ」を外す");
assert.match(overlays, /<p className="settings-head">対局中の演出<\/p>\s*<BattleMotionSettings \/>/, "設定画面に対局中の演出");
assert.match(overlays, /updateCollection\(\(s\) => \(\{ \.\.\.s, motion \}\)\)/);
assert.match(overlays, /const motion = on \? "off" : "full";/, "対局中の演出はオン/オフだけ");
assert.doesNotMatch(overlays, /短縮/, "設定画面に「短縮」を出さない");
for (const f of ["src/ui/skin-film.jsx", "src/ui/ace-magic.jsx"])
  assert.doesNotMatch(fs.readFileSync(f, "utf8"), /collection\.motion === "short"/, `${f} は短縮を読まない`);
assert.doesNotMatch(overlays, /summonMotion/, "設定画面は召喚の演出を触らない");
for (const f of ["src/ui/skin-film.jsx", "src/ui/ace-magic.jsx"])
  assert.match(fs.readFileSync(f, "utf8"), /collection\.motion/, `${f} は対局中の演出の設定を読む`);
console.log("演出の設定: 対局中は設定画面(motion)・召喚はガチャ本文(summonMotion)・旧保存の引き継ぎ: OK");
