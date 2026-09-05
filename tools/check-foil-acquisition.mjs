import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import {
  FOIL_ACQUISITION_MS,
  FOIL_ACQUISITION_STEPS,
  FOIL_IMAGE_TIMEOUT_MS,
  foilAcquisitionFrame,
  scheduleFoilAcquisition,
} from "../src/skins/foil-acquisition.js";
import { byId } from "../src/skins/catalog.js";

// The production timeline receives this clock; no animation logic is recreated here.
function manualClock() {
  let time = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => time,
    setTimer(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: time + delay });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    advance(amount) {
      const target = time + amount;
      for (;;) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        const [id, timer] = next;
        time = timer.at;
        timers.delete(id);
        timer.callback();
      }
      time = target;
    },
    pending: () => timers.size,
  };
}

assert.equal(FOIL_ACQUISITION_MS, 3000);
assert.deepEqual(FOIL_ACQUISITION_STEPS, [320, 1100, 2200, 3000]);
assert.equal(FOIL_IMAGE_TIMEOUT_MS, 2500);
for (const [elapsed, phase, complete] of [
  [0, "normal", false],
  [319, "normal", false],
  [320, "gather", false],
  [1099, "gather", false],
  [1100, "reveal", false],
  [2199, "reveal", false],
  [2200, "settle", false],
  [2999, "settle", false],
  [3000, "complete", true],
  [10000, "complete", true],
]) {
  const frame = foilAcquisitionFrame(elapsed);
  assert.equal(frame.phase, phase, String(elapsed));
  assert.equal(frame.complete, complete, String(elapsed));
  assert.ok(
    Number.isFinite(frame.progress) &&
      frame.progress >= 0 &&
      frame.progress <= 1,
  );
}
assert.equal(
  foilAcquisitionFrame(1100).progress,
  0,
  "溜めの間は箔波を進めない",
);
assert.equal(foilAcquisitionFrame(1650).progress, 0.5);
assert.equal(foilAcquisitionFrame(2200).progress, 1);
for (const options of [{ play: false }, { reduce: true }, { failed: true }]) {
  const frame = foilAcquisitionFrame(0, options);
  assert.equal(frame.complete, true);
  assert.equal(frame.phase, "complete");
}
const waiting = foilAcquisitionFrame(FOIL_ACQUISITION_MS + 1, { ready: false });
assert.equal(waiting.phase, "waiting");
assert.equal(waiting.complete, false, "画像待ちの時間で変化を飛ばさない");

const clock = manualClock();
const phases = [];
let completeCount = 0;
const cancel = scheduleFoilAcquisition({
  ...clock,
  onFrame: (frame) => phases.push(frame.phase),
  onComplete: () => {
    assert.equal(phases.at(-1), "complete", "完成画像の通知後に完了する");
    completeCount++;
  },
});
assert.deepEqual(phases, ["normal"]);
clock.advance(319);
assert.deepEqual(phases, ["normal"]);
clock.advance(1);
assert.deepEqual(phases, ["normal", "gather"]);
clock.advance(780);
assert.equal(phases.at(-1), "reveal");
clock.advance(1100);
assert.equal(phases.at(-1), "settle");
assert.equal(completeCount, 0);
clock.advance(800);
assert.equal(phases.at(-1), "complete");
assert.equal(completeCount, 1);
clock.advance(10000);
assert.equal(completeCount, 1);
assert.equal(clock.pending(), 0);
cancel();

// Timers can be delivered a fraction before their performance-clock deadline.
// A final early callback must either complete or retain a timer that completes it.
const earlyClock = manualClock();
let earlyComplete = 0;
const cancelEarly = scheduleFoilAcquisition({
  ...earlyClock,
  now: () => Math.max(0, earlyClock.now() - 0.25),
  onFrame() {},
  onComplete: () => earlyComplete++,
});
earlyClock.advance(FOIL_ACQUISITION_MS);
assert.ok(
  earlyComplete === 1 || earlyClock.pending() > 0,
  "最終timerが0.25ms早くても待機のまま予約が消えない",
);
earlyClock.advance(10);
assert.equal(earlyComplete, 1);
cancelEarly();

