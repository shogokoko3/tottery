/**
 * フェーズ別オンライン(ストーリーとフェーズ.md)で足したルールの項目を、**本番のデータベースで**試す。
 *
 * tools/replay-live.mjs と同じく、使い捨てのサインインと部屋だけを使い、終わったら消す。
 * `npm run check` には入れない。ルールを公開したあとに手で動かす:
 *
 *   node tools/probe-phase-live.mjs
 *
 * 見るもの:
 *   - フェーズ1の部屋(phase:1)を作れる。掲示は phase+size で出せ、matchSize では出せない
 *   - 席についたゲストは guestPhase(部屋と同じ)を書ける。違う値・ホスト・部外者は書けない
 *   - 開始の合図に kingPowers:false を載せられる(真偽以外は弾かれる)
 *   - 作った後に phase は書き換えられない
 *   - phase の無い部屋(今までどおり)は今までどおり。guestPhase は 3 だけ
 */
const KEY = "AIzaSyDcV6cXMZyzOYrhpUO2Pd4wvP9oXe9vTdY";
const DB = "https://tottery-66e0f-default-rtdb.asia-southeast1.firebasedatabase.app";
const tag = Math.random().toString(36).slice(2, 4).toUpperCase();
const P1 = "PHASE1" + tag, P2 = "PHASE2" + tag, P3 = "PHASE3" + tag, P2S = "PHASE2S" + tag, P1L = "PHASE1L" + tag;
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
let pass = 0; const fail = [];
const want = (label, got, expect = "通る") => {
  const good = expect === "通る" ? got.ok : !got.ok;
  if (good) { pass++; console.log(`  ok   ${label}`); }
  else { fail.push(label); console.log(`  NG   ${label}  (HTTP ${got.status} ${JSON.stringify(got.data)} — ${expect}はず)`); }
  return good;
};
const A = await anon(), B = await anon(), X = await anon();
console.log(`ホスト ${A.uid.slice(0, 8)}… / ゲスト ${B.uid.slice(0, 8)}… / 部外者 ${X.uid.slice(0, 8)}… / 部屋 ${P1} ${P3}\n`);
const room = (extra) => ({ seats: { host: A.uid }, createdAt: Date.now(), guestPresent: false, hostName: "ほ", hostRating: 1500, hostRuleVersion: 18, hostIcon: "", hostTitle: "", matchSize: 5, ...extra });
const act = (extra) => ({ type: "START_SETUP", by: A.uid, __id: `${A.uid.slice(0, 6)}-1`, size: 5, ruleVersion: 18, ...extra });
const pushId = (n) => "-Nprobe" + String(n).padStart(13, "0");

