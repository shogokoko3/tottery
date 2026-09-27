/**
 * Bot(ランダムマッチの練習相手)との対局を月間シーズンに数える(2026-09-23 本人の指示)。
 *
 * 持ち点 2000 未満は人と組まず Bot と当たるので、これが無いと始めたばかりの人がランキングに載れない。
 * Bot の対局は部屋(Firebase)が無く手順を確かめられないので、次で歯止めをかける:
 *   - 相手の点は端末の言い値を読まず、本人のサーバー上の点と同じとみなす(同格 = ±16)
 *   - 本人の点が 2000 以上なら数えない(人と組む段階。Bot で稼げない)
 *   - 同じ id は二度数えない
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { Ledger } from "../src/server/ledger.js";
import { BOT_UNTIL_RATING, makeBot } from "../src/game/bot-match.js";
import { START_RATING, ELO_K } from "../src/game/rating.js";
import { seasonMatchKey } from "../src/net/season.js";

const db = new DatabaseSync(":memory:");
const sql = (q, ...args) => db.prepare(q).all(...args);
const ledger = new Ledger(sql);
const now = Date.parse("2026-09-23T03:00:00Z");
const me = "player-a";

// 勝つと +16、負けると -16(同格)。名前とアイコンは台帳に載る
let r = ledger.recordBot(me, { id: "m1", winner: 0, name: "たろう", icon: "spade" }, now);
assert.equal(r.recorded, true);
assert.equal(r.rating, START_RATING + ELO_K / 2, "同格に勝って +16");
r = ledger.recordBot(me, { id: "m2", winner: 1, name: "たろう", icon: "spade" }, now + 1);
assert.equal(r.rating, START_RATING, "同格に負けて -16");
r = ledger.recordBot(me, { id: "m3", winner: null, name: "たろう", icon: "spade" }, now + 2);
assert.equal(r.rating, START_RATING, "引き分けは動かない");
const row = ledger.list("2026-09").find((p) => p.uid === me);
assert.equal(row.rated, 3);
assert.equal(row.wins, 1);
assert.equal(row.draws, 1);
assert.equal(row.name, "たろう");
assert.equal(row.place, 1, "1戦から順位に載る(2026-09-23 本人の指示。以前は10戦)");
assert.equal(ledger.summary(me, now + 3).list[0]?.uid, me, "1戦でランキングに出る");

// 同じ id は二度数えない
r = ledger.recordBot(me, { id: "m1", winner: 0, name: "たろう", icon: "spade" }, now + 3);
assert.equal(r.recorded, false);
assert.equal(ledger.list("2026-09").find((p) => p.uid === me).rated, 3, "二度目は数えない");

// 10戦まで積んでも同じ
for (let i = 4; i <= 10; i++)
  ledger.recordBot(me, { id: `m${i}`, winner: 0, name: "たろう", icon: "spade" }, now + i);
const listed = ledger.list("2026-09").find((p) => p.uid === me);
assert.equal(listed.rated, 10);
assert.equal(listed.place, 1, "10戦でも順位が付く");
assert.equal(ledger.summary(me, now + 20).list[0].uid, me, "ランキングに出る");

// 2026-09-28: 持ち点の上限では断らない(本人の指示「2000 を超えた人でも Bot と組む」「いつでも数える」)
sql("INSERT OR REPLACE INTO elo_ratings VALUES ('2026-09', ?, ?)", me, 2600);
r = ledger.recordBot(me, { id: "m11", winner: 0, name: "たろう", icon: "spade" }, now + 11);
assert.equal(r.recorded, true, "2000 以上でも数える");
assert.equal(ledger.list("2026-09").find((p) => p.uid === me).rated, 11, "2000 以上でも増える");
// until を渡せば今まで通り断れる(必要になったときの逃げ道を残してある)
r = ledger.recordBot(me, { id: "m12", winner: 0, name: "たろう", icon: "spade" }, now + 12, BOT_UNTIL_RATING);
assert.equal(r.recorded, false);
assert.equal(r.reason, "human-stage");

// 人との対局の記録は変わらない(Bot の記録と混ざらない)
assert.equal(sql("SELECT COUNT(*) AS n FROM matches WHERE guest='bot'")[0].n, 11);
assert.equal(sql("SELECT COUNT(*) AS n FROM matches WHERE host=? AND guest='bot' AND id LIKE 'bot:player-a:%'", me)[0].n, 11, "id は本人の uid を含む(他人の局と衝突しない)");

// makeBot は局ごとに違う matchId を持つ(同じ局を二度数えない鍵)
const b1 = makeBot(1500, null, () => 0.5), b2 = makeBot(1500, null, () => 0.25);
assert.ok(b1.matchId && b2.matchId && b1.matchId !== b2.matchId, "局ごとの目印");

// 端末の送り待ちの鍵。人との対局と Bot の対局を見分ける
assert.equal(seasonMatchKey({ bot: true, id: "x", uid: "u" }), "bot:u:x");
assert.equal(seasonMatchKey({ code: "ABCD", createdAt: 1, round: 0, uid: "u" }), "ABCD:1:0:u");

// 月をまたいでも持ち点は続く(2026-09-23 本人の指示「レーティングと持ち点は同じもの」。以前は毎月 1500 から)
{
  const db3 = new DatabaseSync(":memory:");
  const sql3 = (q, ...args) => db3.prepare(q).all(...args);
  const l3 = new Ledger(sql3);
  const sep = Date.parse("2026-09-20T03:00:00Z"), oct = Date.parse("2026-10-05T03:00:00Z");
  for (let i = 0; i < 3; i++) l3.recordBot("u", { id: `s${i}`, winner: 0, name: "う", icon: null }, sep + i);
  const endSep = l3.list("2026-09").find((p) => p.uid === "u").rating;
  assert.ok(endSep > START_RATING, "9月に勝って上がった");
  const r = l3.recordBot("u", { id: "o1", winner: 1, name: "う", icon: null }, oct);
  assert.equal(r.rating, endSep - ELO_K / 2, "10月の1戦目は9月の最後の持ち点から始まる(1500 に戻らない)");
  const octRow = l3.list("2026-10").find((p) => p.uid === "u");
  assert.equal(octRow.rated, 1, "月の対局数は数え直す");
  assert.equal(octRow.wins, 0);
  assert.equal(l3.playerRow("newcomer", "2026-10").rating, START_RATING, "はじめての人は 1500");
  // 人との対局でも同じ
  const m = { id: "h1", host: "u", guest: "v", winner: 1, names: ["う", "ぶ"], icons: [null, null] };
  l3.record(m, oct + 10);
  assert.equal(l3.list("2026-10").find((p) => p.uid === "v").rating, START_RATING + Math.round(ELO_K * (1 - 1 / (1 + 10 ** ((endSep - ELO_K / 2 - START_RATING) / 400)))), "相手(新規)は 1500 から、こちらは引き継いだ点から計算");
}

// 端末はサーバーの持ち点に合わせる
{
  const profile = readFileSync(new URL("../src/game/profile.js", import.meta.url), "utf8");
  assert.ok(/export function adoptServerRating\(rating\)/.test(profile), "adoptServerRating がある");
  const season = readFileSync(new URL("../src/ui/season.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
  assert.ok(/const result = await finishSeasonMatch\(match\);/.test(season) && /adoptServerRating\(r\)/.test(season), "対局後にサーバーの持ち点を端末へ写す");
  assert.ok(/if \(Number\.isFinite\(next\?\.player\?\.rating\)\)/.test(season) && /adoptServerRating\(next\.player\.rating\)/.test(season), "ランキングを開いたときにも写す");
  assert.ok(/publishPlayer\(after\)/.test(season), "変わったら通算(ranks)にも置き直す");
  const game = readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
  assert.ok(/const r = seasonResult\.serverRating;/.test(game) && /delta: prev\.delta \+ diff/.test(game), "対局後の表示もサーバーの値に合わせる");
}

// 配線
const worker = readFileSync(new URL("../src/server/worker.js", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/if \(op === "finish" && body\.bot === true\)/.test(worker), "finish に Bot の枝がある");
assert.ok(/!\[0, 1, null\]\.includes\(body\.winner\)/.test(worker), "勝者は 0・1・null だけ");
assert.ok(/l\.recordBot\(uid, args, now\)/.test(worker), "上限は渡さない(2026-09-28 から持ち点に関わらず数える)");
assert.ok(!/body\.rating|args\.rating/.test(worker), "自分の点は端末から読まない");
// 2026-09-28: Bot の点だけは受け取る。ただし**台帳が丸めてから**式に入れる
assert.ok(/foeRating/.test(worker), "Bot の点は受け取る");
const ledgerSrc = readFileSync(new URL("../src/server/ledger.js", import.meta.url), "utf8");
assert.ok(/clampBotRating\(foeRating, p\.rating\)/.test(ledgerSrc), "言い値は丸めてから式に入れる");
assert.ok(/nextRating\(p\.rating, foe, won\)/.test(ledgerSrc), "丸めた点で計算する");
const seasonUi = readFileSync(new URL("../src/ui/season.jsx", import.meta.url), "utf8");
assert.ok(/foeRating: bot\.rating/.test(seasonUi), "端末は Bot の点を送る");
const season = readFileSync(new URL("../src/ui/season.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/id: bot\.matchId \|\| `\$\{bot\.id\}:\$\{round\}`/.test(season), "Bot 戦は matchId を送る");
assert.ok(/const eligible = \(!!network \|\| !!bot\) && state\.boardSize === 9 && !disabled;/.test(season), "9×9 の Bot 戦だけ");

// Bot の点を踏まえて計算されるか(丸めも含めて)
{
  const db4 = new DatabaseSync(":memory:");
  const sql4 = (q, ...args) => db4.prepare(q).all(...args);
  const l4 = new Ledger(sql4);
  const t = Date.parse("2026-09-20T03:00:00Z");
  const u = "player-r";
  // 1500 の人が 1580 の Bot に勝つ → 同格(1500)より多く増える
  l4.recordBot(u, { id: "a1", winner: 0, name: "ぼ", icon: null, foeRating: 1580 }, t);
  const strong = l4.list("2026-09").find((r) => r.uid === u).rating;
  const db5 = new DatabaseSync(":memory:");
  const l5 = new Ledger((q, ...args) => db5.prepare(q).all(...args));
  l5.recordBot(u, { id: "a1", winner: 0, name: "ぼ", icon: null, foeRating: 1420 }, t);
  const weak = l5.list("2026-09").find((r) => r.uid === u).rating;
  assert.ok(strong > weak, `強い Bot に勝つほうが増える(${strong} > ${weak})`);
  // 言い値が大きすぎても丸められる。3000 と名乗っても 1580(=1500+80)止まり
  const db6 = new DatabaseSync(":memory:");
  const l6 = new Ledger((q, ...args) => db6.prepare(q).all(...args));
  l6.recordBot(u, { id: "a1", winner: 0, name: "ぼ", icon: null, foeRating: 3000 }, t);
  const lied = l6.list("2026-09").find((r) => r.uid === u).rating;
  assert.equal(lied, strong, "3000 と名乗っても 1580 と同じ扱い(丸められる)");
  // 送って来なければ同格
  const db7 = new DatabaseSync(":memory:");
  const l7 = new Ledger((q, ...args) => db7.prepare(q).all(...args));
  l7.recordBot(u, { id: "a1", winner: 0, name: "ぼ", icon: null }, t);
  const even = l7.list("2026-09").find((r) => r.uid === u).rating;
  assert.ok(even < strong && even > weak, `無指定は同格(${even})`);
}

console.log("Bot 戦をシーズンに数える: Bot の点を踏まえた計算(丸めあり)・重複なし・1戦から順位・持ち点の上限なし・配線 OK");
