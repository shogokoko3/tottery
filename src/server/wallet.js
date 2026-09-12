/**
 * サーバー側の財布。uid ごとのチケット(遊んで貯まる)、ジェム(有償と無償を分けて持つ)、買い切りの権利。
 *
 * 決まり:
 *  - 加算も減算も「出来事の id」で冪等にする(同じ id は二度効かない)。通信のやり直しで
 *    二重に増えたり減ったりしない。両替(ジェム→チケット)も、無償と有償にまたがる減算も1つの出来事
 *  - 減算は残高を超えない(足りなければ失敗して残高は動かない)
 *  - 購入(ジェムのパック)は Apple の取引 ID で冪等。円の分は有償、おまけは無償に入る
 *  - ジェムを使うときは無償→有償の順(catalog の GEM_CONSUME_ORDER)
 *  - 端末の申告で増える分(チケット、無償ジェム)は 1回/1日の上限で抑える
 *  - 端末にあったチケットの引き継ぎは uid ごとに一度きり。上限つき
 *  - 未使用残高(資金決済法)は**有償ジェムだけ**を数える。無償は数えない
 * SQL は既存の Ledger と同じ口(query, ...params) => rows で受ける。
 * 列名: wallets.gems=有償、wallets.gems_free=無償(ジェムより前の表には列を足す)
 */
import {
  productOf,
  GEM_PER_TICKET,
  GEM_CONSUME_ORDER,
  BATTLEPASS_GEMS,
  BATTLEPASS_ENTITLEMENT,
  FREE_GEM_EVENT_MAX,
  FREE_GEM_DAILY_MAX,
} from "../iap/catalog.js";

export const MIGRATE_TICKETS_MAX = 500;
/** 遊んで貯める分(kind=earn)は端末の申告なので、1回と1日(UTC)の上限で抑える */
export const EARN_EVENT_MAX = 10;
export const EARN_DAILY_MAX = 30;
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
const cap = (n, max) => (Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : 0);
const addColumn = (sql, table, col) => {
  try { sql(`ALTER TABLE ${table} ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`); } catch { /* 既にある */ }
};

