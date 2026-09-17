/**
 * フォイルの直接購入(src/skins/foil-shop.js)。本人の決め(2026-09-16):
 *  - 商品1〜4 は 1,500 / 1,500 / 3,000 / 3,000、商品5〜9 は 5,000 で統一。有償ジェムだけ
 *  - ガチャの15キャラのフォイルが、商品1〜9 にちょうど1回ずつ入る
 *  - 買えるのは持っていないフォイルだけ。セットの片方を持っていれば残りを按分
 *  - 引いた帯は勧めない(exclude)
 *  - 商品10(A のフォイル)は全カードをそろえた人にだけ
 *  - 配線: 結果を閉じたら出す・買ったら所持に足す・サーバーは有償だけで払う
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOIL_PRODUCTS, productOf, priceFor, bandOf, ownsAllButSecret, skinVisibleInCollection, foilOffers, coversPool, FOIL_WINDOW_MS, foilWindow, foilWindowLabel, startFoilWindow } from "../src/skins/foil-shop.js";
import { ALL_SKINS, byId, foilId } from "../src/skins/catalog.js";

assert.equal(coversPool(), true, "15キャラのフォイルが商品1〜9にちょうど1回ずつ");
const prices = Object.fromEntries(FOIL_PRODUCTS.map((p) => [p.id, p.price]));
assert.deepEqual(prices, {
  "foil-2-3": 1500, "foil-4-5": 1500, "foil-6-7": 3000, "foil-8-9": 3000,
  "foil-10": 5000, "foil-jq-angel": 5000, "foil-jq-demon": 5000, "foil-k-angel": 5000, "foil-k-demon": 5000, "foil-a": 2000,
});
assert.equal(productOf("foil-a").secret, true);
assert.ok(!productOf("foil-a").pending, "A の絵と購入条件の接続後に公開");
assert.equal(productOf("nope"), null);

// 按分
const jq = productOf("foil-jq-angel");
assert.equal(priceFor(jq, ["angel-j", "angel-q"]), 5000);
assert.equal(priceFor(jq, ["angel-q"]), 2500);
assert.equal(priceFor(jq, ["angel-j", "angel-j"]), null, "同じ札を二度は数えない");
assert.equal(priceFor(jq, ["demon-j"]), null, "商品外の札");
assert.equal(priceFor(jq, []), null);
assert.equal(priceFor(productOf("foil-2-3"), ["zombie-female"]), 750);
assert.equal(bandOf("zombie-male:foil").id, "foil-2-3");
assert.equal(bandOf("genie-magician"), null, "secret は帯にしない");

// 勧める商品
const none = foilOffers({ owned: {} });
assert.equal(none.length, 9, "何も持っていなければ 9 商品(A は出ない)");
assert.ok(none.every((o) => !o.partial && o.price === o.product.price));
const some = foilOffers({ owned: { "zombie-male:foil": 1, "angel-j:foil": 1, "angel-q:foil": 1 } }, { exclude: ["foil-10"] });
assert.ok(!some.some((o) => o.product.id === "foil-jq-angel"), "全部持っている商品は出ない");
assert.ok(!some.some((o) => o.product.id === "foil-10"), "引いた帯は出ない");
const half = some.find((o) => o.product.id === "foil-2-3");
assert.deepEqual([half.skins, half.price, half.partial], [["zombie-female"], 750, true], "片方を持っていれば残りを按分");

// A: 全カード(A のフォイル以外)をそろえたときだけ見える
const everything = Object.fromEntries(ALL_SKINS.map((s) => [s.id, 1]));
delete everything[foilId("genie-magician")];
assert.equal(ownsAllButSecret({ owned: everything }), true);
for (const id of Object.keys(everything))
  assert.equal(ownsAllButSecret({ owned: { ...everything, [id]: 0 } }), false, `${id}も全カードの条件に必要`);
assert.equal(ownsAllButSecret({ owned: { [foilId("genie-magician")]: 1 } }), false);
assert.equal(ownsAllButSecret(null), false);
assert.deepEqual(foilOffers({ owned: everything }).map((offer) => [offer.product.id, offer.price]), [["foil-a", 2000]], "全収集後はAだけを有償2,000で案内");
assert.deepEqual(foilOffers({ owned: { ...everything, [foilId("genie-magician")]: 1 } }), [], "Aも所持済みなら購入を案内しない");
assert.ok(!JSON.stringify(foilOffers({ owned: {} })).includes("genie"), "そろえるまで A の存在を出さない");
const secretSkin = byId(foilId("genie-magician"));
assert.equal(skinVisibleInCollection({ owned: {} }, secretSkin), false, "未収集なら図鑑にも存在を出さない");
assert.equal(skinVisibleInCollection({ owned: everything }, secretSkin), true, "全収集後に図鑑へ公開");
assert.equal(skinVisibleInCollection({ owned: { [secretSkin.id]: 1 } }, secretSkin), true, "購入済みは復元後にも表示");
assert.equal(skinVisibleInCollection({ owned: {} }, byId("genie-magician")), true, "A通常版は既存の図鑑に残す");
assert.equal(skinVisibleInCollection({ owned: {} }, byId("angel-j:foil")), true);
assert.equal(skinVisibleInCollection({ owned: {} }, null), false);

// 配線
const skins = readFileSync(new URL("../src/ui/skins.jsx", import.meta.url), "utf8");
assert.ok(/if \(next && pulledFoils\.length && WALLET_SERVER\)/.test(skins), "ガチャでフォイルが出て結果を閉じたら出す(Web でも有償ジェムがあれば買える)");
assert.ok(/onShop=\{shopOk \? \(\) => setShop\(true\) : null\}/.test(skins), "ジェムを買う釦は iOS だけ");
assert.ok(/setFoilOffer\(\{ exclude \}\)/.test(skins), "引いた帯を除いて出す");
// 決済の呼び出しは src/ui/buy.js の1本に寄せてある(ショップ・ガチャ画面が同じ道を使う。2026-09-17)
const buyui = readFileSync(new URL("../src/ui/buy.js", import.meta.url), "utf8");
assert.ok(/await buyFoil\(offer\.product\.id, offer\.skins\);/.test(buyui), "購入APIを使う(呼び出しは src/ui/buy.js 1本)");
assert.ok(!/buyFoil\(/.test(skins), "画面から直接は呼ばない");
assert.ok(/有償ジェムが足りません/.test(buyui), "フォイルは有償ジェムの足りない言い方で店を開く");
assert.ok(!/grantFoils\(s, offer\.skins\)/.test(skins + buyui), "画面で再送のたびに重複付与しない");
const clientWallet = readFileSync(new URL("../src/net/wallet.js", import.meta.url), "utf8");
assert.ok(/data\.purchasedFoils/.test(clientWallet) && /!next\.owned\[id\]/.test(clientWallet), "支払済みカードの未所持分を応答から復元");
assert.ok(/\{foilOffer && !shop && \(\s*<FoilOfferSheet/.test(skins), "ジェムの店の下には出さない");
const worker = readFileSync(new URL("../src/server/worker.js", import.meta.url), "utf8");
assert.ok(/wop === "foil"/.test(worker) && /call\("wallet-foil", \{ product: body\.product, skins: body\.skins \}\)/.test(worker), "サーバーの口");
const wallet = readFileSync(new URL("../src/server/wallet.js", import.meta.url), "utf8");
assert.ok(/this\.spendGems\(uid, id, price, "foil",[^\n]+\{ paidOnly: true \}\)/.test(wallet), "有償ジェムだけで払う");
console.log("フォイルの直接購入: 値段・15キャラを網羅・按分・帯を除く・A全収集条件・購入復元の配線 OK");

/* ---- ショップに並ぶのは72時間だけ(2026-09-18 本人の指示) ---- */
{
  const fs = await import("node:fs");
  assert.equal(FOIL_WINDOW_MS, 72 * 60 * 60 * 1000, "72時間");
  const now = 1_700_000_000_000;
  assert.deepEqual(foilWindow({}, now), { open: false, until: null, leftMs: 0 }, "まだ引いていなければ並ばない");
  assert.deepEqual(foilWindow({ foilOfferAt: 0 }, now).open, false);
  const started = startFoilWindow({ owned: {} }, now);
  assert.equal(started.foilOfferAt, now, "引いた時刻を控える");
  assert.equal(foilWindow(started, now).open, true, "引いた直後は並ぶ");
  assert.equal(foilWindow(started, now + FOIL_WINDOW_MS - 1000).open, true, "72時間ちょうどの直前まで並ぶ");
  assert.equal(foilWindow(started, now + FOIL_WINDOW_MS).open, false, "72時間で閉じる");
  // 引き直すと、その時点から72時間
  const again = startFoilWindow(started, now + 100 * 3600e3);
  assert.equal(foilWindow(again, now + 101 * 3600e3).open, true, "引くたびに72時間に戻る");
  assert.equal(foilWindowLabel(50 * 60e3), "あと50分");
  assert.equal(foilWindowLabel(5 * 3600e3), "あと5時間");
  assert.equal(foilWindowLabel(51 * 3600e3), "あと2日と3時間");
  assert.equal(foilWindowLabel(48 * 3600e3), "あと2日");
  assert.equal(foilWindowLabel(0), "");
  // 台帳が時刻を覚える
  const { normalize } = await import("../src/skins/collection.js");
  assert.equal(normalize({ foilOfferAt: now }).foilOfferAt, now, "保存から読み戻す");
  assert.equal(normalize({ foilOfferAt: "x" }).foilOfferAt, null, "壊れた値は無し");
  assert.equal(normalize({}).foilOfferAt, null);
  // 画面の配線
  const shop = fs.readFileSync(new URL("../src/ui/shop.jsx", import.meta.url), "utf8");
  assert.ok(/const foilKnown = foilRevealed\(collection\) && window\.open;/.test(shop), "ショップの欄は72時間の中だけ");
  assert.ok(/72時間だけ並びます/.test(shop), "閉じているときは理由を出す");
  const skins = fs.readFileSync(new URL("../src/ui/skins.jsx", import.meta.url), "utf8");
  assert.ok(/pulledFoils\.length \? startFoilWindow\(base\) : base/.test(skins.replace(/\s+/g, " ")), "ガチャでフォイルを引くたびに72時間を引き直す");
  assert.ok(/if \(foilOffers\(next, \{ exclude \}\)\.length\) setFoilOffer\(\{ exclude \}\);/.test(skins), "引くたびにポップアップを出す");
}
console.log("フォイルの欄は72時間だけ・引くたびに引き直す OK");
