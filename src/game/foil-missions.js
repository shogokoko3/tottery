import { FOIL_SKINS } from "../skins/catalog.js";

// One source for the character mission and its manually claimed title reward.
// The catalog excludes the battle-pass magician and early-access pegasus.
export const FOIL_MISSION_DEFS = FOIL_SKINS.map((skin) => {
  const name = skin.name.replace(/（フォイル）$/, "");
  return {
    baseId: skin.baseId,
    skinId: skin.id,
    missionId: `foil-${skin.baseId}`,
    missionName: `「${name}」のフォイルを獲得する`,
    titleId: `foil-${skin.baseId}`,
    titleName: `煌めく${name}`,
  };
});
