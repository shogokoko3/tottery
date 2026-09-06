/**
 * 本物の対局で出る手を、**本番のデータベースへ本当に書いて**、公開中のルールで
 * 全部通るかを確かめる。
 *
 * check-acts-fit は手元の評価器で見るが、評価器は Firebase と食い違うことがある
 * (一度 numChildren() で公開が弾かれた)。ここは Firebase そのものの答えを見る。
 *
 * 通信する。試験用の使い捨てのサインインと部屋だけを使い、終わったら消す。
 * `npm run check` には入れない。ルールを公開したあとに手で動かす:
 *
 *   node tools/replay-live.mjs
 */
import { collectActs } from "./check-acts-fit.mjs";
import { sanitizeLoadout, ALL_SKINS } from "../src/skins/catalog.js";

const KEY = "AIzaSyDcV6cXMZyzOYrhpUO2Pd4wvP9oXe9vTdY";
const DB = "https://tottery-66e0f-default-rtdb.asia-southeast1.firebasedatabase.app";
const CODE = "REPLAY" + Math.random().toString(36).slice(2, 4).toUpperCase();

const anon = async () => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const d = await r.json();
  return { uid: d.localId, tok: d.idToken };
};
const call = async (who, path, method = "GET", body) => {
  const r = await fetch(`${DB}/${path}.json?auth=${who.tok}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, ok: r.ok, data: await r.json().catch(() => null) };
};

// push id の形(20文字、先頭 -)。順番は問わないが、重ならないように番号を埋める
const ALPHA = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const pushId = (n) => {
  let s = "";
  for (let i = 0; i < 19; i++) { s = ALPHA[n % 64] + s; n = Math.floor(n / 64); }
  return "-" + s;
};

let pass = 0; const fail = [];
const want = (label, got, expect = "通る") => {
  const good = expect === "通る" ? got.ok : !got.ok;
  if (good) pass++;
  else fail.push(`${label}  (HTTP ${got.status} ${JSON.stringify(got.data)} — ${expect}はず)`);
  return good;
};

const A = await anon(), B = await anon();
console.log(`ホスト ${A.uid.slice(0, 8)}… / ゲスト ${B.uid.slice(0, 8)}… / 部屋 ${CODE}\n`);

console.log("■ 部屋を整える(アプリと同じ順)");
want("部屋を作る", await call(A, `rooms/${CODE}`, "PUT", { seats: { host: A.uid }, createdAt: Date.now(), guestPresent: false, hostName: "ほ", hostRating: 1500, hostRuleVersion: 3, hostIcon: "", hostTitle: "" }));
want("客が座る", await call(B, `rooms/${CODE}/seats/guest`, "PUT", B.uid));
want("客が名乗る", await call(B, `rooms/${CODE}`, "PATCH", { guestPresent: true, guestName: "き", guestRating: 1500, guestRuleVersion: 3, guestIcon: "", guestTitle: "" }));
// 装備: 実際の形(数字→スキン id)を丸ごと置く
const loadout = Object.fromEntries(ALL_SKINS.slice(0, 13).map((s) => [s.rank, s.id]));
want("ホストが装備を丸ごと置く", await call(A, `rooms/${CODE}/hostSkins`, "PUT", sanitizeLoadout(loadout)));
want("客が装備を1つ置く", await call(B, `rooms/${CODE}/guestSkins/${ALL_SKINS[0].rank}`, "PUT", ALL_SKINS[0].id));
want("装備に無い数字は置けない", await call(B, `rooms/${CODE}/guestSkins/joker`, "PUT", ALL_SKINS[0].id), "弾かれる");

console.log("■ 本物の手を全部書く");
const acts = collectActs();
const seats = [A, B];
const shapes = new Map(); // 形ごとに1つ NG を残す
let n = 0, okActs = 0;
const worker = async (queue) => {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    const { act, seat, i } = item;
    const who = seats[seat];
    const sent = { ...act, by: who.uid, __id: `${who.uid.slice(0, 6)}-${i}` };
    const got = await call(who, `rooms/${CODE}/acts/${pushId(1_000_000 + i)}`, "PUT", sent);
    if (got.ok) okActs++;
    else {
      const key = `${act.type}: ${Object.keys(sent).sort().join(",")}`;
      if (!shapes.has(key)) shapes.set(key, `HTTP ${got.status} ${JSON.stringify(got.data)}`);
    }
  }
};
const queue = acts.map((x, i) => ({ ...x, i }));
await Promise.all(Array.from({ length: 8 }, () => worker(queue)));
console.log(`  ${okActs} / ${acts.length} 件が通った`);
for (const [k, v] of shapes) fail.push(`手が弾かれた ${k}  (${v})`);
pass += okActs;

console.log("■ 再戦と片付け");
want("再戦の意思(ホスト)", await call(A, `rooms/${CODE}/rematch/r0/${A.uid}`, "PUT", true));
want("再戦の意思(客)", await call(B, `rooms/${CODE}/rematch/r0/${B.uid}`, "PUT", true));
want("手番の列を片付ける", await call(A, `rooms/${CODE}/acts`, "DELETE"));
want("局を進める", await call(A, `rooms/${CODE}/round`, "PUT", 1));
want("客が席を立つ", await call(B, `rooms/${CODE}/seats/guest`, "DELETE"));
want("ホストが部屋を消す", await call(A, `rooms/${CODE}`, "DELETE"));

console.log(`\n${pass} ok / ${fail.length} NG`);
for (const f of fail) console.log(`  NG   ${f}`);
process.exit(fail.length ? 1 : 0);