export class Wallet {
  constructor(sql) {
    this.sql = sql;
    sql("CREATE TABLE IF NOT EXISTS wallets (uid TEXT PRIMARY KEY, tickets INTEGER NOT NULL, updated INTEGER, gems INTEGER NOT NULL DEFAULT 0, gems_free INTEGER NOT NULL DEFAULT 0)");
    addColumn(sql, "wallets", "gems");
    addColumn(sql, "wallets", "gems_free");
    sql("CREATE TABLE IF NOT EXISTS wallet_ledger (id TEXT PRIMARY KEY, uid TEXT, tickets INTEGER NOT NULL, gems INTEGER NOT NULL, kind TEXT, ref TEXT, at INTEGER, gems_free INTEGER NOT NULL DEFAULT 0)");
    addColumn(sql, "wallet_ledger", "gems_free");
    sql("CREATE INDEX IF NOT EXISTS wallet_ledger_uid ON wallet_ledger(uid, at)");
    // 旧 wallet_events(チケットだけ)を引き継ぐ。id が同じなら二度は入らない
    sql("CREATE TABLE IF NOT EXISTS wallet_events (id TEXT PRIMARY KEY, uid TEXT, delta INTEGER, kind TEXT, ref TEXT, at INTEGER)");
    sql("INSERT OR IGNORE INTO wallet_ledger (id, uid, tickets, gems, kind, ref, at, gems_free) SELECT id, uid, delta, 0, kind, ref, at, 0 FROM wallet_events");
    sql("CREATE TABLE IF NOT EXISTS purchases (transactionId TEXT PRIMARY KEY, uid TEXT, productId TEXT, environment TEXT, purchasedAt INTEGER, grantedAt INTEGER)");
    sql("CREATE TABLE IF NOT EXISTS entitlements (uid TEXT, productId TEXT, transactionId TEXT, at INTEGER, PRIMARY KEY(uid, productId))");
    sql("CREATE TABLE IF NOT EXISTS migrations (uid TEXT PRIMARY KEY, tickets INTEGER, at INTEGER)");
  }
  row(uid) {
    return (
      this.sql("SELECT tickets, gems, gems_free FROM wallets WHERE uid=?", uid)[0] ||
      { tickets: 0, gems: 0, gems_free: 0 }
    );
  }
  balance(uid) { return this.row(uid).tickets; }
  gems(uid) { const r = this.row(uid); return r.gems + r.gems_free; }
  entitlementsOf(uid) {
    return this.sql("SELECT productId FROM entitlements WHERE uid=?", uid).map((r) => r.productId);
  }
  summary(uid) {
    const r = this.row(uid);
    return {
      tickets: r.tickets,
      gems: r.gems + r.gems_free,
      gemsPaid: r.gems,
      gemsFree: r.gems_free,
      entitlements: this.entitlementsOf(uid),
      prices: { ticket: GEM_PER_TICKET, battlepass: BATTLEPASS_GEMS },
      consumeOrder: GEM_CONSUME_ORDER,
    };
  }
  /** 出来事 id で冪等に増減する。減らす場合は残高を超えない */
  apply(uid, id, { tickets = 0, gemsPaid = 0, gemsFree = 0 }, kind, ref, now) {
    if (typeof id !== "string" || !/^[\w:.-]{1,128}$/.test(id))
      throw new Error("出来事の id が正しくありません。");
    for (const d of [tickets, gemsPaid, gemsFree])
      if (!Number.isSafeInteger(d) || Math.abs(d) > 1000000)
        throw new Error("枚数が正しくありません。");
    if (tickets === 0 && gemsPaid === 0 && gemsFree === 0) throw new Error("枚数が正しくありません。");
    const seen = this.sql("SELECT uid FROM wallet_ledger WHERE id=?", id)[0];
    if (seen) {
      if (seen.uid !== uid) throw new Error("他の人の出来事です。");
      return { applied: false, ...this.summary(uid) };
    }
    if (kind === "earn") {
      // 端末の申告。チケットか無償ジェムのどちらか1種類だけ、上限つき。有償ジェムは増やせない
      if (gemsPaid !== 0 || tickets < 0 || gemsFree < 0 || (tickets > 0) === (gemsFree > 0))
        throw new Error("枚数が正しくありません。");
      const day = dayOf(now);
      if (tickets > EARN_EVENT_MAX || gemsFree > FREE_GEM_EVENT_MAX)
        throw new Error("枚数が正しくありません。");
      const today = this.sql(
        "SELECT COALESCE(SUM(tickets),0) AS t, COALESCE(SUM(gems_free),0) AS g FROM wallet_ledger WHERE uid=? AND kind='earn' AND ref=?",
        uid, day,
      )[0];
      if (today.t + tickets > EARN_DAILY_MAX || today.g + gemsFree > FREE_GEM_DAILY_MAX)
        throw new Error("今日はこれ以上受け取れません。");
      ref = day;
    }
    const before = this.row(uid);
    if (tickets < 0 && before.tickets + tickets < 0)
      throw new Error(`ガチャチケットが足りません(あと${-tickets - before.tickets}枚)`);
    if ((gemsPaid < 0 && before.gems + gemsPaid < 0) || (gemsFree < 0 && before.gems_free + gemsFree < 0))
      throw new Error("ジェムが足りません。");
    this.sql("INSERT INTO wallet_ledger (id, uid, tickets, gems, kind, ref, at, gems_free) VALUES (?,?,?,?,?,?,?,?)",
      id, uid, tickets, gemsPaid, kind, ref ?? null, now, gemsFree);
    this.sql(
      "INSERT INTO wallets (uid, tickets, updated, gems, gems_free) VALUES (?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET tickets=tickets+excluded.tickets, gems=gems+excluded.gems, gems_free=gems_free+excluded.gems_free, updated=excluded.updated",
      uid, tickets, now, gemsPaid, gemsFree,
    );
    return { applied: true, ...this.summary(uid) };
  }
  credit(uid, id, n, kind, now) { return this.apply(uid, id, { tickets: n }, kind, null, now); }
  debit(uid, id, n, kind, now) { return this.apply(uid, id, { tickets: -n }, kind, null, now); }
  /** 無償ジェムを足す(端末の申告。上限つき) */
  earnGems(uid, id, n, now) { return this.apply(uid, id, { gemsFree: n }, "earn", null, now); }
  /** ジェムを使う。無償→有償の順に取り崩し、1つの出来事にする。extra は同時に足すもの(両替のチケットなど) */
  spendGems(uid, id, amount, kind, ref, now, extra = {}) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("枚数が正しくありません。");
    const seen = this.sql("SELECT uid FROM wallet_ledger WHERE id=?", id)[0];
    if (seen) return this.apply(uid, id, { gemsPaid: -1 }, kind, ref, now); // 冪等の判定だけ通す
    const r = this.row(uid);
    const pools = { free: r.gems_free, paid: r.gems };
    if (pools.free + pools.paid < amount)
      throw new Error(`ジェムが足りません(あと${amount - pools.free - pools.paid})`);
    let left = amount; const take = { free: 0, paid: 0 };
    for (const p of GEM_CONSUME_ORDER) { take[p] = Math.min(pools[p], left); left -= take[p]; }
    return this.apply(uid, id, { ...extra, gemsFree: -take.free, gemsPaid: -take.paid }, kind, ref, now);
  }
  /** 検証済みの Apple の取引(ジェムのパック)を財布に反映する。取引 ID で冪等。円の分は有償、おまけは無償 */
  purchase(uid, tx, now) {
    const product = productOf(tx.productId);
    if (!product) throw new Error("知らない商品の取引です。");
    const prior = this.sql("SELECT * FROM purchases WHERE transactionId=?", tx.transactionId)[0];
    if (!prior)
      this.sql("INSERT INTO purchases VALUES (?,?,?,?,?,?)",
        tx.transactionId, uid, tx.productId, tx.environment, Number(tx.purchaseDate) || now, now);
    let granted = false;
    // 世界で一度だけ。別の uid で既に渡していれば、ここでは渡さない
    if (!prior)
      granted = this.apply(uid, `iap:${tx.transactionId}`, { gemsPaid: product.paid, gemsFree: product.free }, "purchase", tx.productId, now).applied;
    return { granted, duplicate: !!prior, product: product.id, ...this.summary(uid) };
  }
  /** ジェムでチケットを買う(両替)。1つの出来事なので、片方だけ効くことはない */
  exchange(uid, id, tickets, now) {
    if (!Number.isSafeInteger(tickets) || tickets < 1 || tickets > 100)
      throw new Error("枚数が正しくありません。");
    return this.spendGems(uid, id, tickets * GEM_PER_TICKET, "exchange", null, now, { tickets });
  }
  /** ジェムでバトルパス(買い切りの権利)を買う。既に持っていれば減らさない */
  buyPass(uid, id, now) {
    if (this.entitlementsOf(uid).includes(BATTLEPASS_ENTITLEMENT))
      return { applied: false, ...this.summary(uid) };
    const r = this.spendGems(uid, id, BATTLEPASS_GEMS, "pass", BATTLEPASS_ENTITLEMENT, now);
    if (r.applied)
      this.sql("INSERT OR IGNORE INTO entitlements VALUES (?,?,?,?)", uid, BATTLEPASS_ENTITLEMENT, id, now);
    return { ...r, ...this.summary(uid) };
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
  /**
   * 未使用残高(運営用)。**有償ジェムだけ**。1ジェム=1円で発行するので合計がそのまま円。
   * 資金決済法: 3月末・9月末にこれが1,000万円を超えたら、2か月以内に届出、半分以上を供託
   */
  unused() {
    const r = this.sql("SELECT COUNT(*) AS holders, COALESCE(SUM(gems),0) AS paid, COALESCE(SUM(gems_free),0) AS free FROM wallets WHERE gems>0 OR gems_free>0")[0];
    const issued = this.sql("SELECT COALESCE(SUM(gems),0) AS n FROM wallet_ledger WHERE kind='purchase'")[0].n;
    const used = -this.sql("SELECT COALESCE(SUM(gems),0) AS n FROM wallet_ledger WHERE gems<0")[0].n;
    return { holders: r.holders, unusedGems: r.paid, unusedFreeGems: r.free, issuedGems: issued, usedGems: used, yen: r.paid, threshold: 10000000, over: r.paid > 10000000 };
  }
  /** 自分の記録を消す(5.1.1(v))。購入の記録は会計のため残す(uid は伏せる) */
  forget(uid) {
    this.sql("DELETE FROM wallets WHERE uid=?", uid);
    this.sql("DELETE FROM wallet_ledger WHERE uid=?", uid);
    this.sql("DELETE FROM wallet_events WHERE uid=?", uid);
    this.sql("DELETE FROM entitlements WHERE uid=?", uid);
    this.sql("DELETE FROM migrations WHERE uid=?", uid);
    this.sql("UPDATE purchases SET uid='' WHERE uid=?", uid);
    return { ok: true };
  }
}
