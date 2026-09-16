import assert from "node:assert/strict";
import fs from "node:fs";
import { createNearby, isNearbyCode, NEARBY_PREFIX } from "../src/net/nearby.js";
import {
  ROOM_CODE_LENGTH,
  generateFriendCode,
  formatRoomCode,
  cleanRoomCode,
  parseRoomCode,
  roomLink,
  roomFromLocation,
} from "../src/net/room-code.js";

// ---- 合言葉(6文字・表示・貼り付け・リンク) ----
assert.equal(ROOM_CODE_LENGTH, 6);
for (let i = 0; i < 200; i++) {
  const c = generateFriendCode();
  assert.match(c, /^[A-HJ-NP-Z2-9]{6}$/, `紛らわしい 0/O・1/I を使わない: ${c}`);
}
assert.equal(formatRoomCode("ABCDEF"), "ABC-DEF");
assert.equal(cleanRoomCode("abc-d ef"), "ABCDEF");
assert.equal(cleanRoomCode("ABCDEFGH"), "ABCDEF", "6文字で切る");
assert.equal(parseRoomCode("https://tottery.tsmanager.workers.dev/?room=ABCDEF"), "ABCDEF");
assert.equal(parseRoomCode("https://x/?a=1&room=abc-def#top"), "ABCDEF", "リンクの小文字・区切りも読む");
assert.equal(parseRoomCode("合言葉は ABC-DEF です"), "ABCDEF", "文中からも読む");
assert.equal(parseRoomCode("ABCDE"), "", "5文字は合言葉でない");
assert.equal(parseRoomCode(""), "");
assert.equal(roomLink("abcdef", "https://tottery.tsmanager.workers.dev"), "https://tottery.tsmanager.workers.dev/?room=ABCDEF");
{
  const calls = [];
  const loc = { search: "?room=abcdef&x=1", href: "https://t.example/?room=abcdef&x=1#h" };
  const code = roomFromLocation(loc, { replaceState: (_s, _t, url) => calls.push(url) });
  assert.equal(code, "ABCDEF");
  assert.deepEqual(calls, ["/?x=1#h"], "読んだら URL から room を消す");
  assert.equal(roomFromLocation({ search: "" }, { replaceState() {} }), "");
}

