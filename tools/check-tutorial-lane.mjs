/**
 * チュートリアルの褒美の道(2026-09-30 本人の指示「チュートリアル分はサーバーで別枠にする」)。
 *
 * サーバーは端末申告の獲得(earn)を 1回10枚・1日30枚で抑えている。
 * 1話10枚×12話=120枚の褒美は、一気に飛ばすと4話目から黙って消えていた。
 * そこで kind=tutorial の道を作り、話ごとに一度きり・枚数はサーバーが決める形にした。
 *
 * ここで見るのは**入口(worker)と端末の送り方**。台帳そのものは tools/check-wallet.mjs。
 *   - /api/wallet/tutorial-reward は「何話」だけを DO へ渡す(枚数も id も端末からは受け取らない)
 *   - 古い端末が earn に流す tutorial:<uid>:<話> は同じ道へ寄る(tutorial:local:N も含めて)
 *   - 話の番号として変なものは DO へ届かない
 *   - 端末は保留列に「何話」を積み、tutorial-reward へ送る。断られた形の誤りは捨て、通信の失敗は残す
 */
import assert from "node:assert/strict";

let ok = 0;
const fail = [];
const is = (label, got, want) => {
  try {
    assert.deepEqual(got, want);
    ok++;
    console.log(`  ok   ${label}`);
  } catch {
    fail.push(label);
    console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
  }
};

