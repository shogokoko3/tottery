/**
 * 買う操作の呼び出し口(画面側の唯一の窓)。
 *
 * ショップ・ガチャ画面・バトルパス画面の3か所から同じ商品を買えるようにしたとき
 * (2026-09-17 本人の指示「他の画面に飛んで買うのをやめる」)、決済の呼び出しが散らばると
 * **値段・残高・失敗の文言が片方だけ古くなる**。ここ1本に閉じ込める。
 *
 * 実処理は src/net/wallet.js とサーバー(src/server/wallet.js)にある。ここは呼ぶだけで、
 * 台帳・冪等(eventId)・有償/無償の縛りはサーバーが持つ。
 *
 * 返り値はどれも { ok, message, needGems }。
 * needGems は「ジェムが足りないので店を開くべき」の合図で、**商品ごとに文言が違う**
 * (フォイルとバトルパスは有償ジェム限定なのでサーバーが「有償ジェムが足りません」と言う)。
 * この取り違えが起きやすいので、判定もここに置く。
 */
import {
  buyFoil,
  buyPassWithGems,
  exchangeGems,
  newEventId,
} from "../net/wallet.js";

/** 有償ジェムだけで買う商品の、残高不足の言い方 */
const PAID_SHORT = /有償ジェムが足りません/;
/** どちらのジェムでも買える商品の、残高不足の言い方 */
const ANY_SHORT = /ジェムが足りません/;

function failed(e, short) {
  const message = (e && e.message) || "買えませんでした。";
  return { ok: false, message, needGems: short.test(message) };
}

/** ガチャチケットをジェムで買う(有償・無償どちらでも) */
export async function buyTicketsFor(n) {
  try {
    await exchangeGems(newEventId("xchg"), n);
    return { ok: true, message: `ガチャチケットを${n}枚受け取りました。`, needGems: false };
  } catch (e) {
    return failed(e, ANY_SHORT);
  }
}

/** フォイルのセットを有償ジェムで買う(src/skins/foil-shop.js の商品) */
export async function buyFoilFor(offer) {
  try {
    await buyFoil(offer.product.id, offer.skins);
    return {
      ok: true,
      message: `「${offer.product.name}」のフォイルを受け取りました。`,
      needGems: false,
    };
  } catch (e) {
    return failed(e, PAID_SHORT);
  }
}

/** バトルパスを有償ジェムで解放する(買い切り) */
export async function buyPassFor() {
  try {
    await buyPassWithGems(newEventId("pass"));
    return { ok: true, message: "バトルパスを手に入れました。", needGems: false };
  } catch (e) {
    return failed(e, ANY_SHORT);
  }
}
