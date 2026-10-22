/**
 * ガチャの選択画面とシリーズのタブ(2026-10-15 本人の指示)。
 *  - ホームからガチャ・スキンを開くと、ガチャの項目(見出し＋看板＋「ガチャを選ぶ」)を縦に並べた選択画面。
 *    スクロールして選ぶ(上に札のタブは置かない。2026-10-15 本人の直し)。選ぶと今のガチャ画面。右上に「ガチャ選択へ」
 *  - ワンダーランド・ゲート／レジェンド・ゲートの2つ並びの切り替え釦はやめ、「札1枚＋押すと縦一覧のシート」を
 *    所持・錬成・加工・バトルパスのシーズンで使う(今後シリーズが何十個に増えても場所を取らない。2026-10-15 本人の決め「1」)
 *  - はじめての10連は台本どおりレジェンド・ゲートなので一覧を飛ばす。未受取の召喚はそのシリーズを開く
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const skins = read("src/ui/skins.jsx");
const pass = read("src/ui/battlepass.jsx");
const css = read("src/styles.css");
const skinsCss = read("src/skins/styles.css");


console.log("ガチャの選択画面");
assert.match(skins, /const \[pickedSeries, setPickedSeries\] = useState\(\(\) =>\s*firstPull \? "heroes" : collection\.pendingPull\?\.series \|\| null,?\s*\)/, "最初は選択画面(はじめての10連と未受取は飛ばす)");
assert.match(skins, /\{tab === "gacha" && !pickedSeries \? \(/, "ガチャの欄は、選ぶまで選択画面");
assert.match(skins, /className="skins-gacha skins-gacha-select" role="tabpanel" aria-label="ガチャを選ぶ"/, "選択画面の入れ物");
assert.match(skins, /const gachaSeriesList = SERIES\.filter\(\(item\) => isSeriesOpen\(item\.id\)\);/, "始まっていないシーズンは出さない");
assert.match(skins, /className="skins-gacha skins-gacha-select"[^\n]*\n\s*\{\/\*[^\n]*\*\/\}\s*\{gachaSeriesList\.map\(\(item\) => \(\s*<section className="gacha-pick" key=\{item\.id\}>/, "選択画面は開いているガチャを全部、縦に並べる(上に札のタブは無い)");
assert.ok(!/browseSeries|browseShown/.test(skins), "選択画面に灯す札の状態は持たない");
assert.match(skins, /<div className="gacha-pick-head">\s*<h2>\{item\.name\}<\/h2>/, "見出しはシリーズ名");
assert.match(skins, /<SeriesBanner series=\{item\.id\} shine=\{shine\} foilKnown=\{foilKnown\} \/>/, "見出しの下に看板");
assert.match(skins, /className="skin-btn skin-btn-gold gacha-pick-go" disabled=\{working\} onClick=\{\(\) => pickGacha\(item\.id\)\}>\s*ガチャを選ぶ/, "「ガチャを選ぶ」で今のガチャ画面へ");
assert.match(skins, /const pickGacha = \(id\) => \{\s*setPickedSeries\(id\);/, "「ガチャを選ぶ」でそのガチャを開く");
assert.match(skins, /\) : tab === "gacha" \? \(\s*<div className="skins-gacha" role="tabpanel" aria-label="ガチャ">\s*<SeriesBanner series=\{series\}/, "選んだあとは今のガチャ画面(看板から)");
assert.ok(!/<SeriesPicker series=\{series\} onChange=\{setSeries\} label="ガチャシリーズ"/.test(skins), "ガチャのシリーズ切り替え釦はやめた");
assert.match(skins, /\{tab === "gacha" && pickedSeries && !firstPull && \(\s*<button type="button" className="skins-gacha-back" disabled=\{working\} onClick=\{backToGachaPick\}>/, "右上に「ガチャ選択へ」(はじめての10連では出さない)");
assert.match(skins, /const backToGachaPick = \(\) => \{\s*setPickedSeries\(null\);/, "戻ると選択画面");
assert.match(skins, /if \(tab === "gacha" && pickedSeries && !reduce && collection\.summonMotion !== "skip"\)/, "演出の先読みはガチャを選んでから");
assert.match(skins, /function SeriesBanner\(\{ series, shine, foilKnown \}\)/, "看板は1つの部品");

console.log("札1枚＋シートを、所持・錬成・加工・バトルパスで(2026-10-15 本人の決め「1」)");
const select = read("src/ui/series-select.jsx");
assert.match(select, /export function SeriesSelect\(\{[\s\S]*?allowAll = false,[\s\S]*?\}\)/, "受け口");
assert.match(select, /aria-haspopup="dialog"[\s\S]*?onClick=\{\(\) => setOpen\(true\)\}/, "札を押すとシート");
assert.match(select, /<SkinModal label=\{label\} onClose=\{\(\) => setOpen\(false\)\} className="series-select-overlay">/, "シートは共通のモーダル");
assert.match(select, /role="listbox"[\s\S]*?\{list\.map\(\(item\) => \(/, "全シリーズを縦に並べる");
assert.match(select, /const list = allowAll \? \[\{ id: "all", name: allLabel, note: allNote \}, \.\.\.items\] : items;/, "所持では「全シリーズ」を先頭に");
assert.match(select, /const pick = \(id\) => \{\s*setOpen\(false\);\s*if \(id !== value\) onChange\(id\);/, "選ぶと閉じる");
assert.match(skins, /function SeriesPicker\(\{ series, onChange, label, disabled = false, allowAll = false, notes = \{\}, allNote = "" \}\) \{[\s\S]*?<SeriesSelect\s+items=\{SERIES\.filter\(\(item\) => isSeriesOpen\(item\.id\)\)\.map\(/, "所持・錬成・加工の切り替えは札1枚＋シート");
assert.match(skins, /notes=\{Object\.fromEntries\(seriesOwned\.map\(\(item\) => \[item\.id, seriesCountNote\(item\)\]\)\)\}/, "所持の札には通常版とフォイルの種類数");
assert.match(skins, /`通常 \$\{item\.normalOwned\}\/\$\{item\.normalTotal\}種\$\{foilKnown \? ` · フォイル \$\{item\.foilOwned\}\/\$\{item\.foilTotal\}種` : ""\}`/, "種類数は「通常 x/N種 · フォイル y/M種」");
assert.ok(!/skins-filters skins-series-picker/.test(skins) && !/SeriesTabs/.test(skins), "2つ並びの釦も横流れの札も残さない");
assert.ok(/label="カードシリーズ"/.test(skins) && /label=\{foilView \? "加工シリーズ" : "錬成シリーズ"\}/.test(skins), "所持・錬成・加工の切り替えは残す");
assert.match(pass, /<SeriesSelect\s+className="pass-seasons"\s+items=\{seasons\.map\(\(s\) => \(\{ id: s\.id, name: s\.passName, note: activeId === s\.id \? "進行中" : undefined, art: rewardSkin\(s\.id\)\?\.card \}\)\)\}\s+value=\{season\}\s+onChange=\{setSeason\}/, "バトルパスのシーズンも札1枚＋シート(進行中の印つき)");
assert.ok(!/SeriesTabs|series-tabs/.test(pass) && !/\.series-tab(s| )/.test(css) && !/pass-season-tab/.test(css), "横流れの札は残さない");
assert.match(css, /\.skin-overlay\.series-select-overlay \{\s*align-items: flex-end;/, "シートは下から");
assert.match(css, /\.series-select-row\.is-active \{/, "選んでいる行は金に灯る");
assert.match(css, /\.series-select \{[\s\S]*?font-family: "Shippori Mincho", serif;/, "明朝の札");
assert.ok(!/skins-series-picker/.test(skinsCss), "2つ並びの釦の規則は落とした");
assert.match(skinsCss, /\.skins-series-owned \{ display: flex;[^}]*overflow-x: auto;/, "所持数のカードも横に流す");
console.log("ガチャの選択画面: 縦に並ぶ見出し＋看板＋釦・選ぶと今のガチャ画面・右上の「ガチャ選択へ」・札1枚＋シートは所持/錬成/加工/バトルパスで OK");
