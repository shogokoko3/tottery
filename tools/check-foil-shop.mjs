/**
 * フォイルの直接購入(src/skins/foil-shop.js)。本人の決め(2026-09-16):
 *  - 商品1〜4 は 1,500 / 1,500 / 3,000 / 3,000、商品5〜9 は 5,000 で統一。有償ジェムだけ
 *  - ガチャの15キャラのフォイルが、商品1〜9 にちょうど1回ずつ入る
 *  - 買えるのは持っていないフォイルだけ。セットの片方を持っていれば残りを按分
 *  - 引いた帯は勧めない(exclude)
 *  - 商品10(A のフォイル)は全カードをそろえた人にだけ。絵ができるまで pending で出さない
 *  - 配線: 結果を閉じたら出す・買ったら所持に足す・サーバーは有償だけで払う
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOIL_PRODUCTS, productOf, priceFor, bandOf, ownsAllButSecret, foilOffers, coversPool } from "../src/skins/foil-shop.js";
import { ALL_SKINS, foilId } from "../src/skins/catalog.js";

assert.equal(coversPool(), true, "15キャラのフォイルが商品1〜9にちょうど1回ずつ");
const prices = Object.fromEntries(FOIL_PRODUCTS.map((p) => [p.id, p.price]));
assert.deepEqual(prices, {
  "foil-2-3": 1500, "foil-4-5": 1500, "foil-6-7": 3000, "foil-8-9": 3000,
  "foil-10": 5000, "foil-jq-angel": 5000, "foil-jq-demon": 5000, "foil-k-angel": 5000, "foil-k-demon": 5000, "foil-a": 2000,
});
assert.equal(productOf("foil-a").secret, true);
assert.equal(productOf("foil-a").pending, true, "A の絵ができるまで pending");
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

// A: 全カード(A のフォイル以外)をそろえたときだけ見える(pending が外れたら)
const everything = Object.fromEntries(ALL_SKINS.map((s) => [s.id, 1]));
delete everything[foilId("genie-magician")];
assert.equal(ownsAllButSecret({ owned: everything }), true);
assert.equal(ownsAllButSecret({ owned: { ...everything, "zombie-male": 0 } }), false);
assert.ok(!foilOffers({ owned: everything }).some((o) => o.product.id === "foil-a"), "pending のあいだは全部そろえても出ない");
assert.ok(!JSON.stringify(foilOffers({ owned: {} })).includes("genie"), "そろえるまで A の存在を出さない");

// 配線
const skins = readFileSync(new URL("../src/ui/skins.jsx", import.meta.url), "utf8");
assert.ok(/if \(next && pulledFoils\.length && WALLET_SERVER\)/.test(skins), "ガチャでフォイルが出て結果を閉じたら出す(Web でも有償ジェムがあれば買える)");
assert.ok(/onShop=\{shopOk \? \(\) => setShop\(true\) : null\}/.test(skins), "ジェムを買う釦は iOS だけ");
assert.ok(/setFoilOffer\(\{ exclude \}\)/.test(skins), "引いた帯を除いて出す");
assert.ok(/await buyFoil\(offer\.product\.id, offer\.skins\);\s*await updateCollection\(\(s\) => grantFoils\(s, offer\.skins\)\);/.test(skins), "買えたら所持に足す");
assert.ok(/\{foilOffer && !shop && \(\s*<FoilOfferSheet/.test(skins), "ジェムの店の下には出さない");
const worker = readFileSync(new URL("../src/server/worker.js", import.meta.url), "utf8");
assert.ok(/wop === "foil"/.test(worker) && /call\("wallet-foil", \{ product: body\.product, skins: body\.skins \}\)/.test(worker), "サーバーの口");
const wallet = readFileSync(new URL("../src/server/wallet.js", import.meta.url), "utf8");
assert.ok(/\{ paidOnly: true \}\);\s*return \{ \.\.\.r, product: product\.id/.test(wallet), "有償ジェムだけで払う");
console.log("フォイルの直接購入: 値段・15キャラを網羅・按分・帯を除く・A は秘密(pending)・配線 OK");
