/**
 * ガチャの開示演出の決まりごと。画面(skins.jsx)から切り離して検査できるようにする。
 *
 * - 前兆(omen): 束の中でいちばん強いレアリティ。伏せた状態の背景と札の光り方を決める。
 *   どの札が当たりかは分からないまま「何かいる」とだけ伝える
 * - 昇格(ladder): めくった札が最終的なレアリティに至るまでに通る段階。
 *   SR は R→SR、SSR は R→SR→SSR と上がって見せる。R はそのまま
 */
import { byId } from "./catalog.js";

export const POWER = { R: 1, SR: 2, SSR: 3, LIMITED: 3 };

/** 早期特典は見た目の格として SSR と同じ扱い */
const tierOf = (rarity) => (rarity === "LIMITED" ? "SSR" : rarity);

export function omenOf(results) {
  let best = "R";
  for (const r of results || []) {
    const skin = byId(r && r.id);
    if (!skin) continue;
    const tier = tierOf(skin.rarity);
    if ((POWER[tier] || 0) > POWER[best]) best = tier;
  }
  return best;
}

export function ladderOf(rarity) {
  const top = tierOf(rarity);
  return ["R", "SR", "SSR"].slice(0, POWER[top] || 1);
}

/** 前兆の一言 */
export const OMEN_TEXT = {
  R: "運命が、目を覚ます。",
  SR: "光が、集まりはじめた。",
  SSR: "……ただならぬ気配。",
};
