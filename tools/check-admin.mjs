import assert from "node:assert/strict";
import worker from "../src/server/worker.js";
import { OPERATOR_UID } from "../src/net/auth.js";
const originalFetch = globalThis.fetch;
const dataToken = "signed-operator",
  playerToken = "signed-player";
let lookupCalls = 0;
globalThis.fetch = async (_url, init) => {
  lookupCalls++;
  const token = JSON.parse(init.body).idToken;
  if (token === dataToken)
    return Response.json({ users: [{ localId: OPERATOR_UID }] });
  if (token === playerToken)
    return Response.json({ users: [{ localId: "player" }] });
  return Response.json({ error: "invalid" }, { status: 400 });
};
const request = (
  token,
  body = {},
  path = "/api/admin/session",
  method = "POST",
) =>
  new Request("https://game.example" + path, {
    method,
    headers: token ? { Authorization: "Bearer " + token } : {},
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
try {
  assert.equal((await worker.fetch(request(), {})).status, 401);
  assert.equal(lookupCalls, 0, "unauthenticated request does not query data");
  assert.equal((await worker.fetch(request("forged"), {})).status, 401);
  assert.equal(
    (await worker.fetch(request(playerToken, { uid: OPERATOR_UID }), {}))
      .status,
    403,
    "a claimed operator UID is ignored",
  );
  assert.equal(
    (await worker.fetch(request(playerToken, {}, "/api/admin/season"), {}))
      .status,
    403,
  );
  assert.equal(
    (await worker.fetch(request(null, {}, "/api/admin/season"), {})).status,
    401,
  );
  let monthlyOp;
  const monthly = await worker.fetch(
    request(dataToken, {}, "/api/admin/season"),
    {
      SEASONS: {
        idFromName: (n) => n,
        get: () => ({
          fetch: async (r) => {
            monthlyOp = await r.json();
            return Response.json({
              season: { id: "2026-09" },
              players: [],
              matches: 0,
            });
          },
        }),
      },
    },
  );
  assert.equal(monthly.status, 200);
  assert.equal(monthlyOp.op, "admin-summary");
  assert.equal(monthlyOp.uid, OPERATOR_UID);
  const ok = await worker.fetch(request(dataToken), {});
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { uid: OPERATOR_UID });
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.equal(
    (
      await worker.fetch(
        request(dataToken, {}, "/api/admin/session", "GET"),
        {},
      )
    ).status,
    405,
  );
  assert.equal(
    (await worker.fetch(request(dataToken, {}, "/api/admin/other"), {})).status,
    404,
  );
  assert.equal(
    (await worker.fetch(request(dataToken, { large: "x".repeat(5000) }), {}))
      .status,
    413,
  );
} finally {
  globalThis.fetch = originalFetch;
}

// The operator page must never create an anonymous account or reuse game credentials.
const store = new Map([
  [
    "tottery.auth.v1",
    JSON.stringify({ uid: "game-player", refreshToken: "game-refresh" }),
  ],
]);
globalThis.localStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};
const auth = await import("../src/net/auth.js");
auth.useOperatorSlot();
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push(String(url));
  if (String(url).includes("accounts:signUp"))
    throw Error("anonymous signup must not happen in admin");
  if (String(url).includes("signInWithPassword"))
    return Response.json({
      idToken: dataToken,
      localId: OPERATOR_UID,
      refreshToken: "operator-refresh",
      expiresIn: "1",
    });
  if (String(url).includes("securetoken")) {
    if (
      new URLSearchParams(init.body).get("refresh_token") === "operator-refresh"
    )
      return Response.json({
        user_id: OPERATOR_UID,
        id_token: dataToken,
        refresh_token: "operator-refresh",
        expires_in: "3600",
      });
    return Response.json(
      { error: { message: "INVALID_REFRESH_TOKEN" } },
      { status: 400 },
    );
  }
  if (url === "/api/admin/session") return Response.json({ uid: OPERATOR_UID });
  throw Error("unexpected request");
};
try {
  assert.equal(await auth.ensureAuth(), null);
  assert.equal(calls.length, 0, "no requests before operator sign-in");
  const signed = await auth.signInAsOperator(
    "operator@example.test",
    "fixture-password",
  );
  assert.equal(signed.uid, OPERATOR_UID);
  assert.equal(
    JSON.parse(store.get("tottery.auth.v1")).uid,
    "game-player",
    "game login is unchanged",
  );
  const { verifyOperatorSession } = await import("../src/admin/session.js");
  assert.equal(await verifyOperatorSession(), OPERATOR_UID);
  assert.ok(
    calls.some((u) => u.includes("securetoken")),
    "a new operator login can refresh after an empty initial session",
  );
  auth.signOut();
  assert.equal(store.has("tottery.auth.op.v1"), false);
  assert.equal(JSON.parse(store.get("tottery.auth.v1")).uid, "game-player");
  store.set(
    "tottery.auth.op.v1",
    JSON.stringify({ uid: OPERATOR_UID, refreshToken: "dead-refresh" }),
  );
  auth.useOperatorSlot();
  assert.equal(await auth.ensureAuth(), null);
  assert.ok(
    !calls.some((u) => u.includes("accounts:signUp")),
    "expired operator credential cannot fall back to a new anonymous account",
  );
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.localStorage;
}
console.log(
  "PASS: operator session verification, unauthorized rejection, forged identity, no pre-login requests, isolated credentials, and expired-session handling",
);
