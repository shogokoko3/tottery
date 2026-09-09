import { byId } from "./catalog.js";
import { AREA_BY_RANK, AREA_INFO } from "../game/areas.js";
import { areaTheme } from "../game/field-presentation.js";

export function areaRewardName(reward) {
  return reward.type === "palace"
    ? `宮殿・${reward.theme === "hell" ? "魔界" : "天界"}`
    : AREA_INFO[reward.type].name;
}

// 所持品は増やさない。獲得したフォイルに付く盤面を案内するための一覧。
// 同じ盤面はまとめる。天使と悪魔の宮殿は見た目が異なるので別々に見せる。
export function areaRewardsFor(results = []) {
  const rewards = new Map();
  for (const result of results) {
    const skin = byId(result.id);
    const type = skin?.foil && AREA_BY_RANK[skin.rank];
    if (!type) continue;
    const theme = areaTheme({ type, skin: skin.id });
    if (!rewards.has(theme)) rewards.set(theme, { type, theme, skins: [] });
    const reward = rewards.get(theme);
    if (!reward.skins.some((s) => s.id === skin.id)) reward.skins.push(skin);
  }
  return [...rewards.values()];
}
