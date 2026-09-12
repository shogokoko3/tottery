/**
 * サーバー側の財布。uid ごとのチケット残高と、買い切りの権利。
 *
 * 決まり:
 *  - 加算も減算も「出来事の id」で冪等にする(同じ id は二度効かない)。通信の
 *    やり直しで二重に増えたり減ったりしない
 *  - 減算は残高を超えない(足りなければ失敗して残高は動かない)
 *  - 購入は Apple の取引 ID で冪等。チケットは世界で一度だけ加算、買い切りの権利は
 *    Apple が所有を証明するので、復元した uid にも渡す
 *  - 端末にあった分の引き継ぎは uid ごとに一度きり。上限つき(端末の値は信じきれない)
 * SQL は既存の Ledger と同じ口(query, ...params) => rows で受ける。
 */
import { productOf } from "../iap/catalog.js";

export const MIGRATE_TICKETS_MAX = 500;
/** 遊んで貯める分(kind=earn)は端末の申告なので、1回と1日(UTC)の上限で抑える */
export const EARN_EVENT_MAX = 10;
export const EARN_DAILY_MAX = 30;
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
const cap = (n, max) => (Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : 0);

export class Wallet {
  constructor(sql) {
    this.sql = sql;
    sql("CREATE TABLE IF NOT EXISTS wallets (uid TEXT PRIMARY KEY, tickets INTEGER NOT NULL, updated INTEGER)");
    sql("CREATE TABLE IF NOT EXISTS wallet_events (id TEXT PRIMARY KEY, uid TEXT, delta INTEGER, kind TEXT, ref TEXT, at INTEGER)");
    sql("CREATE INDEX IF NOT EXISTS wallet_events_uid ON wallet_events(uid, at)");
    sql("CREATE TABLE IF NOT EXISTS purchases (transactionId TEXT PRIMARY KEY, uid TEXT, productId TEXT, environment TEXT, purchasedAt INTEGER, grantedAt INTEGER)");
    sql("CREATE TABLE IF NOT EXISTS entitlements (uid TEXT, productId TEXT, transactionId TEXT, at INTEGER, PRIMARY KEY(uid, productId))");
    sql("CREATE TABLE IF NOT EXISTS migrations (uid TEXT PRIMARY KEY, tickets INTEGER, at INTEGER)");
  }
  balance(uid) {
    const row = this.sql("SELECT tickets FROM wallets WHERE uid=?", uid)[0];
    return row ? row.tickets : 0;
  }
  entitlementsOf(uid) {
    return this.sql("SELECT productId FROM entitlements WHERE uid=?", uid).map((r) => r.productId);
  }
  summary(uid) {
    return { tickets: this.balance(uid), entitlements: this.entitlementsOf(uid) };
  }
  /** 出来事 id で冪等に増減する。減らす場合は残高を超えない */
  apply(uid, id, delta, kind, ref, now) {
    if (typeof id !== "string" || !/^[\w:.-]{1,128}$/.test(id))
      throw new Error("出来事の id が正しくありません。");
    if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 100000)
      throw new Error("枚数が正しくありません。");
    const seen = this.sql("SELECT uid FROM wallet_events WHERE id=?", id)[0];
    if (seen) {
      if (seen.uid !== uid) throw new Error("他の人の出来事です。");
      return { applied: false, tickets: this.balance(uid) };
    }
    if (kind === "earn") {
      if (delta < 0 || delta > EARN_EVENT_MAX) throw new Error("枚数が正しくありません。");
      const today = this.sql(
        "SELECT COALESCE(SUM(delta),0) AS n FROM wallet_events WHERE uid=? AND kind='earn' AND ref=?",
        uid, dayOf(now),
      )[0].n;
      if (today + delta > EARN_DAILY_MAX) throw new Error("今日はこれ以上受け取れません。");
      ref = dayOf(now);
    }
    const before = this.balance(uid);
    if (delta < 0 && before + delta < 0)
      throw new Error(`ガチャチケットが足りません(あと${-delta - before}枚)`);
    this.sql("INSERT INTO wallet_events VALUES (?,?,?,?,?,?)", id, uid, delta, kind, ref ?? null, now);
    this.sql(
      "INSERT INTO wallets VALUES (?,?,?) ON CONFLICT(uid) DO UPDATE SET tickets=tickets+excluded.tickets, updated=excluded.updated",
      uid, delta, now,
    );
    return { applied: true, tickets: before + delta };
  }
  credit(uid, id, n, kind, now) { return this.apply(uid, id, n, kind, null, now); }
  debit(uid, id, n, kind, now) { return this.apply(uid, id, -n, kind, null, now); }
  /** 検証済みの Apple の取引を財布に反映する。取引 ID で冪等 */
  purchase(uid, tx, now) {
    const product = productOf(tx.productId);
    if (!product) throw new Error("知らない商品の取引です。");
    const prior = this.sql("SELECT * FROM purchases WHERE transactionId=?", tx.transactionId)[0];
    if (!prior)
      this.sql("INSERT INTO purchases VALUES (?,?,?,?,?,?)",
        tx.transactionId, uid, tx.productId, tx.environment, Number(tx.purchaseDate) || now, now);
    let granted = false;
    if (product.kind === "tickets") {
      // チケットは世界で一度だけ。別の uid で既に渡していれば、ここでは渡さない
      if (!prior) granted = this.credit(uid, `iap:${tx.transactionId}`, product.tickets, "purchase", now).applied;
    } else {
      // 買い切りの権利は、Apple が所有を証明している uid に渡す(復元で別の uid に来てもよい)
      const has = this.sql("SELECT 1 FROM entitlements WHERE uid=? AND productId=?", uid, tx.productId)[0];
      if (!has) {
        this.sql("INSERT INTO entitlements VALUES (?,?,?,?)", uid, tx.productId, tx.transactionId, now);
        granted = true;
      }
    }
    return { granted, duplicate: !!prior, product: product.id, ...this.summary(uid) };
  }
  /** 端末にあったチケットを一度だけ引き継ぐ(上限つき) */
  migrate(uid, tickets, now) {
    const done = this.sql("SELECT tickets FROM migrations WHERE uid=?", uid)[0];
    if (done) return { applied: false, migrated: done.tickets, ...this.summary(uid) };
    const n = cap(tickets, MIGRATE_TICKETS_MAX);
    this.sql("INSERT INTO migrations VALUES (?,?,?)", uid, n, now);
    if (n) this.credit(uid, `migrate:${uid}`, n, "migrate", now);
    return { applied: true, migrated: n, ...this.summary(uid) };
  }
  /** 自分の記録を消す(5.1.1(v))。購入の記録は会計のため残す(uid は伏せる) */
  forget(uid) {
    this.sql("DELETE FROM wallets WHERE uid=?", uid);
    this.sql("DELETE FROM wallet_events WHERE uid=?", uid);
    this.sql("DELETE FROM entitlements WHERE uid=?", uid);
    this.sql("DELETE FROM migrations WHERE uid=?", uid);
    this.sql("UPDATE purchases SET uid='' WHERE uid=?", uid);
    return { ok: true };
  }
}
