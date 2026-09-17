// ショップで「その場で買える」ことの検査(本人の指示 2026-09-17)。
//   「ショップ画面にある商品を他の画面に飛んで買うのをやめて、
//    一覧ボタンを押したらその場にその商品が並ぶようにしてほしい」
//   1. 4つの欄はどれも閉じて始まる(重い一覧を最初から描かない)
//   2. 商品の中身は modal(portal)を通さない部品で、サーバー側の描画でも出せる
//   3. 決済の呼び出しは src/ui/buy.js の1本だけ。画面から net/wallet.js を直接叩かない
//   4. 買う前に必ず確認する(選ぶ→確認→確定)
//   5. Apple の要件の文言と「購入を確かめ直す」を落としていない
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { GEM_PER_TICKET, TICKET_BUNDLE, BATTLEPASS_GEMS } from "../src/iap/catalog.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-shop-"));
try {
  const outfile = path.join(dir, "view.cjs");
  await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "jsx",
      contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {ShopScreen} from './src/ui/shop.jsx';
import {GemPacks} from './src/ui/gem-shop.jsx';
import {FoilOfferPicker} from './src/ui/foil-offer.jsx';
import {TicketBuy} from './src/ui/ticket-buy.jsx';
import {BattlePassBuy} from './src/ui/battlepass-buy.jsx';
import {foilOffers} from './src/skins/foil-shop.js';
import {normalize} from './src/skins/collection.js';
import {ALL_FOIL_SKINS} from './src/skins/catalog.js';
const noop=()=>{};
export const shop=()=>renderToStaticMarkup(<ShopScreen onBack={noop} onGacha={noop} onFoil={noop} onBattlePass={noop} />);
export const packs=(products)=>renderToStaticMarkup(<GemPacks gems={0} gemsPaid={0} gemsFree={0} onMessage={noop} initialProducts={products} />);
export const tickets=()=>renderToStaticMarkup(<TicketBuy gems={0} onBuy={noop} />);
export const pass=()=>renderToStaticMarkup(<BattlePassBuy gemsPaid={0} onBuy={noop} />);
export const foils=(owned)=>renderToStaticMarkup(<FoilOfferPicker offers={foilOffers(normalize({owned}))} gemsPaid={0} onBuy={noop} />);
export const allFoilIds=()=>ALL_FOIL_SKINS.map((s)=>s.id);`,
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
  const { shop, packs, tickets, pass, foils, allFoilIds } = createRequire(import.meta.url)(outfile);

  // 1. 最初はどの欄も閉じている。重い一覧も portal も描かない
  const html = shop();
  assert.ok(html.includes("ショップ"), "画面が描ける");
  for (const label of ["ジェムを買う", "ガチャチケット", "フォイルを買う", "バトルパス"])
    assert.ok(html.includes(label), `入り口に「${label}」がある`);
  assert.equal((html.match(/aria-expanded="true"/g) || []).length, 0, "最初はどれも開いていない");
  assert.equal((html.match(/class="shop-panel"/g) || []).length, 0, "閉じている欄は描かない");
  for (const cls of ["modal-overlay", "foil-offer", "shop-list", "pass-purchase"])
    assert.ok(!html.includes(cls), `閉じている間は ${cls} を描かない`);
  assert.ok(html.includes(`1枚 ${GEM_PER_TICKET.toLocaleString("ja-JP")}ジェム`), "値段は閉じた見出しにも出す");

  // 2. 中身の部品は portal を通さない(SkinModal を通すとサーバー側の描画で落ちる)
  const foil = fs.readFileSync("src/ui/foil-offer.jsx", "utf8");
  const picker = foil.slice(foil.indexOf("export function FoilOfferPicker"), foil.indexOf("export function FoilOfferSheet"));
  assert.ok(!picker.includes("SkinModal"), "FoilOfferPicker は SkinModal を通さない");
  const all9 = foils({});
  assert.equal((all9.match(/class="foil-offer"/g) || []).length, 9, "何も持っていなければ商品は9つ(A は出さない)");
  assert.ok(!all9.includes("genie"), "A のフォイルは全部そろえるまで出さない");
  const owned = Object.fromEntries(allFoilIds().filter((id) => !id.startsWith("genie")).map((id) => [id, 1]));
  assert.ok(foils(owned).includes("foil-offer") || foils(owned).includes("買えるフォイルはありません"), "全部そろえたら A だけ、または空の案内");

  // 3. ジェムのパックは Apple の要件の文言ごと運ぶ
  const six = packs([1, 2, 3, 4, 5, 6].map((n) => ({ id: `p${n}`, name: `${n}ジェム`, price: `¥${n}` })));
  assert.equal((six.match(/class="skin-btn shop-item"/g) || []).length, 6, "6種が並ぶ");
  for (const text of ["価格は App Storeの表示に従います", "購入を確かめ直す", "無償ジェムから先に減ります"])
    assert.ok(six.includes(text), `ジェムの欄に「${text}」`);

  // 4. チケットとバトルパスの値段
  const t = tickets();
  assert.ok(t.includes("チケット1枚") && t.includes(`チケット${TICKET_BUNDLE.tickets}枚`), "1枚と10枚");
  assert.ok(t.includes(GEM_PER_TICKET.toLocaleString("ja-JP")) && t.includes(TICKET_BUNDLE.gems.toLocaleString("ja-JP")), "値段はカタログから");
  const p = pass();
  assert.ok(p.includes(BATTLEPASS_GEMS.toLocaleString("ja-JP")) && p.includes("有償ジェム"), "パスは有償ジェムの値段");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// 5. 決済の呼び出しは src/ui/buy.js の1本だけ
const buyui = fs.readFileSync("src/ui/buy.js", "utf8");
assert.match(buyui, /exchangeGems\(newEventId\("xchg"\), n\)/);
assert.match(buyui, /buyFoil\(offer\.product\.id, offer\.skins\)/);
assert.match(buyui, /buyPassWithGems\(newEventId\("pass"\)\)/);
// 残高不足の言い方は商品ごとに違う。フォイルだけ「有償ジェム」
assert.match(buyui, /const PAID_SHORT = \/有償ジェムが足りません\//);
assert.match(buyui, /return failed\(e, PAID_SHORT\);/, "フォイルは有償ジェムの言い方");
for (const f of fs.readdirSync("src/ui")) {
  if (f === "buy.js" || !/\.(js|jsx)$/.test(f)) continue;
  const s = fs.readFileSync(`src/ui/${f}`, "utf8");
  for (const call of ["exchangeGems(", "buyPassWithGems(", "buyFoil("])
    assert.ok(!s.includes(call), `${f} から ${call} を直接呼ばない(src/ui/buy.js 経由)`);
}
const shopSrc = fs.readFileSync("src/ui/shop.jsx", "utf8");
for (const part of ["GemPacks", "TicketBuy", "FoilOfferPicker", "BattlePassBuy"])
  assert.ok(shopSrc.includes(`<${part}`), `ショップが ${part} をその場に描く`);
assert.match(shopSrc, /open === "gems"/, "欄ごとに開く");
assert.match(shopSrc, /setOpen\(\(cur\) => \(cur === key \? null : key\)\)/, "開くのは一度に1つだけ");
assert.ok(!shopSrc.includes("<FoilOfferSheet"), "portal のシートはショップに持ち込まない");
assert.match(shopSrc, /syncWallet\(\)/, "有償ジェムで買わせる前に残高を引き直す");

// 6. 買う前に必ず確認する(選ぶ→確認→確定)
for (const f of ["src/ui/ticket-buy.jsx", "src/ui/battlepass-buy.jsx", "src/ui/foil-offer.jsx"]) {
  const s = fs.readFileSync(f, "utf8");
  assert.ok(s.includes("setup-actions") && s.includes("やめる") && s.includes("買う"), `${f}: 確認の二段`);
}

// 7. それぞれの画面の購入UIは残す(「飛んで買うのをやめる」であって「他では買えなくする」ではない)
const skins = fs.readFileSync("src/ui/skins.jsx", "utf8");
assert.ok(skins.includes("<FoilOfferSheet"), "ガチャ直後の勧めは残す");
assert.ok(/buyTickets\(1\)/.test(skins) && /buyTickets\(10\)/.test(skins), "ガチャ画面のチケット釦は残す");
assert.ok(fs.readFileSync("src/ui/battlepass.jsx", "utf8").includes("buyPassFor"), "バトルパス画面の購入は残す");

console.log("ショップでその場に並ぶ: 4欄は閉じて始まる・portal無し・決済は buy.js 1本・二段確認・Apple の文言・元の画面も残す: OK");
