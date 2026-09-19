/**
 * ガチャ結果の札ごとに「このキャラのフォイルを持っているか」を出す件
 * (2026-09-19 本人の指示。装備ボタンの近くで所持が分かるように)。
 *
 * 守りたいのは次の3つ。
 * 1. 表示があること(文言とクラス)
 * 2. 出してはいけない札に出さないこと(フォイル未解禁・フォイル版が無い・伏せる札)
 * 3. 4列の釦の位置がずれないこと(所持・未所持・空 で同じ高さを取る)
 * 隣接や出現回数は数えない。隣に要素が増えても壊れないようにする。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ALL_SKINS, POOL, byId, foilId } from "../src/skins/catalog.js";
import { foilRevealed } from "../src/skins/collection.js";
import { skinVisibleInCollection } from "../src/skins/foil-shop.js";

const ui = readFileSync(new URL("../src/ui/skins.jsx", import.meta.url), "utf8");
const css = readFileSync(
  new URL("../src/skins/styles.css", import.meta.url),
  "utf8",
);

// 1. 表示があること
assert.match(ui, /function visibleFoilOf\(/, "フォイルの出し分けは1か所にまとめる");
assert.match(ui, /skins-result-foil/, "結果の札に所持の行を出す");
assert.match(ui, /フォイル所持/, "所持しているときの文言");
assert.match(ui, /フォイル未所持/, "持っていないときの文言");
assert.match(
  ui,
  /const foilHeld = foil \? collection\.owned\[foil\.id\] \|\| 0 : 0;/,
  "所持は台帳の枚数で見る(id の文字列ではなく foil.id)",
);

// 2. 出してはいけないところに出さない
assert.match(
  ui,
  /\{foilKnown && \(\s*<small/,
  "フォイルを1枚も持たないうちは、行ごと出さない",
);
assert.match(
  ui,
  /const candidate = foilKnown && skin \? byId\(foilId\(skin\.id\)\) : null;/,
  "未解禁なら候補を作らない",
);
assert.match(
  ui,
  /return skinVisibleInCollection\(collection, candidate\) \? candidate : null;/,
  "伏せる札(A のフォイル)は null にする",
);

// 3. 高さをそろえる・釦の位置をそろえる
assert.match(
  css,
  /\.skins-result-foil \{[\s\S]*?min-height:/,
  "所持・未所持・空 で同じ高さを取る",
);
assert.match(
  css,
  /\.skins-result-foil \{[\s\S]*?white-space: nowrap;/,
  "狭い端末で折り返して高さが変わらないようにする",
);
assert.match(css, /\.skins-result-foil\.is-owned \{/, "持っているときは見分けがつく");
assert.match(
  css,
  /\.skins-result \.skin-btn \{\s*margin-top: auto;/,
  "名前が3行になる札でも、同じ行の装備釦の高さをそろえる",
);

// 4. 結果を確認は、スクロールしなくても押せる(下端に貼る)
assert.match(ui, /className="skins-result-actions"/, "伝言と釦をまとめた囲い");
assert.match(
  css,
  /\.skins-results-overlay \.skins-result-actions \{[\s\S]*?position: sticky;[\s\S]*?bottom: 0;/,
  "囲いごと下端に貼る",
);

// --- 台帳の前提(ここが崩れると上の出し分けが嘘になる) ---
assert.equal(
  POOL.filter((s) => !byId(foilId(s.id))).length,
  0,
  "POOL の全キャラにフォイル版がある",
);
assert.deepEqual(
  ALL_SKINS.filter((s) => !s.foil && !byId(foilId(s.id))).map((s) => s.id),
  ["pegasus-knight"],
  "フォイル版が無いのは 10(白翼の天馬騎士)だけ。増えたら結果画面の空欄の扱いを見直す",
);
assert.equal(
  skinVisibleInCollection({ owned: {} }, null),
  false,
  "フォイル版が無い札では null を渡すので、false が返ること",
);
assert.equal(
  skinVisibleInCollection({ owned: {} }, byId(foilId("genie-magician"))),
  false,
  "A のフォイルは全収集まで伏せる",
);
assert.equal(foilRevealed({ owned: {} }), false, "未解禁の判定");

console.log("check-foil-owned-badge ok");
