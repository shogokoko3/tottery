/**
 * どの入れ物で動いているか。
 *
 * 「ネイティブかどうか」だけで分けると、Android 版を足したときに
 * 「店は無いのにバトルパスは買えと言われる」のような行き止まりができる。
 * 店があるかどうかで分けるために、判定をここ1か所にまとめる。
 *
 * いまの線引き(2026-09-19 Android 版の土台を足したとき):
 *   iOS ネイティブ … 店あり(StoreKit 2)
 *   Android ネイティブ … 店なし。サーバーの検証(src/server/applejws.js)が
 *     Apple の署名専用なので、Google Play Billing の検証の道ができるまでは出さない
 *   Web … 店なし(これまで通り)
 */
import { Capacitor } from "@capacitor/core";

/** iOS アプリの中か */
export function isIosNative() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

/** アプリ内課金の店がある入れ物か。ここが false なら、買わせる画面は出さない */
export function hasStore() {
  return isIosNative();
}
