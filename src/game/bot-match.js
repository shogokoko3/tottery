/**
 * ランダムマッチの練習相手(Bot)。
 *
 * ランダムマッチで人と組めないとき、名前と持ち点を持った Bot(中身は通常の CPU)と対局する。
 * 待ち時間なしに対局でき、実力が近い相手と当たるようにするため。
 * (2026-09-14、本人の指示「1600ポイント到達するまではその Bot とマッチング」。
 *  2026-09-16 に 1750 へ、2026-09-25 に 2000 へ。
 *  2026-09-28 に**持ち点の上限を外した**。本人の指示「レートが2000を超えた人でも Bot と
 *  マッチングする。ただし Bot のレートは 2000 未満」。上の帯は人が少なく、待つだけになるため)
 *
 * 決まり:
 *  - **持ち点に関わらず**、まず掲示(人)で探す。人が見つからないまま BOT_WAIT_MS 経ったら Bot に切り替える
 *  - 直前のランダムマッチで人に負けていたら、次は探さずにすぐ Bot(1敗したら Bot)。Bot 戦を1局すると元に戻る
 *  - Bot との 9×9 は持ち点に数える(人との対局と同じ Elo)
 *  - **Bot が名乗る持ち点は 2000 未満**(BOT_RATING_MAX)。自分の近く(±80)に寄せるが、
 *    2000 以上の人にはその手前で頭打ちになる
 *  - **持ち点の増減は Bot の持ち点を踏まえて計算する**(2026-09-28 本人の指示)。
 *    ただしサーバーは端末の言い値をそのまま使わない。clampBotRating で
 *    「正しく作られたなら取り得る値」(自分の点の ±BOT_RATING_SPREAD、かつ 1200〜1999)に
 *    丸めてから式に入れる。大きな数を名乗って稼ぐことはできない
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

/**
 * Bot が名乗る持ち点の上限(この値未満)。2026-09-28 本人の指示。
 * 強さの段階(BOT_TIERS)の区切りにも使う
 */
export const BOT_RATING_MAX = 2000;

/**
 * Bot の持ち点が自分から離れてよい幅(±)。makeBot はこの幅で振り、
 * サーバーはこの幅に丸めてから式に入れる(端末の言い値をそのまま信じない)
 */
export const BOT_RATING_SPREAD = 80;

/**
 * 端末が名乗った Bot の持ち点を、**正しく作られたなら取り得る値**に丸める。
 * サーバー(src/server/ledger.js)が持ち点を計算する前に必ず通す。
 *   1. 自分の点の ±BOT_RATING_SPREAD に収める
 *   2. さらに 1200〜(BOT_RATING_MAX-1) に収める
 * 数でなければ「自分と同じ」(＝同格)にする。
 * 丸めるので、大きな数を名乗って稼ぐことはできない(2026-09-28 本人の指示)
 */
export function clampBotRating(claimed, myRating) {
  const me = normalizeRating(myRating ?? START_RATING);
  // null・undefined・空文字は Number() が 0 になってしまうので先に外す
  if (typeof claimed !== "number" && typeof claimed !== "string") return me;
  const n = Number(claimed);
  if (!Number.isFinite(n) || n <= 0) return me;
  const near = Math.min(
    Math.max(Math.round(n), me - BOT_RATING_SPREAD),
    me + BOT_RATING_SPREAD,
  );
  return Math.min(Math.max(near, 1200), BOT_RATING_MAX - 1);
}

/**
 * かつて「ここに届いたら Bot は出ない」だった線。いまは**強さの段階の区切り**と、
 * サーバーが Bot 戦を数えるかの目印として残っている。
 * @deprecated 入口の判定には使わない(matchesBot は持ち点を見ない)
 */
export const BOT_UNTIL_RATING = BOT_RATING_MAX;

/** 強さの段階。until 未満の持ち点ならその段階。blunder は「でたらめに指す割合」 */
export const BOT_TIERS = Object.freeze([
  Object.freeze({ tier: 1, name: "見習い", until: 1550, blunder: 0.45 }),
  Object.freeze({ tier: 2, name: "修行中", until: 1650, blunder: 0.2 }),
  Object.freeze({ tier: 3, name: "熟練", until: Infinity, blunder: 0 }),
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

/**
 * Bot と組む段階か。2026-09-28 から**持ち点に関わらず組む**(本人の指示)。
 * 引数は呼ぶ側の都合で残してある
 */
export function matchesBot() {
  return true;
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
  // 自分の近く(±80)。ただし **2000 未満**(本人の指示)。
  // 2000 以上の人には 1999 が上限になる
  const rating = Math.max(
    1200,
    Math.min(
      BOT_RATING_MAX - 1,
      base + Math.round(rng() * BOT_RATING_SPREAD * 2 - BOT_RATING_SPREAD),
    ),
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
 *   "now"      … 探さずにすぐ Bot(直前に人に負けた)
 *   "fallback" … まず人を探し、BOT_WAIT_MS 経っても組めなければ Bot
 * "none"(Bot を出さない)は 2026-09-28 に無くなった。持ち点の上限を外したため
 */
export function botPlan(rating, storage = null) {
  if (!matchesBot(rating)) return "none";
  return wantsBotNow(storage) ? "now" : "fallback";
}

/** 「探しています…」を見せる時間(2〜6秒)。すぐ出ると作り物に見える */
export function botSearchDelay(rng = Math.random) {
  return 2000 + Math.floor(rng() * 4000);
}