try {
  console.log("■ フェーズ1の部屋");
  want("部屋を作れる(phase:1)", await call(A, `rooms/${P1}`, "PUT", room({ phase: 1 })));
  want("掲示は phase+size で出せる", await call(A, `lobby/${P1}`, "PUT", { host: A.uid, createdAt: Date.now(), phase: 1, size: 5 }));
  want("掲示を下ろす", await call(A, `lobby/${P1}`, "DELETE"));
  want("phase の部屋に matchSize の掲示は出せない(旧端末を釣れない)", await call(A, `lobby/${P1}`, "PUT", { host: A.uid, createdAt: Date.now(), matchSize: 5 }), "弾かれる");
  want("部屋と違う phase の掲示は出せない", await call(A, `lobby/${P1}`, "PUT", { host: A.uid, createdAt: Date.now(), phase: 2, size: 5 }), "弾かれる");
  want("掲示(phase+size)を出し直す", await call(A, `lobby/${P1}`, "PUT", { host: A.uid, createdAt: Date.now(), phase: 1, size: 5 }));
  want("客が掲示に名乗る", await call(B, `lobby/${P1}/guest`, "PUT", B.uid));
  want("客が座る", await call(B, `rooms/${P1}/seats/guest`, "PUT", B.uid));
  want("客が名乗る(guestPhase:1 を含めて)", await call(B, `rooms/${P1}`, "PATCH", { guestPresent: true, guestName: "き", guestRating: 1500, guestRuleVersion: 18, guestIcon: "", guestTitle: "", guestMatchSize: 5, guestPhase: 1 }));
  want("客は違う guestPhase を書けない", await call(B, `rooms/${P1}/guestPhase`, "PUT", 2), "弾かれる");
  want("ホストは guestPhase を書けない", await call(A, `rooms/${P1}/guestPhase`, "PUT", 1), "弾かれる");
  want("部外者は guestPhase を書けない", await call(X, `rooms/${P1}/guestPhase`, "PUT", 1), "弾かれる");
  want("作った後に phase は書き換えられない", await call(A, `rooms/${P1}`, "PATCH", { phase: 2 }), "弾かれる");
  want("開始の合図に kingPowers:false を載せられる", await call(A, `rooms/${P1}/acts/${pushId(1)}`, "PUT", act({ kingPowers: false })));
  want("kingPowers は真偽だけ", await call(A, `rooms/${P1}/acts/${pushId(2)}`, "PUT", act({ __id: `${A.uid.slice(0, 6)}-2`, kingPowers: "no" })), "弾かれる");
  want("kingPowers の下に子は書けない", await call(A, `rooms/${P1}/acts/${pushId(3)}`, "PUT", act({ __id: `${A.uid.slice(0, 6)}-3`, kingPowers: { x: true } })), "弾かれる");

  console.log("■ フェーズ2の部屋(9×9。2026-09-30)");
  want("部屋を作れる(phase:2・9×9)", await call(A, `rooms/${P2}`, "PUT", room({ phase: 2, matchSize: 9 })));
  want("掲示は phase:2 + size:9 で出せる", await call(A, `lobby/${P2}`, "PUT", { host: A.uid, createdAt: Date.now(), phase: 2, size: 9 }));
  want("掲示を下ろす", await call(A, `lobby/${P2}`, "DELETE"));
  // 部屋の matchSize と同じ盤でも、フェーズの盤でなければ弾く(フェーズの縛りそのものを見る)
  want("部屋を作れる(phase:2・5×5。部屋の盤は縛らない)", await call(A, `rooms/${P2S}`, "PUT", room({ phase: 2, matchSize: 5 })));
  want("フェーズ2の掲示に 5×5 は出せない(部屋も 5×5 でも)", await call(A, `lobby/${P2S}`, "PUT", { host: A.uid, createdAt: Date.now(), phase: 2, size: 5 }), "弾かれる");
  want("部屋を作れる(phase:1・9×9)", await call(A, `rooms/${P1L}`, "PUT", room({ phase: 1, matchSize: 9 })));
  want("フェーズ1の掲示に 9×9 は出せない(部屋も 9×9 でも)", await call(A, `lobby/${P1L}`, "PUT", { host: A.uid, createdAt: Date.now(), phase: 1, size: 9 }), "弾かれる");

  console.log("■ phase の無い部屋(今までどおり)");
  want("部屋を作れる(phase なし)", await call(A, `rooms/${P3}`, "PUT", room({})));
  want("掲示は今までどおり matchSize で出せる", await call(A, `lobby/${P3}`, "PUT", { host: A.uid, createdAt: Date.now(), matchSize: 5 }));
  want("掲示を下ろす", await call(A, `lobby/${P3}`, "DELETE"));
  want("phase の無い部屋に phase の掲示は出せない", await call(A, `lobby/${P3}`, "PUT", { host: A.uid, createdAt: Date.now(), phase: 1, size: 5 }), "弾かれる");
  want("客が座る", await call(B, `rooms/${P3}/seats/guest`, "PUT", B.uid));
  want("旧端末の形の名乗り(guestPhase なし)は通る", await call(B, `rooms/${P3}`, "PATCH", { guestPresent: true, guestName: "き", guestRating: 1500, guestRuleVersion: 18, guestIcon: "", guestTitle: "", guestMatchSize: 5 }));
  want("phase の無い部屋の guestPhase は 3 だけ(3 は通る)", await call(B, `rooms/${P3}/guestPhase`, "PUT", 3));
  want("phase の無い部屋に guestPhase:1 は書けない", await call(B, `rooms/${P3}/guestPhase`, "PUT", 1), "弾かれる");
  want("後から phase は足せない", await call(A, `rooms/${P3}`, "PATCH", { phase: 1 }), "弾かれる");
  want("今までどおりの開始の合図は通る", await call(A, `rooms/${P3}/acts/${pushId(4)}`, "PUT", act({ __id: `${A.uid.slice(0, 6)}-4` })));
} finally {
  console.log("■ 片付け");
  for (const code of [P1, P2, P3, P2S, P1L]) {
    await call(A, `lobby/${code}`, "DELETE");
    await call(A, `rooms/${code}/acts`, "DELETE");
    await call(B, `rooms/${code}/seats/guest`, "DELETE");
    want(`ホストが部屋 ${code} を消す`, await call(A, `rooms/${code}`, "DELETE"));
  }
  for (const who of [A, B, X]) {
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: who.tok }),
    }).catch(() => {});
  }
  console.log("  使い捨ての口座を消した");
}
console.log(`\n${pass} ok / ${fail.length} NG`);
process.exit(fail.length ? 1 : 0);
