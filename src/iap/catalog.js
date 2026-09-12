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
 *  120円=120 / 600円=600+120 / 1,500円=1,500+180 / 3,000円=3,000+450 /
 *  5,000円=5,000+850 / 10,000円=10,000+2,000
 * 値付け(チケット1枚・バトルパス)と獲得量は目安で、あとで相談して決める。
 * 商品 ID は円で固定する(おまけを変えても App Store の商品を作り直さない)
 */
export const BUNDLE_ID = "com.shogokoko.tottery";

/** 店を出すか。iOS でだけ意味を持つ(Web は課金しない)。緊急に閉じる旗 */
export const SHOP_ENABLED = true;

/** ジェムのパック(消耗型)。paid は円の価格と同じ、free はおまけ(無償) */
export const GEM_PACKS = [
  // おまけ(無償)は買うほど率が上がる。120=0% / 600=10% / 1500=15% / 3000=20% / 5000=25% / 10000=30%
  { id: `${BUNDLE_ID}.gems.120`, paid: 120, free: 0, name: "120ジェム" },
  { id: `${BUNDLE_ID}.gems.600`, paid: 600, free: 60, name: "600ジェム＋おまけ60" },
  { id: `${BUNDLE_ID}.gems.1500`, paid: 1500, free: 225, name: "1,500ジェム＋おまけ225" },
  { id: `${BUNDLE_ID}.gems.3000`, paid: 3000, free: 600, name: "3,000ジェム＋おまけ600" },
  { id: `${BUNDLE_ID}.gems.5000`, paid: 5000, free: 1250, name: "5,000ジェム＋おまけ1,250" },
  { id: `${BUNDLE_ID}.gems.10000`, paid: 10000, free: 3000, name: "10,000ジェム＋おまけ3,000" },
];
/** 使う順。無償を先に減らし、足りない分を有償から */
export const GEM_CONSUME_ORDER = ["free", "paid"];
/** ゲーム内の値付け(ジェム)。目安 */
export const GEM_PER_TICKET = 10;
export const BATTLEPASS_GEMS = 600;
/** 買い切りの権利の名前(App Store の商品ではない。ジェムで買う) */
export const BATTLEPASS_ENTITLEMENT = "battlepass";
/** 無償ジェムの獲得(端末の申告)の上限。1回と1日(UTC) */
export const FREE_GEM_EVENT_MAX = 100;
export const FREE_GEM_DAILY_MAX = 300;
/** バトルパスの25マスをそろえたときの無償ジェム。目安 */
export const BATTLEPASS_COMPLETE_GEMS = 60;

export const PRODUCTS = GEM_PACKS.map((p) => ({ ...p, kind: "gems", gems: p.paid + p.free }));
export const PRODUCT_IDS = PRODUCTS.map((p) => p.id);
export const productOf = (id) => PRODUCTS.find((p) => p.id === id) || null;
