/**
 * ランダムマッチの練習相手(Bot)。
 *
 * 持ち点が BOT_UNTIL_RATING(2000)に届くまでは、ランダムマッチで人と組まず、
 * 名前と持ち点を持った Bot(中身は通常の CPU)と対局する。始めたばかりの人が
 * 待ち時間なしに対局でき、実力が近い相手と当たるようにするため。
 * (2026-09-14、本人の指示「1600ポイント到達するまではその Bot とマッチング」。
 *  2026-09-16 に 1750 へ。強さを3段階にし、持ち点が上がるほど強い Bot が当たる)
 *
 * 決まり:
 *  - 2000 未満でも、まず掲示(人)で探す。人が見つからないまま BOT_WAIT_MS 経ったら Bot に切り替える
 *  - 直前のランダムマッチで人に負けていたら、次は探さずにすぐ Bot(1敗したら Bot)。Bot 戦を1局すると元に戻る
 *  - 2000 以上になった瞬間から、Bot は出ない(人だけ)
 *  - Bot との 9×9 は持ち点に数える(人との対局と同じ Elo)。だから勝てば 2000 に届く
 *  - Bot の持ち点は自分の近く(±80)。同格として +16/-16 を基本にする
 *  - **強さは3段階**(BOT_TIERS)。自分の持ち点で決まり、上がるほど強い相手になる:
 *      1 見習い(〜1549): 手の 45% をでたらめに指す
 *      2 修行中(1550〜1649): 手の 20% をでたらめに指す
 *      3 熟練(1650〜1999): 通常の CPU そのまま
 *    でたらめ = 合法な手からランダムに1つ(布陣・王の選択・エリアの発動は通常どおり)
 *  - **エリアは6種を均等に**(JOSEKI_AREAS からランダム。王はそのエリアの帯から)。
 *    以前は CPU が手札から K を選ぶため宮殿ばかりになっていた(本人の指摘 2026-09-16)
 *  - サーバーのシーズン台帳には送らない(部屋が無いので verifyMatch を通せない)。
 *    月間ランキング・季節の褒美は人との対局だけ。ミッションの「オンライン対戦」にも数えない
 *  - Bot は端末の中で動く(src/game/cpu.js)。通信は要らない
 */
import { ICONS } from "./icons.js";
import { normalizeRating, START_RATING } from "./rating.js";
import { JOSEKI_AREAS, pickJosekiKing } from "./cpu-joseki.js";
import { getLegalMoves, kingRankOf } from "./board.js";
import { isFrozen } from "./areas.js";

/** この持ち点に届くまで Bot と組む(2026-09-25 本人の指示で 1750→2000) */
export const BOT_UNTIL_RATING = 2000;

/** 強さの段階。until 未満の持ち点ならその段階。blunder は「でたらめに指す割合」 */
export const BOT_TIERS = Object.freeze([
  Object.freeze({ tier: 1, name: "見習い", until: 1550, blunder: 0.45 }),
  Object.freeze({ tier: 2, name: "修行中", until: 1650, blunder: 0.2 }),
  Object.freeze({ tier: 3, name: "熟練", until: BOT_UNTIL_RATING, blunder: 0 }),
]);

/** その持ち点で当たる Bot の段階 */
export function botTierFor(rating) {
  const r = normalizeRating(rating ?? START_RATING);
  return BOT_TIERS.find((t) => r < t.until) || BOT_TIERS[BOT_TIERS.length - 1];
}

/** Bot の名前。人の名前と同じ長さの決まり(10字まで) */
export const BOT_NAMES = Object.freeze([
  "ゆきの",
  "たけ",
  "まる",
  "しおん",
  "こはる",
  "りく",
  "あおい",
  "はやて",
  "みなと",
  "ひなた",
  "そら",
  "つばさ",
  "かえで",
  "ren",
  "yuu",
  "kaito",
  "nao",
  "mio",
  "sakura",
  "hiro",
]);

/** Bot が使うアイコン。誰でも持てるものだけ */
const BOT_ICONS = ICONS.filter((i) => i.free).map((i) => i.id);

/** その持ち点なら Bot と組むか */
export function matchesBot(rating) {
  return normalizeRating(rating ?? START_RATING) < BOT_UNTIL_RATING;
}

/**
 * Bot の人物(名前・アイコン・持ち点)。myName と同じ名前は避ける。
 * rng は 0〜1 を返す関数(検査で固定する)
 */
