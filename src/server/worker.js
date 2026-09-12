import { API_KEY, OPERATOR_UID } from "../net/auth.js";
import { DB_URL } from "../net/firebase.js";
import { Ledger } from "./ledger.js";
import { verifyMatch } from "./verify-match.js";
import { Wallet } from "./wallet.js";
import { verifyAppleTransaction } from "./applejws.js";
import { seasonAt, seasonRewards } from "../game/season.js";

const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
/**
 * iOS アプリ(Capacitor)は capacitor://localhost から呼ぶので、同じオリジンではない。
 * この2つの由来にだけ CORS を返す(Web は同じオリジンなので要らない)。
 * 運営の口(/api/admin/*)はアプリに入れないので対象外
 */
const APP_ORIGINS = new Set(["capacitor://localhost", "ionic://localhost"]);
export function withCors(res, request) {
  const origin = request.headers.get("origin");
  if (!origin || !APP_ORIGINS.has(origin)) return res;
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Max-Age", "600");
  headers.append("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers });
}
const remote = (url, init = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(7000) });
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    // iOS アプリからの事前確認(preflight)。シーズンの口だけ
    if (
      request.method === "OPTIONS" &&
      /^\/api\/(season|wallet|iap)\//.test(url.pathname)
    )
      return withCors(new Response(null, { status: 204 }), request);
    return withCors(await handleApi(request, env, url), request);
  },
};
async function handleApi(request, env, url) {
  {
    if (url.pathname === "/api/season/health" && request.method === "GET")
      return json({ ok: true, version: 1, season: seasonAt() });
    const adminSession = url.pathname === "/api/admin/session";
    const adminSeason = url.pathname === "/api/admin/season";
    const adminWallet = url.pathname === "/api/admin/wallet";
    if (
      !adminSession &&
      !adminSeason &&
      !adminWallet &&
      !/^\/api\/(season|wallet|iap)\//.test(url.pathname)
    )
      return json({ error: "見つかりません。" }, 404);
    if (request.method !== "POST")
      return json({ error: "POSTを使用してください。" }, 405);
    try {
      if (Number(request.headers.get("content-length") || 0) > 4096)
        return json({ error: "リクエストが大きすぎます。" }, 413);
      const raw = await request.text();
      if (raw.length > 4096)
        return json({ error: "リクエストが大きすぎます。" }, 413);
      const body = JSON.parse(raw || "{}");
      const token = request.headers
        .get("authorization")
        ?.match(/^Bearer (\S+)$/)?.[1];
      if (!token || token.length > 4096)
        return json({ error: "本人確認が必要です。" }, 401);
      const auth = await remote(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        },
      );
      if (!auth.ok)
        return json({ error: "本人確認をやり直してください。" }, 401);
      const uid = (await auth.json()).users?.[0]?.localId;
      if (!uid) return json({ error: "本人確認ができませんでした。" }, 401);
      if (adminSession)
        return uid === OPERATOR_UID
          ? json({ uid })
          : json({ error: "運営権限がありません。" }, 403);
      if ((adminSeason || adminWallet) && uid !== OPERATOR_UID)
        return json({ error: "運営権限がありません。" }, 403);
      const ledger = env.SEASONS.get(env.SEASONS.idFromName("monthly-v1"));
      const call = (op, args = {}) =>
        ledger.fetch(
          new Request("https://ledger/", {
            method: "POST",
            body: JSON.stringify({ op, uid, ...args }),
          }),
        );
      if (adminSeason) {
        return call("admin-summary");
      }
      // 未使用残高(資金決済法の集計)。運営だけ
      if (adminWallet) return call("admin-unused");
      // ---- 財布(サーバー側のチケット残高)と課金 ----
      // 出来事の id は端末が作る(やり直しで二重にならない)。形だけここで見る
      const eventId = (x) => (typeof x === "string" && /^[\w:.-]{1,128}$/.test(x) ? x : null);
      if (url.pathname.startsWith("/api/wallet/")) {
        const wop = url.pathname.slice("/api/wallet/".length);
        if (wop === "summary") return call("wallet-summary");
        if (wop === "debit" && eventId(body.id) && Number.isSafeInteger(body.n) && body.n > 0 && body.n <= 100)
          return call("wallet-debit", { id: body.id, n: body.n, kind: "pull" });
        if (wop === "earn" && eventId(body.id) && Number.isSafeInteger(body.n) && body.n > 0)
          return call("wallet-credit", { id: body.id, n: body.n, kind: "earn" });
        // 無償ジェム(ミッションや手紙、バトルパスの完成)。端末の申告なので上限つき
        if (wop === "earn-gems" && eventId(body.id) && Number.isSafeInteger(body.gems) && body.gems > 0)
          return call("wallet-earn-gems", { id: body.id, gems: body.gems });
        if (wop === "migrate" && Number.isSafeInteger(body.tickets) && body.tickets >= 0)
          return call("wallet-migrate", { tickets: body.tickets });
        if (wop === "exchange" && eventId(body.id) && Number.isSafeInteger(body.tickets) && body.tickets > 0 && body.tickets <= 100)
          return call("wallet-exchange", { id: body.id, tickets: body.tickets });
        if (wop === "buy-pass" && eventId(body.id))
          return call("wallet-buypass", { id: body.id });
        // バトルパスのマスをクリアした報酬(チケット1枚)。所持者だけ・週の上限はサーバーが数える
        if (wop === "pass-reward" && eventId(body.id))
          return call("wallet-pass-reward", { id: body.id });
        // 広告を1本見た報酬(チケット1枚)。1日の上限はサーバーが数える
        if (wop === "ad-reward" && eventId(body.id))
          return call("wallet-ad-reward", { id: body.id });
        return json({ error: "見つかりません。" }, 404);
      }
      if (url.pathname === "/api/iap/verify") {
        // Apple の署名は非同期に検証し、通ったものだけを台帳(同期)へ渡す
        let tx;
        try {
          tx = await verifyAppleTransaction(body.jws);
        } catch (e) {
          return json({ error: e.message }, 400);
        }
        return call("wallet-purchase", {
          tx: {
            transactionId: tx.transactionId,
            productId: tx.productId,
            environment: tx.environment,
            purchaseDate: tx.purchaseDate,
          },
        });
      }
      if (url.pathname.startsWith("/api/iap/"))
        return json({ error: "見つかりません。" }, 404);
      const op = url.pathname.slice("/api/season/".length);
      if (op === "finish") {
        if (
          !/^[A-Z0-9]{4,10}$/i.test(body.code || "") ||
          !Number.isSafeInteger(body.createdAt) ||
          !Number.isInteger(body.round) ||
          body.round < 0 ||
          body.round > 10000
        )
          return json({ error: "対局の指定が正しくありません。" }, 400);
        const id = `${body.code}:${body.createdAt}:${body.round}`;
        const prior = await call("result", { id });
        if (!prior.ok) return prior;
        if ((await prior.json()).match) return call("summary");
        const res = await remote(
          `${DB_URL}/rooms/${body.code}.json?auth=${encodeURIComponent(token)}`,
        );
        if (!res.ok)
          return json({ error: "対局の記録を読み込めませんでした。" }, 409);
        return call("record", { room: await res.json(), request: body });
      }
      if (op === "summary") return call("summary");
      // 自分のシーズン記録を消す(5.1.1(v))。本文は要らない
      if (op === "forget") return call("forget");
      if (op === "claim" && typeof body.id === "string")
        return call("claim", { id: body.id });
      if (op === "equip")
        return call("equip", {
          back: body.back ?? null,
          frame: body.frame ?? null,
        });
      if (
        op === "appearance" &&
        Array.isArray(body.uids) &&
        body.uids.length <= 2 &&
        body.uids.every(
          (x) => typeof x === "string" && /^[\w-]{1,128}$/.test(x),
        )
      )
        return call("appearance", { uids: body.uids });
      return json({ error: "見つかりません。" }, 404);
    } catch (e) {
      // 外部通信例外には認証 URL が含まれる可能性があるので本文・ログへ出さない。
      const known = /^(この対局|対局|通常の9×9)/.test(e.message || "");
      return json(
        {
          error: known ? e.message : "通信を確認して、もう一度お試しください。",
        },
        409,
      );
    }
  }
}
export class SeasonLedger {
  constructor(ctx) {
    this.ctx = ctx;
    const sql = (query, ...params) =>
      ctx.storage.sql.exec(query, ...params).toArray();
    this.ledger = new Ledger(sql);
    this.wallet = new Wallet(sql);
  }
  async fetch(request) {
    const { op, uid, ...args } = await request.json(),
      now = Date.now();
    try {
      const data = this.ctx.storage.transactionSync(() => {
        const l = this.ledger;
        if (op === "result") return { match: l.result(uid, args.id) };
        if (op === "record") {
          const match = verifyMatch(args.room, args.request, uid);
          l.record(match, now);
          return l.summary(uid, now);
        }
        if (op === "summary") return l.summary(uid, now);
        if (op === "admin-summary" && uid === OPERATOR_UID)
          return l.adminSummary(now);
        if (op === "forget") {
          this.wallet.forget(uid);
          return l.forget(uid);
        }
        const w = this.wallet;
        if (op === "wallet-summary") return w.summary(uid, now);
        if (op === "wallet-debit") return w.debit(uid, args.id, args.n, args.kind, now);
        if (op === "wallet-credit") return w.credit(uid, args.id, args.n, args.kind, now);
        if (op === "wallet-purchase") return w.purchase(uid, args.tx, now);
        if (op === "wallet-migrate") return w.migrate(uid, args.tickets, now);
        if (op === "wallet-earn-gems") return w.earnGems(uid, args.id, args.gems, now);
        if (op === "wallet-exchange") return w.exchange(uid, args.id, args.tickets, now);
        if (op === "wallet-buypass") return w.buyPass(uid, args.id, now);
        if (op === "wallet-pass-reward") return w.passReward(uid, args.id, now);
        if (op === "wallet-ad-reward") return w.adReward(uid, args.id, now);
        if (op === "admin-unused" && uid === OPERATOR_UID) return w.unused();
        if (op === "claim") {
          // 初めて受け取るときだけ、報酬のチケットをその場で財布へ(端末を信じない)。
          // 以前に端末で受け取った分は引き継ぎで来るので、ここで二度は足さない
          const had = l.sql("SELECT 1 FROM claims WHERE uid=? AND id=?", uid, args.id)[0];
          const r = l.claim(uid, args.id, now);
          const reward = seasonRewards(String(args.id).slice(0, 7)).find((x) => x.id === args.id);
          if (!had && reward && reward.tickets)
            this.wallet.credit(uid, `season:${args.id}`, reward.tickets, "season", now);
          return { ...r, wallet: this.wallet.summary(uid) };
        }
        if (op === "equip") return l.equip(uid, args.back, args.frame, now);
        if (op === "appearance")
          return Object.fromEntries(
            args.uids.map((id) => [id, l.appearance(id)]),
          );
        throw new Error("操作が見つかりません。");
      });
      return json(data);
    } catch (e) {
      return json({ error: e.message }, 400);
    }
  }
}
