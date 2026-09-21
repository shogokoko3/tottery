import { findTitle } from "../game/titles.js";

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

// motif, palette, ornament level (1–6). Each character has its own pairing.
const DESIGNS = {
  novice: ["laurel", "steel", 1],
  first: ["sword", "bronze", 1],
  ten: ["shield", "steel", 2],
  fifty: ["shield", "royal", 3],
  win10: ["sword", "flame", 2],
  win30: ["dragon", "flame", 4],
  rated: ["star", "tide", 2],
  fortress: ["ice", "ice", 4],
  "twin-wings": ["wing", "sky", 4],
  "heir-hunt": ["trail", "earth", 4],
  elimination: ["leaf", "forest", 4],
  kamikaze: ["wave", "tide", 4],
  "royal-road": ["crown", "royal", 5],
  "court-heavy": ["cards", "blood", 6],
  regular: ["laurel", "forest", 2],
  devoted: ["sun", "gold", 3],
  "rank-shi": ["shield", "bronze", 3],
  "rank-sho": ["sword", "royal", 4],
  "rank-o": ["crown", "gold", 5],
  "foil-zombie-male": ["bone", "forest", 3],
  "foil-zombie-female": ["bone", "shadow", 3],
  "foil-pirate-male": ["anchor", "tide", 3],
  "foil-pirate-female": ["anchor", "rose", 3],
  "foil-elf-male": ["bow", "forest", 3],
  "foil-elf-female": ["bow", "astral", 3],
  "foil-viking-male": ["axe", "sky", 4],
  "foil-viking-female": ["axe", "ice", 4],
  "foil-dragon-knight": ["dragon", "flame", 5],
  "foil-angel-j": ["wing", "sky", 4],
  "foil-angel-q": ["wing", "forest", 4],
  "foil-angel-k": ["wing", "gold", 6],
  "foil-demon-j": ["horn", "astral", 4],
  "foil-demon-q": ["horn", "rose", 4],
  "foil-demon-k": ["horn", "blood", 6],
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

export function titleDesign(id) {
  const title = findTitle(id);
  if (!title) return null;
  let spec = DESIGNS[title.id];
  if (title.family) {
    const family = FAMILIES[title.family] || ["laurel", "steel"];
    // All nine summon tiers remain visually distinct, including the final three.
    spec = [...family, Math.min(6, title.tier + (title.foil ? 1 : 0))];
  } else if (title.id.startsWith("season:")) {
    const place = title.id.split(":")[2];
    spec = {
      king: ["crown", "royal", 4],
      first: ["crown", "gold", 6],
      three: ["laurel", "astral", 5],
      ten: ["laurel", "steel", 4],
    }[place];
  }
  const [motif, palette, level] = spec || ["laurel", "steel", 1];
  const [light, edge, base, ink] = PALETTES[palette];
  return {
    motif,
    palette,
    level,
    tier: title.tier || level,
    style: {
      "--title-light": light,
      "--title-edge": edge,
      "--title-base": base,
      "--title-ink": ink,
      "--title-angle": `${105 + (title.tier || level) * 9}deg`,
    },
  };
}
