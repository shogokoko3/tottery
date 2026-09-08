import { SKINS, byId, foilId } from "./catalog.js";

// CPUは所持データを使わず、限定・バトルパスを含む全スキンから装備する。
// 同じ数字に複数ある場合は均等に選び、対局中は選んだ装備を保持する。
export function createCpuLoadout(random = Math.random) {
  const groups = new Map();
  for (const skin of SKINS) {
    if (!groups.has(skin.rank)) groups.set(skin.rank, []);
    groups.get(skin.rank).push(skin);
  }
  return Object.fromEntries(
    [...groups].map(([rank, skins]) => {
      const skin = skins[Math.floor(random() * skins.length)];
      return [rank, byId(foilId(skin.id))?.id || skin.id];
    }),
  );
}
