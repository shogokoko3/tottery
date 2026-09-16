import { byId } from "./catalog.js";

export const SUMMON_TIMING = Object.freeze({
  ascent: 2000,
  gate: 2000,
  opening: 3000,
  flight: 2000,
  total: 9000,
});

export const SUMMON_WORLDS = Object.freeze({
  earth: {
    name: "忘却の墓廟",
    sky: "#101b24",
    stone: "#343d41",
    accent: "#8bddc0",
    fog: "#172833",
    crest: "♠",
  },
  sea: {
    name: "黒潮の宝物殿",
    sky: "#0b2738",
    stone: "#304250",
    accent: "#73d7e9",
    fog: "#173e50",
    crest: "⚓",
  },
  forest: {
    name: "翠樹の神殿",
    sky: "#102820",
    stone: "#40503c",
    accent: "#b3dd8b",
    fog: "#183629",
    crest: "❧",
  },
  ice: {
    name: "極光の氷殿",
    sky: "#162741",
    stone: "#647f95",
    accent: "#b5ecff",
    fog: "#304961",
    crest: "❄",
  },
  sky: {
    name: "雲海の天空門",
    sky: "#172a43",
    stone: "#4d657b",
    accent: "#d5ecff",
    fog: "#3c5269",
    crest: "✦",
  },
  heaven: {
    name: "白金の聖堂",
    sky: "#111d36",
    stone: "#425269",
    accent: "#ffe6ab",
    fog: "#27334c",
    crest: "♛",
  },
  hell: {
    name: "深淵の魔王門",
    sky: "#1b1123",
    stone: "#302534",
    accent: "#f98055",
    fog: "#351e31",
    crest: "♜",
  },
});

export function summonWorldForSkin(skin) {
  if (!skin) return "earth";
  if (skin.family === "demon" || skin.id.startsWith("demon-")) return "hell";
  if (skin.family === "angel" || skin.id.startsWith("angel-")) return "heaven";
  if (["2", "3"].includes(skin.rank)) return "earth";
  if (["4", "5"].includes(skin.rank)) return "sea";
  if (["6", "7"].includes(skin.rank)) return "forest";
  if (["8", "9"].includes(skin.rank)) return "ice";
  if (skin.rank === "10") return "sky";
  return "heaven";
}

/** The saved draw chooses the world. No second lottery changes the results. */
export function summonPlan(results) {
  const skins = results.map((r) => byId(r.id)).filter(Boolean);
  const foils = skins.filter((s) => s.foil);
  const order = { R: 1, SR: 2, SSR: 3, LIMITED: 3, SPECIAL: 3 };
  const candidates = foils.length ? foils : skins;
  // Stable first-drawn tie break, including multiple equally rare foils.
  let lead = candidates[0];
  for (const skin of candidates)
    if ((order[skin.rarity] || 0) > (order[lead?.rarity] || 0)) lead = skin;
  return {
    world: summonWorldForSkin(lead),
    gold: foils.length > 0,
    count: results.length,
  };
}

export const smooth = (x) => {
  const p = Math.max(0, Math.min(1, x));
  return p * p * (3 - 2 * p);
};
export function summonFrame(ms) {
  const t = Math.max(0, ms);
  return {
    ascent: smooth(t / 2000),
    opening: smooth((t - 4000) / 3000),
    flight: smooth((t - 7000) / 2000),
    stage:
      t < 2000 ? "ascent" : t < 4000 ? "gate" : t < 7000 ? "opening" : "flight",
    done: t >= SUMMON_TIMING.total,
  };
}
