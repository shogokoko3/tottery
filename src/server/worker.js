import { API_KEY, OPERATOR_UID } from "../net/auth.js";
import { DB_URL } from "../net/firebase.js";
import { Ledger } from "./ledger.js";
import { verifyMatch } from "./verify-match.js";
import { seasonAt } from "../game/season.js";

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
      url.pathname.startsWith("/api/season/")
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
    if (
      !adminSession &&
      !adminSeason &&
      !url.pathname.startsWith("/api/season/")
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
      if (adminSeason && uid !== OPERATOR_UID)
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
    this.ledger = new Ledger((query, ...params) =>
      ctx.storage.sql.exec(query, ...params).toArray(),
    );
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
        if (op === "forget") return l.forget(uid);
        if (op === "claim") return l.claim(uid, args.id, now);
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