// ---- 近くの端末: 偽のプラグイン2台をつないで、部屋と手番の写しが両方でそろうか ----
function pair() {
  const ends = [];
  const make = (idx) => {
    const listeners = {};
    const end = {
      started: null,
      stopped: 0,
      sent: [],
      addListener: async (ev, fn) => {
        (listeners[ev] ||= []).push(fn);
        return { remove: async () => {} };
      },
      fire: (ev, data) => (listeners[ev] || []).forEach((fn) => fn(data)),
      start: async (o) => {
        end.started = o;
      },
      stop: async () => {
        end.stopped++;
      },
      invite: async ({ peerId }) => {
        // 招待は必ず通る。招待した側 initiator=true
        queueMicrotask(() => {
          ends[1 - idx].fire("connected", { peerId: `p${idx}`, name: "x", initiator: false });
          end.fire("connected", { peerId, name: "y", initiator: true });
        });
      },
      send: async ({ data }) => {
        end.sent.push(data);
        queueMicrotask(() => ends[1 - idx].fire("message", { data }));
      },
    };
    return end;
  };
  ends.push(make(0), make(1));
  return ends;
}
const flush = () => new Promise((r) => setTimeout(r, 0));
{
  const [pa, pb] = pair();
  const A = createNearby({ plugin: pa, myId: "uidA", now: () => 1000 });
  const B = createNearby({ plugin: pb, myId: "uidB", now: () => 2000 });
  const ready = { A: null, B: null };
  const prof = (name, size) => ({ name, icon: null, title: null, skins: { K: `${name}-k:foil` }, ruleVersion: 16, boardSize: size });
  await A.start(prof("あ", 9), (n) => (ready.A = n));
  await B.start(prof("い", 5), (n) => (ready.B = n));
  assert.equal(pa.started.name, "あ");
  pa.fire("peers", { peers: [{ id: "pB", name: "い" }] });
  assert.deepEqual(A.peers, [{ id: "pB", name: "い" }]);
  // A が B をタップ → A がゲスト(席1)、B がホスト(席0)
  await A.invite("pB");
  await flush();
  await flush();
  await flush();
  assert.ok(ready.A && ready.B, "両方に部屋が渡る");
  assert.equal(ready.A.myPlayerIndex, 1);
  assert.equal(ready.B.myPlayerIndex, 0);
  assert.equal(ready.A.code, ready.B.code, "同じ合言葉");
  assert.ok(isNearbyCode(ready.A.code) && ready.A.code.startsWith(NEARBY_PREFIX));
  assert.equal(ready.A.nearby, true);
  assert.equal(ready.A.foeUid, "uidB");
  assert.equal(ready.B.foeUid, "uidA");
  assert.deepEqual(ready.A.names, ["い", "あ"], "席順(ホスト, ゲスト)");
  assert.deepEqual(ready.B.names, ["い", "あ"]);
  assert.equal(ready.A.boardSize, 5, "盤の大きさはホストのもの");
  assert.equal(ready.A.createdAt, 2000, "createdAt はホストの時計");
  assert.deepEqual(ready.A.ratings, [null, null], "持ち点は持たない(数えない)");
  assert.equal(ready.A.hostRuleVersion, 16);
  const rA = await A.readRoom();
  const rB = await B.readRoom();
  assert.deepEqual(rA.data, rB.data, "部屋の写しが同じ");
  assert.equal(rA.data.guestPresent, true);
  assert.deepEqual(rA.data.seats, { host: "uidB", guest: "uidA" });
  // 手番: 両方から交互に積んでも、同じ並びで読める
  await B.pushAct({ type: "START_SETUP", __id: "b-1" });
  await flush();
  await A.pushAct({ type: "SETUP_CONFIRM", __id: "a-1" });
  await flush();
  await B.pushAct({ type: "SETUP_CONFIRM", __id: "b-2" });
  await flush();
  const la = (await A.readActs()).list.map((a) => a.__id);
  const lb = (await B.readActs()).list.map((a) => a.__id);
  assert.deepEqual(la, ["b-1", "a-1", "b-2"]);
  assert.deepEqual(lb, la, "両端末で同じ順");
  assert.equal((await A.readActs()).list[0].by, "uidB", "by は送り主");
  assert.equal((await A.readActs()).list[1].by, "uidA");
  // 再戦: 意思→両方そろう→ホストが手番を片付けて局を進める→両方で読める
  await A.wantRematch(0);
  await B.wantRematch(0);
  await flush();
  assert.deepEqual((await A.readRematch(0)).data, { uidA: true, uidB: true });
  assert.deepEqual((await B.readRematch(0)).data, { uidA: true, uidB: true });
  await B.clearActs();
  await B.bumpRound(1);
  await flush();
  assert.deepEqual((await A.readActs()).list, [], "片付けが相手にも届く");
  assert.equal((await A.readRound()).data, 1);
  assert.equal((await B.readRound()).data, 1);
  // ゲストが席を空ける → ホストから見て相手が出た
  await A.leaveRoom();
  await flush();
  assert.equal((await B.readRoom()).data.seats.guest, undefined);
  // ホストが部屋を消す → ゲストから見て部屋が無い
  await B.deleteRoom();
  await flush();
  assert.equal((await A.readRoom()).data, null);
  // 切断: 手番が読めなくなり、理由が返る
  pa.fire("disconnected", { peerId: "pB" });
  const gone = await A.readActs();
  assert.equal(gone.ok, false);
  assert.match(gone.error, /接続が切れました/);
  assert.equal((await A.pushAct({ type: "MOVE_PIECE", __id: "a-9" })).ok, false);
  await A.stop();
  assert.equal(pa.stopped, 1);
}

