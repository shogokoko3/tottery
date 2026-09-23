/**
 * Bot(ランダムマッチの練習相手)との対局を月間シーズンに数える(2026-09-23 本人の指示)。
 *
 * 持ち点 1750 未満は人と組まず Bot と当たるので、これが無いと始めたばかりの人がランキングに載れない。
 * Bot の対局は部屋(Firebase)が無く手順を確かめられないので、次で歯止めをかける:
 *   - 相手の点は端末の言い値を読まず、本人のサーバー上の点と同じとみなす(同格 = ±16)
 *   - 本人の点が 1750 以上なら数えない(人と組む段階。Bot で稼げない)
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

// 1750 以上は数えない(人と組む段階)
sql("INSERT OR REPLACE INTO elo_ratings VALUES ('2026-09', ?, ?)", me, BOT_UNTIL_RATING);
r = ledger.recordBot(me, { id: "m11", winner: 0, name: "たろう", icon: "spade" }, now + 11, BOT_UNTIL_RATING);
assert.equal(r.recorded, false);
assert.equal(r.reason, "human-stage");
assert.equal(ledger.list("2026-09").find((p) => p.uid === me).rated, 10, "1750 以上では増えない");

// 人との対局の記録は変わらない(Bot の記録と混ざらない)
assert.equal(sql("SELECT COUNT(*) AS n FROM matches WHERE guest='bot'")[0].n, 10);
assert.equal(sql("SELECT COUNT(*) AS n FROM matches WHERE host=? AND guest='bot' AND id LIKE 'bot:player-a:%'", me)[0].n, 10, "id は本人の uid を含む(他人の局と衝突しない)");

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
  assert.ok(/const r = seasonResult\.serverRating;/.test(game) && /delta: r - prev\.before/.test(game), "対局後の表示もサーバーの値に合わせる");
}

// 配線
const worker = readFileSync(new URL("../src/server/worker.js", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/if \(op === "finish" && body\.bot === true\)/.test(worker), "finish に Bot の枝がある");
assert.ok(/!\[0, 1, null\]\.includes\(body\.winner\)/.test(worker), "勝者は 0・1・null だけ");
assert.ok(/l\.recordBot\(uid, args, now, BOT_UNTIL_RATING\)/.test(worker), "台帳は 1750 の線を守る");
assert.ok(!/body\.rating|args\.rating|body\.foeRating/.test(worker), "端末の言い値の点は読まない");
const season = readFileSync(new URL("../src/ui/season.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/id: bot\.matchId \|\| `\$\{bot\.id\}:\$\{round\}`/.test(season), "Bot 戦は matchId を送る");
assert.ok(/const eligible = \(!!network \|\| !!bot\) && state\.boardSize === 9 && !disabled;/.test(season), "9×9 の Bot 戦だけ");

console.log("Bot 戦をシーズンに数える: 同格の ±16・重複なし・1戦から順位・1750 以上は数えない・配線 OK");
