import assert from "node:assert/strict";
import fs from "node:fs";
import {
  summonPlan,
  summonWorldForSkin,
  summonFrame,
  SUMMON_TIMING,
} from "../src/skins/summon-plan.js";
import { byId } from "../src/skins/catalog.js";
const draw = (...ids) => ids.map((id) => ({ id, isNew: true }));
for (const [id, world] of Object.entries({
  "zombie-male": "earth",
  "pirate-female": "sea",
  "elf-male": "forest",
  "viking-female": "ice",
  "dragon-knight": "sky",
  "angel-q": "heaven",
  "demon-k": "hell",
}))
  assert.equal(summonWorldForSkin(byId(id)), world);
assert.deepEqual(
  summonPlan(draw("angel-k", "zombie-male")),
  { world: "heaven", gold: false, count: 2 },
  "ordinary SSR must keep bronze gate",
);
assert.deepEqual(
  summonPlan(draw("angel-k", "zombie-male:foil")),
  { world: "earth", gold: true, count: 2 },
  "a foil's area takes priority over a normal SSR",
);
assert.equal(
  summonPlan(draw("demon-j:foil", "angel-k:foil")).world,
  "hell",
  "ties follow first drawn card",
);
assert.equal(
  summonPlan(draw("elf-male:foil", "angel-k:foil")).world,
  "heaven",
  "highest rarity foil leads",
);
for (const count of [1, 10])
  assert.equal(summonPlan(draw(...Array(count).fill("elf-male"))).count, count);
for (const [time, stage] of [
  [0, "ascent"],
  [1999, "ascent"],
  [2000, "gate"],
  [3999, "gate"],
  [4000, "opening"],
  [6999, "opening"],
  [7000, "flight"],
  [9000, "flight"],
])
  assert.equal(summonFrame(time).stage, stage);
assert.equal(SUMMON_TIMING.total, 9000);
assert.equal(summonFrame(8999).done, false);
assert.equal(summonFrame(9000).done, true);
assert.equal(summonFrame(4000).opening, 0);
assert.equal(summonFrame(7000).opening, 1);
assert.equal(summonFrame(9000).flight, 1);
const ui = fs.readFileSync("src/ui/summon-intro.jsx", "utf8");
assert.match(ui, /webglcontextlost/);
assert.match(ui, /visibilitychange/);
assert.match(ui, /getBoundingClientRect/);
assert.match(ui, /SUMMON_TIMING\.total \+ 600/);
assert.doesNotMatch(ui, /debitTickets|updateCollection|Math\.random/);
assert.ok(fs.statSync("assets/skins/summon/gate-relief.webp").size > 10000);
for (const world of ["earth", "sea", "forest", "ice", "sky", "heaven", "hell"])
  assert.ok(fs.statSync(`assets/skins/summon/${world}-hall.webp`).size > 10000);
console.log(
  "召喚導入: 結果由来の7世界・通常SSR銅/foil金・1/10枚・2+2+3+2秒・失敗時に結果保護: OK",
);
