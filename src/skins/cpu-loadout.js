import { SKINS, FOIL_SKINS, SPECIAL_FOIL_SKINS } from "./catalog.js";
import { areaSkinOk } from "../game/areas.js";

// CPUは所持データを使わず、限定・バトルパスを含む全スキンから装備する。
// 同じ数字に複数ある場合は均等に選び、対局中は選んだ装備を保持する。
// 例外は A のフォイル(全カード所持者だけの有償商品)。CPU には持たせない(2026-09-17 本人の指示)。
const CPU_EXCLUDED = new Set(SPECIAL_FOIL_SKINS.map((skin) => skin.id));
const cpuFoilFor = (skin) =>
  FOIL_SKINS.find((foil) => foil.baseId === skin.id && !CPU_EXCLUDED.has(foil.id))?.id || skin.id;
export function createCpuLoadout(random = Math.random) {
  const groups = new Map();
  for (const skin of SKINS) {
    if (!groups.has(skin.rank)) groups.set(skin.rank, []);
    groups.get(skin.rank).push(skin);
  }
  return Object.fromEntries(
    [...groups].map(([rank, skins]) => {
      const skin = skins[Math.floor(random() * skins.length)];
      // CPUは通常の15種だけフォイル化する。A・天馬騎士は通常版を使う。
      return [rank, cpuFoilFor(skin)];
    }),
  );
}

/**
 * その数字にフォイルを必ず持たせる。エリアを選んだCPU戦で、王の数字のエリアが立つように。
 * (10 の天馬騎士のように、フォイル版の無いスキンを引くとエリアが立たない)
 */
export function ensureCpuFoil(loadout, rank) {
  if (!rank || areaSkinOk(loadout?.[rank])) return loadout;
  const foil = FOIL_SKINS.find((skin) => skin.rank === rank && !CPU_EXCLUDED.has(skin.id));
  return foil ? { ...loadout, [rank]: foil.id } : loadout;
}
