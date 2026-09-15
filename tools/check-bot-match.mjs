// ランダムマッチの練習相手(Bot、src/game/bot-match.js)の検査。
//   1. 判定: 持ち点 1750 未満だけ Bot。壊れた値は初期値(1500)扱い。強さは3段階(持ち点で決まる)
//   2. 人物: 名前は10字以内で自分と違う、アイコンは誰でも持てるもの、持ち点は自分の近く。rng を固定すれば同じ
//   3. 持ち点が動く: Bot に勝ち続けると 1750 に届き、そこから Bot と組まなくなる(recordGame は人との対局と同じ式)。段階も上がる
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
const { BOT_UNTIL_RATING, BOT_TIERS, BOT_WAIT_MS, BOT_NAMES, matchesBot, makeBot, botTierFor, botAction, randomMove, botSearchDelay, botPlan, noteRandomResult, wantsBotNow, clearBotNow } = await import("../src/game/bot-match.js");
const { JOSEKI_AREAS, JOSEKI_KINGS } = await import("../src/game/cpu-joseki.js");
const { ICONS } = await import("../src/game/icons.js");
const { START_RATING, nextRating } = await import("../src/game/rating.js");
const { loadProfile, recordGame } = await import("../src/game/profile.js");

// 1. 判定
assert.equal(BOT_UNTIL_RATING, 1750);
assert.equal(matchesBot(1500), true);
assert.equal(matchesBot(1749), true);
assert.equal(matchesBot(1750), false, "1750 に届いたら人と組む");
assert.equal(matchesBot(2000), false);
// 強さは3段階。持ち点が上がるほど強い
assert.equal(BOT_TIERS.length, 3);
assert.deepEqual(BOT_TIERS.map((t) => t.tier), [1, 2, 3]);
assert.equal(botTierFor(1200).tier, 1);
assert.equal(botTierFor(1549).tier, 1);
assert.equal(botTierFor(1550).tier, 2);
assert.equal(botTierFor(1649).tier, 2);
assert.equal(botTierFor(1650).tier, 3);
assert.equal(botTierFor(1749).tier, 3);
assert.equal(botTierFor(undefined).tier, 1, "持ち点が無ければ初期値(1500)で見習い");
assert.ok(BOT_TIERS[0].blunder > BOT_TIERS[1].blunder && BOT_TIERS[1].blunder > BOT_TIERS[2].blunder, "上の段階ほどでたらめが減る");
assert.equal(BOT_TIERS[2].blunder, 0, "熟練は通常の CPU そのまま");
assert.equal(BOT_TIERS[2].until, BOT_UNTIL_RATING);
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
  assert.equal(b.tier, 1, "1500 なら見習い");
  assert.equal(b.blunder, BOT_TIERS[0].blunder);
  assert.ok(JOSEKI_AREAS.includes(b.area), "エリアは6種のどれか");
  assert.ok(JOSEKI_KINGS[b.area].includes(b.king), "王はそのエリアの帯");
  assert.equal(makeBot(1600, null, () => 0.5).tier, 2);
  assert.equal(makeBot(1700, null, () => 0.5).tier, 3);
  // エリアは6種を均等に(宮殿ばかりにならない)
  {
    const cnt = {};
    for (let k = 0; k < 3000; k++) { const a = makeBot(1500).area; cnt[a] = (cnt[a] || 0) + 1; }
    for (const a of JOSEKI_AREAS) assert.ok(cnt[a] >= 380 && cnt[a] <= 620, `${a} が均等(${cnt[a]}/3000)`);
  }
  for (const n of BOT_NAMES) assert.ok(n.length <= 10, `${n} は10字以内`);
  assert.equal(new Set(BOT_NAMES).size, BOT_NAMES.length, "名前は重複しない");
  // 自分と同じ名前は避ける
  for (let k = 0; k < 200; k++) assert.notEqual(makeBot(1500, "ゆきの").name, "ゆきの");
  // 持ち点の枠
  for (let k = 0; k < 200; k++) {
    const r = makeBot(100).rating;
    assert.ok(r >= 1200 && r <= 1800, `枠の中(${r})`);
    const hi = makeBot(1749).rating;
    assert.ok(hi >= 1200 && hi <= 1800, `枠の中(${hi})`);
  }
  for (let k = 0; k < 50; k++) {
    const d = botSearchDelay();
    assert.ok(d >= 2000 && d <= 6000, `探す時間 2〜6 秒(${d})`);
  }
}

