/**
 * フレンドとプロフィール(サーバー側 src/server/friends.js)。2026-09-23 本人の指示。
 *
 * - フレンド ID(8文字)で申請 → 承認で双方向。互いに申請していればその場で結ぶ。50人まで
 * - 贈り物は 1日にフレンド1人あたり1枚(日本時間・最大50人ぶん)・フレンドだけ。受け取るまで残り、受け取ると印が付く(財布への加算は DO 側)
 * - 招待は 3 分で古くなる。フレンドだけ
 * - プロフィールの写しは桁と長さを見張る。アピールは決まった id から 3 つまで
 * - 記録を消すと全部消える
 * 通信はしない。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  Friends,
  FRIEND_MAX,
  FRIEND_CODE_LEN,
  INVITE_TTL_MS,
  PRESENCE_TTL_MS,
  ONLINE_TTL_MS,
  SHOWCASE_IDS,
  SHOWCASE_MAX,
  jstDay,
  sanitizeProfileCard,
} from "../src/server/friends.js";
import { Wallet } from "../src/server/wallet.js";

const db = new DatabaseSync(":memory:");
const sql = (q, ...a) => db.prepare(q).all(...a);
// 乱数は決まった列にして、衝突の作り直しも見る
let seq = 0;
const rnd = () => ((seq++ * 7919) % 1000) / 1000;
const f = new Friends(sql, rnd);
const T0 = Date.parse("2026-09-23T03:00:00Z"); // JST 12:00

// 日付は日本時間
assert.equal(jstDay(Date.parse("2026-09-23T14:59:00Z")), "2026-09-23", "JST 23:59 はまだ 23 日");
assert.equal(jstDay(Date.parse("2026-09-23T15:00:00Z")), "2026-09-24", "JST 0:00 で 24 日");

// フレンド ID は uid ごとに1つ。読み違えやすい字は寄せる
const codeA = f.codeOf("A", T0);
assert.equal(codeA.length, FRIEND_CODE_LEN);
assert.equal(f.codeOf("A", T0 + 1), codeA, "二度目も同じ");
assert.doesNotMatch(codeA, /[01IL]/, "0・1・I・L は使わない");
assert.equal(f.uidOfCode(codeA.toLowerCase()), "A", "小文字でも通る");
assert.equal(f.uidOfCode(codeA.slice(0, 3) + "-" + codeA.slice(3)), "A", "区切りを挟んでも通る");
assert.equal(f.uidOfCode("ZZZZZZZZ"), null);
const codeB = f.codeOf("B", T0);
assert.notEqual(codeA, codeB);

// 申請 → 承認
assert.throws(() => f.request("A", codeA, T0), /自分の/);
assert.throws(() => f.request("A", "NOPE", T0), /見つかりません/);
let r = f.request("A", codeB, T0);
assert.deepEqual(r, { ok: true, friend: false, uid: "B" });
let s = f.state("B", T0 + 1);
assert.equal(s.requestsIn.length, 1);
assert.equal(s.requestsIn[0].uid, "A");
assert.equal(f.state("A", T0 + 1).requestsOut[0].uid, "B");
assert.throws(() => f.accept("B", "C", T0), /もうありません/);
f.accept("B", "A", T0 + 2);
assert.ok(f.isFriend("A", "B") && f.isFriend("B", "A"), "双方向");
assert.equal(f.state("A", T0 + 3).friends[0].uid, "B");
assert.equal(f.state("B", T0 + 3).requestsIn.length, 0, "申請は消える");
assert.deepEqual(f.request("A", codeB, T0), { ok: true, friend: true, uid: "B" }, "もうフレンドなら何もしない");

// 互いに申請していればその場で結ぶ。断る・取り消す
const codeC = f.codeOf("C", T0);
f.request("A", codeC, T0);
r = f.request("C", codeA, T0 + 1);
assert.equal(r.friend, true, "互いの申請でその場で結ぶ");
assert.ok(f.isFriend("A", "C"));
const codeD = f.codeOf("D", T0);
f.request("D", codeA, T0);
f.decline("A", "D");
assert.equal(f.state("A", T0).requestsIn.length, 0);
f.request("A", codeD, T0);
f.cancel("A", "D");
assert.equal(f.state("D", T0).requestsIn.length, 0, "取り消せる");

// 入口ごとの受付(2026-09-24 本人の指示)。切った入口からは「いっぱい」の文で断る(断っていることを伝えない)
{
  f.setProfile("B", { name: "びー", accept: { code: true, match: false, rank: true } }, T0);
  assert.throws(() => f.requestUid("D", "B", T0, "match"), /相手のフレンドがいっぱいです/, "対戦相手からは受けない設定");
  assert.equal(f.state("B", T0).requestsIn.length, 0, "申請は残らない");
  assert.equal(f.requestUid("D", "B", T0, "rank").friend, false, "ランキングからは受ける");
  f.decline("B", "D");
  assert.throws(() => f.requestUid("D", "B", T0, "nope"), /入口/);
  assert.throws(() => f.requestUid("D", "D", T0, "rank"), /自分/);
  assert.equal(f.acceptsFrom("nobody", "match"), true, "写しを送っていない人は全部受ける");
  f.setProfile("B", { name: "びー" }, T0);
  assert.deepEqual(f.profileOf("B").accept, { code: true, match: true, rank: true }, "無ければ全部受ける");
  assert.equal(f.state("B", T0).requestsIn.length, 0);
}

// 外す
f.remove("A", "C");
assert.ok(!f.isFriend("A", "C") && !f.isFriend("C", "A"));

// 50人まで(申請する側・される側の両方)
for (let i = 0; i < FRIEND_MAX - 1; i++) f.link("A", `x${i}`, T0);
assert.equal(f.count("A"), FRIEND_MAX);
assert.throws(() => f.request("A", codeD, T0), /50人まで/);
assert.throws(() => f.request("D", codeA, T0), /いっぱい/);
f.request("D", codeC, T0);
f.link("C", "A", T0); // C は A と結び直す(A は 51 人目になるが link は数えない。承認の側で見る)
assert.equal(f.count("A"), FRIEND_MAX + 1);
f.remove("A", "C");

// 贈り物: 1日にフレンド1人あたり1枚(最大でフレンドの数=50人)、フレンドだけ、受け取るまで残る
assert.throws(() => f.gift("A", "D", T0), /フレンドにだけ/); // D はフレンドでない
r = f.gift("A", "B", T0);
assert.equal(r.day, "2026-09-23");
assert.equal(r.to, "B");
assert.throws(() => f.gift("A", "B", T0 + 1000), /今日もう贈りました/, "同じ相手には1日1枚まで");
// 別のフレンドには、同じ日でも贈れる(1日にフレンド1人1枚・最大50人ぶん)
r = f.gift("A", "x0", T0 + 1000);
assert.equal(r.day, "2026-09-23", "別のフレンドには同じ日でも贈れる");
assert.deepEqual([...f.state("A", T0).giftedTo].sort(), ["B", "x0"], "今日贈った相手が一覧で並ぶ");
s = f.state("B", T0 + 1);
assert.equal(s.gifts.length, 1);
assert.equal(s.gifts[0].id, "gift:A:B:2026-09-23");
assert.equal(s.gifts[0].from.uid, "A");
const next = Date.parse("2026-09-23T15:00:00Z"); // JST 翌日 0:00
r = f.gift("A", "B", next);
assert.equal(r.day, "2026-09-24", "翌日はまた贈れる");
const claimed = f.claimGifts("B", next + 1);
assert.equal(claimed.length, 2);
assert.equal(f.state("B", next + 2).gifts.length, 0, "受け取ると消える");
assert.equal(f.claimGifts("B", next + 3).length, 0, "二度は無い");

// 財布に足すのは id ごとに1枚(DO が claimGifts の結果で credit する想定)
const w = new Wallet(sql);
for (const g of claimed) w.credit("B", g.id, 1, "friend-gift", next);
assert.equal(w.summary("B").tickets, 2);
for (const g of claimed) w.credit("B", g.id, 1, "friend-gift", next);
assert.equal(w.summary("B").tickets, 2, "同じ id は二度効かない");

// まとめて贈る(2026-09-25 本人の指示): まだ今日贈っていない相手だけに、一度に
const gifted0 = new Set(f.state("A", T0).giftedTo); // 今日は B と x0 に贈り済み
const all = f.giftAll("A", T0);
assert.equal(all.sent.length, f.count("A") - gifted0.size, "今日まだ贈っていない全員に贈る");
assert.ok(!all.sent.includes("B") && !all.sent.includes("x0"), "既に贈った相手には二重に贈らない");
assert.equal(new Set(f.state("A", T0).giftedTo).size, f.count("A"), "贈ったあとは今日の相手が全員");
assert.equal(f.giftAll("A", T0).sent.length, 0, "もう全員に贈ったので0人");

// 招待: フレンドだけ、3分で古くなる
assert.throws(() => f.invite("A", "D", "ABCDEF", T0), /フレンドにだけ/);
assert.throws(() => f.invite("A", "B", "ab", T0), /合言葉/);
f.invite("A", "B", "ABCDEF", T0);
s = f.state("B", T0 + 1000);
assert.equal(s.invites.length, 1);
assert.equal(s.invites[0].code, "ABCDEF");
assert.equal(s.invites[0].from.uid, "A");
assert.equal(f.state("B", T0 + INVITE_TTL_MS + 1).invites.length, 0, "3分で消える");
f.invite("A", "B", "ABCDEF", T0);
f.cancelInvite("A", "B");
assert.equal(f.state("B", T0 + 1).invites.length, 0);

// プロフィールの写し
const card = sanitizeProfileCard({
  name: "とても長い名前を付けた人",
  icon: "spade",
  title: "rank-sho",
  pinnedTitle: "fortress",
  bg: "sea",
  level: 250,
  showcase: ["rating", "rating", "nope", "wins", "titles", "level"],
  stats: { battles: 12, wins: 7, draws: -3, titles: "9", rated: 1e12 },
});
assert.equal(card.name, "とても長い名前を付けた人".slice(0, 10));
assert.equal(card.level, 100, "レベルは 100 まで");
assert.deepEqual(card.showcase, ["rating", "wins", "titles"], `知らない id は捨て、重複を除き ${SHOWCASE_MAX} つまで`);
assert.equal(card.stats.draws, 0, "負の数は 0");
assert.equal(card.stats.titles, 9);
assert.equal(card.stats.rated, 1e9, "桁は見張る");
assert.ok(SHOWCASE_IDS.includes("bestPlace"));
f.setProfile("A", { name: "えー", icon: "spade", title: "novice", level: 3, showcase: ["wins"], stats: { wins: 1 } }, T0);
const pa = f.profileOf("A");
assert.equal(pa.name, "えー");
assert.equal(pa.showcase[0], "wins");
assert.equal(f.state("B", T0).friends[0].name, "えー", "一覧の名札にも出る");
assert.equal(f.profileOf("nobody"), null);
assert.equal(f.tag("nobody").name, "", "写しの無い人は名前が空");
assert.equal(f.state("B", T0).friends[0].seen, T0, "最後に開いた時刻");

// 記録を消す
f.forget("A");
assert.equal(f.count("A"), 0);
assert.ok(!f.isFriend("B", "A"), "相手の側からも外れる");
assert.equal(f.state("B", T0).gifts.length, 0);
assert.equal(f.profileOf("A"), null);
assert.notEqual(f.codeOf("A", T0), codeA, "ID も作り直し");

// 在席(対戦中)と観戦(2026-09-24)。フレンドだけが「対戦中」と観戦できる部屋を知る
f.link("P1", "P2", T0);
assert.equal(f.presenceOf("P1", T0), null, "対戦していなければ在席は無い");
f.enterRoom("P1", "WATCH1", false, "相手のなまえ", T0);
const p2sees = f.state("P2", T0).friends.find((x) => x.uid === "P1");
assert.deepEqual(p2sees.match, { code: "WATCH1", online: false, opp: "相手のなまえ" }, "フレンドの一覧に対戦中の部屋が出る");
f.enterRoom("P1", "RANDOM99", true, "対戦相手のとても長い名前だよ", T0 + 1000);
const p2b = f.state("P2", T0 + 1000).friends.find((x) => x.uid === "P1");
assert.equal(p2b.match.code, "RANDOM99", "新しい部屋で上書き");
assert.equal(p2b.match.online, true, "ランダムマッチの印");
assert.ok(p2b.match.opp.length <= 10, "相手の名前は10文字まで");
// 期限切れ
assert.equal(f.presenceOf("P1", T0 + 1000 + PRESENCE_TTL_MS + 1), null, "古い在席は消える");
// 合言葉の形は見張る
assert.throws(() => f.enterRoom("P1", "no spaces!", false, "", T0), /合言葉/, "変な合言葉は断る");
// 締める・記録を消す
f.leaveRoom("P1");
assert.equal(f.presenceOf("P1", T0), null, "離れたら在席は消える");
f.enterRoom("P2", "ROOM77", false, "x", T0);
f.forget("P2");
assert.equal(f.presenceOf("P2", T0), null, "記録を消すと在席も消える");

// オンライン/オフライン表示(2026-09-25 本人の指示。前は「◯時間前」)
f.link("O1", "O2", T0);
assert.equal(f.state("O2", T0).friends.find((x) => x.uid === "O1").online, false, "何もしていなければオフライン");
f.seenNow("O1", T0);
assert.equal(f.isOnline("O1", T0), true, "seen を打つとオンライン");
assert.equal(f.state("O2", T0).friends.find((x) => x.uid === "O1").online, true, "一覧にもオンラインが出る");
assert.equal(f.isOnline("O1", T0 + ONLINE_TTL_MS + 1), false, "時間が経つとオフライン");
// 写しがまだ無い人でも seenNow は行を作る(profileOf が壊れない)
assert.doesNotThrow(() => f.seenNow("O3", T0));
assert.equal(f.isOnline("O3", T0), true);
// 対戦中は seen が古くてもオンライン
f.enterRoom("O1", "ROOMO", false, "", T0 + ONLINE_TTL_MS + 2000);
assert.equal(f.isOnline("O1", T0 + ONLINE_TTL_MS + 2000), true, "対戦中はオンライン");

// 配線(Worker と端末)
const worker = readFileSync(new URL("../src/server/worker.js", import.meta.url), "utf8").replace(/\s+/g, " ");
for (const op of ["friends-enter-room", "friends-leave-room", "friends-ping"])
  assert.ok(worker.includes(`"${op}"`), `Durable Object に ${op}`);
assert.ok(/fr\.enterRoom\(uid, args\.code, args\.online, args\.opp, now\)/.test(worker), "在席は enterRoom へ");
assert.ok(/\/\^\\\/api\\\/\(season\|wallet\|iap\|friends\)\\\//.test(worker), "CORS と本文の判定に friends が入っている");
assert.ok(/call\("friends-request-uid", \{ target: body\.uid, source: body\.source \}\)/.test(worker), "uid で申請する口(対戦相手・ランキング)");
for (const op of ["friends-state", "friends-request", "friends-request-uid", "friends-accept", "friends-decline", "friends-cancel", "friends-remove", "friends-gift", "friends-gift-all", "friends-claim", "friends-invite", "friends-cancel-invite", "friends-profile-set", "friends-profile-get"])
  assert.ok(worker.includes(`"${op}"`), `Durable Object に ${op}`);
assert.ok(/this\.friends\.forget\(uid\)/.test(worker), "記録を消すときフレンドも消す");
assert.ok(/w\.credit\(uid, g\.id, 1, "friend-gift", now\)/.test(worker), "受け取った贈り物は id ごとに1枚");
// 財布 w は friends-claim より前で宣言する(const の初期化前アクセスで受け取りが落ちていた。2026-09-24)
assert.ok(worker.indexOf("const w = this.wallet;") !== -1 && worker.indexOf("const w = this.wallet;") < worker.indexOf('if (op === "friends-claim")'), "財布 w は friends-claim の処理より前に束ねる");
assert.ok(/args\.target !== uid && !fr\.isFriend\(uid, args\.target\)/.test(worker), "他人のプロフィールはフレンドだけ");
// call() は { op, uid, ...args } なので、相手を uid の名で渡すと本人の uid が上書きされる(承認しても申請が残った。2026-09-24)
assert.ok(!/call\("friends-[a-z-]+", \{ uid:/.test(worker), "相手は target で渡す(uid の名で渡さない)");
assert.ok(!/fr\.\w+\(uid, args\.uid/.test(worker), "Durable Object でも args.uid を読まない");
const net = readFileSync(new URL("../src/net/friends.js", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/\/api\/friends\/\$\{op\}/.test(net), "端末は /api/friends/<op> を叩く");
assert.ok(/friendsRequest\("enter-room"/.test(net) && /friendsRequest\("leave-room"/.test(net), "端末に在席の口(enter-room / leave-room)");
assert.ok(/friendsRequest\("ping"\)/.test(net), "端末にオンラインの印(ping)");

console.log("フレンドとプロフィール: ID・申請と承認・50人・フレンド1人1日1枚の贈り物・招待の期限・写しの見張り・在席と観戦・消去・配線 OK");
