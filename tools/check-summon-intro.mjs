import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { SUMMON_ARCHITECTURE } from "../src/skins/summon-architecture.js";
import {
  summonPlan,
  summonWorldForSkin,
  summonFrame,
  SUMMON_TIMING,
  SUMMON_WORLDS,
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
// 門の世界は7つから均等に選び、引いた札とは結びつけない(2026-09-17 本人の指示: 門で SSR が推測できないように)。
// 門の色はこれまでどおり: フォイルがあれば金、なければ銅
assert.deepEqual(
  summonPlan(draw("angel-k", "zombie-male"), 0),
  { world: "earth", gold: false, count: 2 },
  "pick=0 で土。SSR を引いていても土になれる。SSR でも銅の門",
);
assert.deepEqual(
  summonPlan(draw("zombie-male", "zombie-male"), 0.99),
  { world: "hell", gold: false, count: 2 },
  "pick=0.99 で魔界。SSR が無くても魔界になれる",
);
assert.equal(summonPlan(draw("angel-k", "zombie-male:foil"), 0).gold, true, "フォイルがあれば金の門");
{
  const results = draw("angel-k", "zombie-male", "elf-male", "viking-female");
  assert.equal(summonPlan(results).world, summonPlan(results).world, "同じ結果なら再表示でも同じ門");
}
{
  // 抽選結果を変えながら多数作ると、7つの世界がどれもしっかり出る(偏りは 2 倍以内)
  const pool = ["zombie-male", "pirate-female", "elf-male", "viking-female", "dragon-knight", "angel-q", "demon-k"];
  const cnt = {};
  for (let i = 0; i < 1400; i++) {
    const ids = Array.from({ length: 10 }, (_, k) => pool[(i * 3 + k * 5 + (i % 4)) % pool.length]).map((id, k) => (k === i % 10 ? `${id}` : id));
    const w = summonPlan(draw(...ids, `x${i}`)).world;
    cnt[w] = (cnt[w] || 0) + 1;
  }
  const counts = Object.values(cnt);
  assert.equal(counts.length, 7, `7つの世界がすべて出る(${JSON.stringify(cnt)})`);
  assert.ok(Math.max(...counts) <= 2 * Math.min(...counts), `偏りすぎない(${JSON.stringify(cnt)})`);
}
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
for (const world of Object.keys(SUMMON_WORLDS)) {
  assert.ok(
    fs.statSync(
      `assets/skins/summon/art-v3/${SUMMON_ARCHITECTURE[world].asset || `${world}.webp`}`,
    ).size > 10000,
    `召喚建築 ${world} が配信元に含まれる`,
  );
  assert.ok(
    fs.statSync(`assets/skins/summon/interior-v4/${world}.webp`).size > 10000,
    `門の奥の空間 ${world} が配信元に含まれる`,
  );
}

// Exercise the real preview startup with delayed assets, failure, and world
// changes. Never expose an untextured frame or leave the controls stuck waiting.
function element() {
  const children = new Map();
  return {
    style: {},
    hidden: false,
    disabled: false,
    append() {},
    setAttribute() {},
    querySelector(selector) {
      if (!children.has(selector)) children.set(selector, element());
      return children.get(selector);
    },
  };
}
const elements = new Map();
const created = [];
const document = {
  body: element(),
  head: element(),
  querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  },
  createElement() {
    const node = element();
    created.push(node);
    return node;
  },
};
const scenes = [],
  timers = new Map();
let timerId = 0;
vm.runInNewContext(
  fs
    .readFileSync("tools/preview-summon-entry.js", "utf8")
    .replace(/^import .*;\n/gm, ""),
  {
    document,
    window: { addEventListener() {} },
    location: { search: "?world=heaven&time=3000" },
    innerWidth: 390,
    innerHeight: 844,
    URLSearchParams,
    SUMMON_WORLDS,
    performance: { now: () => 0 },
    requestAnimationFrame() {},
    cancelAnimationFrame() {},
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    createSummonScene() {
      const item = { renders: [], disposed: false };
      item.ready = new Promise((resolve, reject) => {
        item.resolve = resolve;
        item.reject = reject;
      });
      item.resize = () => {};
      item.render = (time) => item.renders.push(time);
      item.dispose = () => {
        item.disposed = true;
      };
      scenes.push(item);
      return item;
    },
  },
);
const play = elements.get("#play"),
  slider = elements.get("input"),
  canvas = elements.get("canvas"),
  select = elements.get("select"),
  loading = created[0];
const flush = () => new Promise((resolve) => setImmediate(resolve));
assert.equal(play.disabled, true);
assert.equal(slider.disabled, true);
assert.equal(canvas.style.visibility, "hidden");
assert.deepEqual(scenes[0].renders, []);
assert.equal([...timers.values()][0].delay, 15000);
scenes[0].resolve();
await flush();
assert.deepEqual(scenes[0].renders, [3000]);
assert.equal(play.disabled, false);
assert.equal(canvas.style.visibility, "visible");
assert.equal(loading.hidden, true);
assert.equal(timers.size, 0);
select.onchange();
select.onchange();
assert.equal(scenes[1].disposed, true);
scenes[1].resolve();
await flush();
assert.equal(play.disabled, true, "旧エリアの読込完了で再生を解禁しない");
assert.deepEqual(scenes[2].renders, []);
scenes[2].resolve();
await flush();
assert.equal(play.disabled, false);
select.onchange();
scenes[3].reject(new Error("missing image"));
await flush();
assert.equal(play.disabled, true);
assert.equal(loading.querySelector("button").hidden, false);
assert.match(loading.querySelector("p").textContent, /読み込めません/);
loading.querySelector("button").onclick();
assert.equal(loading.querySelector("button").hidden, true);
[...timers.values()][0].callback();
assert.equal(scenes[4].disposed, true);
assert.equal(loading.querySelector("button").hidden, false);
scenes[4].resolve();
await flush();
assert.equal(play.disabled, true, "時間切れ後の遅延完了で再開しない");
assert.equal(timers.size, 0);
console.log(
  "召喚導入: 7世界・銅/金・1/10枚・2+2+3+2秒・新建築素材・読込待機/切替/失敗/15秒制限: OK",
);
