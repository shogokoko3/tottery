import assert from "node:assert/strict";
import {
  captureTiming,
  captureFrame,
  captureCues,
  capturedCells,
} from "../src/game/capture-sequence.js";
import { movePresentationMs } from "../src/game/capture-presentation.js";
import { captureLayout, captureBackPose } from "../src/ui/capture-layout.js";

const paths = [
  { from: { row: 4, col: 2 }, to: { row: 2, col: 2 }, captured: true },
  { from: { row: 4, col: 0 }, to: { row: 2, col: 2 }, captured: true },
  { from: { row: 4, col: 1 }, to: { row: 2, col: 2 }, captured: true },
  { from: { row: 8, col: 4 }, to: { row: 0, col: 4 }, captured: true },
  null, // A surround: no moving attacker
];
for (const move of paths)
  for (const reduced of [false, true]) {
    for (const count of [1, 3, 10]) {
      const q = captureTiming(move, count, reduced);
      assert.equal(q.hit, movePresentationMs(move));
      assert.ok(
        q.crack > q.ready,
        "cracking starts only after arrival at center",
      );
      if (!reduced)
        assert.ok(q.crack - q.ready >= 150, "pause at center before cracking");
      if (!reduced)
        assert.ok(
          q.reveal >= q.melt + 620,
          "back fragments must be gone before revealing a face",
        );
      const unreadable = new Proxy([], {
        get(_, key) {
          if (/^\d+$/.test(String(key))) throw Error("read an unrevealed card");
          return undefined;
        },
      });
      for (const t of [0, q.hit, q.crack, q.melt, q.reveal - 1]) {
        const frame = captureFrame(t, q, unreadable);
        assert.equal(frame.shown, 0);
        assert.equal(frame.collected, 0);
        assert.equal(frame.royal, false);
        assert.equal(frame.done, false);
      }
      const cards = Array.from({ length: count }, (_, i) => ({
        isKing: i === count - 1,
      }));
      for (let i = 0; i < count; i++) {
        const at = q.reveal + i * q.gap;
        const guarded = new Proxy(cards, {
          get(target, key) {
            if (/^\d+$/.test(String(key)) && Number(key) > i)
              throw Error("read a later card");
            return target[key];
          },
        });
        const frame = captureFrame(at, q, guarded);
        assert.equal(frame.shown, i + 1);
        assert.equal(
          frame.collected,
          i,
          "the history must not reveal the new card before the large face",
        );
        assert.equal(frame.royal, false);
        assert.equal(captureFrame(at + 219, q, guarded).royal, false);
        assert.equal(captureFrame(at + 220, q, guarded).royal, i === count - 1);
        assert.equal(frame.done, false);
      }
      const lastAt = q.reveal + (count - 1) * q.gap;
      assert.equal(captureFrame(lastAt + 1379, q, cards).done, false);
      const finished = captureFrame(lastAt + 1380, q, cards);
      assert.equal(finished.done, true);
      assert.equal(finished.collected, count);
      assert.ok(
        captureCues(q).every(([at, kind]) => at >= 0 && kind !== "royal"),
        "royal audio is triggered only by the public frame",
      );
    }
  }
const q = captureTiming(paths[0]);
assert.equal(
  captureFrame(q.reveal + 650 + 279, q, [{ isKing: false }]).done,
  false,
);
assert.equal(
  captureFrame(q.reveal + 650 + 280, q, [{ isKing: false }]).done,
  true,
);
assert.deepEqual(
  capturedCells(
    [
      { row: 2, col: 3, owner: 1, rank: "K", suit: "heart", wasKing: true },
      { row: 4, col: 3, owner: 0, rank: "6", wasKing: true },
    ],
    0,
  ),
  [{ row: 2, col: 3, owner: 1 }],
  "back renderer receives no rank, suit or king flag; counterattack waits for its film",
);
// 端の駒、反転した盤、複数撃破でも、同じ画面中央で割る。
for (const viewport of [
  {
    width: 375,
    height: 812,
    headerBottom: 103,
    footerTop: 620,
    titleHeight: 50,
  },
  {
    width: 320,
    height: 568,
    headerBottom: 68,
    footerTop: 390,
    titleHeight: 50,
  },
  {
    width: 812,
    height: 375,
    headerBottom: 56,
    footerTop: 285,
    titleHeight: 48,
  },
  {
    width: 1024,
    height: 768,
    headerBottom: 72,
    footerTop: 580,
    titleHeight: 63,
  },
]) {
  const { focal, zoom, titleY } = captureLayout(viewport);
  const halfCard = (101 * 1.46 * zoom) / 2;
  assert.equal(focal.x, viewport.width / 2);
  assert.ok(Math.abs(focal.y - viewport.height / 2) < 60);
  assert.ok(
    titleY >= viewport.headerBottom + 15.9,
    "heading clears the title bar",
  );
  assert.ok(titleY + viewport.titleHeight + 15.9 <= focal.y - halfCard);
  assert.ok(focal.y + halfCard + 15.9 <= viewport.footerTop);
  for (const reduced of [false, true]) {
    const q = captureTiming(paths[0], 3, reduced);
    for (const from of [
      { x: 20, y: 120 },
      { x: viewport.width - 20, y: 160 },
      { x: 40, y: viewport.height - 80 },
    ]) {
      const base = 26 / 75;
      assert.deepEqual(
        captureBackPose(q.lift - 1, q, from, focal, base, zoom),
        { ...from, scale: base },
      );
      for (const t of [q.ready, q.crack, q.melt]) {
        const pose = captureBackPose(t, q, from, focal, base, zoom);
        assert.ok(Math.abs(pose.x - focal.x) < 1e-8);
        assert.ok(
          Math.abs(pose.y - (reduced ? 0 : 28 * zoom) - focal.y) < 1e-8,
        );
        assert.ok(Math.abs(pose.scale - zoom) < 1e-8);
      }
    }
  }
}
console.log(
  "Capture sequence: hidden identity, complete shatter, shared move clock, royal delay, multi-capture order, readable faces, centered arrival before cracking, safe heading layout, reduced motion: OK",
);
