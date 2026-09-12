/**
 * 課金の目録。App Store Connect に作る商品 ID と、買うと何が渡るか。
 * サーバー(Worker)とアプリの両方がここを見る。値段は App Store Connect で決め、
 * 画面の表示価格は StoreKit から取る(Apple の要件)。
 */
export const BUNDLE_ID = "com.shogokoko.tottery";

/** 店を出すか。iOS でだけ意味を持つ(Web は課金しない)。緊急に閉じる旗 */
export const SHOP_ENABLED = true;

/** 商品。kind: "tickets"(消耗型) / "entitlement"(買い切り) */
export const PRODUCTS = [
  { id: `${BUNDLE_ID}.tickets.10`, kind: "tickets", tickets: 10, name: "ガチャチケット 10枚" },
  { id: `${BUNDLE_ID}.tickets.30`, kind: "tickets", tickets: 30, name: "ガチャチケット 30枚" },
  { id: `${BUNDLE_ID}.tickets.100`, kind: "tickets", tickets: 100, name: "ガチャチケット 100枚" },
  { id: `${BUNDLE_ID}.battlepass`, kind: "entitlement", grant: "battlepass", name: "バトルパス" },
];
export const PRODUCT_IDS = PRODUCTS.map((p) => p.id);
export const productOf = (id) => PRODUCTS.find((p) => p.id === id) || null;
export const BATTLEPASS_PRODUCT = `${BUNDLE_ID}.battlepass`;
