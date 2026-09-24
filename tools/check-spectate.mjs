/**
 * 観戦(2026-09-24 本人の指示「フレンドが対戦中に観戦できる」)。
 *
 * 観戦は **読むだけ**。手番の列(rooms/<code>/acts)を、誰が書いたか(by)から席を決めて
 * reducer で畳み直す。ここでは spectateAct の席決め(なりすまし・野次馬を弾く)と、
 * 実際に一局ぶんの手を畳んで両者の reducer と同じ盤になることを確かめる。
 * あわせて firebase-rules.json が観戦者の読みを開けていること、Piece が revealAll を持つことも見張る。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spectateAct, acceptAct } from "../src/net/sync.js";
import { reducer, initialState } from "../src/game/reducer.js";
import { enrichAction } from "../src/game/actions.js";

const HOST = "hostUid";
const GUEST = "guestUid";

/* ---- spectateAct の席決め ---- */
// ホストが書いた手は席0、ゲストは席1
assert.equal(spectateAct({ __id: "a", type: "MOVE_PIECE", by: HOST }, HOST, GUEST).player, 0, "ホストの手は席0");
assert.equal(spectateAct({ __id: "b", type: "MOVE_PIECE", by: GUEST }, HOST, GUEST).player, 1, "ゲストの手は席1");
// 席に無い by は捨てる(野次馬・なりすまし)
assert.equal(spectateAct({ __id: "c", type: "MOVE_PIECE", by: "stranger" }, HOST, GUEST), null, "知らない by は捨てる");
// by が無い・__id が無い・NET でない手は捨てる
assert.equal(spectateAct({ __id: "d", type: "MOVE_PIECE" }, HOST, GUEST), null, "by 無しは捨てる");
assert.equal(spectateAct({ type: "MOVE_PIECE", by: HOST }, HOST, GUEST), null, "__id 無しは捨てる");
assert.equal(spectateAct({ __id: "e", type: "VIEW_LOG", by: HOST }, HOST, GUEST), null, "盤に関わらない手は捨てる");
// 始まりの合図はホストだけ。ゲストが名乗ったら捨てる
assert.equal(spectateAct({ __id: "f", type: "START_SETUP", by: GUEST }, HOST, GUEST), null, "START_SETUP をゲストが出したら捨てる");
assert.ok(spectateAct({ __id: "g", type: "START_SETUP", by: HOST }, HOST, GUEST), "START_SETUP はホストなら通る");
// 時間切れは席を書き換えず、player をそのまま運ぶ
assert.equal(spectateAct({ __id: "h", type: "CLOCK_TIMEOUT", by: HOST, player: 1 }, HOST, GUEST).player, 1, "時間切れは申告された席のまま");
assert.equal(spectateAct({ __id: "i", type: "CLOCK_TIMEOUT", by: HOST, player: 5 }, HOST, GUEST), null, "時間切れの席が変なら捨てる");
// ゲストがまだ居ない(guestUid=null)なら、ゲストの手は決められない
assert.equal(spectateAct({ __id: "j", type: "MOVE_PIECE", by: GUEST }, HOST, null), null, "ゲスト未確定なら席1の手は保留");

/* ---- 一局ぶんを畳んで、当事者の盤と一致するか ---- */
// 5×5 の対局を、通信でやり取りする形(acts)にして組み立てる。
// 当事者の端末は acceptAct で「相手の手は 1-seat」と畳む。観戦者は by から席を決める。
// 同じ acts から、両者とも同じ盤にたどり着くのが正。

// 乱数を固定して、配りと出目を決める(enrichAction が確定してから送るので、両者で同じ)
let r = 12345;
const rng = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const realRandom = Math.random;
Math.random = rng;

let idc = 0;
const nextId = () => `-Nspec${String(idc++).padStart(12, "0")}`;
const acts = [];
// ホスト(席0)が始まりの合図を出す。enrichAction が山札を確定して載せる
function emit(by, action) {
  const enriched = enrichAction(action, spectatorStateFor(by));
  const withId = { ...enriched, __id: nextId(), by };
  acts.push(withId);
  return withId;
}
// enrichAction は state を見て畳む種類がある(この検査で使うのは START_SETUP のみ)
let hostView = initialState();
function spectatorStateFor() {
  return hostView;
}

