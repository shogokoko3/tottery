// ランダムマッチの練習相手(Bot、src/game/bot-match.js)の検査。
//   1. 判定: 持ち点 1600 未満だけ Bot。壊れた値は初期値(1500)扱い
//   2. 人物: 名前は10字以内で自分と違う、アイコンは誰でも持てるもの、持ち点は自分の近く。rng を固定すれば同じ
//   3. 持ち点が動く: Bot に勝ち続けると 1600 に届き、そこから Bot と組まなくなる(recordGame は人との対局と同じ式)
//   4. 配線: 掲示に行かずに Bot を出す・持ち点に数える・札を絞らない・シーズン台帳には送らない・連戦の釦
import assert from "node:assert/strict";
import fs from "node:fs";
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};
const { BOT_UNTIL_RATING, BOT_WAIT_MS, BOT_NAMES, matchesBot, makeBot, botSearchDelay, botPlan, noteRandomResult, wantsBotNow, clearBotNow } = await import("../src/game/bot-match.js");
const { ICONS } = await import("../src/game/icons.js");
const { START_RATING, nextRating } = await import("../src/game/rating.js");
const { loadProfile, recordGame } = await import("../src/game/profile.js");

// 1. 判定
assert.equal(BOT_UNTIL_RATING, 1600);
assert.equal(matchesBot(1500), true);
assert.equal(matchesBot(1599), true);
assert.equal(matchesBot(1600), false, "1600 に届いたら人と組む");
assert.equal(matchesBot(2000), false);
assert.equal(matchesBot(undefined), true, "持ち点が無ければ初期値(1500)で Bot");
assert.equal(matchesBot("abc"), true);

// 2. 人物
{
  const seq = [0.1, 0.5, 0.9];
  let i = 0;
  const rng = () => seq[i++ % seq.length];
  const b = makeBot(1500, null, rng);
  i = 0;
  assert.deepEqual(makeBot(1500, null, rng), b, "rng を固定すれば同じ人物");
  assert.ok(BOT_NAMES.includes(b.name) && b.name.length <= 10);
  assert.ok(ICONS.some((ic) => ic.id === b.icon && ic.free), "アイコンは誰でも持てるもの");
  assert.ok(b.rating >= 1420 && b.rating <= 1580, `持ち点は自分の近く(${b.rating})`);
  assert.equal(b.id, `bot:${b.name}`);
  for (const n of BOT_NAMES) assert.ok(n.length <= 10, `${n} は10字以内`);
  assert.equal(new Set(BOT_NAMES).size, BOT_NAMES.length, "名前は重複しない");
  // 自分と同じ名前は避ける
  for (let k = 0; k < 200; k++) assert.notEqual(makeBot(1500, "ゆきの").name, "ゆきの");
  // 持ち点の枠
  for (let k = 0; k < 200; k++) {
    const r = makeBot(100).rating;
    assert.ok(r >= 1200 && r <= 1650, `枠の中(${r})`);
    const hi = makeBot(1599).rating;
    assert.ok(hi >= 1200 && hi <= 1650, `枠の中(${hi})`);
  }
  for (let k = 0; k < 50; k++) {
    const d = botSearchDelay();
    assert.ok(d >= 2000 && d <= 6000, `探す時間 2〜6 秒(${d})`);
  }
}

// 3. 持ち点が動いて 1600 に届く(同格の Bot に勝ち続ける)
{
  for (const k of Object.keys(store)) delete store[k];
  let p = loadProfile();
  assert.equal(p.rating, START_RATING);
  assert.equal(matchesBot(p.rating), true);
  let games = 0;
  while (matchesBot(p.rating) && games < 50) {
    const bot = makeBot(p.rating, p.name, () => 0.5); // 同格
    const expect = nextRating(p.rating, bot.rating, true);
    p = recordGame(true, { foeRating: bot.rating, kingRank: "2" });
    assert.equal(p.rating, expect.rating, "人との対局と同じ式");
    games++;
  }
  assert.ok(p.rating >= 1600, `1600 に届く(${p.rating})`);
  assert.equal(matchesBot(p.rating), false, "届いたら人と組む");
  assert.ok(games >= 6 && games <= 8, `同格に勝ち続けて 7 局ほど(${games})`);
  assert.equal(p.rated, games, "持ち点つき対局として数える");
  assert.equal(p.battles, games, "対戦の数にも数える");
  // 負ければ下がる
  const before = p.rating;
  p = recordGame(false, { foeRating: makeBot(p.rating, null, () => 0.5).rating, kingRank: "2" });
  assert.ok(p.rating < before);
}

