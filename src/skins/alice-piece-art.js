import { L } from "../i18n/index.js";
// Summoned cups and transformed soldiers are board pieces, not gacha equipment.
export function alicePieceArt(piece, loadout = {}) {
  if (!piece.tea && !piece.soldier) return null;
  const cup = piece.tea;
  const slug = cup
    ? piece.teaMovement === "diag" ? "teacup-green-copper" : "teacup-blue-gold"
    : "card-soldier";
  const kingSkin = loadout[piece.aliceKingRank];
  const foil = String(kingSkin || "").startsWith("alice-") && kingSkin.endsWith(":foil");
  const baseId = "alice-extra-" + slug;
  const folder = cup ? "v2" : "v1";
  return {
    id: baseId + (foil ? ":foil" : ""),
    baseId,
    foil,
    name: cup ? piece.teaMovement === "diag" ? L("三月ウサギのティーカップ") : L("帽子屋のティーカップ") : L("トランプ兵"),
    boardCard: `skins/alice-extra-${foil ? "foils" : "cards"}-${folder}/${slug}.png`,
  };
}
