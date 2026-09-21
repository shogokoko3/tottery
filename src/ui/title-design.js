import { findTitle } from "../game/titles.js";
import { byId } from "../skins/catalog.js";

// Appearance is derived from the existing title ID, so both online seats use the
// same frame without changing saves, rewards, or the network protocol.
const PALETTES = {
  steel: ["#bed0da", "#718b9a", "#253746", "#edf5fa"],
  bronze: ["#edbb81", "#b47d51", "#39271f", "#fff0d8"],
  flame: ["#ffbf73", "#ea684e", "#401c27", "#fff2d3"],
  ice: ["#c5f5ff", "#56b9e9", "#122e50", "#effdff"],
  sky: ["#f5e9b8", "#82bfeb", "#203753", "#ffffeb"],
  earth: ["#e0c07e", "#bc8760", "#342b23", "#fff2d9"],
  forest: ["#c5edbc", "#57b58e", "#173c32", "#f1ffdf"],
  tide: ["#7ce9e8", "#509dcf", "#123445", "#e3ffff"],
  royal: ["#ffdf8f", "#d89b48", "#39294e", "#fff3c5"],
  shadow: ["#d7cff3", "#9386c4", "#27233e", "#f0eaff"],
  astral: ["#ebc8ff", "#a68bef", "#2e2351", "#fcf0ff"],
  gold: ["#ffe7a3", "#dea949", "#443319", "#fff9dc"],
  rose: ["#ffc3db", "#d26c9f", "#48233c", "#fff0f7"],
  blood: ["#ffbcbd", "#d66d8e", "#3c1932", "#ffeaf2"],
};

// Motif and palette describe the story; acquisition difficulty sets the frame.
// Do not use the character's rank (J/Q/K) as its acquisition rarity.
const DESIGNS = {
  novice: ["laurel", "steel"],
  first: ["sword", "bronze"],
  ten: ["shield", "steel"],
  fifty: ["shield", "royal"],
  win10: ["sword", "flame"],
  win30: ["dragon", "flame"],
  rated: ["star", "tide"],
  fortress: ["ice", "ice"],
  "twin-wings": ["wing", "sky"],
  "heir-hunt": ["grave", "earth"],
  elimination: ["leaf", "forest"],
  kamikaze: ["wave", "tide"],
  "royal-road": ["crown", "royal"],
  "court-heavy": ["cards", "blood"],
  regular: ["laurel", "forest"],
  devoted: ["sun", "gold"],
  "rank-shi": ["shield", "bronze"],
  "rank-sho": ["sword", "royal"],
  "rank-o": ["crown", "gold"],
  "foil-zombie-male": ["bone", "forest"],
  "foil-zombie-female": ["bone", "shadow"],
  "foil-pirate-male": ["anchor", "tide"],
  "foil-pirate-female": ["anchor", "rose"],
  "foil-elf-male": ["bow", "forest"],
  "foil-elf-female": ["bow", "astral"],
  "foil-viking-male": ["axe", "sky"],
  "foil-viking-female": ["axe", "ice"],
  "foil-dragon-knight": ["dragon", "flame"],
  "foil-angel-j": ["wing", "sky"],
  "foil-angel-q": ["wing", "forest"],
  "foil-angel-k": ["wing", "gold"],
  "foil-demon-j": ["horn", "astral"],
  "foil-demon-q": ["horn", "rose"],
  "foil-demon-k": ["horn", "blood"],
};
const FAMILIES = {
  "all-r": ["moon", "shadow"],
  freeze: ["ice", "ice"],
  "foil-draw": ["sun", "gold"],
  "ssr-draw": ["gem", "royal"],
  pulls: ["portal", "astral"],
  "multi-ssr": ["star", "sky"],
  "foil-complete": ["crown", "gold"],
  "normal-complete": ["book", "earth"],
};

// Art direction based on achievement effort, collection rarity and final rank.
// These are display grades, not drop probabilities or new unlock conditions.
export const FRAME_GRADES = [
  { level: 1, name: "素朴", metal: "#9eafbd", detail: "細い金属枠" },
  { level: 2, name: "彫金", metal: "#d5dce7", detail: "銀の彫刻・小さな宝石" },
  {
    level: 3,
    name: "宝飾",
    metal: "#ddbe7e",
    detail: "二重の金縁・紋章・宝石",
  },
  { level: 4, name: "荘厳", metal: "#f3d08a", detail: "翼状の彫刻・宝石の帯" },
  {
    level: 5,
    name: "絢爛",
    metal: "#ffe4a1",
    detail: "多重の装飾・大粒の宝石・後光",
  },
  {
    level: 6,
    name: "極煌",
    metal: "#fff2c5",
    detail: "冠飾り・放射状の翼・極光の縁",
  },
];
const ACHIEVEMENT_LEVELS = {
  novice: 1,
  first: 1,
  rated: 1,
  ten: 2,
  regular: 2,
  fifty: 3,
  win10: 3,
  win30: 3,
  devoted: 3,
  "rank-shi": 3,
  "rank-sho": 4,
  "rank-o": 5,
  fortress: 4,
  "twin-wings": 4,
  "heir-hunt": 4,
  elimination: 4,
  kamikaze: 4,
  "royal-road": 5,
  "court-heavy": 6,
};
// Counts differ by family: e.g. pulling 10 times is not equivalent to 10 freezes.
// Repeated grades still advance through the family's engraved progress jewels.
const FAMILY_LEVELS = {
  "all-r": [3, 4, 4, 5, 5, 6],
  freeze: [3, 4, 4, 5, 5, 6],
  "foil-draw": [3, 4, 4, 5, 5, 6],
  "ssr-draw": [2, 3, 3, 4, 4, 5],
  pulls: [1, 2, 3, 3, 4, 4, 5, 5, 6],
  "multi-ssr": [3, 4, 5],
  "foil-complete": [4, 5, 6],
  "normal-complete": [2, 3, 4],
};
const SEASON_LEVELS = { king: 5, ten: 4, three: 5, first: 6 };

export function titleDesign(id) {
  const title = findTitle(id);
  if (!title) return null;
  let spec = DESIGNS[title.id];
  let level = ACHIEVEMENT_LEVELS[title.id] || 1;
  if (title.family) {
    spec = FAMILIES[title.family] || ["laurel", "steel"];
    level = FAMILY_LEVELS[title.family]?.[title.tier - 1] || 1;
  } else if (title.id.startsWith("foil-")) {
    // Same acquisition rarity = same ornament grade, including all seven SSRs.
    const skin = byId(title.id.slice(5));
    level = { R: 3, SR: 4, SSR: 5 }[skin?.rarity] || 3;
  } else if (title.id.startsWith("season:")) {
    const place = title.id.split(":")[2];
    level = SEASON_LEVELS[place];
    spec = {
      king: ["crown", "royal"],
      first: ["crown", "gold"],
      three: ["laurel", "astral"],
      ten: ["laurel", "steel"],
    }[place];
  }
  const [motif, palette] = spec || ["laurel", "steel"];
  const [light, edge, base, ink] = PALETTES[palette];
  const grade = FRAME_GRADES[level - 1];
  return {
    motif,
    palette,
    level,
    gradeName: grade.name,
    tier: title.tier || level,
    gems: level === 1 ? 0 : Math.max(level - 1, title.tier || 0),
    style: {
      "--title-light": light,
      "--title-edge": edge,
      "--title-base": base,
      "--title-ink": ink,
      "--title-metal": grade.metal,
      "--title-angle": `${105 + (title.tier || level) * 9}deg`,
    },
  };
}