export function makeBot(myRating, myName = null, rng = Math.random) {
  const names = BOT_NAMES.filter((n) => n !== myName);
  const name = names[Math.floor(rng() * names.length)];
  const icon = BOT_ICONS[Math.floor(rng() * BOT_ICONS.length)];
  const base = normalizeRating(myRating ?? START_RATING);
  const rating = Math.max(
    1200,
    Math.min(1800, base + Math.round(rng() * 160 - 80)),
  );
  const { tier, blunder } = botTierFor(base);
  // エリアは6種を均等に。王はそのエリアの帯からランダム
  const area = JOSEKI_AREAS[Math.floor(rng() * JOSEKI_AREAS.length)];
  const king = pickJosekiKing(area, rng);
  // matchId はこの1局の目印。シーズン台帳に送るとき、同じ局を二度数えないための鍵(2026-09-23)
  // rng だけから作る(rng を固定すれば同じ人物、の検査を保つ)。62 ビットあれば同じ局が重なることはない
  const matchId = `${Math.floor(rng() * 2 ** 31).toString(36)}${Math.floor(rng() * 2 ** 31).toString(36)}`;
  return { id: `bot:${name}`, name, icon, rating, tier, blunder, area, king, matchId };
}

/**
 * Bot の称号(2026-09-23 本人の指示「相手の名前が出る箇所には称号も」)。人物として自然に見えるよう、
 * 持ち点に応じた既存の称号を名乗る。持ち点で決まる称号の線(titles.js)と同じ
 */
export function botTitle(bot) {
  const r = Number(bot?.rating) || 0;
  return r >= 1800 ? "rank-sho" : r >= 1600 ? "rank-shi" : "first";
}

/** 合法な手からランダムに1つ(A の入れ替えと凍った駒は除く)。無ければ null */
export function randomMove(state, player, rng = Math.random) {
  const all = [];
  for (const piece of Object.values(state.pieces)) {
    if (!piece.alive || piece.owner !== player || piece.rank === "A") continue;
    if (isFrozen(state, piece)) continue;
    for (const m of getLegalMoves(
      piece,
      state.board,
      state.boardSize,
      state.players[player].armyRankCounts,
      kingRankOf(state, player),
    ))
      all.push({
        type: "MOVE_PIECE",
        pieceId: piece.id,
        row: m.row,
        col: m.col,
        captures: m.captures,
      });
  }
  return all.length ? all[Math.floor(rng() * all.length)] : null;
}

/**
 * Bot の強さを手に反映する。段階の blunder の割合で、CPU の選んだ移動をでたらめな合法手に差し替える。
 * 移動以外(布陣・王・エリアの発動・入れ替え)はそのまま
 */
export function botAction(state, player, act, bot, rng = Math.random) {
  if (!act || !bot || !(bot.blunder > 0)) return act;
  if (state.phase !== "play" || act.type !== "MOVE_PIECE") return act;
  if (rng() >= bot.blunder) return act;
  return randomMove(state, player, rng) || act;
}

/** 人を探す時間。これだけ経っても人と組めなければ Bot に切り替える */
export const BOT_WAIT_MS = 8000;

/** 「1敗したら次は Bot」の印。端末に置く */
const NOW_KEY = "tottery.bot-match.v1";

function storageOf(storage) {
  try {
    return storage || localStorage;
  } catch {
    return null;
  }
}

/**
 * ランダムマッチの結果を控える。人に負けたら次は Bot、
 * 人に勝つか引き分けるか、Bot と1局したら元に戻る
 */
export function noteRandomResult({ won, vsBot }, storage = null) {
  const st = storageOf(storage);
  if (!st) return;
  try {
    if (!vsBot && won === false) st.setItem(NOW_KEY, "1");
    else st.removeItem(NOW_KEY);
  } catch {
    /* 保存できない端末では、毎回まず人を探す */
  }
}

/** 直前に人に負けていて、次はすぐ Bot にする番か */
export function wantsBotNow(storage = null) {
  const st = storageOf(storage);
  try {
    return !!st && st.getItem(NOW_KEY) === "1";
  } catch {
    return false;
  }
}

/** Bot 戦を始めたら印を消す(途中で抜けても、次はまた人から) */
export function clearBotNow(storage = null) {
  const st = storageOf(storage);
  try {
    st && st.removeItem(NOW_KEY);
  } catch {
    /* 消せなくても害は無い */
  }
}

/**
 * ランダムマッチを開いたときの Bot の扱い。
 *   "none"     … Bot は出ない(持ち点 1750 以上)
 *   "now"      … 探さずにすぐ Bot(直前に人に負けた)
 *   "fallback" … まず人を探し、BOT_WAIT_MS 経っても組めなければ Bot
 */
export function botPlan(rating, storage = null) {
  if (!matchesBot(rating)) return "none";
  return wantsBotNow(storage) ? "now" : "fallback";
}

/** 「探しています…」を見せる時間(2〜6秒)。すぐ出ると作り物に見える */
export function botSearchDelay(rng = Math.random) {
  return 2000 + Math.floor(rng() * 4000);
}
