import assert from "node:assert/strict";
import fs from "node:fs";
import { decodeFoilMask, renderFoilFrame } from "../src/skins/foil-material.js";
const entries = JSON.parse(
  fs.readFileSync(new URL("../assets/skins/foils/masks.json", import.meta.url)),
);
for (const [id, entry] of Object.entries(entries)) {
  for (const width of [64, 128, 256]) {
    const m = decodeFoilMask(entry, width);
    assert(
      m.active.length && m.background.length,
      `${id}: material and background present`,
    );
    const a = renderFoilFrame(m, 0.2).slice(),
      b = renderFoilFrame(m, 0.75).slice();
    const active = new Set([...m.active, ...m.background].map((p) => p.i));
    assert(
      m.background.some((p) => a[p.i * 4 + 3] !== b[p.i * 4 + 3]),
      `${id}: existing background flecks sparkle`,
    );
    assert(
      m.active.some((p) => a[p.i * 4] !== b[p.i * 4]),
      `${id}: foil colour gradient changes`,
    );
    for (let i = 0; i < m.width * m.height; i++)
      if (!active.has(i)) {
        assert.equal(a[i * 4 + 3], 0, `${id}: outside foil remains untouched`);
        assert.equal(b[i * 4 + 3], 0);
      }
    for (const [l, t, r, bottom] of entry.protected || []) {
      for (
        let y = Math.floor(t * m.height);
        y < Math.ceil(bottom * m.height);
        y++
      )
        for (let x = Math.floor(l * m.width); x < Math.ceil(r * m.width); x++)
          if (x >= 0 && x < m.width && y >= 0 && y < m.height)
            assert(
              !active.has(y * m.width + x),
              `${id}: face/skin is protected`,
            );
    }
  }
}
console.log(
  "15 foil characters × 3 sizes: gradients, existing-background sparkle, face/skin guards OK",
);