// ---- 入口(worker) ----
console.log("入口(worker)");
{
  const worker = (await import("../src/server/worker.js")).default;
  const TOKEN = "signed-player";
  // 認証の照会だけ偽物にする(check-admin.mjs と同じ)
  globalThis.fetch = async (_url, init) => {
    const token = JSON.parse(init.body).idToken;
    if (token === TOKEN) return Response.json({ users: [{ localId: "player-1" }] });
    return Response.json({ error: "invalid" }, { status: 400 });
  };
  let last = null;
  const env = {
    SEASONS: {
      idFromName: (n) => n,
      get: () => ({
        fetch: async (r) => {
          last = await r.json();
          return Response.json({ applied: true, tickets: 10 });
        },
      }),
    },
  };
  const post = (path, body) =>
    worker.fetch(
      new Request("https://game.example" + path, {
        method: "POST",
        headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
    );
  last = null;
  let res = await post("/api/wallet/tutorial-reward", { chapter: 3, n: 999, id: "tutorial:someone-else:3" });
  is("tutorial-reward は 200", res.status, 200);
  is("DO には op と何話だけが渡る(枚数と id は捨てる)", last, { op: "wallet-tutorial-reward", uid: "player-1", chapter: 3 });
  for (const bad of ["3", 1.5, -1, 0, 14, null, undefined]) {
    last = null;
    res = await post("/api/wallet/tutorial-reward", { chapter: bad });
    is(`変な話の番号(${JSON.stringify(bad)})は DO へ届かず 400`, [last, res.status, (await res.json()).error], [null, 400, "話の番号が正しくありません。"]);
  }
  last = null;
  res = await post("/api/wallet/earn", { id: "tutorial:local:5", n: 10 });
  is("古い端末の tutorial:local:N も同じ道へ(uid はサーバーが付け直す)", last, { op: "wallet-tutorial-reward", uid: "player-1", chapter: 5 });
  last = null;
  res = await post("/api/wallet/earn", { id: "tutorial:someone-else:7", n: 10 });
  is("古い端末の tutorial:<他人>:N も自分の話として扱う(id の uid は信じない)", last, { op: "wallet-tutorial-reward", uid: "player-1", chapter: 7 });
  last = null;
  res = await post("/api/wallet/earn", { id: "tutorial:local:14", n: 10 });
  is("古い端末でも 14 話は無いので DO へ届かず 400", [last, res.status], [null, 400]);
  last = null;
  res = await post("/api/wallet/earn", { id: "tutorial:local:13", n: 10 });
  is("古い端末の第13話(番外)は受け付ける", last, { op: "wallet-tutorial-reward", uid: "player-1", chapter: 13 });
  last = null;
  res = await post("/api/wallet/earn", { id: "login:2026-09-30", n: 1 });
  is("ふつうの earn は今まで通り", last, { op: "wallet-credit", uid: "player-1", id: "login:2026-09-30", n: 1, kind: "earn" });
  last = null;
  res = await worker.fetch(
    new Request("https://game.example/api/wallet/tutorial-reward", { method: "POST", body: JSON.stringify({ chapter: 1 }) }),
    env,
  );
  is("合言葉が無ければ 401", res.status, 401);
  is("合言葉が無ければ DO へ届かない", last, null);
  last = null;
  res = await worker.fetch(
    new Request("https://game.example/api/wallet/tutorial-reward", {
      method: "POST",
      headers: { Authorization: "Bearer forged-token", "Content-Type": "application/json" },
      body: JSON.stringify({ chapter: 1 }),
    }),
    env,
  );
  is("合言葉の照会に失敗すれば 401", res.status, 401);
  is("照会に失敗すれば DO へ届かない", last, null);
}


// ---- 端末の送り方(net/wallet.js) ----
console.log("\n端末の送り方");
{
  // localStorage と window の偽物(check-profile-sync.mjs と同じ作り)
  const mem = new Map([["tottery.auth.v1", JSON.stringify({ uid: "cli-user", refreshToken: "fixture-refresh" })]]);
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };
  globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  if (!globalThis.window) globalThis.window = globalThis;
  if (!globalThis.window.addEventListener) globalThis.window.addEventListener = () => {};
  if (!globalThis.window.dispatchEvent) globalThis.window.dispatchEvent = () => true;
  if (!globalThis.document) globalThis.document = { addEventListener() {}, visibilityState: "visible" };

  const calls = [];
  let mode = "ok"; // ok | offline | bad
  globalThis.fetch = async (url, init = {}) => {
    // node では seasonApiBase() が空なので相対 URL で来る。基底を足して読む
    const u = new URL(url, "https://game.example");
    if (u.hostname === "securetoken.googleapis.com" || u.hostname === "identitytoolkit.googleapis.com")
      return Response.json({ user_id: "cli-user", id_token: "cli-token", refresh_token: "fixture-refresh", expires_in: "3600", localId: "cli-user", idToken: "cli-token", refreshToken: "fixture-refresh", expiresIn: "3600" });
    if (u.pathname.startsWith("/api/wallet/")) {
      const body = init.body ? JSON.parse(init.body) : {};
      calls.push({ op: u.pathname.slice("/api/wallet/".length), body });
      if (mode === "offline") throw new TypeError("fetch failed");
      if (mode === "bad") return Response.json({ error: "話の番号が正しくありません。" }, { status: 400 });
      return Response.json({ applied: true, tickets: 10 });
    }
    return Response.json({}, { status: 404 });
  };
  const { earnTutorialTicket, flushPending } = await import("../src/net/wallet.js");
  const pending = () => JSON.parse(localStorage.getItem("tottery.wallet.pending.v1") || "[]");

  await earnTutorialTicket(3);
  is("tutorial-reward へ「何話」だけ送る", calls.map((c) => [c.op, c.body]), [["tutorial-reward", { chapter: 3 }]]);
  is("送れたら保留列から消える", pending(), []);
  is("id に uid は入っていない(tutorial:local: を二度と送らない)", calls.every((c) => !("id" in c.body)), true);

  calls.length = 0;
  mode = "offline";
  await earnTutorialTicket(4);
  is("圏外でも送ろうとする", calls.map((c) => c.op), ["tutorial-reward"]);
  is("圏外なら保留列に残る", pending().map((e) => e.tutorial), [4]);
  await earnTutorialTicket(4);
  is("同じ話は二度積まない", pending().map((e) => e.tutorial), [4]);
  calls.length = 0;
  mode = "ok";
  await flushPending();
  is("戻ったら残っていた分を送る", calls.map((c) => c.body.chapter), [4]);
  is("送れたら消える", pending(), []);

  calls.length = 0;
  mode = "bad";
  await earnTutorialTicket(2);
  is("形の誤りで断られたものは捨てる(残しても二度と通らない)", pending(), []);

  calls.length = 0;
  mode = "ok";
  await earnTutorialTicket(1.5);
  await earnTutorialTicket("3");
  await earnTutorialTicket(0);
  is("話の番号でないものは送らない", calls.length, 0);

  // 端末の入口(tutorial-reward.js)から末端まで。0 と 13 は捨て、2 だけ送る
  const { grantTutorialTickets } = await import("../src/game/tutorial-reward.js");
  calls.length = 0;
  const amount = await grantTutorialTickets([0, 14, 2, 2]);
  is("褒美の入口は正しい話だけを数える", amount, 10);
  is("正しい話だけ送る", calls.map((c) => [c.op, c.body.chapter]), [["tutorial-reward", 2]]);

  // 取りこぼしの回収: profile.cleared にある話を一度だけ全部送り直す
  const { backfillTutorialRewards, BACKFILL_KEY } = await import("../src/game/tutorial-reward.js");
  mem.set("tottery.profile.v1", JSON.stringify({ name: "回収", cleared: [1, 2, 5, 5, 0, 14] }));
  calls.length = 0;
  is("終えた話を全部送り直す(変な番号と重複は落とす)", await backfillTutorialRewards(), 3);
  is("送るのは tutorial-reward", calls.map((c) => [c.op, c.body.chapter]), [["tutorial-reward", 1], ["tutorial-reward", 2], ["tutorial-reward", 5]]);
  is("控えが立つ", localStorage.getItem(BACKFILL_KEY), "1");
  calls.length = 0;
  is("二度目は送らない", await backfillTutorialRewards(), 0);
  is("二度目は通信しない", calls.length, 0);
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
