import { POOL, baseSkinId, byId, foilId } from "./catalog.js";

export const FREEZE_FOIL_CHANCE = 0.3;
const poolIds = new Set(POOL.map((s) => s.id));
const eligible = (id) => !!byId(id) && poolIds.has(baseSkinId(id));

/** Evaluate the original ten cards once, before any bonus changes. */
export function qualifiesForFreeze(ids) {
  if (!Array.isArray(ids) || ids.length !== 10 || !ids.every(eligible))
    return false;
  const cards = ids.map(byId);
  const ssr = cards.filter((s) => s.rarity === "SSR").length;
  return ssr >= 2 || (ssr >= 1 && cards.some((s) => s.foil));
}
function unit(random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1)
    throw new Error("乱数の範囲が不正です");
  return n;
}

/** Final grants and presentation provenance are saved together by the caller. */
export function resolveSummonFreeze(initial, random = Math.random) {
  if (!qualifiesForFreeze(initial))
    return { skins: [...initial], freeze: null };
  const skins = initial.map((id) => {
    const skin = byId(id);
    if (skin.foil) return id;
    if (skin.rarity === "SSR")
      return unit(random) < FREEZE_FOIL_CHANCE ? foilId(id) : id;
    const pool = POOL.filter(
      (s) => s.rarity === (skin.rarity === "R" ? "SR" : "SSR"),
    );
    return pool[Math.floor(unit(random) * pool.length)].id;
  });
  return { skins, freeze: { version: 1, initial: [...initial] } };
}

/** Old saves have no freeze. Invalid presentation data never changes grants. */
export function normalizeSummonFreeze(value, finalIds) {
  if (
    value?.version !== 1 ||
    !qualifiesForFreeze(value.initial) ||
    !Array.isArray(finalIds) ||
    finalIds.length !== 10
  )
    return null;
  const valid = value.initial.every((id, i) => {
    const before = byId(id),
      after = byId(finalIds[i]);
    if (!eligible(finalIds[i])) return false;
    if (before.foil) return finalIds[i] === id;
    if (before.rarity === "SSR")
      return finalIds[i] === id || finalIds[i] === foilId(id);
    return (
      !after.foil && after.rarity === (before.rarity === "R" ? "SR" : "SSR")
    );
  });
  return valid ? { version: 1, initial: [...value.initial] } : null;
}
export function freezeFoilUpgrade(freeze, index, finalId) {
  const initial = byId(freeze?.initial?.[index]);
  return !!(
    initial &&
    initial.rarity === "SSR" &&
    !initial.foil &&
    finalId === foilId(initial.id)
  );
}
/** Existing foil identities resolve first; the freeze's bonus SSR→foil is the finale.
 * Preserve grid order within each group and never change the granted results. */
export function summonFoilOrder(results, freeze) {
  const original = [], bonus = [];
  results.forEach((result, index) => {
    if (!byId(result.id)?.foil) return;
    (freezeFoilUpgrade(freeze, index, result.id) ? bonus : original).push(index);
  });
  return [...original, ...bonus];
}
export function freezeLadder(initialId, finalId) {
  const before = byId(initialId),
    after = byId(finalId);
  // Even already-special cards join the simultaneous rotation, without exposing a foil's identity.
  return [before.rarity === "SSR" ? "SR" : before.rarity, after.rarity];
}
export const FREEZE_TIMES = {
  stop: 1100,
  collapse: 1750,
  darkness: 2320,
  invitation: 3050,
};
