/**
 * ガチャの結果で解放される称号(2026-09-21 本人の指示)。
 *
 * 守りたいこと:
 *  - 抽選のたびに applyPull が実績(gacha)を正しく増やす(全R・SSR・フォイル・
 *    10連の最高SSR枚数・フリーズ)。最終結果(昇格後)で数える。
 *  - gachaStatsOf が実績と所持からまとめを作る。
 *  - profile.gacha で称号が解放される。段階(tier)を持ち、3段目までが目標、
 *    4段目以降も組み込まれている。
 */
import assert from "node:assert/strict";
import { normalize, applyPull, gachaStatsOf } from "../src/skins/collection.js";
import { POOL, foilId } from "../src/skins/catalog.js";
import {
  TITLES,
  GACHA_TITLES,
  hasTitle,
} from "../src/game/titles.js";

const rId = POOL.find((s) => s.rarity === "R").id;
const srId = POOL.find((s) => s.rarity === "SR").id;
const ssrId = POOL.find((s) => s.rarity === "SSR").id;
const rFoil = foilId(rId);
const clear = (s) => ({ ...s, pending: null });

// --- applyPull が実績を数える ---
let s = normalize({});
s = applyPull(s, Array(10).fill(rId), { free: true });
assert.equal(s.gacha.allR, 1, "10連が全Rなら allR=1");
assert.equal(s.draws, 10, "引いた枚数を数える");
assert.equal(s.gacha.ssr, 0, "SSRは0");

s = clear(s);
const mixed = [ssrId, ssrId, ssrId, rFoil, ...Array(6).fill(rId)];
s = applyPull(s, mixed, { free: true });
assert.equal(s.gacha.ssr, 3, "SSR3枚を数える");
assert.equal(s.gacha.bestTenSsr, 3, "10連の最高SSR枚数を覚える");
assert.ok(s.gacha.foil >= 1, "フォイルを数える");
assert.equal(s.gacha.allR, 1, "全Rでない回は allR を増やさない");

// フリーズ: initial が2SSRで資格を満たし、final は昇格後
s = clear(s);
const initial = [ssrId, ssrId, ...Array(8).fill(rId)];
const finalIds = [ssrId, ssrId, ...Array(8).fill(srId)];
const beforeFreeze = s.gacha.freeze;
s = applyPull(s, { skins: finalIds, freeze: { version: 1, initial } }, {
  free: true,
});
assert.equal(s.gacha.freeze, beforeFreeze + 1, "フリーズを1回数える");

// --- gachaStatsOf ---
const stats = gachaStatsOf(s);
assert.equal(stats.pulls, s.draws, "pulls は draws");
assert.equal(stats.ssr, s.gacha.ssr, "ssr を写す");
assert.ok(stats.normalsOwned >= 1, "所持した通常版を数える");
assert.ok(stats.foilsOwned >= 1, "所持したフォイルを数える");

// --- 称号の解放(profile.gacha で判定) ---
const full = {
  titles: [],
  gacha: {
    pulls: 100,
    freeze: 5,
    foil: 1,
    ssr: 10,
    allR: 1,
    bestTenSsr: 3,
    foilsOwned: 15,
    normalsOwned: 15,
  },
};
for (const id of [
  "gacha-all-r-1",
  "gacha-freeze-5",
  "gacha-foil-draw-1",
  "gacha-ssr-draw-10",
  "gacha-pulls-100",
  "gacha-multi-ssr-3",
  "gacha-foil-complete-15",
  "gacha-normal-complete-15",
])
  assert.ok(hasTitle(full, id), `${id} が解放される`);
assert.ok(!hasTitle(full, "gacha-freeze-10"), "届いていない段は解放しない");
assert.ok(
  !hasTitle({ titles: [] }, "gacha-pulls-10"),
  "実績が無ければ解放しない",
);

// --- 構造(段階・掲載3段ルール) ---
const ids = GACHA_TITLES.map((t) => t.id);
assert.equal(new Set(ids).size, ids.length, "称号idは一意");
for (const t of GACHA_TITLES) {
  assert.ok(t.family, "family を持つ");
  assert.ok(t.tier >= 1, "tier を持つ");
  assert.equal(typeof t.unlocked, "function", "unlocked を持つ");
  assert.ok(TITLES.find((x) => x.id === t.id), "TITLES に載っている");
}
for (const fam of [
  "all-r",
  "freeze",
  "foil-draw",
  "ssr-draw",
  "pulls",
  "multi-ssr",
  "foil-complete",
  "normal-complete",
])
  assert.ok(
    GACHA_TITLES.filter((t) => t.family === fam).length >= 3,
    `${fam} は3段以上ある`,
  );
assert.ok(
  GACHA_TITLES.some((t) => t.tier > 3),
  "4段目以降を持つ家系がある(掲載3段ルールが効く)",
);
for (const fam of ["foil-draw", "foil-complete"])
  assert.ok(
    GACHA_TITLES.filter((t) => t.family === fam).every((t) => t.foil),
    `${fam} は foil:true`,
  );

console.log(
  "ガチャ称号: 実績カウント・まとめ・解放・段階・3段ルール・フォイル制限 OK",
);
