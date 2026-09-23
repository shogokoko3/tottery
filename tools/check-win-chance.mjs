/**
 * オンライン対戦の勝利チャンス(2026-09-23 本人の指示)。
 *   - 1日の上限3回
 *   - 1回目は1戦目〜5戦目のどれかにランダム。負けたら次の対局も同じチャンス(成功まで持ち越す)
 *   - 2回目は成功した次の対局を1戦目として、そこから5戦目以内。3回目も同じ
 *   - 日付が変われば1回目から
 * 画面の配線: 対戦相手の画面で知らせ、終局で清算し、成功ならガチャチケット(出来事 id つき)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WIN_CHANCE_MAX_PER_DAY,
  WIN_CHANCE_WINDOW,
  WIN_CHANCE_REWARD_TICKETS,
  drawTarget,
  normalizeWinChance,
  isChanceNext,
  chancesLeft,
  settleWinChance,
  rewardEventId,
  loadWinChance,
  saveWinChance,
  chanceDay,
} from "../src/game/win-chance.js";

assert.equal(WIN_CHANCE_MAX_PER_DAY, 3);
assert.equal(WIN_CHANCE_WINDOW, 5);
assert.ok(WIN_CHANCE_REWARD_TICKETS >= 1);

// 何戦目に来るかは 1〜5
for (const r of [0, 0.19, 0.2, 0.5, 0.8, 0.999]) {
  const t = drawTarget(() => r);
  assert.ok(t >= 1 && t <= 5, `target ${t}`);
}
assert.equal(drawTarget(() => 0), 1);
assert.equal(drawTarget(() => 0.999), 5);

// 1回目: 3戦目にチャンス。1・2戦目はチャンスでない
const rng3 = () => 0.5; // → target 3
let s = normalizeWinChance(null, "2026-09-23", rng3);
assert.deepEqual(s, { day: "2026-09-23", done: 0, played: 0, target: 3 });
assert.equal(isChanceNext(s), false, "1戦目はまだ");
let r = settleWinChance(s, true, rng3);
assert.equal(r.wasChance, false);
assert.equal(r.rewarded, false, "チャンスでない勝ちは褒美なし");
s = r.state;
assert.equal(isChanceNext(s), false, "2戦目もまだ");
s = settleWinChance(s, false, rng3).state;
assert.equal(isChanceNext(s), true, "3戦目がチャンス");
// チャンスに負けたら、次の対局も同じチャンス
r = settleWinChance(s, false, rng3);
assert.equal(r.wasChance, true);
assert.equal(r.rewarded, false);
s = r.state;
assert.equal(isChanceNext(s), true, "負けたら持ち越し");
r = settleWinChance(s, null, rng3);
assert.equal(r.rewarded, false, "引き分けも持ち越し");
s = r.state;
assert.equal(isChanceNext(s), true);
// 勝てば成功。2回目の周期が始まり、そこから5戦目以内
r = settleWinChance(s, true, () => 0.999); // 次の target は 5
assert.equal(r.rewarded, true);
assert.equal(r.done, 1);
s = r.state;
assert.deepEqual([s.done, s.played, s.target], [1, 0, 5], "成功で周期が改まる");
assert.equal(chancesLeft(s), 2);
for (let i = 0; i < 4; i++) {
  assert.equal(isChanceNext(s), false, `2回目の${i + 1}戦目はまだ`);
  s = settleWinChance(s, true, rng3).state;
}
assert.equal(isChanceNext(s), true, "2回目は5戦目に来る");
s = settleWinChance(s, true, () => 0).state; // 成功。3回目は1戦目
assert.equal(s.done, 2);
assert.equal(isChanceNext(s), true, "3回目は1戦目に来ることもある");
s = settleWinChance(s, true, rng3).state;
assert.equal(s.done, 3);
assert.equal(chancesLeft(s), 0);
assert.equal(isChanceNext(s), false, "3回成功したらその日は終わり");
r = settleWinChance(s, true, rng3);
assert.equal(r.rewarded, false, "上限を超えて配らない");

// 日付が変われば1回目から
const next = normalizeWinChance(s, "2026-09-24", rng3);
assert.deepEqual([next.done, next.played], [0, 0], "翌日はやり直し");
assert.equal(normalizeWinChance({ day: "2026-09-23", done: 9, played: -3, target: 99 }, "2026-09-23", rng3).done, 3, "壊れた値は直す");
assert.equal(normalizeWinChance({ day: "2026-09-23", done: 1, played: 2, target: 4 }, "2026-09-23", rng3).target, 4, "同じ日は引き継ぐ");

// 日の区切りはミッションと同じ(05:00 JST)
assert.equal(chanceDay(Date.UTC(2026, 8, 22, 19, 30)), "2026-09-22", "04:30 JST はまだ前日");
assert.equal(chanceDay(Date.UTC(2026, 8, 22, 20, 30)), "2026-09-23", "05:30 JST から新しい日");

// 保存と読み戻し
const mem = new Map();
const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
saveWinChance({ day: chanceDay(), done: 1, played: 1, target: 2 }, storage);
assert.deepEqual(loadWinChance(Date.now(), storage, rng3), { day: chanceDay(), done: 1, played: 1, target: 2 });

// 出来事 id は日と回で決まる(同じ成功を二度積まない)
assert.equal(rewardEventId("u1", "2026-09-23", 2), "win-chance:u1:2026-09-23:2");

// 配線
const game = readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/const chanceEligible = !!\(\(network && network\.random\) \|\| bot\) && !tutorial;/.test(game), "ランダムマッチ(人・Bot)だけ");
assert.ok(/const r = settleWinChance\(loadWinChance\(\), won\);/.test(game) && /saveWinChance\(r\.state\)/.test(game), "終局で清算して保存");
assert.ok(/earnTickets\(rewardEventId\(myUid\(\), day, r\.done\), WIN_CHANCE_REWARD_TICKETS\)/.test(game), "成功ならサーバーの財布に出来事 id つきで積む");
assert.ok(/giveGift\(\{ type: "ticket", amount: WIN_CHANCE_REWARD_TICKETS \}\)/.test(game), "手元の持ち物にも足す");
assert.ok(/export function MatchIntro\(/.test(game) && /対戦相手が決まりました/.test(game), "対戦相手の画面がある");
assert.ok(/const showIntro = !!\(network \|\| bot\) && !tutorial && !introDone;/.test(game), "対戦相手の画面はオンライン(人・Bot)だけ");
assert.ok(/matchRatings\.ready && \/\/ [^/]*\n?[^!]*!showIntro &&/.test(game) || /!showIntro && \(\(network && p !== 0\)/.test(game), "見終わるまで START_SETUP を送らない");
assert.ok(/chance=\{chanceResult\}/.test(game) && /勝利チャンス成功/.test(game), "終局画面で知らせる");
const screens = readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8").replace(/\s+/g, " ");
assert.ok(/\? \[titleOf\(mine\)\.id, botTitle\(bot\)\]/.test(screens), "Bot にも称号を持たせる(時計欄と対戦相手の画面に出る)");

console.log("勝利チャンス: 1〜5戦目にランダム・負けたら持ち越し・成功で周期が改まる・1日3回・翌日やり直し・配線 OK");
