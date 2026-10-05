import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { captureCues, captureTiming } from "../src/game/capture-sequence.js";
import { paintLostBack } from "../src/ui/capture-renderer.js";
import { captureSoundOnBus } from "../src/audio/capture-sounds.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-visibility-"));
try {
  const out = path.join(tmp, "render.cjs");
  await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "jsx",
      contents: `
    import {renderToStaticMarkup} from 'react-dom/server';
    import {Piece} from './src/ui/cards.jsx';

    import {SeatsProvider} from './src/ui/names.jsx';
    export function render(props) {return renderToStaticMarkup(<SeatsProvider value={{skins:[{6:'elf-male'},{6:'elf-male'}]}}><Piece {...props}/></SeatsProvider>)}
  `,
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    loader: { ".css": "text", ".png": "dataurl", ".webp": "dataurl" },
    define: { __AUDIO_FILES__: "{}" },
    outfile: out,
    logLevel: "silent",
  });
  const { render } = createRequire(import.meta.url)(out);
  for (const viewer of [0, 1, null])
    for (const owner of [0, 1])
      for (const size of ["xs", "md"])
        for (const revealed of [false, true]) {
          const piece = {
            id: "p",
            rank: "6",
            suit: "spade",
            owner,
            revealed,
            isKing: true,
            mark: "palace",
            originalRank: "4",
          };
          const html = render({ piece, viewer, size });
          const expected =
            viewer == null
              ? owner === 0
                ? "赤"
                : "青"
              : owner === viewer
                ? "自"
                : "敵";
          assert.ok(html.includes('data-faction="' + owner + '"'));
          assert.match(
            html,
            new RegExp("piece-faction-mark[^>]*>" + expected + "<"),
          );
          if (owner !== viewer && !revealed) {
            assert.doesNotMatch(
              html,
              /data-skin="elf-male"|card-captain|king-badge|元は4|card-suit-promoted/,
            );
            assert.match(html, /card-back/);
          } else {
            assert.match(html, /data-skin="elf-male"/);
            assert.match(html, /card-suit-promoted/);
            assert.match(html, /king-badge/);
          }
        }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

for (const reduced of [false, true]) {
  const q = captureTiming(
    { from: { row: 8, col: 4 }, to: { row: 2, col: 4 } },
    3,
    reduced,
  );
  assert.ok(captureCues(q).some((c) => c[1] === "open"));
  assert.ok(captureCues(q, false).every((c) => c[1].startsWith("loss-")));
  assert.ok(captureCues(q, false).every((c) => c[0] >= q.hit));
  const state = { globalAlpha: 1 };
  let saves = 0,
    draws = 0;
  const context = new Proxy(state, {
    get(target, key) {
      if (key === "save")
        return () => {
          saves++;
        };
      if (key === "restore")
        return () => {
          saves--;
        };
      if (key === "drawImage")
        return () => {
          draws++;
        };
      if (key === "createRadialGradient" || key === "createLinearGradient")
        return () => {
          assert.fail("loss has no luminous gradients");
        };
      return key in target ? target[key] : () => {};
    },
    set(target, key, value) {
      assert.ok(!(key === "globalCompositeOperation" && value === "lighter"));
      target[key] = value;
      return true;
    },
  });
  for (const t of [
    0,
    q.hit,
    q.lift,
    q.ready,
    q.crack + 100,
    q.melt + 120,
    q.reveal,
  ])
    paintLostBack(context, {}, t, q);
  assert.equal(saves, 0);
  assert.ok(draws > 0);
}
// Exercise the real synthesizer: loss cues never invoke the normal capture sample
// or rising/high pitched oscillators, and can be stopped through the same bus.
let hits = 0;
const tones = [];
const param = () => ({
  value: 0,
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
});
const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {} });
const ctx = {
  state: "running",
  currentTime: 0,
  sampleRate: 8000,
  createGain: () => ({ ...node(), gain: param() }),
  createDynamicsCompressor: () => ({
    ...node(),
    threshold: param(),
    knee: param(),
    ratio: param(),
    attack: param(),
    release: param(),
  }),
  createOscillator: () => {
    const f = [];
    tones.push(f);
    return {
      ...node(),
      frequency: {
        setValueAtTime: (v) => f.push(v),
        exponentialRampToValueAtTime: (v) => f.push(v),
      },
    };
  },
  createBuffer: (channels, n) => ({
    getChannelData: () => new Float32Array(n),
  }),
  createBufferSource: node,
  createBiquadFilter: () => ({ ...node(), frequency: param(), Q: param() }),
};
const sound = captureSoundOnBus(ctx, {}, () => {
  hits++;
});
for (const cue of [
  "loss-hit",
  "loss-crack",
  "loss-break",
  "loss-open",
  "loss-royal",
])
  sound.play(cue);
assert.equal(hits, 0);
assert.ok(tones.length >= 4);
assert.ok(tones.every(([start, end]) => start < 200 && end < start));
sound.stop();
console.log(
  "駒の陣営: 両視点・観戦・伏せ札・公開札・スキン・昇格・王 / 損失: 正体保護・非発光・専用下降音: OK",
);
