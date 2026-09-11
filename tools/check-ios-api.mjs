// iOS アプリ(capacitor://localhost)からシーズン API に届くか。
//   1. seasonApiBase: アプリでは Worker の絶対 URL、Web と手元は相対(同じオリジン)
//   2. Worker の CORS: アプリの由来にだけ許可を返し、それ以外には何も足さない。事前確認(OPTIONS)は 204
import assert from "node:assert/strict";
import { seasonApiBase, SEASON_API_ORIGIN } from "../src/net/season.js";
import worker, { withCors } from "../src/server/worker.js";

assert.equal(seasonApiBase({ protocol: "capacitor:" }), SEASON_API_ORIGIN);
assert.equal(seasonApiBase({ protocol: "ionic:" }), SEASON_API_ORIGIN);
assert.equal(seasonApiBase({ protocol: "https:" }), "");
assert.equal(seasonApiBase({ protocol: "http:" }), "", "手元の localhost は見本(tools/serve.mjs)に届く");
assert.equal(seasonApiBase(undefined), "");

const req = (origin, method = "POST", path = "/api/season/summary") =>
  new Request(`https://tottery.example${path}`, { method, headers: origin ? { origin } : {} });
{
  const res = withCors(Response.json({ ok: true }), req("capacitor://localhost"));
  assert.equal(res.headers.get("access-control-allow-origin"), "capacitor://localhost");
  assert.match(res.headers.get("access-control-allow-headers"), /Authorization/);
  assert.equal(res.headers.get("vary"), "Origin");
  assert.deepEqual(await res.json(), { ok: true }, "本文はそのまま");
}
{
  const res = withCors(Response.json({ ok: true }), req("https://evil.example"));
  assert.equal(res.headers.get("access-control-allow-origin"), null, "他の由来には許可を返さない");
  const res2 = withCors(Response.json({ ok: true }), req(null));
  assert.equal(res2.headers.get("access-control-allow-origin"), null, "由来が無ければ何も足さない(Web の同じオリジン)");
}
{
  const env = { ASSETS: { fetch: () => new Response("asset") } };
  const pre = await worker.fetch(req("capacitor://localhost", "OPTIONS"), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "capacitor://localhost");
  const preAdmin = await worker.fetch(req("capacitor://localhost", "OPTIONS", "/api/admin/session"), env);
  assert.notEqual(preAdmin.status, 204, "運営の口は事前確認に応じない");
  const asset = await worker.fetch(req(null, "GET", "/index.html"), env);
  assert.equal(await asset.text(), "asset");
  const health = await worker.fetch(req("capacitor://localhost", "GET", "/api/season/health"), env);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("access-control-allow-origin"), "capacitor://localhost");
}
console.log("iOS からのシーズン API: 絶対 URL・CORS(アプリの由来だけ)・事前確認 OK");
