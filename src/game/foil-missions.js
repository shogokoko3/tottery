import { FOIL_SKINS } from "../skins/catalog.js";
import { L } from "../i18n/index.js";

// One source for the character mission and its manually claimed title reward.
// The catalog excludes the battle-pass magician and early-access pegasus.
export const FOIL_MISSION_DEFS = FOIL_SKINS.map((skin) => {
  const name = skin.baseName ?? skin.name;
  return {
    baseId: skin.baseId,
    skinId: skin.id,
    missionId: `foil-${skin.baseId}`,
    missionName: L("「{name}」のフォイルを獲得する", { name }),
    titleId: `foil-${skin.baseId}`,
    titleName: L("煌めく{name}", { name }),
  };
});
