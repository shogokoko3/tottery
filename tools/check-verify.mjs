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

console.log(`\n${ok} 件 ok / ${fails.length} 件 NG`);
process.exit(fails.length ? 1 : 0);
