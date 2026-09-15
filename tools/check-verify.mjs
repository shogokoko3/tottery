/**
 * 本人確認(匿名でないか)の見分けを確かめる。
 *
 * ランダムマッチの待ち合わせに入れるのは本人確認済みだけにする。
 * その見分けは idToken の中の firebase.sign_in_provider を読む。
 * ここでは偽の idToken を組んで、providerOf の読み取りだけを確かめる
 * (署名は見ない。ルール側は Firebase が署名を検証する)。通信はしない。
 */
import { providerOf } from "../src/net/auth.js";

let ok = 0;
const fails = [];
const is = (label, got, want) => {
  if (got === want) { ok++; console.log(`  ok   ${label}`); }
  else { fails.push(label); console.log(`  NG   ${label}  ${JSON.stringify(got)} であるべきは ${JSON.stringify(want)}`); }
};

// base64url で payload だけ入れた偽トークン(header.payload.sig)
const tok = (claims) => {
  const b64 = Buffer.from(JSON.stringify(claims)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `eyJhbGciOiJSUzI1NiJ9.${b64}.sig`;
};

console.log("本人確認の見分け");
is("匿名は anonymous", providerOf(tok({ firebase: { sign_in_provider: "anonymous" } })), "anonymous");
is("Apple で入ると apple.com", providerOf(tok({ firebase: { sign_in_provider: "apple.com" } })), "apple.com");
is(
  "取り直しで匿名に戻っても、identities に apple.com が残れば本人確認済み",
  providerOf(tok({ firebase: { sign_in_provider: "anonymous", identities: { "apple.com": ["001"] } } })),
  "apple.com",
);
is("firebase 欄が無ければ anonymous 扱い", providerOf(tok({ sub: "x" })), "anonymous");
is("壊れたトークンは anonymous 扱い(遊べる方に倒す)", providerOf("not-a-token"), "anonymous");
is("空文字も anonymous 扱い", providerOf(""), "anonymous");

// Apple の紐づけ(通信は偽物)。トークンは一度しか使えないので、既に別の口座なら送り直さずに知らせる
console.log("Apple の紐づけ");
{
  const store = { "tottery.auth.v1": JSON.stringify({ refreshToken: "r", uid: "uidT" }) };
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  globalThis.window = globalThis;
  const calls = [];
  let mode = "ok";
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("securetoken")) return { ok: true, status: 200, json: async () => ({ id_token: "anon", user_id: "uidT", expires_in: 3600, refresh_token: "r" }) };
    calls.push({ url: u, body: JSON.parse(init.body), headers: init.headers });
    if (mode === "linked") return { ok: false, status: 400, json: async () => ({ error: { message: "FEDERATED_USER_ID_ALREADY_LINKED" } }) };
    if (mode === "dup") return { ok: false, status: 400, json: async () => ({ error: { message: "MISSING_OR_INVALID_NONCE : Duplicate credential received." } }) };
    return { ok: true, status: 200, json: async () => ({ idToken: "apple", localId: "uidT", refreshToken: "r2", expiresIn: "3600" }) };
  };
  const { linkAppleIdentity } = await import("../src/net/auth.js");
  mode = "linked";
  let code = null;
  try { await linkAppleIdentity({ identityToken: "tok1", rawNonce: "n1", link: true }); } catch (e) { code = e.code; }
  is("既に別の口座なら code=ALREADY_LINKED で知らせる", code, "ALREADY_LINKED");
  is("同じトークンを送り直さない(1回だけ)", calls.length, 1);
  is("紐づけのときは今の idToken を添える", calls[0].body.idToken, "anon");
  is("Web ではバンドル ID のヘッダを添えない", calls[0].headers["X-Ios-Bundle-Identifier"], undefined);
  mode = "ok";
  globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
  const held = await linkAppleIdentity({ identityToken: "tok2", rawNonce: "n2", link: false });
  is("入り直し(link=false)は idToken を添えない", calls[1].body.idToken, undefined);
  is("iOS ではバンドル ID のヘッダを添える", calls[1].headers["X-Ios-Bundle-Identifier"], "com.shogokoko.tottery");
  is("通れば Apple の合言葉になる", held.idToken, "apple");
  delete globalThis.Capacitor;
  mode = "dup";
  let msg = "";
  try { await linkAppleIdentity({ identityToken: "tok2", rawNonce: "n2", link: false }); } catch (e) { msg = e.message; }
  is("その他の失敗は理由つきで投げる", /Duplicate credential/.test(msg), true);
}

console.log(`\n${ok} 件 ok / ${fails.length} 件 NG`);
process.exit(fails.length ? 1 : 0);
