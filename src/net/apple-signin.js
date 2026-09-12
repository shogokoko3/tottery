/**
 * Sign in with Apple(iOS)。いまの匿名の口座に Apple を紐づけて、uid を機種変更後も
 * 引き継げるようにする(財布と買い切りの権利の鍵)。
 *
 * nonce: 素の乱数(rawNonce)の SHA-256 を Apple に渡し、Apple が返す identityToken に
 * その写しが入る。Firebase には素の rawNonce を渡し、突き合わせてもらう。
 * Web では何もしない(本人確認は iOS だけ。手順書 本人確認-Apple.md)。
 */
import { Capacitor } from "@capacitor/core";
import { linkAppleIdentity, isVerified } from "./auth.js";
import { BUNDLE_ID } from "../iap/catalog.js";

export const appleSignInAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

async function sha256hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 紐づける。取り消したら null、既に紐づいていれば { already: true } */
export async function signInWithApple() {
  if (isVerified()) return { already: true };
  if (!appleSignInAvailable()) throw new Error("Apple でのサインインは iOS アプリで行えます。");
  const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
  const rawNonce = crypto.randomUUID() + crypto.randomUUID();
  let res;
  try {
    res = await SignInWithApple.authorize({
      clientId: BUNDLE_ID,
      redirectURI: "https://tottery-66e0f.firebaseapp.com/__/auth/handler",
      scopes: "name email",
      nonce: await sha256hex(rawNonce),
    });
  } catch (e) {
    if (/cancel|1001/i.test(String(e && (e.message || e.code)))) return null;
    throw new Error("Apple のサインインを完了できませんでした。");
  }
  const identityToken = res && res.response && res.response.identityToken;
  if (!identityToken) throw new Error("Apple からの返事を受け取れませんでした。");
  await linkAppleIdentity({ identityToken, rawNonce });
  return { linked: true };
}