// A delayed callback after a background pause jumps to completion once.
const lateClock = manualClock();
let lateBy = 0;
let lateComplete = 0;
const cancelLate = scheduleFoilAcquisition({
  ...lateClock,
  now: () => lateClock.now() + lateBy,
  onFrame() {},
  onComplete: () => lateComplete++,
});
lateBy = 7000;
lateClock.advance(320);
assert.equal(lateComplete, 1);
assert.equal(lateClock.pending(), 0);
lateClock.advance(10000);
assert.equal(lateComplete, 1);
cancelLate();

for (const disabled of [{ play: false }, { reduce: true }]) {
  const instantClock = manualClock();
  let finished = 0;
  const cancelInstant = scheduleFoilAcquisition({
    ...instantClock,
    ...disabled,
    onFrame: (frame) => assert.equal(frame.complete, true),
    onComplete: () => finished++,
  });
  assert.equal(finished, 1);
  assert.equal(instantClock.pending(), 0);
  cancelInstant();
}

// Cancel is the same function used by component cleanup; even a queued stale callback is inert.
const canceledClock = manualClock();
const staleCallbacks = [];
const canceledPhases = [];
let canceledComplete = 0;
const stop = scheduleFoilAcquisition({
  ...canceledClock,
  setTimer(callback, delay) {
    staleCallbacks.push(callback);
    return canceledClock.setTimer(callback, delay);
  },
  onFrame: (frame) => canceledPhases.push(frame.phase),
  onComplete: () => canceledComplete++,
});
canceledClock.advance(320);
const beforeCancel = canceledPhases.slice();
stop();
stop();
assert.equal(canceledClock.pending(), 0);
canceledClock.advance(10000);
for (const callback of staleCallbacks) callback();
assert.deepEqual(canceledPhases, beforeCancel);
assert.equal(canceledComplete, 0);

// Ten real timeline instances share a clock but have independent start/finish/cleanup.
const batchClock = manualClock();
const events = Array.from({ length: 10 }, () => []);
const completed = Array(10).fill(0);
const cleanup = [];
for (let i = 0; i < 10; i++) {
  cleanup.push(
    scheduleFoilAcquisition({
      ...batchClock,
      onFrame: (frame) => events[i].push(frame.phase),
      onComplete: () => completed[i]++,
    }),
  );
  batchClock.advance(100);
}
cleanup[3]();
batchClock.advance(FOIL_ACQUISITION_MS - 1000);
assert.equal(completed[0], 1);
assert.equal(completed[1], 0, "後から開いた札を先頭と同時に完了しない");
batchClock.advance(1000);
assert.deepEqual(completed, [1, 1, 1, 0, 1, 1, 1, 1, 1, 1]);
assert.notEqual(events[3].at(-1), "complete");
assert.equal(batchClock.pending(), 0);
for (const dispose of cleanup) dispose();
console.log(
  "フォイル変化: 実タイムライン境界・完了1回・10枚独立・cleanup後発火なし: OK",
);

