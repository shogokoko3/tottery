// ホームの入り口の並びと、ランキングの置き場所の検査(本人の指示 2026-09-17)。
//   1. ホームは2列3段。左上から チュートリアル・カード / 詰めトッタリー・ショップ / ミッション・バトルパス・ガチャ
//      (2026-09-22 本人の指示: ミッションとバトルパスを1つにまとめてバトルパスの場所へ。
//       ミッションがあった場所は「カード」＝札ごとの熟練度)
//   1a. ミッション・バトルパスは1つの画面(QuestsScreen)で、上の切り替えで行き来する
//   1b. カードの画面に13種の札の熟練度が並ぶ
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
import {QuestsScreen} from './src/ui/quests.jsx';
import {CardMasteryScreen} from './src/ui/card-mastery.jsx';
const noop=()=>{};
export const home=()=>renderToStaticMarkup(<MenuScreen onPlay={noop} onTutorial={noop} onTsume={noop} onSkins={noop} onBattlePass={noop} onMissions={noop} onCards={noop} onShop={noop} onLetters={noop} />);
export const quests=(tab)=>renderToStaticMarkup(<QuestsScreen tab={tab} onTab={noop} onBack={noop} onSkins={noop} />);
export const cards=()=>renderToStaticMarkup(<CardMasteryScreen onBack={noop} />);
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
  const { home, matching, shop, quests, cards } = createRequire(import.meta.url)(outfile);

  // 1. ホームの並び
  const html = home();
  const grid = html.slice(html.indexOf('class="home-grid"'));
  // 名は <b> の中。「ミッション・バトルパス」は <br> で2行にしているので、タグを外して読む
  const order = [...grid.matchAll(/<b>(.*?)<\/b>/g)]
    // 「おすすめ」の印(span)は名ではないので除く
    .map((m) => m[1].replace(/<span[^>]*>.*?<\/span>/g, "").replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  assert.deepEqual(
    order.slice(0, 6),
    ["チュートリアル", "カード", "詰めトッタリー", "ショップ", "ミッション・バトルパス", "ガチャ・スキン"],
    "2列3段: 左上から チュートリアル・カード / 詰めトッタリー・ショップ / ミッション・バトルパス・ガチャ",
  );
  assert.equal((grid.match(/home-tile home-tile-/g) || []).length, 6, "四角い入り口は6つ");
  for (const tone of ["tutorial", "cards", "tsume", "shop", "quests", "skins"])
    assert.ok(grid.includes(`home-tile-${tone}`), `${tone} の欄がある`);
  assert.ok(!grid.includes("home-tile-missions") && !grid.includes("home-tile-pass"), "ミッションとバトルパスの単独の入り口は無い");

  // 1a. ミッション・バトルパスは1つの画面。切り替えの2つの札があり、開いている側の中身が出る
  const qm = quests("missions");
  assert.ok(qm.includes('class="quests-screen is-missions"'), "ミッションのタブ");
  assert.ok(/role="tab"[^>]*aria-selected="true"[^>]*>ミッション/.test(qm), "ミッションが選ばれている");
  assert.ok(/role="tab"[^>]*>バトルパス/.test(qm), "バトルパスの札がある");
  assert.ok(qm.includes("missions-scroll"), "ミッションの一覧が出る");
  assert.ok(!qm.includes("<h2>ミッション</h2>"), "見出しは切り替えの札が兼ねる(重ねない)");
  const qp = quests("battlepass");
  assert.ok(qp.includes('class="quests-screen is-pass"'), "バトルパスのタブ");
  assert.ok(/role="tab"[^>]*aria-selected="true"[^>]*>バトルパス/.test(qp), "バトルパスが選ばれている");
  assert.ok(qp.includes("pass-reward"), "バトルパスの中身が出る");
  assert.ok(!qp.includes("<h2>バトルパス</h2>"), "見出しは切り替えの札が兼ねる(重ねない)");
  for (const h of [qm, qp]) assert.ok(h.includes("ホームに戻る"), "どちらのタブにも「ホームに戻る」");

  // 1b. カードの画面: 13種の札と、その熟練度
  const cd = cards();
  assert.ok(cd.includes("<h2>カード</h2>"), "カードの見出し");
  for (const rank of ["A","2","3","4","5","6","7","8","9","10","J","Q","K"])
    assert.ok(cd.includes(`aria-label="${rank} の熟練度"`), `${rank} の熟練度のメーター`);
  assert.equal((cd.match(/card-mastery-row/g) || []).length, 13, "札は13種");
  assert.ok(cd.includes("十三英雄の主") && cd.includes("盤上無双"), "通しの称号も出る");
  assert.ok(cd.includes("盤の有利不利には効きません"), "盤に効かないことを断る");
  assert.ok(cd.includes("ホームに戻る"), "カードにも「ホームに戻る」");

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
// 4. 左上の戻る釦は外した(2026-09-21 本人の指示。各画面に「ホームに戻る」があり重複)。
//    backFor の戻り先表は、ホームへの戻り先(goHome の予備)を決めるために残す。
{
  const src = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  const flat = src.replace(/\s+/g, " ");
  assert.ok(/onBack=\{backFor\(e\)\}/.test(flat), "画面の枠は backFor で戻り先を決める");
  const table = flat.slice(flat.indexOf("function backFor(screen)"), flat.indexOf("function backToMatching"));
  assert.ok(/if \(screen === "home" \|\| screen === "game"\) return undefined;/.test(table), "タイトルと対局中だけは出さない");
  for (const [screen, to] of [
    ["menu", "home"], ["shop", "menu"], ["matching", "menu"], ["tutorial", "menu"],
    ["tsume", "menu"], ["missions", "menu"], ["battlepass", "menu"], ["cards", "menu"], ["letters", "menu"],
    ["ranking", "matching"], ["online", "matching"], ["room", "matching"], ["nearby", "matching"],
  ])
    assert.ok(new RegExp(`${screen}: "${to}"`).test(table), `${screen} の戻り先は ${to}`);
  assert.ok(/skins: skinsFrom/.test(table) && /rules: rulesFrom/.test(table), "ガチャとルール設定は来た道へ戻る");
  assert.ok(/if \(screen === "online" \|\| screen === "room" \|\| screen === "nearby"\) return backToMatching;/.test(table), "待ち合わせからの戻りは後片付けを通す");
}
console.log("ホームの並び・ミッションとバトルパスの統合・カードの熟練度・ランキングは対戦する・ショップの中身・戻る釦 OK");
