/**
 * シーズン2(アリス)の技の映像の検査(2026-10-14 本人の指示)。
 *
 * ・A の数字逆転は、王なら3体版(king)、王以外なら1体版(reverse)
 * ・王の技・帰還・盤面効果の映像は、使った本人にも相手にも流す(CPU も同じ)
 * ・幻影が倒された手は、攻めた側にも攻められた側にも phantom を流す
 * ・チェシャ猫の「姿をくらます」は盤面効果(field)の枠
 * ・騙す移動そのもの、幻影が晴れただけの手では phantom を流さない
 * ・対局中の映像は最後まで流す(5秒で打ち切らない)
 * ・スキン画面は、登録してある技の動画をすべて試写できる
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { wonderlandFxScene } from "./wonderland-fx-fixtures.mjs";
import { reducer } from "../src/game/reducer.js";
import { syncAlice } from "../src/game/alice-rules.js";
import { filmPlanFor, phantomFilm, powerFilm } from "../src/skins/events.js";
import { ALICE_SKINS } from "../src/skins/alice.js";

const loadout = Object.fromEntries(ALICE_SKINS.map((s) => [s.rank, s.id]));
const loadouts = [loadout, loadout];
const videos = (before, after, viewer) =>
  filmPlanFor(before, after, loadouts, viewer).map(({ skin }) => skin.video);
const film = (name) => `skins/alice-films-v1/${name}`;
let n = 0;
const t = (label, cond) => {
  assert.ok(cond, label);
  n++;
};

// 王の A の逆転 → 3体版。誰の画面でも流れる
{
  const { before, after } = wonderlandFxScene("reverse");
  t("発動の記録に royal が残る", after.lastAlicePower.royal === true);
  for (const viewer of [0, 1, null])
    t(`王の逆転は3体版(viewer=${viewer})`, videos(before, after, viewer).includes(film("A-alice-king.mp4")));
  t("1体版は流れない", !videos(before, after, 1).includes(film("A-alice-single.mp4")));
}
// 王以外の A の逆転 → 1体版
{
  let { before } = wonderlandFxScene("reverse");
  before = structuredClone(before);
  const own0 = before.pieces["own-0"], own1 = before.pieces["own-1"];
  before.pieces["own-0"] = { ...own0, rank: "2" }; before.board[own0.row][own0.col] = before.pieces["own-0"];
  before.pieces["own-1"] = { ...own1, rank: "A" }; before.board[own1.row][own1.col] = before.pieces["own-1"];
  before.shuffleMode = { aId: "own-1", picks: ["foe-2"] };
  before = syncAlice(before);
  const after = reducer(before, { type: "ALICE_ACTION", kind: "reverse", aId: "own-1", player: 0, pickIds: ["foe-2"], seed: 10 });
  assert.notEqual(after, before, "王以外の逆転が通る");
  t("発動の記録は royal でない", after.lastAlicePower.royal === false);
  for (const viewer of [0, 1])
    t(`王以外の逆転は1体版(viewer=${viewer})`, videos(before, after, viewer).includes(film("A-alice-single.mp4")));
}
// 王の技(4 バリア・5 偽の王)と帰還 → 本人にも相手にも
for (const [type, name] of [["barrier", "6-gryphon.mp4"], ["false-king", "7-mock-turtle.mp4"], ["revive", null]]) {
  const { before, after } = wonderlandFxScene(type);
  const expected = name ? film(name) : film(`${after.lastAlicePower.rank === "2" ? "2-dodo" : "3-bill"}.mp4`);
  for (const viewer of [0, 1, null])
    t(`${type} の映像は誰の画面でも流れる(viewer=${viewer})`, videos(before, after, viewer).includes(expected));
  t(`${type} は1本だけ`, videos(before, after, 1).length === 1);
}
// 盤面効果「幻影」(味方2体を入れ替えて正体を隠す) → field の枠＝姿をくらます
{
  const { before, after } = wonderlandFxScene("illusion");
  for (const viewer of [0, 1])
    t(`姿をくらますは field の枠(viewer=${viewer})`, videos(before, after, viewer).includes(film("10-cheshire-cat-vanish.mp4")));
}
// 幻影が倒された手 → 攻めた側にも攻められた側にも phantom
{
  const { before, after } = wonderlandFxScene("phantom-hit");
  // ふつうの手では dispelled は立たない(クロッケーのときだけ)。相手が騙す位置のマスへ動いたことで判定する
  const real = Object.values(before.pieces).find((p) => p.alive && p.illusion);
  t("相手が騙す位置へ動いた", real && after.lastMove.to.row === real.illusion.row && after.lastMove.to.col === real.illusion.col && after.lastMove.owner !== real.owner);
  t("本体は倒れていない", after.pieces[real.id].alive);
  t("phantomFilm がチェシャ猫を返す", phantomFilm(before, after, loadouts)?.video === film("10-cheshire-cat-phantom.mp4"));
  for (const viewer of [0, 1])
    t(`幻影が倒された映像は両方の画面(viewer=${viewer})`, videos(before, after, viewer).includes(film("10-cheshire-cat-phantom.mp4")));
  t("同じ盤を2度描いても流さない", phantomFilm(after, after, loadouts) === null);
}
// 騙す移動そのもの・幻影が晴れただけの手では流さない
for (const type of ["deception", "reappear"]) {
  const { before, after } = wonderlandFxScene(type);
  t(`${type} では phantom を流さない`, phantomFilm(before, after, loadouts) === null);
  t(`${type} では技の映像も流さない`, powerFilm(before, after, loadouts) === null);
}
// 登録：チェシャ猫は field と phantom、capture/swap は空
{
  const cat = ALICE_SKINS.find((s) => s.id === "alice-10-cheshire-cat");
  t("チェシャ猫 capture は空", !cat.videos.capture);
  t("チェシャ猫 swap は空", !cat.videos.swap);
  t("チェシャ猫 field は姿をくらます", cat.videos.field === film("10-cheshire-cat-vanish.mp4"));
  t("チェシャ猫 phantom は幻影が倒される", cat.videos.phantom === film("10-cheshire-cat-phantom.mp4"));
  t("13体すべてに技の動画がある", ALICE_SKINS.every((s) => Object.values(s.videos).some(Boolean)));
  t("J/Q/K に仲間にしたときの動画がある", ["J", "Q", "K"].every((r) => ALICE_SKINS.find((s) => s.rank === r).videos.recruit));
  t("Q にクロッケー大会の動画がある(field)", ALICE_SKINS.find((s) => s.rank === "Q").videos.field === film("Q-croquet.mp4"));
  for (const s of ALICE_SKINS)
    for (const v of Object.values(s.videos).filter(Boolean))
      t(`${s.name} の動画がある: ${v}`, fs.statSync(`assets/${v}`).size > 0);
}
// 対局中の映像は最後まで。スキン画面は全部の技を試写できる
{
  const skinFilm = fs.readFileSync("src/ui/skin-film.jsx", "utf8");
  t("動画の長さを読んで最後まで流す", /el\.duration/.test(skinFilm));
  t("5秒の決め打ちは長さが読めないときだけ", !/short \? 2000 : 5000/.test(skinFilm));
  t("見張りは9秒の動画より長い", /setTimeout\(finish, 15000\)/.test(skinFilm));
  const skins = fs.readFileSync("src/ui/skins.jsx", "utf8");
  for (const slot of ["king", "reverse", "revive", "field", "recruit", "phantom", "capture", "swap"])
    t(`試写の枠 ${slot}`, new RegExp(`FILM_SLOTS = \\[[^\\]]*"${slot}"`).test(skins));
  t("試写の文言に王のとき/王以外がある", /（王のとき）/.test(skins) && /（王以外）/.test(skins));
  t("エースの包囲撃破の文言は残す", /"包囲撃破"/.test(skins));
}
// 仲間にできる撃破：J/Q/K の recruit の映像を、撃破の手で(配置より先に)両方の画面に流す(2026-10-16 本人の指示)
{
  const { before, after } = wonderlandFxScene("croquet", "hit");
  const entry = after.aliceRecruit?.[0];
  t("仲間にする待ちが立つ(通し番号つき)", !!entry && ["J", "Q", "K"].includes(entry.rank) && entry.seq > 0);
  const skin = ALICE_SKINS.find((s) => s.rank === entry.rank);
  t(`${entry.rank} の recruit の動画が登録されている`, !!skin.videos.recruit);
  for (const viewer of [0, 1, null])
    t(`仲間の映像は撃破の手で誰の画面でも流れる(viewer=${viewer})`, videos(before, after, viewer).includes(skin.videos.recruit));
  const list = videos(before, after, 1);
  t("クロッケーの映像のあとに仲間の映像", list.indexOf(skin.videos.field) < list.indexOf(skin.videos.recruit) && list.length === 2);
}
// 配置の手では、もう映像を流さない(撃破の手で流し終えている)
{
  const { before, after } = wonderlandFxScene("recruit");
  t("配置の手では映像なし", videos(before, after, 0).length === 0);
  t("仲間にした相手の駒は表向き", Object.values(after.pieces).some((p) => p.id.startsWith("r") && p.alive && p.revealed));
}
// 断った(decline)ときも流さない(動画はすでに流れている)
{
  const { before } = wonderlandFxScene("recruit");
  const after = reducer(before, { type: "ALICE_ACTION", kind: "decline", player: 0, seed: 10 });
  assert.notEqual(after, before, "断る手が通る");
  t("断ったときは映像なし", videos(before, after, 0).length === 0);
}
// クロッケー大会：飛ばした兵が相手の駒を倒したときだけ field の映像。外れ・戻っただけでは流さない
{
  const hit = wonderlandFxScene("croquet", "hit");
  const rank = hit.after.lastAlicePower.rank;
  const skin = ALICE_SKINS.find((s) => s.rank === rank);
  t(`クロッケーの記録は盤面効果(${rank})`, hit.after.lastAlicePower.kind === "field" && skin.fieldEffect.type === "alice-croquet");
  t("相手の駒が倒れている", Object.values(hit.before.pieces).some((p) => p.alive && p.owner === 1 && hit.after.pieces[p.id]?.alive === false));
  if (skin.videos.field) {
    for (const viewer of [0, 1])
      t(`当てたときはクロッケーの映像(viewer=${viewer})`, videos(hit.before, hit.after, viewer).includes(skin.videos.field));
  } else console.log(`  (${rank} のクロッケーの動画は未採用なので、当たりの映像の検査は省略)`);
  const miss = wonderlandFxScene("croquet", "empty");
  t("外れたときは流さない", powerFilm(miss.before, miss.after, loadouts) === null);
  const back = wonderlandFxScene("croquet", "return");
  t("自分の位置に戻っただけでは流さない", powerFilm(back.before, back.after, loadouts) === null);
}
console.log(`アリスの技の映像: 王/王以外の振り分け、両者に流す、幻影、盤面効果、仲間、クロッケー、最後まで流す、試写: OK (${n})`);