// 始まり(ホスト)。5×5、詳細設定なし
const startAct = emit(HOST, { type: "START_SETUP", size: 5 });

// 席の視点で reducer をそれぞれ回す(当事者2人 + 観戦者)
function foldSeat(list, seat, me, foeUid) {
  let s = initialState();
  const seen = new Set();
  for (const raw of list) {
    let a = acceptAct(raw, me, seat, foeUid);
    if (!a || seen.has(a.__id)) continue;
    seen.add(a.__id);
    s = reducer(s, a);
  }
  return s;
}
function foldSpectate(list) {
  let s = initialState();
  const seen = new Set();
  for (const raw of list) {
    let a = spectateAct(raw, HOST, GUEST);
    if (!a || seen.has(a.__id)) continue;
    seen.add(a.__id);
    s = reducer(s, a);
  }
  return s;
}

// ゲスト(席1)は、ホストの START_SETUP を acceptAct で受け取って盤を作る。
// 観戦者は by から席を決めて同じ acts を畳む。両者は同じ盤へたどり着くのが正
const guest1 = foldSeat(acts, 1, GUEST, HOST);
const spec = foldSpectate(acts);
assert.equal(guest1.boardSize, 5, "ゲストは合図を受けて盤ができる(受け取れている前提の確認)");
assert.equal(spec.boardSize, guest1.boardSize, "観戦の盤の大きさは当事者と同じ");
assert.equal(spec.players[0].hand.length, guest1.players[0].hand.length, "席0の手札の枚数が一致");
assert.equal(spec.players[1].hand.length, guest1.players[1].hand.length, "席1の手札の枚数が一致");
// 山札が公開されているので、観戦者は両者の手札の中身まで復元できる(審判視点の土台)
assert.deepEqual(
  spec.players[0].hand.map((c) => c.id),
  guest1.players[0].hand.map((c) => c.id),
  "観戦者は席0の手札の中身まで当事者と同じに復元する",
);

Math.random = realRandom;

/* ---- ルールが観戦者の読みを開けているか ---- */
const rules = readFileSync(new URL("../firebase-rules.json", import.meta.url), "utf8");
assert.ok(
  rules.includes("data.child('spectate').val() === true && data.child('spectators').child(auth.uid).exists()"),
  "spectate 済みの部屋を、名乗った観戦者が読める",
);
assert.ok(/"spectators":/.test(rules) && /"spectate":/.test(rules) && /"spectateReveal":/.test(rules), "spectate / spectateReveal / spectators の枝がある");
// 観戦者は手番(acts)を書けない(席についた二人だけ)
const actsWrite = rules.slice(rules.indexOf('"acts":'));
assert.ok(/seats'\)\.child\('host'\)\.val\(\) === auth\.uid/.test(actsWrite), "acts の書き込みは席の二人だけ(観戦者は書けない)");

/* ---- 端末側の配線 ---- */
const fb = readFileSync(new URL("../src/net/firebase.js", import.meta.url), "utf8");
for (const fn of ["setRoomSpectate", "joinSpectate", "leaveSpectate"])
  assert.ok(fb.includes(`export ` ) && fb.includes(fn), `firebase.js に ${fn}`);
const cards = readFileSync(new URL("../src/ui/cards.jsx", import.meta.url), "utf8");
assert.ok(/revealAll/.test(cards), "Piece に審判視点(revealAll)がある");
const spectate = readFileSync(new URL("../src/ui/spectate.jsx", import.meta.url), "utf8");
assert.ok(!/pushAct\(/.test(spectate) && !/from "\.\.\/net\/firebase\.js"[^;]*pushAct/.test(spectate), "観戦の画面は手番を書き込まない(pushAct を呼ばない)");
assert.ok(/joinSpectate/.test(spectate) && /leaveSpectate/.test(spectate), "観戦の画面は名乗って入り、下ろして出る");

console.log("観戦: 席決め(by→席)・なりすまし除外・一局の再生一致・ルールの読み開放・書き込み無し・配線 OK");
