import { API_KEY, OPERATOR_UID } from "../net/auth.js";

/** 購入の検証の本文の上限。applejws.js が受ける JWS(16384)+包み */
export const VERIFY_BODY_MAX = 20480;
/** 引き継ぎの控えを預かるときの本文の上限。控え本体(BACKUP_MAX)に JSON の外枠を足した分 */
export const BACKUP_BODY_MAX = BACKUP_MAX + 1024;
import { DB_URL } from "../net/firebase.js";
import { Ledger } from "./ledger.js";
import { verifyMatch } from "./verify-match.js";
import { Wallet, BACKUP_MAX } from "./wallet.js";
import { verifyAppleTransaction } from "./applejws.js";
import { minAppBuild, updateUrl } from "./app-version.js";
import { seasonAt, seasonRewards } from "../game/season.js";
import { BOT_UNTIL_RATING } from "../game/bot-match.js";
import { Friends } from "./friends.js";

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
      /^\/api\/(season|wallet|iap|friends)\//.test(url.pathname)
    )
      return withCors(new Response(null, { status: 204 }), request);
    return withCors(await handleApi(request, env, url), request);
  },
};
async function handleApi(request, env, url) {
  {
    if (url.pathname === "/api/season/health" && request.method === "GET")
      return json({ ok: true, version: 1, season: seasonAt() });
    // 強制アップデートの最低ビルド番号(公開GET)。アプリが起動時に読む。0=ブロックしない
    if (url.pathname === "/api/app-version" && request.method === "GET")
      return json({ minBuild: minAppBuild(env), storeUrl: updateUrl(env) });
    const adminSession = url.pathname === "/api/admin/session";
    const adminSeason = url.pathname === "/api/admin/season";
    const adminWallet = url.pathname === "/api/admin/wallet";
    const adminGrant = url.pathname === "/api/admin/grant";
    const adminPurchases = url.pathname === "/api/admin/purchases";
    const adminGacha = url.pathname === "/api/admin/gacha";
    // 店の診断の一覧。運営の Firebase トークンか、読み取り専用の秘密(DIAG_TOKEN。wrangler secret)で読める
    const adminDiag = url.pathname === "/api/admin/diag";
    const adminPass = url.pathname === "/api/admin/pass-complete";
    // 運営: 指定した uid のシーズン記録をまとめて消す(テストプレイヤーの片付け。2026-09-23 本人の指示)
    const adminForget = url.pathname === "/api/admin/season-forget";
    if (
      !adminSession &&
      !adminSeason &&
      !adminWallet &&
      !adminGrant &&
      !adminPurchases &&
      !adminGacha &&
      !adminDiag &&
      !adminPass &&
      !adminForget &&
      !/^\/api\/(season|wallet|iap|friends)\//.test(url.pathname)
    )
      return json({ error: "見つかりません。" }, 404);
    if (request.method !== "POST")
      return json({ error: "POSTを使用してください。" }, 405);
    try {
      // 本文の上限。購入の検証だけは Apple の取引(JWS。証明書3枚つきで 6KB ほど)が入るので広い
      // (2026-09-15、実機の購入が 413 で弾かれ「反映待ち」のまま残った)
      const maxBody =
        url.pathname === "/api/iap/verify"
          ? VERIFY_BODY_MAX
          : // 引き継ぎの控え(端末の記録ぜんぶ)は大きい
            url.pathname === "/api/wallet/backup-save"
            ? BACKUP_BODY_MAX
            : 4096;
      if (Number(request.headers.get("content-length") || 0) > maxBody)
        return json({ error: "リクエストが大きすぎます。" }, 413);
      const raw = await request.text();
      if (raw.length > maxBody)
        return json({ error: "リクエストが大きすぎます。" }, 413);
      const body = JSON.parse(raw || "{}");
      const token = request.headers
        .get("authorization")
        ?.match(/^Bearer (\S+)$/)?.[1];
      if (!token || token.length > 4096)
        return json({ error: "本人確認が必要です。" }, 401);
      // 診断の一覧だけは、秘密のトークン(読み取り専用)でも通す。運営が手元の curl で読むため
      if (adminDiag && env.DIAG_TOKEN && token.length >= 32 && token === env.DIAG_TOKEN) {
        const ledger0 = env.SEASONS.get(env.SEASONS.idFromName("monthly-v1"));
        return ledger0.fetch(new Request("https://ledger/", { method: "POST", body: JSON.stringify({ op: "admin-diag", uid: OPERATOR_UID }) }));
      }
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
      if (
        (adminSeason || adminWallet || adminGrant || adminPurchases || adminGacha || adminDiag || adminPass || adminForget) &&
        uid !== OPERATOR_UID
      )
        return json({ error: "運営権限がありません。" }, 403);
      const ledger = env.SEASONS.get(env.SEASONS.idFromName("monthly-v1"));
      const call = (op, args = {}) =>
        ledger.fetch(
          new Request("https://ledger/", {
            method: "POST",
            // uid は最後に置く。args に uid の名の値が混ざっても本人の uid を上書きできない
            // (フレンドの相手を uid の名で渡して承認が効かなかった。2026-09-24)
            body: JSON.stringify({ op, ...args, uid }),
          }),
        );
      if (adminSeason) {
        return call("admin-summary");
      }
      // 運営: uid の一覧(200件まで)のシーズン記録を、本人の「自分の記録を消す」と同じ手順で消す。
      // 財布(wallet)は触らない(テストプレイヤーには無い。実際の人を間違えて指しても課金の記録は残る)
      if (adminForget) {
        const uids = Array.isArray(body.uids)
          ? body.uids.filter((x) => typeof x === "string" && /^[\w-]{1,128}$/.test(x)).slice(0, 200)
          : [];
        if (!uids.length) return json({ error: "uids を指定してください。" }, 400);
        return call("admin-forget", { uids });
      }
      // 未使用残高(資金決済法の集計)。運営だけ
      if (adminWallet) return call("admin-unused");
      // 運営: 手動付与・購入履歴・ガチャ履歴。相手の uid は body.uid
      if (adminGrant)
        return call("admin-grant", { targetUid: body.uid, tickets: body.tickets, gemsFree: body.gemsFree, id: body.id });
      if (adminPurchases) return call("admin-purchases", { targetUid: body.uid });
      if (adminGacha) return call("admin-gacha", { targetUid: body.uid });
      if (adminDiag) return call("admin-diag");
      if (adminPass) return call("admin-pass-complete", { targetUid: body.uid });
      // ---- 財布(サーバー側のチケット残高)と課金 ----
      // 出来事の id は端末が作る(やり直しで二重にならない)。形だけここで見る
      const eventId = (x) => (typeof x === "string" && /^[\w:.-]{1,128}$/.test(x) ? x : null);
      if (url.pathname.startsWith("/api/wallet/")) {
        const wop = url.pathname.slice("/api/wallet/".length);
        if (wop === "summary") return call("wallet-summary");
        // 機種変更の引き継ぎ。端末の記録の控えを預かる・返す(中身は見ない)
        if (wop === "backup-save" && typeof body.blob === "string" && body.blob.length <= BACKUP_MAX)
          return call("wallet-backup-save", { blob: body.blob });
        if (wop === "backup-load") return call("wallet-backup-load");
        // 所持一覧を本人の保存分として同期する。購入条件は財布側で全種類を照合する。
        // 端末保存が現行の取得元であり、この同期を取得証明とは扱わない。
        if (wop === "collection" && Array.isArray(body.ownedIds))
          return call("wallet-collection", { ownedIds: body.ownedIds });
        if (wop === "debit" && eventId(body.id) && Number.isSafeInteger(body.n) && body.n > 0 && body.n <= 100)
          return call("wallet-debit", { id: body.id, n: body.n, kind: "pull" });
        // サーバーが引く(2026-09-18)。debit は配布済みのビルドが使うので残す
        if (wop === "pull" && eventId(body.id) && (body.n === 1 || body.n === 10))
          return call("wallet-pull", { id: body.id, n: body.n });
        if (wop === "earn" && eventId(body.id) && Number.isSafeInteger(body.n) && body.n > 0)
          return call("wallet-credit", { id: body.id, n: body.n, kind: "earn" });
        // 記念配布(src/game/campaigns.js)。枚数はサーバーが台帳から読む。uid ごとに一度きり
        if (wop === "campaign" && typeof body.campaign === "string" && /^[\w.-]{1,64}$/.test(body.campaign))
          return call("wallet-campaign", { campaign: body.campaign });
        // 無償ジェム(ミッションや手紙、バトルパスの完成)。端末の申告なので上限つき
        if (wop === "earn-gems" && eventId(body.id) && Number.isSafeInteger(body.gems) && body.gems > 0)
          return call("wallet-earn-gems", { id: body.id, gems: body.gems });
        if (wop === "migrate" && Number.isSafeInteger(body.tickets) && body.tickets >= 0)
          return call("wallet-migrate", { tickets: body.tickets });
        if (wop === "exchange" && eventId(body.id) && Number.isSafeInteger(body.tickets) && body.tickets > 0 && body.tickets <= 100)
          return call("wallet-exchange", { id: body.id, tickets: body.tickets });
        // 無償ジェムをエーテルに(無償だけ)。量はカタログの決まり
        if (wop === "ether" && eventId(body.id) && Number.isSafeInteger(body.gems) && body.gems > 0 && body.gems <= 1000)
          return call("wallet-ether", { id: body.id, gems: body.gems });
        // フォイルの直接購入(有償ジェムだけ)。値段は財布がカタログから決める
        if (
          wop === "foil" &&
          typeof body.product === "string" && /^[\w-]{1,32}$/.test(body.product) &&
          Array.isArray(body.skins) && body.skins.length >= 1 && body.skins.length <= 4 &&
          body.skins.every((x) => typeof x === "string" && /^[\w-]{1,40}$/.test(x))
        )
          return call("wallet-foil", { product: body.product, skins: body.skins });
        if (wop === "buy-pass" && eventId(body.id))
          return call("wallet-buypass", { id: body.id });
        // バトルパスのマスをクリアした報酬(チケット1枚)。所持者だけ・週の上限はサーバーが数える
        if (wop === "pass-reward" && eventId(body.id))
          return call("wallet-pass-reward", { id: body.id });
        // 広告を1本見た報酬(チケット1枚)。1日の上限はサーバーが数える
        if (wop === "ad-reward" && eventId(body.id))
          return call("wallet-ad-reward", { id: body.id });
        // ガチャの結果を記録(運営の履歴用)。端末の申告。残高は動かさない
        if (wop === "log-pull" && Array.isArray(body.items))
          return call("wallet-log-pull", { items: body.items.slice(0, 20) });
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
      // 店の診断(端末の申告)。商品の問い合わせの結果を控える。値の切り詰めは財布側
      if (url.pathname === "/api/iap/diag" && body.diag && typeof body.diag === "object")
        return call("wallet-diag", { diag: body.diag });
      if (url.pathname.startsWith("/api/iap/"))
        return json({ error: "見つかりません。" }, 404);
      // ---- フレンドとプロフィール(2026-09-23 本人の指示) ----
      // 相手は uid(申請だけはフレンド ID)。形だけここで見て、決まりは Durable Object(src/server/friends.js)が守る
      if (url.pathname.startsWith("/api/friends/")) {
        const fop = url.pathname.slice("/api/friends/".length);
        const who = (x) => (typeof x === "string" && /^[\w-]{1,128}$/.test(x) ? x : null);
        if (fop === "state") return call("friends-state");
        if (fop === "request" && typeof body.code === "string" && body.code.length <= 16)
          return call("friends-request", { code: body.code });
        // 対戦した相手・ランキングの人へ、uid で申請する(2026-09-24)。相手の受付の設定は DO が見る
        if (fop === "request" && who(body.uid) && (body.source === "match" || body.source === "rank"))
          return call("friends-request-uid", { target: body.uid, source: body.source });
        // 相手は target で渡す。call() は { op, uid, ...args } なので、uid の名で渡すと本人の uid を上書きしてしまう
        // (承認しても申請が残る不具合の原因。2026-09-24 本人の報告)
        if (fop === "accept" && who(body.uid)) return call("friends-accept", { target: body.uid });
        if (fop === "decline" && who(body.uid)) return call("friends-decline", { target: body.uid });
        if (fop === "cancel" && who(body.uid)) return call("friends-cancel", { target: body.uid });
        if (fop === "remove" && who(body.uid)) return call("friends-remove", { target: body.uid });
        if (fop === "gift" && who(body.uid)) return call("friends-gift", { target: body.uid });
        if (fop === "claim") return call("friends-claim");
        if (fop === "invite" && who(body.uid) && typeof body.code === "string" && body.code.length <= 16)
          return call("friends-invite", { target: body.uid, code: body.code });
        if (fop === "cancel-invite" && who(body.uid)) return call("friends-cancel-invite", { target: body.uid });
        if (fop === "enter-room" && typeof body.code === "string" && body.code.length <= 16)
          return call("friends-enter-room", { code: body.code, online: body.online === true, opp: typeof body.opp === "string" ? body.opp.slice(0, 20) : "" });
        if (fop === "leave-room") return call("friends-leave-room");
        if (fop === "profile-set" && body.card && typeof body.card === "object")
          return call("friends-profile-set", { card: body.card });
        if (fop === "profile-get" && who(body.uid)) return call("friends-profile-get", { target: body.uid });
        return json({ error: "見つかりません。" }, 404);
      }
      const op = url.pathname.slice("/api/season/".length);
      // Bot(ランダムマッチの練習相手)との対局(2026-09-23 本人の指示)。部屋が無いので手順は確かめられない。
      // 相手の点は台帳が本人の点と同じとみなし(端末の言い値は読まない)、本人が 1750 以上なら数えない
      if (op === "finish" && body.bot === true) {
        if (
          typeof body.id !== "string" ||
          !/^[\w:-]{4,80}$/.test(body.id) ||
          ![0, 1, null].includes(body.winner)
        )
          return json({ error: "対局の指定が正しくありません。" }, 400);
        const name =
          typeof body.name === "string" && body.name.trim().length >= 1
            ? body.name.trim().slice(0, 10)
            : "名無し";
        const icon =
          typeof body.icon === "string" && /^[\w-]{1,32}$/.test(body.icon) ? body.icon : null;
        return call("record-bot", { id: body.id, winner: body.winner, name, icon });
      }
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
    this.friends = new Friends(sql);
  }
  async fetch(request) {
    const { op, uid, ...args } = await request.json(),
      now = Date.now();
    try {
      const data = this.ctx.storage.transactionSync(() => {
        const l = this.ledger;
        // 財布は先に束ねておく。フレンドの贈り物の受け取り(friends-claim)が w を使うので、
        // ここより後で const 宣言すると初期化前アクセスで落ちていた(受け取れないバグ。2026-09-24 本人の報告)
        const w = this.wallet;
        if (op === "result") return { match: l.result(uid, args.id) };
        if (op === "record") {
          const match = verifyMatch(args.room, args.request, uid);
          l.record(match, now);
          return l.summary(uid, now);
        }
        if (op === "summary") return l.summary(uid, now);
        if (op === "record-bot") {
          l.recordBot(uid, args, now, BOT_UNTIL_RATING);
          return l.summary(uid, now);
        }
        if (op === "admin-summary" && uid === OPERATOR_UID)
          return l.adminSummary(now);
        if (op === "admin-forget" && uid === OPERATOR_UID) {
          const done = [];
          for (const target of args.uids || []) {
            l.forget(target);
            done.push(target);
          }
          return { ok: true, forgotten: done.length, uids: done };
        }
        if (op === "forget") {
          this.wallet.forget(uid);
          this.friends.forget(uid);
          return l.forget(uid);
        }
        // ---- フレンドとプロフィール(src/server/friends.js) ----
        const fr = this.friends;
        // 持ち点は台帳から足す(端末の言い値は読まない)。今月の行が無ければ前月からの持ち越し
        const ratingOf = (id) => l.playerRow(id, l.current(now).id).rating;
        const withRating = (tag) => ({ ...tag, rating: ratingOf(tag.uid) });
        if (op === "friends-state") {
          const st = fr.state(uid, now);
          return {
            ...st,
            friends: st.friends.map(withRating),
            requestsIn: st.requestsIn.map(withRating),
            requestsOut: st.requestsOut.map(withRating),
          };
        }
        if (op === "friends-request") return fr.request(uid, args.code, now, "code");
        if (op === "friends-request-uid") return fr.requestUid(uid, args.target, now, args.source);
        if (op === "friends-accept") return fr.accept(uid, args.target, now);
        if (op === "friends-decline") return fr.decline(uid, args.target);
        if (op === "friends-cancel") return fr.cancel(uid, args.target);
        if (op === "friends-remove") return fr.remove(uid, args.target);
        if (op === "friends-gift") return fr.gift(uid, args.target, now);
        if (op === "friends-claim") {
          // 受け取った贈り物は id ごとに1枚(同じ id は財布が二度足さない)
          const list = fr.claimGifts(uid, now);
          for (const g of list) w.credit(uid, g.id, 1, "friend-gift", now);
          return { claimed: list.map((g) => ({ ...g, from: fr.tag(g.fromUid) })), wallet: w.summary(uid, now) };
        }
        if (op === "friends-invite") return fr.invite(uid, args.target, args.code, now);
        if (op === "friends-cancel-invite") return fr.cancelInvite(uid, args.target);
        // 対戦中の在席(観戦できる部屋をフレンドに知らせる)。設定でオンにした人だけが打つ
        if (op === "friends-enter-room") return fr.enterRoom(uid, args.code, args.online, args.opp, now);
        if (op === "friends-leave-room") return fr.leaveRoom(uid);
        if (op === "friends-profile-set") return fr.setProfile(uid, args.card, now);
        if (op === "friends-profile-get") {
          // 他人のプロフィールはフレンドだけ。自分のはいつでも
          if (args.target !== uid && !fr.isFriend(uid, args.target)) throw new Error("フレンドのプロフィールだけ見られます。");
          const card = fr.profileOf(args.target);
          const season = l.current(now).id;
          const row = l.playerRow(args.target, season);
          const player = l.list(season).find((p) => p.uid === args.target) || null;
          return {
            uid: args.target,
            card,
            rating: row.rating,
            place: player?.place || null,
            best: player?.best || null,
            rated: player?.rated || 0,
            appearance: l.appearance(args.target),
            friend: args.target === uid || fr.isFriend(uid, args.target),
          };
        }
        if (op === "wallet-summary") return w.summary(uid, now);
        if (op === "wallet-backup-save") return w.saveBackup(uid, args.blob, now);
        if (op === "wallet-backup-load") return w.loadBackup(uid);
        if (op === "wallet-debit") return w.debit(uid, args.id, args.n, args.kind, now);
        if (op === "wallet-pull") return w.pull(uid, args.id, args.n, now);
        if (op === "wallet-credit") return w.credit(uid, args.id, args.n, args.kind, now);
        if (op === "wallet-campaign") return w.campaign(uid, args.campaign, now);
        if (op === "wallet-purchase") return w.purchase(uid, args.tx, now);
        if (op === "wallet-migrate") return w.migrate(uid, args.tickets, now);
        if (op === "wallet-earn-gems") return w.earnGems(uid, args.id, args.gems, now);
        if (op === "wallet-exchange") return w.exchange(uid, args.id, args.tickets, now);
        if (op === "wallet-foil") return w.buyFoil(uid, args.product, args.skins, now);
        if (op === "wallet-collection") return w.syncCollection(uid, args.ownedIds, now);
        if (op === "wallet-ether") return w.buyEther(uid, args.id, args.gems, now);
        if (op === "wallet-buypass") return w.buyPass(uid, args.id, now);
        if (op === "wallet-pass-reward") return w.passReward(uid, args.id, now);
        if (op === "wallet-ad-reward") return w.adReward(uid, args.id, now);
        if (op === "wallet-log-pull") return w.logGacha(uid, args.items, now);
        if (op === "wallet-diag") return w.logDiag(uid, args.diag, now);
        if (op === "admin-diag" && uid === OPERATOR_UID) return w.diagList();
        if (op === "admin-pass-complete" && uid === OPERATOR_UID) return w.adminPassComplete(args.targetUid, now);
        if (op === "admin-unused" && uid === OPERATOR_UID) return w.unused();
        if (op === "admin-grant" && uid === OPERATOR_UID)
          return w.adminGrant(args.targetUid, { tickets: args.tickets, gemsFree: args.gemsFree }, args.id, now);
        if (op === "admin-purchases" && uid === OPERATOR_UID)
          return w.purchaseHistory(args.targetUid);
        if (op === "admin-gacha" && uid === OPERATOR_UID)
          return w.gachaHistory(args.targetUid);
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
            args.targets.map((id) => [id, l.appearance(id)]),
          );
        throw new Error("操作が見つかりません。");
      });
      return json(data);
    } catch (e) {
      return json({ error: e.message }, 400);
    }
  }
}
