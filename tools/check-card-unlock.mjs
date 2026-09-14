// レベルで開く札(src/game/card-unlock.js)の検査。
//   1. 段がチュートリアルと合っている(話の pool と、その話が開くレベルの pool が同じ)
//   2. 絞った札で 5×5 の対局が始まる。9×9 は Lv4 から(2〜5 の16枚では始まらない)
//   3. 手札の枚数が盤の駒数以上で、山札が足りる
//   4. 画面の配線: 手元の対局だけ絞り、オンラインは絞らない。定石CPUは絞るレベルでは出さない
import assert from "node:assert/strict";
import fs from "node:fs";
import { reducer } from "../src/game/reducer.js";
import { CARD_POOLS, RANKS } from "../src/game/constants.js";
import { totalSlots } from "../src/game/board.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { TUTORIALS } from "../src/game/tutorial.js";
import {
  ALL_CARDS_LEVEL,
  BOARD9_LEVEL,
  CARD_UNLOCKS,
  boardOpen,
  cardUnlockFor,
  cardUnlockText,
  handSizeForLevel,
  nextCardUnlock,
  poolForLevel,
} from "../src/game/card-unlock.js";

// 段は単調に増える。加わる札を足していくと CARD_POOLS と一致する
{
  let acc = [];
  for (const u of CARD_UNLOCKS) {
    acc = [...acc, ...u.adds];
    // RANKS は A が先頭なので、集合として比べる
    assert.deepEqual([...acc].sort(), [...CARD_POOLS[u.pool]].sort(), `Lv${u.level}: ${u.pool} は ${acc.join(",")}`);
  }
  assert.deepEqual([...acc].sort(), [...RANKS].sort(), "最後の段で全部の札");
  for (let i = 1; i < CARD_UNLOCKS.length; i++)
    assert.ok(CARD_UNLOCKS[i].level > CARD_UNLOCKS[i - 1].level, "レベルは昇順");
  assert.equal(poolForLevel(ALL_CARDS_LEVEL), null, "全部開けば絞らない(null)");
  assert.equal(poolForLevel(100), null);
  assert.deepEqual(poolForLevel(1), CARD_POOLS.basic);
  assert.deepEqual(poolForLevel(0), CARD_POOLS.basic, "壊れたレベルは Lv1 扱い");
  assert.deepEqual(poolForLevel(undefined), CARD_POOLS.basic);
  assert.deepEqual(poolForLevel(3.9), CARD_POOLS.basic);
  assert.deepEqual(poolForLevel(5), CARD_POOLS.mid);
  assert.deepEqual(poolForLevel(8), CARD_POOLS.court);
  assert.equal(nextCardUnlock(1).level, 4);
  assert.equal(nextCardUnlock(8).label, "A");
  assert.equal(nextCardUnlock(9), null);
  assert.match(cardUnlockText(1), /2〜5.*Lv4.*6〜9/);
  assert.match(cardUnlockText(7), /2〜Q.*Lv8.*K/);
  assert.match(cardUnlockText(9), /すべて/);
}

// チュートリアルの段と合う: 各話の pool は、その話が開くレベルで開いている pool の範囲内。
// 札を新しく教える話(第4・6・7・8・9話)は、その話が開くレベルでちょうどその段が開く
{
  const byPool = new Map(Object.entries(CARD_POOLS).map(([k, v]) => [v, k]));
  for (const t of TUTORIALS) {
    const key = byPool.get(t.pool);
    const open = cardUnlockFor(t.level);
    assert.ok(
      CARD_POOLS[open.pool].length >= t.pool.length,
      `第${t.id}話(Lv${t.level}, ${key}): 対局で開いている段(${open.pool})の範囲内`,
    );
  }
  const firstOf = {};
  for (const t of TUTORIALS) {
    const key = byPool.get(t.pool);
    if (!(key in firstOf)) firstOf[key] = t.level;
  }
  for (const u of CARD_UNLOCKS)
    assert.equal(firstOf[u.pool], u.level, `${u.pool} を教える最初の話は Lv${u.level} で開く`);
}

// 9×9 は Lv4 から。2〜5 の16枚では 9枚×2人の手札が作れない(reducer が START_SETUP を拒む)
{
  assert.equal(BOARD9_LEVEL, 4);
  assert.ok(!boardOpen(9, 3) && boardOpen(9, 4) && boardOpen(5, 1));
  const start = (size, level) =>
    reducer(
      { phase: "intro" },
      {
        type: "START_SETUP",
        size,
        setupMode: "simultaneous",
        ruleVersion: GAME_RULE_VERSION,
        pool: poolForLevel(level),
        ...(handSizeForLevel(level) ? { handSize: handSizeForLevel(level) } : null),
      },
    );
  for (let level = 1; level <= 10; level++) {
    for (const size of [5, 9]) {
      const s = start(size, level);
      const pool = poolForLevel(level) || RANKS;
      if (!boardOpen(size, level)) {
        assert.equal(s.phase, "intro", `Lv${level} ${size}×${size}: 閉じている盤は始まらない`);
        continue;
      }
      assert.equal(s.phase, "dice", `Lv${level} ${size}×${size}: 始まる`);
      const hand = s.players[0].hand;
      assert.ok(hand.length >= totalSlots(size), `Lv${level} ${size}×${size}: 手札 ${hand.length} 枚は駒数以上`);
      assert.equal(s.players[1].hand.length, hand.length);
      for (const c of [...hand, ...s.players[1].hand, ...s.reserve])
        assert.ok(pool.includes(c.rank), `Lv${level}: ${c.rank} は開いている札`);
      assert.equal(
        hand.length * 2 + s.reserve.length,
        pool.length * 4,
        `Lv${level} ${size}×${size}: 山札は開いている札の全部`,
      );
      if (level <= 3) assert.equal(hand.length, 6, `Lv${level}: 2〜5 の段は手札6枚`);
    }
  }
}

// 画面の配線
{
  const screens = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  assert.ok(/const localLevel = levelOf\(loadProfile\(\)\)/.test(screens), "自分のレベルから");
  assert.ok(/const localPool = poolForLevel\(localLevel\)/.test(screens), "レベルから札を出す");
  assert.ok(/pool=\{!a && !tut && !bot \? localPool : null\}/.test(screens), "オンライン・チュートリアル・Bot は絞らない");
  assert.ok(/handSize=\{!a && !tut && !bot \? handSizeForLevel\(localLevel\) : null\}/.test(screens), "手札の枚数も");
  assert.ok(/level=\{o === "online" \|\| o === "room" \? null : localLevel\}/.test(screens), "ルール設定はオンラインでは絞らない");
  assert.ok(/disabled=\{i === 9 && locked9\}/.test(screens), "閉じている 9×9 は押せない");
  assert.ok(/foilRevealed\(collection\) && !localPool/.test(screens), "定石CPUは絞るレベルでは出さない");
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  assert.ok(/\.\.\.\(pool && !network && !tutorial\s*\? \{ pool, \.\.\.\(handSize \? \{ handSize \} : null\) \}/.test(game), "START_SETUP に pool を載せる(手元だけ)");
  assert.ok(/!tutorial &&\s*!pool &&\s*cpuArea/.test(game), "定石の山札は絞らないときだけ");
}
console.log("レベルで開く札: 段・チュートリアルとの整合・5×5と9×9の開始・配線 OK");
