/**
 * フェーズごとのオンライン(ストーリーとフェーズ.md「オンライン(フェーズ別)」)を確かめる。
 *
 * 守りたいのは「旧端末がフェーズ1・2の対局に入って盤がずれる」ことが無いこと:
 *   - フェーズ1・2の掲示は matchSize を書かず phase+size を書く → 旧端末は拾わない
 *   - 部屋の phase / 席の guestPhase。書けない相手(旧端末)はフェーズ3扱い
 *   - ゲストは部屋の phase から kingPowers / areas / 詳細設定を決め直す(ホストの言い分は信じない)
 *   - phase を渡さなければ今までどおり(古い記録・観戦・サーバー再生)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { matchesOnlineSize, matchesOnlineEntry, roomPhaseOf, guestPhaseOf, onlinePhase } from "../src/net/match-settings.js";
import { setupFlagsForPhase, rulesForPhase } from "../src/game/phase.js";
import { setupFromRoom } from "../src/net/sync.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";

let ok = 0;
const fail = [];
const is = (label, got, want) => {
  try { assert.deepEqual(got, want); ok++; console.log(`  ok   ${label}`); }
  catch { fail.push(label); console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); }
};
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

console.log("掲示の突き合わせ(match-settings)");
const oldEntry = { matchSize: 5, host: "h", guest: null, createdAt: 1 };      // 旧端末・フェーズ3の掲示
const p1Entry = { phase: 1, size: 5, host: "h", guest: null, createdAt: 1 };  // フェーズ1の掲示
is("旧端末はフェーズ1の掲示を拾わない(matchSize が無い)", matchesOnlineSize(p1Entry, 5), false);
is("旧端末は今までどおりの掲示を拾う", matchesOnlineSize(oldEntry, 5), true);
is("フェーズ3の人は今までどおりの掲示だけ", [matchesOnlineEntry(oldEntry, 5, 3), matchesOnlineEntry(p1Entry, 5, 3)], [true, false]);
is("フェーズ1の人はフェーズ1の掲示だけ", [matchesOnlineEntry(p1Entry, 5, 1), matchesOnlineEntry(oldEntry, 5, 1), matchesOnlineEntry({ ...p1Entry, phase: 2 }, 5, 1)], [true, false, false]);
is("盤が違えば拾わない", [matchesOnlineEntry(p1Entry, 9, 1), matchesOnlineEntry(oldEntry, 9, 3)], [false, false]);
is("両方書いてある変な掲示は拾わない", matchesOnlineEntry({ ...p1Entry, matchSize: 5 }, 5, 1), false);
is("phase だけ書いた掲示はフェーズ3の人も拾わない", matchesOnlineEntry({ matchSize: 5, phase: 3 }, 5, 3), false);
is("空・壊れた掲示", [matchesOnlineEntry(null, 5, 1), matchesOnlineEntry({}, 5, 3), matchesOnlineEntry({ phase: "1", size: 5 }, 5, 1)], [false, false, false]);
is("部屋のフェーズ(無ければ 3)", [roomPhaseOf({ phase: 1 }), roomPhaseOf({}), roomPhaseOf(null), roomPhaseOf({ phase: "2" })], [1, 3, 3, 3]);
is("席のフェーズ(書けない旧端末は 3)", [guestPhaseOf({ guestPhase: 2 }), guestPhaseOf({}), guestPhaseOf({ guestPhase: 1.5 })], [2, 3, 3]);
is("範囲外のフェーズは 3 と読む(0・4・7・文字)", [onlinePhase(0), onlinePhase(4), onlinePhase(7), onlinePhase("1"), roomPhaseOf({ phase: 0 }), guestPhaseOf({ guestPhase: 9 })], [3, 3, 3, 3, 3, 3]);
is("自分のフェーズが範囲外なら 3 の掲示を拾う", [matchesOnlineEntry(oldEntry, 5, 0), matchesOnlineEntry(p1Entry, 5, 4)], [true, false]);

console.log("\n部屋から決め直す(sync.setupFromRoom)");
const skins = [{ 2: "zombie-male:foil" }, { 2: "zombie-male:foil" }];
const act9 = { type: "START_SETUP", size: 9, areas: true, loadouts: skins, custom: { ranks: ["2", "3", "4", "5"] }, kingPowers: true };
const act5 = { type: "START_SETUP", size: 5, kingPowers: true, custom: { ranks: ["2", "3", "4", "5"] } };
const V = GAME_RULE_VERSION;
{
  const a = setupFromRoom({ ...act5, kingPowers: true }, skins, { ruleVersion: V, boardSize: 5, phase: 1 });
  is("フェーズ1: ホストが力ありと言っても力なし", a.kingPowers, false);
  is("フェーズ1: エリア・詳細設定は無し", [a.areas, a.loadouts, a.custom], [undefined, undefined, undefined]);
  const b = setupFromRoom({ ...act9, kingPowers: false }, skins, { ruleVersion: V, boardSize: 9, phase: 2 });
  is("フェーズ2: ホストが力なしと言っても旗は消える(=力あり)", "kingPowers" in b, false);
  is("フェーズ2: 9×9 でもエリアは立たない・詳細設定も無し", [b.areas, b.loadouts, b.custom], [undefined, undefined, undefined]);
  const c = setupFromRoom({ ...act9, kingPowers: false }, skins, { ruleVersion: V, boardSize: 9, phase: 3 });
  is("フェーズ3: 旗は消え、エリアは立つ", ["kingPowers" in c, c.areas, !!c.loadouts], [false, true, true]);
  is("フェーズ3: 詳細設定は始める側のものが効く", !!c.custom, true);
  const d = setupFromRoom({ ...act9, kingPowers: false }, skins, { ruleVersion: V, boardSize: 9 });
  is("phase を渡さなければフェーズ3と同じ(古い記録・観戦・サーバー再生)", [d.kingPowers, d.areas, !!d.custom], [undefined, true, true]);
  const e = setupFromRoom({ ...act9 }, skins, { ranked: true, ruleVersion: V, boardSize: 9, phase: 3 });
  is("持ち点の対局では詳細設定を受け取らない(今までどおり)", "custom" in e, false);
  is("START_SETUP 以外はそのまま", setupFromRoom({ type: "MOVE_PIECE" }, skins, { phase: 1 }), { type: "MOVE_PIECE" });
}

console.log("\nFirebase のルール(firebase-rules.json)");
{
  const rules = JSON.parse(read("firebase-rules.json")).rules;
  const rooms = rules.rooms.$code;
  is("rooms.phase は 1・2・3 だけ", rooms.phase[".validate"], "newData.val() === 1 || newData.val() === 2 || newData.val() === 3");
  is("rooms.guestPhase は席についた本人だけ書ける", /seats'\)\.child\('guest'\)\.val\(\) === auth\.uid/.test(rooms.guestPhase[".write"]), true);
  is("rooms.guestPhase は部屋の phase と同じ(部屋に無ければ 3)", /\('phase'\)\.exists\(\) && newData\.val\(\) === root.*\|\| \(!root.*\('phase'\)\.exists\(\) && newData\.val\(\) === 3\)/.test(rooms.guestPhase[".validate"]), true);
  const lobby = rules.lobby.$code;
  is("lobby.phase は 1・2 だけで、部屋の phase と同じ", /\(newData\.val\(\) === 1 \|\| newData\.val\(\) === 2\).*child\('phase'\)\.val\(\)/.test(lobby.phase[".validate"]), true);
  is("lobby.size は 5 だけで、部屋の matchSize と同じ", /newData\.val\(\) === 5.*child\('matchSize'\)\.val\(\)/.test(lobby.size[".validate"]), true);
  is("lobby.matchSize の決まりは今までどおり(書くときだけ検査)", /=== 5 \|\| newData\.val\(\) === 9/.test(lobby.matchSize[".validate"]), true);
  is("lobby.matchSize はフェーズ<3 の部屋には書けない(改造ホストが旧端末を釣れない)", /&& !root\.child\('rooms'\)\.child\(\$code\)\.child\('phase'\)\.exists\(\)/.test(lobby.matchSize[".validate"]), true);
  is("lobby の必須項目は host と createdAt だけ(matchSize が無くても書ける)", /hasChildren\(\['host','createdAt'\]\)/.test(lobby[".write"]), true);
  // acts の START_SETUP: scripted の隣に kingPowers(boolean)
  const find = (node, key) => { if (!node || typeof node !== "object") return null; if (key in node) return node; for (const v of Object.values(node)) { const r = find(v, key); if (r) return r; } return null; };
  const setup = find(rules, "scripted");
  is("acts の START_SETUP に kingPowers(真偽だけ)", setup?.kingPowers?.[".validate"], "newData.isBoolean()");
  is("kingPowers の下に子は書けない", setup?.kingPowers?.$sa?.[".validate"], false);
}

console.log("\nFirebase のルールを評価器で確かめる(tools/check-rules.mjs の canWrite / canPatch)");
{
  const { canWrite, canPatch } = await import("./check-rules.mjs");
  // 評価器の「いま」は固定(tools/check-rules.mjs の NOW)。createdAt の許容幅に合わせる
  const NOW = 1_700_000_000_000;
  const A = { uid: "uidA" }, B = { uid: "uidB" }, X = { uid: "uidX" };
  // 部屋の作成
  const make = (extra) => canWrite({}, ["rooms", "P1"], A, { seats: { host: "uidA" }, createdAt: NOW, matchSize: 5, ...extra });
  is("ホストはフェーズ1の部屋を作れる", make({ phase: 1 }), true);
  is("フェーズ3の部屋は今までどおり(phase なし)で作れる", make({}), true);
  is("フェーズ 4 や文字の phase では作れない", [make({ phase: 4 }), make({ phase: "1" }), make({ phase: 0 })], [false, false, false]);
  // 席の申告
  const seated = (extra) => ({ rooms: { P1: { seats: { host: "uidA", guest: "uidB" }, createdAt: NOW - 60_000, matchSize: 5, hostName: "あ", ...extra } } });
  const p1 = seated({ phase: 1 }), p3 = seated({});
  is("席についたゲストは guestPhase(部屋と同じ)を書ける", canWrite(p1, ["rooms", "P1", "guestPhase"], B, 1), true);
  is("部屋と違う guestPhase は書けない", canWrite(p1, ["rooms", "P1", "guestPhase"], B, 2), false);
  is("ホストは guestPhase を書けない", canWrite(p1, ["rooms", "P1", "guestPhase"], A, 1), false);
  is("部外者は guestPhase を書けない", canWrite(p1, ["rooms", "P1", "guestPhase"], X, 1), false);
  is("phase の無い部屋(旧端末のホスト)では guestPhase は 3 だけ", [canWrite(p3, ["rooms", "P1", "guestPhase"], B, 3), canWrite(p3, ["rooms", "P1", "guestPhase"], B, 1)], [true, false]);
  is("席の申告(まとめ書き)に guestPhase を含めて書ける", canPatch(p1, ["rooms", "P1"], B, { guestPresent: true, guestMatchSize: 5, guestPhase: 1, guestName: "い" }), true);
  is("席の申告に部屋と違う guestPhase を混ぜると全部弾かれる", canPatch(p1, ["rooms", "P1"], B, { guestPresent: true, guestMatchSize: 5, guestPhase: 3 }), false);
  is("旧端末のゲスト(guestPhase なし)の名乗りは今までどおり通る", canPatch(p1, ["rooms", "P1"], B, { guestPresent: true, guestMatchSize: 5, guestName: "い" }), true);
  is("作った後はホストも phase を書き換えられない", [canWrite(p1, ["rooms", "P1", "phase"], A, 2), canPatch(p1, ["rooms", "P1"], A, { phase: 2 })], [false, false]);
  is("phase の無い部屋に後から足せない", canPatch(p3, ["rooms", "P1"], A, { phase: 1 }), false);
  is("guestPhase は数だけ", [canWrite(p1, ["rooms", "P1", "guestPhase"], B, "1"), canWrite(p1, ["rooms", "P1", "guestPhase"], B, true)], [false, false]);
  // 掲示
  const lobbyDb = (roomExtra) => ({ rooms: { L1: { seats: { host: "uidA" }, createdAt: NOW - 1000, matchSize: 5, ...roomExtra } } });
  const post = (db, entry) => canWrite(db, ["lobby", "L1"], A, { host: "uidA", createdAt: NOW, ...entry });
  is("フェーズ1の掲示(phase+size)を出せる", post(lobbyDb({ phase: 1 }), { phase: 1, size: 5 }), true);
  is("フェーズ1の部屋に matchSize の掲示は出せない(改造ホストが旧端末を釣れない)", post(lobbyDb({ phase: 1 }), { matchSize: 5 }), false);
  is("部屋と違うフェーズの掲示は出せない", post(lobbyDb({ phase: 1 }), { phase: 2, size: 5 }), false);
  is("フェーズ1・2の掲示に 9×9 は無い", post(lobbyDb({ phase: 1, matchSize: 9 }), { phase: 1, size: 9 }), false);
  is("フェーズ3の部屋には今までどおり matchSize の掲示", post(lobbyDb({}), { matchSize: 5 }), true);
  is("phase の無い部屋に phase の掲示は出せない", post(lobbyDb({}), { phase: 1, size: 5 }), false);
  // size だけ(phase なし)の掲示はルール上は書けるが、旧端末(matchSize 必須)も新端末(phase 必須)も拾わない
  is("size だけの掲示は誰も拾わない", [matchesOnlineSize({ size: 5, host: "h" }, 5), matchesOnlineEntry({ size: 5, host: "h" }, 5, 1), matchesOnlineEntry({ size: 5, host: "h" }, 5, 3)], [false, false, false]);
  const posted = { rooms: { L3: { seats: { host: "uidA" }, createdAt: NOW - 1000, matchSize: 5 } }, lobby: { L3: { matchSize: 5, host: "uidA", createdAt: NOW - 1000 } } };
  is("出した掲示に後から phase を足せない(本人でも)", canPatch(posted, ["lobby", "L3"], A, { phase: 1 }), false);
  is("他人の掲示に phase を書けない", canWrite(posted, ["lobby", "L3", "phase"], X, 1), false);
  // 開始の合図
  const actDb = { rooms: { P1: { seats: { host: "uidA", guest: "uidB" }, createdAt: NOW - 60_000, matchSize: 5, phase: 1, acts: {} } } };
  const act = (extra) => canWrite(actDb, ["rooms", "P1", "acts", "-Nzzzzzzzzzzzzzzzzz1"], A, { type: "START_SETUP", by: "uidA", __id: "s-1", size: 5, ...extra });
  is("開始の合図はそのまま積める(照らし合わせ)", act({}), true);
  is("開始の合図に kingPowers:false を載せられる", act({ kingPowers: false }), true);
  is("kingPowers は真偽だけ", [act({ kingPowers: "no" }), act({ kingPowers: 1 })], [false, false]);
  is("kingPowers の下に子は書けない", act({ kingPowers: { x: true } }), false);
}

console.log("\nサーバー再生(verify-match)は、フェーズ<3 の部屋と力なしの開始を持ち点に数えない");
{
  const { verifyMatch } = await import("../src/server/verify-match.js");
  const finish = { code: "T", createdAt: 1, round: 0, winner: 0 };
  const start = (extra) => ({ "-N0000000000000000001": { type: "START_SETUP", by: "h", __id: "s-1", size: 9, ruleVersion: GAME_RULE_VERSION, ...extra } });
  const room = (extra, acts) => ({ seats: { host: "h", guest: "g" }, createdAt: 1, round: 0, acts, ...extra });
  const thrown = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
  // 断り文は worker.js の known(/^(この対局|対局|通常の9×9)/)に合う形。合わないと端末には汎用の通信エラーとして届く
  const known = /^(この対局|対局|通常の9×9)/;
  is("フェーズ1の部屋は断る(端末に届く断り文で)", known.test(thrown(() => verifyMatch(room({ phase: 1 }, start({})), finish, "h")) || ""), true);
  is("フェーズ2の部屋も断る", known.test(thrown(() => verifyMatch(room({ phase: 2 }, start({})), finish, "h")) || ""), true);
  is("phase の無い部屋で kingPowers:false の開始は断る", /9×9/.test(thrown(() => verifyMatch(room({}, start({ kingPowers: false })), finish, "h")) || ""), true);
  const plain = thrown(() => verifyMatch(room({}, start({})), finish, "h")) || "";
  is("phase の無い部屋の普通の開始は、フェーズの理由では断らない", /フェーズ3/.test(plain), false);
}

console.log("\nホスト側の旗(setupFlagsForPhase)とゲスト側の決め直し(setupFromRoom)が一致する");
for (const p of [1, 2, 3]) {
  const host = { type: "START_SETUP", size: 5, ...setupFlagsForPhase(p) };
  const guest = setupFromRoom({ type: "START_SETUP", size: 5 }, [{}, {}], { ruleVersion: V, boardSize: 5, phase: p });
  is(`フェーズ${p}: kingPowers が両側で同じ`, host.kingPowers, guest.kingPowers);
  is(`フェーズ${p}: 旗は rulesForPhase と同じ`, guest.kingPowers === false, !rulesForPhase(p).kingPowers);
}

console.log("\n配線(screens / nearby / verify-match / spectate)");
{
  const screens = read("src/ui/screens.jsx");
  is("ランダム: 部屋にフェーズを書く(フェーズ<3 のときだけ)", /matchSize: boardSize,\s*(\/\/[^\n]*\n\s*)*\.\.\.\(myPhase < 3 \? \{ phase: myPhase \} : \{\}\),/.test(screens), true);
  is("ランダム: フェーズ3は matchSize だけ、1・2は phase+size", /myPhase >= 3 \? \{ matchSize: boardSize \} : \{ phase: myPhase, size: boardSize \}/.test(screens), true);
  is("ランダム: 掲示は matchesOnlineEntry で拾う", /matchesOnlineEntry\(g, boardSize, myPhase\)/.test(screens), true);
  is("ランダム: 部屋のフェーズも確かめる", /roomPhaseOf\(b\.data\) !== myPhase/.test(screens), true);
  is("ランダム: 席に guestPhase を書く(部屋がフェーズ<3 のときだけ)", /guestMatchSize: boardSize,\s*(\/\/[^\n]*\n\s*)*\.\.\.\(roomPhaseOf\(b\.data\) < 3 \? \{ guestPhase: myPhase \} : \{\}\),/.test(screens), true);
  is("ランダム: ホストは相手のフェーズを確かめる", /guestPhaseOf\(g\.data\) !== myPhase/.test(screens), true);
  is("ランダム: フェーズ1・2は 5×5 に丸める", /rulesForPhase\(myPhase\)\.sizes\.includes\(wantedSize\) \? wantedSize : 5/.test(screens), true);
  is("ランダム: 対局にフェーズを渡す(2か所)", (screens.match(/random: !0,\s*phase: myPhase,/g) || []).length, 2);
  is("合言葉: 部屋に始める側のフェーズ(フェーズ<3 のときだけ)", /hostRuleVersion: GAME_RULE_VERSION,\s*(\/\/[^\n]*\n\s*)*\.\.\.\(phaseOf\(loadProfile\(\)\) < 3 \? \{ phase: phaseOf\(loadProfile\(\)\) \} : \{\}\),/.test(screens), true);
  is("合言葉: 旧端末のゲストとは3未満で始めない(部屋の phase で判定し、部屋を消す)", /roomPhaseOf\(N\.data\) < 3 &&\s*!Number\.isInteger\(N\.data\.guestPhase\)[\s\S]{0,400}deleteRoom\(f\);/.test(screens), true);
  is("合言葉: ホストは部屋に書いた phase で対局へ", /phase: roomPhaseOf\(N\.data\),\s*code: f,/.test(screens), true);
  is("合言葉: ゲストは部屋のフェーズで遊ぶ", /\.\.\.\(roomPhaseOf\(x\.data\) < 3 \? \{ guestPhase: roomPhaseOf\(x\.data\) \} : \{\}\)/.test(screens) && /phase: roomPhaseOf\(x\.data\),\s*code: P,/.test(screens), true);
  is("親: フェーズ<3 のオンラインは盤を 5×5 に丸めてから対局へ", /\(o === "online" \|\| o === "room" \|\| o === "nearby"\) && phaseOf\(loadProfile\(\)\) < 3 \? 5 : b/.test(screens), true);
  is("親: 詳細設定はフェーズ3だけ", /rulesForPhase\(a \? roomPhaseOf\(a\) : phaseOf\(loadProfile\(\)\)\)\.areas/.test(screens), true);
  is("ルール画面: フェーズ<3 のオンラインは 9×9 を選べない", /lockedByPhase = false,/.test(screens) && /\|\| lockedByPhase;/.test(screens) && /lockedByPhase=\{/.test(screens), true);
  is("近くの端末: 名乗りにフェーズ", /boardSize,\s*phase: phaseOf\(loadProfile\(\)\),\s*\}\);/.test(screens), true);
  is("近くの端末: 相手が知らなければ3未満で始めない", /phase < 3 && !Number\.isInteger\(network\.guestPhase\)/.test(screens), true);
  const nearby = read("src/net/nearby.js");
  is("nearby: 名乗りから部屋と対局にフェーズを写す(2か所・範囲を確かめて)", (nearby.match(/phase: onlinePhase\(hostHello\.phase\)/g) || []).length, 2);
  const verify = read("src/server/verify-match.js");
  is("サーバー再生: 力なしは持ち点に数えない", /act\.kingPowers === false/.test(verify), true);
  is("サーバー再生: 決め直しはフェーズ3で", /phase: 3 \}/.test(verify), true);
  is("サーバー再生: フェーズ<3 の部屋は持ち点に数えない", /room\.phase < 3/.test(verify), true);
  const spectate = read("src/ui/spectate.jsx");
  is("観戦: 部屋のフェーズで決め直す", /phase: roomPhaseOf\(metaLocal\)/.test(spectate), true);
  is("観戦: 部屋の phase を写している", /\{ phase: d\.phase \}/.test(spectate), true);
  const profile = read("src/game/profile.js");
  is("昇格の5勝: 対局のフェーズが自分と違えば数えない", /opts\.phase == null \|\| opts\.phase === normalizePhase\(profile\.phase\)/.test(profile), true);
  is("ルール版は上げていない(旧端末除けは guestPhase で行う)", GAME_RULE_VERSION, 18);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) { console.error("NG: " + fail.join(", ")); process.exit(1); }
