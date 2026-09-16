/**
 * 課金の目録。App Store Connect に作る商品 ID と、買うと何が渡るか。
 * サーバー(Worker)とアプリの両方がここを見る。値段は App Store Connect で決め、
 * 画面の表示価格は StoreKit から取る(Apple の要件)。
 *
 * ジェムは有償(paid)と無償(free)を財布の中で分けて持つ。
 *  - 有償: 買った円の分(1ジェム=1円)。資金決済法の未使用残高はこれだけを数える
 *  - 無償: パックのおまけ、ミッションや手紙、バトルパスの完成などで手に入る分
 *  - 使うときは無償→有償の順(GEM_CONSUME_ORDER)。定数1つで変えられる
 * パックは 2026-09-12 に本人が決めた(有償=円と同額、端数のおまけ=無償):
 *  150円=150(2026-09-16 に 120 から) / 600円=600+60 / 1,500円=1,500+230 / 3,000円=3,000+600 /
 *  5,000円=5,000+850 / 10,000円=10,000+2,000
 * 値付け(チケット1枚・バトルパス)と獲得量は目安で、あとで相談して決める。
 * 商品 ID は円で固定する(おまけを変えても App Store の商品を作り直さない)
 */
export const BUNDLE_ID = "com.shogokoko.tottery";

/** 店を出すか。iOS でだけ意味を持つ(Web は課金しない)。緊急に閉じる旗 */
export const SHOP_ENABLED = true;

/** ジェムのパック(消耗型)。paid は円の価格と同じ、free はおまけ(無償) */
export const GEM_PACKS = [
  // おまけ(無償)は買うほど率が上がる。120=0% / 600=10% / 1500≈15%(230) / 3000=20% / 5000=25% / 10000=30%
  // 120 → 150 に(2026-09-16 本人の決め。ガチャ1回 150 ジェムをちょうど買える最小のパック)
  { id: `${BUNDLE_ID}.gems.150`, paid: 150, free: 0, name: "150ジェム" },
  {
    id: `${BUNDLE_ID}.gems.600`,
    paid: 600,
    free: 60,
    name: "600ジェム＋おまけ60",
  },
  {
    id: `${BUNDLE_ID}.gems.1500`,
    paid: 1500,
    free: 230,
    name: "1,500ジェム＋おまけ230",
  },
  {
    id: `${BUNDLE_ID}.gems.3000`,
    paid: 3000,
    free: 600,
    name: "3,000ジェム＋おまけ600",
  },
  {
    id: `${BUNDLE_ID}.gems.5000`,
    paid: 5000,
    free: 1250,
    name: "5,000ジェム＋おまけ1,250",
  },
  {
    id: `${BUNDLE_ID}.gems.10000`,
    paid: 10000,
    free: 3000,
    name: "10,000ジェム＋おまけ3,000",
  },
];
/** 使う順。無償を先に減らし、足りない分を有償から */
export const GEM_CONSUME_ORDER = ["free", "paid"];
/**
 * ゲーム内の値付け(ジェム)。2026-09-16 本人の決め: ガチャチケット1枚 150、10枚まとめて 1,200
 * (1ジェム=1円なので、有償ガチャは 1回 ¥150 / 10連 ¥1,200。割引は「1枚→10枚」の1段だけ)。
 * 10 ジェム=1枚だった頃(2026-09-12〜16)は 1回 ¥10 になっていた
 */
export const GEM_PER_TICKET = 150;
export const TICKET_BUNDLE = Object.freeze({ tickets: 10, gems: 1200 });
/** n 枚のチケットの値段(ジェム)。10枚ごとにまとめ売りの値段、端数は1枚ずつ */
export function ticketsPrice(n) {
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  const bundles = Math.floor(n / TICKET_BUNDLE.tickets);
  return (
    bundles * TICKET_BUNDLE.gems + (n % TICKET_BUNDLE.tickets) * GEM_PER_TICKET
  );
}
/**
 * 無償ジェムをエーテルに(2026-09-16 本人の決め: 10 → 20)。**無償だけ**で払う。
 * ガチャ1回(10 ジェム相当だった頃の崩し分 ≒ 24)よりやや不利にして、ガチャの価値を守る
 */
export const ETHER_EXCHANGE = Object.freeze({ gems: 10, ether: 20, max: 1000 });
/** gems(無償)をエーテルにするとき得られる量。10 の倍数でなければ null */
export function etherFor(gems) {
  if (
    !Number.isSafeInteger(gems) ||
    gems <= 0 ||
    gems % ETHER_EXCHANGE.gems !== 0 ||
    gems > ETHER_EXCHANGE.max
  )
    return null;
  return (gems / ETHER_EXCHANGE.gems) * ETHER_EXCHANGE.ether;
}
/** バトルパス。1,500ジェムで買い切り解放・周回制(2026-09-13 本人の決め) */
export const BATTLEPASS_GEMS = 1500;
/** 買い切りの権利の名前(App Store の商品ではない。ジェムで買う) */
export const BATTLEPASS_ENTITLEMENT = "battlepass";
/**
 * バトルパスの周回とチケット。買うと解放。各マスクリアでチケット1枚(1周=24枚)、毎周。
 * 周回は1週間(UTC月曜始まり)に3回まで=チケット週72枚まで。1周目の完成だけ限定スキン。
 * 24 は盤の埋めるマス数(5×5から真ん中1つを除く)。tools/check-battlepass.mjs が盤と一致を見張る
 */
export const BATTLEPASS_TICKETS_PER_CYCLE = 24;
export const BATTLEPASS_CYCLES_PER_WEEK = 3;
export const BATTLEPASS_WEEK_TICKET_MAX =
  BATTLEPASS_TICKETS_PER_CYCLE * BATTLEPASS_CYCLES_PER_WEEK;
/** 初課金特典: 初めての有料購入だけ、購入ジェムを2倍(おまけは無償)＋このスキン */
export const FIRST_PURCHASE_SKIN = "pegasus-knight";
/** 無償ジェムの獲得(端末の申告)の上限。1回と1日(UTC) */
export const FREE_GEM_EVENT_MAX = 100;
export const FREE_GEM_DAILY_MAX = 500; // ミッション等の正規の受け取りが1日で詰まらない量
/** 広告リワード: 広告を1本見るとガチャ1回ぶん(チケット1枚)。1日3回まで */
export const ADS_PER_DAY = 3;
export const AD_REWARD_TICKETS = 1;

/** パックの絵(2026-09-14、本人の原画 1024px を 512px の WebP に)。assets/skins/gems/ → skins/gems/ で配る */
export const packImage = (paid) => `skins/gems/gem-pack-${paid}.webp`;
export const PRODUCTS = GEM_PACKS.map((p) => ({
  ...p,
  kind: "gems",
  gems: p.paid + p.free,
  image: packImage(p.paid),
}));
export const PRODUCT_IDS = PRODUCTS.map((p) => p.id);
export const productOf = (id) => PRODUCTS.find((p) => p.id === id) || null;
