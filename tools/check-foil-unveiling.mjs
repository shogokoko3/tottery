import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { byId } from "../src/skins/catalog.js";
import { foilRevealRoute } from "../src/skins/reveal.js";
import {
  foilUnveilingPlan,
  foilUnveilingFrame,
  scheduleFoilUnveiling,
} from "../src/skins/foil-unveiling.js";

assert.equal(foilRevealRoute(byId("angel-k"), "any"), "none");
assert.equal(foilRevealRoute(byId("zombie-male:foil"), "any"), "common");
assert.equal(foilRevealRoute(byId("elf-female:foil"), "any"), "common");
const legend = byId("angel-k:foil"),
  before = JSON.stringify(legend);
let special = 0;
for (let draw = 1; draw <= 10000; draw++) {
  const seed = `${draw}#angel-k:foil#0`,
    route = foilRevealRoute(legend, seed);
  assert.equal(
    foilRevealRoute(legend, seed),
    route,
    "same saved draw keeps the route after reload",
  );
  if (route === "legend") special++;
  else assert.equal(route, "surprise");
}
assert.ok(
  special > 4750 && special < 5250,
  `50% route threshold: ${special}/10000`,
);
assert.equal(
  JSON.stringify(legend),
  before,
  "presentation never modifies the drawn card",
);

for (const legend of [false, true])
  for (const fromGrid of [false, true]) {
    const plan = foilUnveilingPlan(legend, fromGrid);
    if (fromGrid) {
      assert.equal(foilUnveilingFrame(0, { legend, fromGrid }).phase, "select");
      assert.equal(
        foilUnveilingFrame(plan.lift, { legend, fromGrid }).phase,
        "lift",
      );
      assert.equal(
        foilUnveilingFrame(plan.gather, { legend, fromGrid }).phase,
        "gather",
      );
    }
    assert.equal(
      plan.reveal - plan.hush,
      1000,
      "one full second of anticipation immediately before identity reveal",
    );
    assert.equal(
      foilUnveilingFrame(plan.hush, { legend, fromGrid }).phase,
      "hush",
    );
    assert.equal(
      foilUnveilingFrame(plan.reveal - 1, { legend, fromGrid }).phase,
      "hush",
    );
    for (const elapsed of [
      0,
      plan.seal - 1,
      plan.seal,
      plan.hush,
      plan.reveal - 1,
    ])
      assert.equal(
        foilUnveilingFrame(elapsed, { legend, fromGrid }).identityVisible,
        false,
      );
    for (const elapsed of [plan.reveal, plan.settle, plan.complete])
      assert.equal(
        foilUnveilingFrame(elapsed, { legend, fromGrid }).identityVisible,
        true,
      );
    assert.equal(
      foilUnveilingFrame(plan.complete - 1, { legend, fromGrid }).complete,
      false,
    );
    assert.equal(
      foilUnveilingFrame(0, { legend, fromGrid, reduce: true }).complete,
      true,
    );
    let time = 0,
      finish = 0,
      frame,
      next = 0;
    const callbacks = new Map();
    const stop = scheduleFoilUnveiling({
      legend,
      fromGrid,
      now: () => time,
      setTimer: (fn, at) => {
        const id = ++next;
        callbacks.set(id, {
          fn: () => {
            callbacks.delete(id);
            fn();
          },
          at,
        });
        return id;
      },
      clearTimer: (id) => callbacks.delete(id),
      onFrame: (value) => {
        frame = value;
      },
      onComplete: () => finish++,
    });
    const scheduled = [...callbacks.values()];
    for (const { fn, at } of scheduled) {
      time = at - 0.25; // Early browser timers still respect the requested boundary.
      fn();
      assert.equal(frame.identityVisible, at >= plan.reveal);
    }
    assert.equal(finish, 1);
    for (const { fn } of scheduled) fn();
    assert.equal(finish, 1);
    assert.equal(callbacks.size, 0);
    stop();
  }
let called = 0,
  stale;
const cancel = scheduleFoilUnveiling({
  setTimer: (fn) => ((stale = fn), 1),
  clearTimer() {},
  onComplete: () => called++,
});
cancel();
stale();
assert.equal(called, 0);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-unveiling-"));
try {
  const outfile = path.join(temp, "view.cjs");
  await build({
    stdin: {
      contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {FoilUnveilingView} from './src/ui/foil-unveiling.jsx';export const render=(props)=>renderToStaticMarkup(React.createElement(FoilUnveilingView,props));`,
      resolveDir: process.cwd(),
      loader: "jsx",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    loader: { ".css": "text" },
    outfile,
    logLevel: "silent",
  });
  const { render } = createRequire(import.meta.url)(outfile);
  for (const id of ["zombie-male", "elf-female", "angel-k"]) {
    const skin = byId(id + ":foil"),
      base = byId(id);
    for (const route of ["common", "legend", "surprise"])
      for (const phase of [
        "waiting",
        "select",
        "lift",
        "gather",
        "seal",
        "hush",
      ]) {
        const html = render({ skin, phase, route });
        assert.ok(!html.includes(base.name), `${phase}: no character name`);
        assert.ok(
          !html.includes(skin.name),
          `${phase}: no accessible identity`,
        );
        assert.ok(
          !html.includes(base.card) && !html.includes(skin.card),
          `${phase}: no artwork rendered`,
        );
        assert.match(html, /foil-seal/);
        assert.ok(
          !/>[^<]*\b(?:SSR|SR|R)\b[^<]*</.test(html),
          `${phase}: rarity text stays hidden`,
        );
        if (skin.rarity === "SSR") {
          assert.equal(
            /foil-unveiling-stage[^"]*\bis-legend\b/.test(html),
            route === "legend" || ["seal", "hush"].includes(phase),
          );
          assert.equal(
            html.includes("is-upgrading"),
            route === "surprise" && phase === "seal",
          );
        }
      }
    for (const phase of ["reveal", "settle", "complete"]) {
      const html = render({ skin, phase });
      assert.ok(html.includes(skin.card));
      assert.ok(html.includes(base.name));
      assert.ok(
        !html.includes(base.card),
        "unveil directly as foil; no normal-to-foil coating",
      );
    }
    const failed = render({ skin, phase: "complete", missing: true });
    assert.ok(
      failed.includes(base.name),
      "failed artwork still resolves with the correct name",
    );
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log(
  `フォイルの正体: 開示前の絵・名前・レアリティ・読み上げを伏せる／開示時に完成箔／SSR2経路50% (${special}/10000)／時間境界と中断: OK`,
);
