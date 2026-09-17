// ホームの入り口の並びと、ランキングの置き場所の検査(本人の指示 2026-09-17)。
//   1. ホームは2列3段。左上から チュートリアル・ミッション / 詰めトッタリー・ショップ / バトルパス・ガチャ
//   2. ランキングはホームに無く、「対戦する」(MatchingScreen)にある
//   3. ショップの画面に、ジェム・チケット・フォイル・バトルパスの入り口がある
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-home-"));
try {
  const outfile = path.join(dir, "view.cjs");
  await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "jsx",
      contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {MenuScreen, MatchingScreen} from './src/ui/screens.jsx';
import {ShopScreen} from './src/ui/shop.jsx';
const noop=()=>{};
export const home=()=>renderToStaticMarkup(<MenuScreen onPlay={noop} onTutorial={noop} onTsume={noop} onSkins={noop} onBattlePass={noop} onMissions={noop} onShop={noop} onLetters={noop} />);
export const matching=()=>renderToStaticMarkup(<MatchingScreen onOnline={noop} onFriend={noop} onCpu={noop} onBack={noop} onTutorial={noop} onRanking={noop} />);
export const shop=()=>renderToStaticMarkup(<ShopScreen onBack={noop} onGacha={noop} onFoil={noop} onBattlePass={noop} />);`,
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    outfile,
    logLevel: "silent",
    define: { __FIELD_FILES__: "{}", __BUILD_VERSION__: '"check"' },
    loader: { ".css": "text", ".png": "dataurl", ".jpg": "dataurl", ".webp": "dataurl", ".mp4": "dataurl", ".mp3": "dataurl", ".svg": "dataurl" },
  });
  const noop = () => {};
  Object.assign(globalThis, {
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
    requestAnimationFrame: (f) => setTimeout(f, 0),
    cancelAnimationFrame: clearTimeout,
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 2,
    scrollTo: noop,
    location: { protocol: "http:", hostname: "localhost", host: "localhost", href: "http://localhost/", search: "", origin: "http://localhost", pathname: "/" },
    document: {
      addEventListener: noop, removeEventListener: noop, visibilityState: "visible", hidden: false,
      body: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop },
      documentElement: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, setAttribute: noop, getAttribute: () => null },
      createElement: () => ({ style: {}, setAttribute: noop, getAttribute: () => null, appendChild: noop, remove: noop, getContext: () => null, classList: { add: noop, remove: noop } }),
      querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
      head: { appendChild: noop }, fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
    },
  });
  globalThis.window = globalThis;
  if (typeof globalThis.Image === "undefined") globalThis.Image = class { set src(_) {} };
  if (typeof globalThis.Audio === "undefined") globalThis.Audio = class { play() {} pause() {} };
  const { home, matching, shop } = createRequire(import.meta.url)(outfile);

  // 1. ホームの並び
  const html = home();
  const grid = html.slice(html.indexOf('class="home-grid"'));
  const order = [...grid.matchAll(/<b>([^<]*)/g)].map((m) => m[1].trim()).filter(Boolean);
  assert.deepEqual(
    order.slice(0, 6),
    ["チュートリアル", "ミッション", "詰めトッタリー", "ショップ", "バトルパス", "ガチャ・装備"],
    "2列3段: 左上から チュートリアル・ミッション / 詰めトッタリー・ショップ / バトルパス・ガチャ",
  );
  assert.equal((grid.match(/home-tile home-tile-/g) || []).length, 6, "四角い入り口は6つ");
  for (const tone of ["tutorial", "missions", "tsume", "shop", "pass", "skins"])
    assert.ok(grid.includes(`home-tile-${tone}`), `${tone} の欄がある`);

  // 2. ランキングの置き場所
  assert.ok(!html.includes("ランキング"), "ホームにランキングは無い");
  const m = matching();
  assert.ok(m.includes("ランキングを見る"), "「対戦する」からランキングを見られる");
  for (const label of ["オンラインでマッチする", "フレンドとマッチする", "CPUと対戦する"])
    assert.ok(m.includes(label), `${label} はそのまま`);

  // 3. ショップの中身
  const sh = shop();
  for (const label of ["ジェムを買う", "ガチャチケット", "フォイルを買う", "バトルパス"])
    assert.ok(sh.includes(label), `ショップに「${label}」`);
  assert.ok(/1枚 150ジェム \/ 10枚 1,200ジェム/.test(sh), "チケットの値段を出す");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("ホームの並び・ランキングは対戦する・ショップの中身 OK");