// 3b. 人が先。負けたら次は Bot、Bot と1局したら元に戻る
{
  const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };
  const st = mem();
  assert.ok(BOT_WAIT_MS >= 5000 && BOT_WAIT_MS <= 15000, `人を探す時間は数秒(${BOT_WAIT_MS}ms)`);
  assert.equal(botPlan(1500, st), "fallback", "1600 未満: まず人を探し、時間切れで Bot");
  assert.equal(botPlan(1600, st), "none", "1600 以上: Bot は出ない");
  noteRandomResult({ won: false, vsBot: false }, st);
  assert.equal(wantsBotNow(st), true, "人に負けたら次は Bot");
  assert.equal(botPlan(1500, st), "now");
  assert.equal(botPlan(1650, st), "none", "負けていても 1600 以上なら人だけ");
  noteRandomResult({ won: false, vsBot: true }, st);
  assert.equal(wantsBotNow(st), false, "Bot と1局(負けでも)したら元に戻る");
  noteRandomResult({ won: false, vsBot: false }, st);
  clearBotNow(st);
  assert.equal(wantsBotNow(st), false, "Bot 戦を始めた時点で印を消す(途中で抜けても次は人から)");
  noteRandomResult({ won: false, vsBot: false }, st);
  noteRandomResult({ won: true, vsBot: false }, st);
  assert.equal(wantsBotNow(st), false, "人に勝てば元に戻る");
  noteRandomResult({ won: false, vsBot: false }, st);
  noteRandomResult({ won: null, vsBot: false }, st);
  assert.equal(wantsBotNow(st), false, "引き分けでも元に戻る");
  const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
  assert.equal(botPlan(1500, broken), "fallback", "保存できない端末では毎回まず人を探す");
  noteRandomResult({ won: false, vsBot: false }, broken);
}

// 4. 配線
{
  const screens = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  assert.ok(/const planRef = useRef\(onBotReady \? botPlan\(myRating\(\)\) : "none"\);/.test(screens), "Bot の扱いは開いた時点で botPlan で決める");
  assert.ok(/const plan = planRef\.current;/.test(screens), "探す効果はその決めを使う");
  assert.ok(/if \(plan === "now"\) \{\s*const bot = makeBot\(myRating\(\), myName\(\)\);/.test(screens), "直前に人に負けていたら、探さずに Bot");
  assert.ok(/botSearchDelay\(\)/.test(screens), "そのときも数秒「探しています」を見せる");
  assert.ok(/plan === "fallback"\s*\? setTimeout\(\(\) => \{\s*if \(o\.current\) return;\s*o\.current = !0;\s*onBotReady\(makeBot\(myRating\(\), myName\(\)\)\);\s*\}, BOT_WAIT_MS\)/.test(screens), "まず人を探し、BOT_WAIT_MS で Bot に切り替える(探すのを止める)");
  assert.ok(/if \(fallback\) clearTimeout\(fallback\);/.test(screens), "画面を離れたら切り替えの予約を消す");
  assert.ok(/l === "error" && planRef\.current !== "fallback" \? \(/.test(screens), "通信の誤りでも、Bot に切り替える予約があれば「探しています」のまま");
  assert.ok(/onBotReady=\{\(b\) => \{\s*clearBotNow\(\);/.test(screens), "Bot 戦を始めたら「次は Bot」の印を消す");
  assert.ok(/bot=\{d && !tut \? bot : null\}/.test(screens), "GameCore に Bot を渡す");
  assert.ok(/pool=\{!a && !tut && !bot \? localPool : null\}/.test(screens), "Bot 戦は札を絞らない(人との対局と同じ)");
  assert.ok(/onNextMatch=\{\(a && a\.random\) \|\| bot \? nextRandomMatch : null\}/.test(screens), "Bot 戦のあとも「次の相手と対戦する」");
  assert.ok(/onBotReady=\{\(b\) => \{\s*clearBotNow\(\);\s*setCpuSkins\(createCpuLoadout\(\)\);\s*setCpuArea\(null\);\s*setBot\(b\);/.test(screens), "Bot は CPU 戦の作りで始める(エリア指定なし)");
  assert.ok(/\? bot\.name\s*: cpuArea && cpuArea\.king/.test(screens), "相手の名前は Bot の名前");
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  assert.ok(/const ranked = \(!!network \|\| !!bot\) && a\.boardSize === 9;/.test(game), "Bot の 9×9 は持ち点に数える");
  assert.ok(/\? bot\.rating/.test(game), "相手の点は Bot の人物の点");
  assert.ok(/online: !!network && !tutorial,/.test(game), "ミッションのオンライン回数には数えない(network のときだけ)");
  assert.ok(/useSeasonMatch\(a, network, round, !!tutorial\)/.test(game), "シーズン台帳は network のときだけ(Bot は送らない)");
  assert.ok(/tutorial \|\| bot \? "相手の番です"/.test(game), "Bot 戦で「CPU」と出さない");
  assert.ok(/if \(\(network && network\.random\) \|\| bot\) noteRandomResult\(\{ won, vsBot: !!bot \}\);/.test(game), "ランダムマッチの結果を控える(人に負けたら次は Bot)");
}
console.log("ランダムマッチの練習相手(Bot): 判定・人物・持ち点が 1600 に届く・配線 OK");