// ---- 配線 ----
const fb = fs.readFileSync("src/net/firebase.js", "utf8");
for (const [fn, to] of [["readRoom", "readRoom"], ["updateRoom", "updateRoom"], ["joinRoom", "joinRoom"], ["leaveRoom", "leaveRoom"], ["deleteRoom", "deleteRoom"], ["clearActs", "clearActs"], ["wantRematch", "wantRematch"], ["readRematch", "readRematch"], ["bumpRound", "bumpRound"], ["readRound", "readRound"], ["pushAct", "pushAct"], ["readActs", "readActs"]])
  assert.ok(new RegExp(`isNearbyCode\\(code\\)[^;]*nearby\\(\\)\\.${to}\\(`).test(fb), `firebase.js の ${fn} は NEAR- の合言葉を近くの端末へ振り分ける`);
assert.match(fb, /export async function deleteRoomKeepalive\(code\) \{\s*if \(isNearbyCode\(code\)\) return nearby\(\)\.deleteRoom\(\);/, "画面を閉じるときの片付けも振り分ける");
assert.match(fb, /export async function leaveRoomKeepalive\(code\) \{\s*if \(isNearbyCode\(code\)\) return nearby\(\)\.leaveRoom\(\);/);
const game = fs.readFileSync("src/ui/game.jsx", "utf8");
assert.match(game, /const ranked = \(!!\(network && network\.random\) \|\| !!bot\) && a\.boardSize === 9;/, "近くの端末(とフレンド対戦)は持ち点に数えない。数えるのはランダムマッチだけ");
assert.match(game, /online: !!network && !network\.nearby && !tutorial,/, "オンラインの回数にも数えない");
assert.match(game, /!!network && !!network\.random && boardSize === 9 && !tutorial,/, "持ち点の読み出しはランダムマッチだけ");
assert.match(game, /useSeasonMatch\(a, network, round, !!tutorial \|\| !network\?\.random\)/, "シーズンの記録もランダムマッチだけ");
const screens = fs.readFileSync("src/ui/screens.jsx", "utf8");
assert.match(screens, /generateFriendCode\(\)/, "フレンドの合言葉は6文字");
assert.doesNotMatch(screens, /P\.length < 8|maxLength=\{8\}|8文字の合言葉/, "8文字の名残を残さない");
assert.match(screens, /export function NearbyScreen/);
assert.match(screens, /nearbyAvailable\(\)/, "近くの端末のボタンはプラグインがある端末だけ");
assert.match(screens, /roomFromLocation\(\)/, "起動時の ?room= を読む");
assert.match(screens, /navigator\.share/, "リンクの共有");
assert.match(screens, /navigator\.clipboard/, "コピーと貼り付け");
const plist = fs.readFileSync("ios/App/App/Info.plist", "utf8");
for (const key of ["NSLocalNetworkUsageDescription", "NSBonjourServices", "NSBluetoothAlwaysUsageDescription"])
  assert.ok(plist.includes(key), `Info.plist に ${key}`);
assert.ok(plist.includes("_tottery-near._tcp"), "Bonjour の型名がプラグインと一致");
const swift = fs.readFileSync("plugins/tottery-nearby/ios/Sources/TotteryNearbyPlugin/NearbyPlugin.swift", "utf8");
assert.ok(swift.includes('serviceType = "tottery-near"'));
assert.ok(swift.includes("encryptionPreference: .required"), "通信は暗号化");
assert.ok(swift.includes('@objc(NearbyPlugin)') && swift.includes('jsName = "Nearby"'));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(pkg.dependencies["tottery-nearby"], "file:plugins/tottery-nearby", "プラグインは repo 内の file: 依存");
const cfg = JSON.parse(fs.readFileSync("ios/App/App/capacitor.config.json", "utf8"));
assert.ok(cfg.packageClassList.includes("NearbyPlugin"), "cap sync がプラグインを登録している");
assert.ok(fs.readFileSync("ios/App/CapApp-SPM/Package.swift", "utf8").includes("TotteryNearby"), "SPM にプラグインが入っている");
console.log("近くの端末との対戦: 6文字の合言葉・リンク/貼り付け・部屋と手番の写し・再戦・切断・配線・iOS の宣言: OK");
