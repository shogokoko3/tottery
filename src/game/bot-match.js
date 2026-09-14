/**
 * ランダムマッチの練習相手(Bot)。
 *
 * 持ち点が BOT_UNTIL_RATING(1600)に届くまでは、ランダムマッチで人と組まず、
 * 名前と持ち点を持った Bot(中身は通常の CPU)と対局する。始めたばかりの人が
 * 待ち時間なしに対局でき、実力が近い相手と当たるようにするため。
 * (2026-09-14、本人の指示「1600ポイント到達するまではその Bot とマッチング」)
 *
 * 決まり:
 *  - 判定は自分の持ち点だけ。1600 以上になった瞬間から、掲示(人)で探す
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

/** 「探しています…」を見せる時間(2〜6秒)。すぐ出ると作り物に見える */
export function botSearchDelay(rng = Math.random) {
  return 2000 + Math.floor(rng() * 4000);
}
