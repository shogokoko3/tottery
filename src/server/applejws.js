/**
 * App Store の取引(StoreKit 2 の JWS)を検証する。
 *
 * 通り道: 署名(ES256)が x5c の先頭の証明書で検証できる → 証明書の鎖が
 * 「葉 ← 中間 ← 根」とつながり、根が Apple Root CA - G3 そのもの → 各証明書が
 * 署名日時(signedDate)に有効 → 本文の bundleId / 商品 ID / 環境が合う。
 * どれか1つでも欠ければ捨てる。根は引数で差し替えられる(検査で合成の鎖を使う)。
 * 通信はしない。秘密も持たない(検証だけなので鍵は要らない)。
 */
// @peculiar/x509 は tsyringe 経由で reflect-metadata を先に要求する
import "reflect-metadata";
import { X509Certificate } from "@peculiar/x509";
import { compactVerify, decodeProtectedHeader } from "jose";
import { APPLE_ROOT_G3_PEM } from "./apple-root-g3.js";
import { BUNDLE_ID, PRODUCT_IDS } from "../iap/catalog.js";

const pemToDer = (pem) =>
  Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
const sameBytes = (a, b) => {
  const x = new Uint8Array(a), y = new Uint8Array(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
};

/**
 * @param {string} jws  取引の JWS(compact)
 * @param {{rootPem?: string, bundleId?: string, productIds?: string[], environments?: string[]}} opts
 * @returns 検証済みの本文(decoded payload)
 */
export async function verifyAppleTransaction(jws, opts = {}) {
  const rootDer = pemToDer(opts.rootPem || APPLE_ROOT_G3_PEM);
  const bundleId = opts.bundleId || BUNDLE_ID;
  const productIds = opts.productIds || PRODUCT_IDS;
  const environments = opts.environments || ["Production", "Sandbox"];
  if (typeof jws !== "string" || jws.length > 16384) throw new Error("取引の形が正しくありません。");
  const header = decodeProtectedHeader(jws);
  if (header.alg !== "ES256") throw new Error("取引の署名方式が違います。");
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length < 2 || x5c.length > 5)
    throw new Error("取引の証明書が欠けています。");
  const chain = x5c.map((b64) => new X509Certificate(b64));
  const root = chain[chain.length - 1];
  if (!sameBytes(root.rawData, rootDer))
    throw new Error("取引の署名の根が Apple ではありません。");
  // 署名を、葉の公開鍵で確かめる
  const leafKey = await chain[0].publicKey.export();
  let payload;
  try {
    const { payload: raw } = await compactVerify(jws, leafKey, { algorithms: ["ES256"] });
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new Error("取引の署名が合いません。");
  }
  const signedAt = Number(payload.signedDate);
  if (!Number.isFinite(signedAt)) throw new Error("取引に署名日時がありません。");
  const at = new Date(signedAt);
  // 鎖: 葉 ← 中間 ← … ← 根。それぞれ発行者の鍵で署名を確かめ、署名日時に有効であること
  for (let i = 0; i < chain.length; i++) {
    const cert = chain[i];
    if (at < cert.notBefore || at > cert.notAfter)
      throw new Error("取引の証明書の期限が合いません。");
    const issuer = chain[i + 1] || cert; // 根は自己署名
    // 検証中の例外(鍵の種類違い・壊れた署名など)も「鎖が切れている」として扱う
    let ok = false;
    try {
      ok = await cert.verify({ publicKey: issuer, signatureOnly: true });
    } catch {
      ok = false;
    }
    if (!ok) throw new Error("取引の証明書の鎖が切れています。");
    if (i < chain.length - 1 && cert.issuer !== issuer.subject)
      throw new Error("取引の証明書の発行者が合いません。");
  }
  if (payload.bundleId !== bundleId) throw new Error("別のアプリの取引です。");
  if (!productIds.includes(payload.productId)) throw new Error("知らない商品の取引です。");
  if (!environments.includes(payload.environment)) throw new Error("この環境の取引は受け付けません。");
  if (typeof payload.transactionId !== "string" || !/^\d{1,32}$/.test(payload.transactionId))
    throw new Error("取引 ID の形が正しくありません。");
  if (payload.revocationDate != null) throw new Error("返金された取引です。");
  return payload;
}
