/**
 * ランダムマッチの練習相手(Bot)。
 *
 * 持ち点が BOT_UNTIL_RATING(1600)に届くまでは、ランダムマッチで人と組まず、
 * 名前と持ち点を持った Bot(中身は通常の CPU)と対局する。始めたばかりの人が
 * 待ち時間なしに対局でき、実力が近い相手と当たるようにするため。
 * (2026-09-14、本人の指示「1600ポイント到達するまではその Bot とマッチング」)
 *
 * 決まり:
 *  - 1600 未満でも、まず掲示(人)で探す。人が見つからないまま BOT_WAIT_MS 経ったら Bot に切り替える
 *  - 直前のランダムマッチで人に負けていたら、次は探さずにすぐ Bot(1敗したら Bot)。Bot 戦を1局すると元に戻る
 *  - 1600 以上になった瞬間から、Bot は出ない(人だけ)
 *  - Bot との 9×9 は持ち点に数える(人との対局と同じ Elo)。だから勝てば 1600 に届く
 *  - Bot の持ち点は自分の近く(±80)。同格として +16/-16 を基本にする
 *  - サーバーのシーズン台帳には送らない(部屋が無いので verifyMatch を通せない)。
 *    月間ランキング・季節の褒美は人との対局だけ。ミッションの「オンライン対戦」にも数えない
 *  - Bot は端末の中で動く(src/game/cpu.js)。通信は要らない
 */
import { ICONS } from "./icons.js";
import { normalizeRating, START_RATING } from "./rating.js";

/** この持ち点に届くまで Bot と組む */
export const BOT_UNTIL_RATING = 1600;

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
  const rating = Math.max(1200, Math.min(1650, base + Math.round(rng() * 160 - 80)));
  return { id: `bot:${name}`, name, icon, rating };
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
 *   "none"     … Bot は出ない(持ち点 1600 以上)
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
