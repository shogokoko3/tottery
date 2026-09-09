/**
 * プレイヤー向けの盤面エリアの説明(src/ui/area-guide.jsx)が、決まり
 * (src/game/areas.js)からずれていないかを見る。
 *
 * 説明は人が読む文なので機械で全部は照らせない。ここでは
 *   - 6種類すべてに行があり、順番が王のランクの順であること
 *   - 数字(見抜く確率・体数・凍る手番)が AREA_TUNING と同じであること
 *   - 自動発動のエリアと、選んで発動のエリアの説明が食い違わないこと
 * だけを見る。効果を差し替えたら、この検査が落ちたところを直す。
 */
import { AREA_BY_RANK, AREA_INFO, AREA_TUNING } from "../src/game/areas.js";
import { AUTO_AREAS } from "../src/game/area-presentation.js";

import fs from "node:fs";
import { AREA_GUIDE_ROWS as rows } from "../src/ui/area-guide-rows.js";
// 前置きの文(フォイル限定など)は画面側にあるので、そちらの原文も読む
const src = fs.readFileSync("src/ui/area-guide.jsx", "utf8");

let ok = 0;
const fails = [];
const is = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) ok++;
  else fails.push(`${name}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
};

const types = [...new Set(Object.values(AREA_BY_RANK))];
is("6種類すべてに行がある(王のランクの順)", rows.map((r) => r.type), types);
is("フォイルでだけ立つ、と書いてある", /フォイル/.test(src) && /通常のスキンでは立ちません/.test(src), true);
for (const r of rows) {
  const info = AREA_INFO[r.type];
  is(`${info.name}: 名前がある`, typeof info.name, "string");
  const auto = AUTO_AREAS.has(r.type);
  is(`${info.name}: 自動/選ぶ の説明が決まりと合う`, r.when.includes("自動"), auto);
  is(`${info.name}: 効果の文がある`, r.effect.length > 20, true);
}
const byType = Object.fromEntries(rows.map((r) => [r.type, r]));
is("土: 確率が AREA_TUNING と同じ", byType.earth.effect.includes(`${Math.round(AREA_TUNING.earthOdds * 100)}%`), true);
is("森: 体数が AREA_TUNING と同じ", byType.forest.effect.includes(`${AREA_TUNING.forestReveals}体`), true);
is("氷: 体数が AREA_TUNING と同じ", byType.ice.effect.includes(`${AREA_TUNING.iceTargets}体`), true);
is("氷: 手番数が AREA_TUNING と同じ", byType.ice.effect.includes(`${AREA_TUNING.freezeTurns}手番`), true);
is("空: 全10が2回、の説明は AREA_TUNING と同じ", byType.sky.effect.includes("全て1手番に2回"), AREA_TUNING.skyAllTens);
is("宮殿: 上限の説明", byType.palace.effect.includes(AREA_TUNING.palaceCap === "K" ? "→K" : `${AREA_TUNING.palaceCap}まで`), true);

for (const f of fails) console.log("  NG  " + f);
console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) process.exit(1);