// Render the actual React component. SSR runs its initial state, not a copied view function.
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "tottery-foil-acquisition-"),
);
try {
  const outfile = path.join(directory, "acquisition.cjs");
  await build({
    stdin: {
      contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {FoilAcquisition} from './src/ui/foil-acquisition.jsx'; import {RevealCard,SummonReveal} from './src/ui/skins.jsx'; export function render(props){return renderToStaticMarkup(React.createElement(FoilAcquisition,props));} export function renderReveal(props){return renderToStaticMarkup(React.createElement(RevealCard,props));} export function renderSummon(props){return renderToStaticMarkup(React.createElement(SummonReveal,props));}`,
      resolveDir: process.cwd(),
      loader: "jsx",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
    define: { __AUDIO_FILES__: "{}" },
    outfile,
    logLevel: "silent",
    plugins: [
      {
        name: "export-actual-reveal-for-check",
        setup(builder) {
          builder.onLoad({ filter: /src\/ui\/skin-modal\.jsx$/ }, (args) => ({
            // SSR has no portal target. Keep the actual modal and children; only inline the portal.
            contents: fs
              .readFileSync(args.path, "utf8")
              .replace(
                'import { createPortal } from "react-dom";',
                "const createPortal = (children) => children;",
              )
              .replace("    document.body,", "    null,"),
            loader: "jsx",
            resolveDir: path.dirname(args.path),
          }));
          builder.onLoad({ filter: /src\/ui\/skins\.jsx$/ }, (args) => ({
            // Expose the existing private component without substituting its render or hooks.
            contents:
              fs.readFileSync(args.path, "utf8") +
              "\nexport { RevealCard, SummonReveal };\n",
            loader: "jsx",
            resolveDir: path.dirname(args.path),
          }));
        },
      },
    ],
  });
  const { render, renderReveal, renderSummon } = createRequire(import.meta.url)(
    outfile,
  );
  for (const count of [1, 10]) {
    const html = renderSummon({
      results: Array.from({ length: count }, (_, index) => ({
        id: index % 2 ? "zombie-male" : "angel-k:foil",
        isNew: true,
      })),
      onFinish() {},
      reduce: false,
    });
    assert.equal((html.match(/class="reveal-card /g) || []).length, count);
    assert.match(html, /すべてめくる/, "1連/10連とも全めくり操作を残す");
    assert.doesNotMatch(
      html,
      /演出をスキップ/,
      "召喚中のスキップボタンを再表示しない",
    );
    assert.doesNotMatch(
      html,
      /結果へ/,
      "未開示のまま結果へ進むボタンを出さない",
    );
  }
  for (const id of ["zombie-male", "elf-female", "angel-k"]) {
    const base = byId(id);
    const foil = byId(id + ":foil");
    const normal = render({ skin: foil, play: true, alt: foil.name });
    assert.ok(normal.includes(base.card), "R/SR/SSRとも通常版から開始");
    assert.ok(
      !normal.includes(foil.card),
      "foil画像はeffectの読み込み前に描画しない",
    );
    assert.ok(
      !normal.includes("（フォイル）"),
      "通常版の段階でfoil名を読み上げない",
    );
    assert.doesNotMatch(normal, /skins-foil-badge|data-foil=/);
    for (const instant of [{ play: false }, { reduce: true }]) {
      const html = render({ skin: foil, ...instant });
      assert.ok(html.includes(foil.card));
      assert.doesNotMatch(html, /<canvas/, "off/reducedの完成画像は静止画");
    }
    const ordinary = render({ skin: base, play: true });
    assert.ok(ordinary.includes(base.card));
    assert.doesNotMatch(ordinary, /skins\/foils\/|<canvas/);
    for (const flipped of [false, true]) {
      const pendingReveal = renderReveal({
        result: { id: foil.id, isNew: true },
        index: 0,
        flipped,
        onFlip() {},
        onComplete() {},
        reduce: false,
        seed: "foil-before-rarity",
      });
      assert.doesNotMatch(
        pendingReveal,
        /skins\/foils\/|data-foil=|skins-foil-badge/,
      );
      assert.ok(
        !pendingReveal.includes(base.name),
        "レア度確定前はキャラ名も出さない",
      );
      assert.ok(!pendingReveal.includes("（フォイル）"));
      assert.match(pendingReveal, /reveal-veil/);
    }
  }
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log(
  "フォイル変化: 実React初期描画の通常絵・foil名非開示・off/reduced即確定・召喚のスキップなし: OK",
);
