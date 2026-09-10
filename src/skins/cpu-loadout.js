import { SKINS, byId, foilId } from "./catalog.js";
import { areaSkinOk } from "../game/areas.js";

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

/**
 * その数字にフォイルを必ず持たせる。エリアを選んだCPU戦で、王の数字のエリアが立つように。
 * (10 の天馬騎士のように、フォイル版の無いスキンを引くとエリアが立たない)
 */
export function ensureCpuFoil(loadout, rank) {
  if (!rank || areaSkinOk(loadout?.[rank])) return loadout;
  const foil = SKINS.map((skin) => byId(foilId(skin.id))).find(
    (skin) => skin && skin.rank === rank,
  );
  return foil ? { ...loadout, [rank]: foil.id } : loadout;
}