// 2b. 強さ: 見習いは移動の一部をでたらめな合法手に差し替える。熟練はそのまま。移動以外は触らない
{
  const mk = (id, owner, row, col, rank) => ({ id, owner, row, col, rank, suit: "spade", alive: true, isKing: false, history: [] });
  const board = Array.from({ length: 9 }, () => Array(9).fill(null));
  const pieces = {};
  for (const p of [mk("k", 1, 8, 4, "2"), mk("x", 1, 7, 0, "3"), mk("y", 0, 0, 4, "2")]) { pieces[p.id] = p; board[p.row][p.col] = p; }
  pieces.k.isKing = true;
  const state = { boardSize: 9, ruleVersion: 14, phase: "play", currentTurn: 1, board, pieces, areas: [null, null],
    players: [{ armyRankCounts: { 2: 1 } }, { armyRankCounts: { 2: 1, 3: 1 } }] };
  const best = { type: "MOVE_PIECE", pieceId: "k", row: 7, col: 4 };
  const weak = { blunder: 0.45 }, strong = { blunder: 0 };
  assert.deepEqual(botAction(state, 1, best, strong, () => 0.0), best, "熟練はそのまま");
  assert.deepEqual(botAction(state, 1, best, weak, () => 0.9), best, "でたらめの割合を超えればそのまま");
  const r = botAction(state, 1, best, weak, () => 0.1);
  assert.equal(r.type, "MOVE_PIECE");
  assert.ok(["k", "x"].includes(r.pieceId), "自分の駒の合法手");
  const legal = randomMove(state, 1, () => 0.1);
  assert.ok(legal && ["k", "x"].includes(legal.pieceId));
  assert.deepEqual(botAction({ ...state, phase: "setup" }, 1, best, weak, () => 0.1), best, "布陣中は触らない");
  assert.deepEqual(botAction(state, 1, { type: "USE_AREA" }, weak, () => 0.1), { type: "USE_AREA" }, "エリアの発動は触らない");
  assert.equal(botAction(state, 1, null, weak, () => 0.1), null);
  assert.deepEqual(botAction(state, 1, best, null, () => 0.1), best, "Bot でなければそのまま");
}

// 3. 持ち点が動いて 1750 に届く(同格の Bot に勝ち続ける)。途中で段階が上がる
{
  for (const k of Object.keys(store)) delete store[k];
  let p = loadProfile();
  assert.equal(p.rating, START_RATING);
  assert.equal(matchesBot(p.rating), true);
  let games = 0;
  const tiersSeen = new Set();
  while (matchesBot(p.rating) && games < 50) {
    const bot = makeBot(p.rating, p.name, () => 0.5); // 同格
    tiersSeen.add(bot.tier);
    const expect = nextRating(p.rating, bot.rating, true);
    p = recordGame(true, { foeRating: bot.rating, kingRank: "2" });
    assert.equal(p.rating, expect.rating, "人との対局と同じ式");
    games++;
  }
  assert.ok(p.rating >= 1750, `1750 に届く(${p.rating})`);
  assert.equal(matchesBot(p.rating), false, "届いたら人と組む");
  assert.ok(games >= 14 && games <= 18, `同格に勝ち続けて 16 局ほど(${games})`);
  assert.equal(tiersSeen.has(1) && tiersSeen.has(2) && tiersSeen.has(3), true, `徐々に強い Bot に当たる(${[...tiersSeen]})`);
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
  assert.equal(botPlan(1500, st), "fallback", "1750 未満: まず人を探し、時間切れで Bot");
  assert.equal(botPlan(1750, st), "none", "1750 以上: Bot は出ない");
  noteRandomResult({ won: false, vsBot: false }, st);
  assert.equal(wantsBotNow(st), true, "人に負けたら次は Bot");
  assert.equal(botPlan(1500, st), "now");
  assert.equal(botPlan(1800, st), "none", "負けていても 1750 以上なら人だけ");
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
  assert.ok(/setCpuArea\(b\.area && b\.king && foilRevealed\(collection\) \? \{ type: b\.area, king: b\.king \} : null\);\s*setBot\(b\);/.test(screens), "Bot のエリア(6種を均等)を CPU 戦の作りで立てる。フォイルを持たない人には立てない");
  assert.ok(/foilRevealed\(collection\) && \(!localPool \|\| bot\)\s*\? ensureCpuFoil\(cpuSkins, cpuArea\.king\)/.test(screens), "Bot の王の数字にフォイルを必ず持たせる(レベルの札の絞りに関係なく)");
  assert.ok(/foilRevealed\(collection\) && \(!localPool \|\| bot\) \? cpuArea : null/.test(screens), "GameCore にも Bot のエリアを渡す");
  assert.ok(/\? bot\.name\s*: cpuArea && cpuArea\.king/.test(screens), "相手の名前は Bot の名前");
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  assert.ok(/const ranked = \(!!network \|\| !!bot\) && a\.boardSize === 9;/.test(game), "Bot の 9×9 は持ち点に数える");
  assert.ok(/if \(bot\) E = botAction\(a, T, E, bot\);/.test(game), "Bot の強さ(段階)を手に反映する");
  assert.ok(/\? bot\.rating/.test(game), "相手の点は Bot の人物の点");
  assert.ok(/online: !!network && !tutorial,/.test(game), "ミッションのオンライン回数には数えない(network のときだけ)");
  assert.ok(/useSeasonMatch\(a, network, round, !!tutorial\)/.test(game), "シーズン台帳は network のときだけ(Bot は送らない)");
  assert.ok(/tutorial \|\| bot \? "相手の番です"/.test(game), "Bot 戦で「CPU」と出さない");
  assert.ok(/if \(\(network && network\.random\) \|\| bot\) noteRandomResult\(\{ won, vsBot: !!bot \}\);/.test(game), "ランダムマッチの結果を控える(人に負けたら次は Bot)");
}
console.log("ランダムマッチの練習相手(Bot): 判定・3段階の強さ・6エリア均等・持ち点が 1750 に届く・配線 OK");
