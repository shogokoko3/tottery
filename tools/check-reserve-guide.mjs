/**
 * 予備札を盤に出すときの札の説明。
 * 動きの説明には「2枚まで採用可(王がKなら1枚)」「王にする時のみ1枚採用できる」という
 * 採用(布陣)の但し書きが混じっていて、予備札から出す場面ではその札を置けないかのように
 * 読める(本人の指摘 2026-09-15)。置く場面では moveOnlyText で外す。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOVE_TEXT, ADOPTION_NOTES, moveOnlyText } from "../src/game/constants.js";

// 但し書きは本当に説明の中にある(外す対象がずれていない)
for (const note of ADOPTION_NOTES)
  assert.ok(Object.values(MOVE_TEXT).some((t) => t.includes(note)), `但し書きが説明に無い: ${note}`);
assert.equal(moveOnlyText("J"), "縦横に何マスでも。");
assert.equal(moveOnlyText("Q"), "斜めに何マスでも。");
assert.equal(moveOnlyText("K"), "縦横斜めに何マスでも。10と同じ跳び方もできる。");
for (const r of ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"])
  assert.equal(moveOnlyText(r), MOVE_TEXT[r], `${r} の説明は変わらない`);
for (const r of Object.keys(MOVE_TEXT))
  for (const note of ADOPTION_NOTES) assert.ok(!moveOnlyText(r).includes(note), `${r} に但し書きが残る`);
assert.equal(moveOnlyText("なし"), "");

// 配線: 予備札の置き場(ReservePlacer)は placing で出し、CardGuide は placing なら moveOnlyText を使う
const setup = readFileSync(new URL("../src/ui/setup.jsx", import.meta.url), "utf8");
const placer = setup.slice(setup.indexOf("export function ReservePlacer"));
const guides = placer.match(/<CardGuide[^>]*>/g) || [];
assert.ok(guides.length >= 2, "置き場に札の説明が2か所(複数枚・1枚)");
for (const g of guides) assert.ok(/\bplacing\b/.test(g), `置き場の CardGuide に placing が無い: ${g}`);
const guidesSrc = readFileSync(new URL("../src/ui/guides.jsx", import.meta.url), "utf8");
assert.ok(/placing \? moveOnlyText\(rank\) : MOVE_TEXT\[rank\]/.test(guidesSrc), "CardGuide が placing で moveOnlyText を使う");

console.log("予備札の札の説明: 採用の但し書きを外す(J/Q/K)・他は同じ・置き場の配線 OK");
