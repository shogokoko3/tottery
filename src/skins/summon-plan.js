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

/** 抽選結果の id の並びから決まる 0〜1 の値。同じ結果なら再表示しても同じ門になる */
function drawSeed(results) {
  let h = 2166136261;
  for (const r of results)
    for (const ch of String(r.id))
      h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (h >>> 0) / 4294967296;
}

/**
 * 門の世界は、7つの世界から**均等に**選ぶ(本人の指示 2026-09-17)。
 * 引いた札から選ぶと、どんな重み付けでも門を見た時点で中身(SSR など)が推測できてしまうので、
 * 札とは結びつけない(カモフラージュ)。乱数は保存済みの抽選結果から決まる(drawSeed)ので、
 * 結果を変えず、再表示でも同じ門になる。門の色は変えない: フォイルが1枚でもあれば金、なければ銅
 */
export const SUMMON_WORLD_ORDER = Object.freeze([
  "earth",
  "sea",
  "forest",
  "ice",
  "sky",
  "heaven",
  "hell",
]);
export function summonPlan(results, pick = null) {
  const skins = results.map((r) => byId(r.id)).filter(Boolean);
  const foils = skins.filter((s) => s.foil);
  const u = typeof pick === "number" ? pick : drawSeed(results);
  const n = SUMMON_WORLD_ORDER.length;
  const world = SUMMON_WORLD_ORDER[Math.min(n - 1, Math.floor(u * n))];
  return { world, gold: foils.length > 0, count: results.length };
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
