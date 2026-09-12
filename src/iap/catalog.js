/**
 * 課金の目録。App Store Connect に作る商品 ID と、買うと何が渡るか。
 * サーバー(Worker)とアプリの両方がここを見る。値段は App Store Connect で決め、
 * 画面の表示価格は StoreKit から取る(Apple の要件)。
 *
 * 売るのは**ジェム(有償の通貨)のパックだけ**。チケットとバトルパスはゲーム内でジェムで買う
 * (2026-09-12 本人の決め)。ジェムは有効期限なし・有償のみ・ボーナスなし。
 * **1ジェム＝1円で発行する前提**(未使用残高を円でそのまま数えられるように、パックのジェム数は
 * App Store Connect で選ぶ円の価格と同じにする)。数字は目安。あとで相談して決める。
 */
export const BUNDLE_ID = "com.shogokoko.tottery";

/** 店を出すか。iOS でだけ意味を持つ(Web は課金しない)。緊急に閉じる旗 */
export const SHOP_ENABLED = true;

/** ジェムのパック(消耗型)。gems は円の価格と揃える */
export const GEM_PACKS = [
  { id: `${BUNDLE_ID}.gems.120`, gems: 120, name: "120ジェム" },
  { id: `${BUNDLE_ID}.gems.600`, gems: 600, name: "600ジェム" },
  { id: `${BUNDLE_ID}.gems.1500`, gems: 1500, name: "1,500ジェム" },
];
/** ゲーム内の値付け(ジェム)。目安 */
export const GEM_PER_TICKET = 10;
export const BATTLEPASS_GEMS = 600;
/** 買い切りの権利の名前(App Store の商品ではない。ジェムで買う) */
export const BATTLEPASS_ENTITLEMENT = "battlepass";

export const PRODUCTS = GEM_PACKS.map((p) => ({ ...p, kind: "gems" }));
export const PRODUCT_IDS = PRODUCTS.map((p) => p.id);
export const productOf = (id) => PRODUCTS.find((p) => p.id === id) || null;
