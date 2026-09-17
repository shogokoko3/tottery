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
  ADS_PER_DAY,
  AD_REWARD_TICKETS,
  GEM_PER_TICKET,
  GEM_CONSUME_ORDER,
  BATTLEPASS_GEMS,
  BATTLEPASS_ENTITLEMENT,
  BATTLEPASS_WEEK_TICKET_MAX,
  FIRST_PURCHASE_SKIN,
  FREE_GEM_EVENT_MAX,
  FREE_GEM_DAILY_MAX,
  TICKET_BUNDLE,
  ticketsPrice,
  ETHER_EXCHANGE,
  etherFor,
} from "../iap/catalog.js";
import { campaignOf, campaignOpen } from "../game/campaigns.js";
import { productOf as foilProductOf, priceFor as foilPriceFor, ownsAllButSecret } from "../skins/foil-shop.js";
import { ALL_SKINS, byId as skinById, foilId } from "../skins/catalog.js";

export const MIGRATE_TICKETS_MAX = 500;
/** 遊んで貯める分(kind=earn)は端末の申告なので、1回と1日(UTC)の上限で抑える */
export const EARN_EVENT_MAX = 10;
export const EARN_DAILY_MAX = 30;
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);
/** その日が入る週の始まり(UTC 月曜)。バトルパスの周回上限の区切り */
const weekOf = (now) => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const cap = (n, max) => (Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : 0);
const addColumn = (sql, table, col) => {
  try { sql(`ALTER TABLE ${table} ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`); } catch { /* 既にある */ }
};
const foilEventId = (uid, product, skins) =>
  `foil:${uid}:${product}:${[...skins].sort().join("+")}`;

/** 引き継ぎの控えの上限(文字数)。所持スキンと戦績が入る大きさ */
export const BACKUP_MAX = 40000;

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
    // 端末の所持一覧の写し。既存ゲームと同じ端末申告モデルであり、取得の独立した証明ではない。
    sql("CREATE TABLE IF NOT EXISTS collection_skins (uid TEXT NOT NULL, skinId TEXT NOT NULL, syncedAt INTEGER, PRIMARY KEY(uid, skinId))");
    // 有償購入した札は端末の所持同期とは別に保持し、端末消失後にも復元できる。
    sql("CREATE TABLE IF NOT EXISTS foil_purchases (uid TEXT NOT NULL, skinId TEXT NOT NULL, eventId TEXT NOT NULL, at INTEGER, PRIMARY KEY(uid, skinId))");
    // ガチャの履歴(運営が見る)。1回引くごとに1行。端末が結果を申告する
    sql("CREATE TABLE IF NOT EXISTS gacha_log (id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, skinId TEXT, isNew INTEGER NOT NULL DEFAULT 0, at INTEGER)");
    sql("CREATE INDEX IF NOT EXISTS gacha_log_uid ON gacha_log(uid, at)");
    // 店の診断(端末が App Store に商品を問い合わせた結果の控え。uid ごとに最新の1件)。
    // 本人の端末で「商品を読み込んでいます…」から進まない件の切り分け用(2026-09-15)。運営だけが読む
    sql("CREATE TABLE IF NOT EXISTS iap_diag (uid TEXT PRIMARY KEY, at INTEGER, build INTEGER, storefront TEXT, count INTEGER, error TEXT, ms INTEGER)");
    // 運営がバトルパスを「クリア状態」にした印。summary の passComplete で端末に伝え、端末が盤を埋める
    sql("CREATE TABLE IF NOT EXISTS pass_grants (uid TEXT PRIMARY KEY, at INTEGER)");
    // 機種変更の引き継ぎに使う、端末の記録の控え(名前・戦績・レベル・所持スキンなど)。
    // uid ごとに最新の1件だけ。Apple で本人確認した人の端末が預ける(src/net/backup.js)
    sql("CREATE TABLE IF NOT EXISTS profile_backups (uid TEXT PRIMARY KEY, blob TEXT, at INTEGER)");
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
  /** 旧購入も支払済み台帳から復元。端末の申告ではシークレットを付与しない。 */
  restoreFoilPurchases(uid) {
    const rows = this.sql(
      "SELECT id, ref, at FROM wallet_ledger WHERE uid=? AND kind='foil' AND gems<0 AND gems_free=0 AND tickets=0",
      uid,
    );
    for (const row of rows) {
      if (typeof row.ref !== "string") continue;
      const split = row.ref.indexOf(":");
      if (split < 1) continue;
      const product = foilProductOf(row.ref.slice(0, split));
      const skins = row.ref.slice(split + 1).split(",");
      if (foilPriceFor(product, skins) === null ||
          row.id !== foilEventId(uid, product.id, skins)) continue;
      this.rememberFoils(uid, skins, row.id, row.at);
    }
  }
  rememberFoils(uid, skins, eventId, now) {
    for (const baseId of skins)
      this.sql(
        "INSERT OR IGNORE INTO foil_purchases (uid, skinId, eventId, at) VALUES (?,?,?,?)",
        uid, foilId(baseId), eventId, now,
      );
  }
  purchasedFoilsOf(uid) {
    this.restoreFoilPurchases(uid);
    return this.sql("SELECT skinId FROM foil_purchases WHERE uid=? ORDER BY skinId", uid)
      .map((r) => r.skinId);
  }
  collectionOf(uid, purchased = this.purchasedFoilsOf(uid)) {
    const rows = this.sql("SELECT skinId FROM collection_skins WHERE uid=?", uid);
    return { owned: Object.fromEntries([...rows.map((r) => r.skinId), ...purchased].map((id) => [id, 1])) };
  }
  /**
   * 認証済みuidの端末所持一覧を置換する。全入力を先に検査し、壊れた同期で既存一覧を消さない。
   * Aフォイルの申告は購入記録の代わりにしない。正規購入済みのAも支払台帳から復元する。
   * 呼出元のtransactionSyncで一覧更新と応答を一括確定する。
   */
  syncCollection(uid, ownedIds, now) {
    if (!Array.isArray(ownedIds) || ownedIds.length > ALL_SKINS.length ||
        new Set(ownedIds).size !== ownedIds.length ||
        [...ownedIds].some((id) => typeof id !== "string" || !skinById(id)))
      throw new Error("所持カードの一覧が正しくありません。");
    this.sql("DELETE FROM collection_skins WHERE uid=?", uid);
    for (const id of ownedIds) {
      if (skinById(id).secret) continue;
      this.sql("INSERT INTO collection_skins (uid, skinId, syncedAt) VALUES (?,?,?)", uid, id, now);
    }
    return this.summary(uid, now);
  }
  /** 公開中の商品の購入条件。completeフラグは受け取らず、保存済みの全IDを照合する。 */
  checkFoilOwnership(uid, product, skins) {
    const collection = this.collectionOf(uid);
    if (product.secret && !ownsAllButSecret(collection))
      throw new Error("このフォイルの購入条件を満たしていません。");
    if (skins.some((id) => collection.owned[foilId(id)]))
      throw new Error("このフォイルはすでに持っています。");
  }
  /** 今日(UTC)の広告リワードの使用回数 */
  adsUsedToday(uid, now) {
    if (!Number.isFinite(now)) return 0;
    return this.sql(
      "SELECT COUNT(*) AS n FROM wallet_ledger WHERE uid=? AND kind='ad' AND ref=?",
      uid, dayOf(now),
    )[0].n;
  }
  /** 今週(UTC月曜始まり)のバトルパスのチケット枚数 */
  passTicketsThisWeek(uid, now) {
    if (!Number.isFinite(now)) return 0;
    return this.sql(
      "SELECT COALESCE(SUM(tickets),0) AS t FROM wallet_ledger WHERE uid=? AND kind='pass' AND ref=?",
      uid, weekOf(now),
    )[0].t;
  }
  summary(uid, now = null) {
    const r = this.row(uid);
    const used = now == null ? null : this.adsUsedToday(uid, now);
    const passWeek = now == null ? null : this.passTicketsThisWeek(uid, now);
    const purchasedFoils = this.purchasedFoilsOf(uid);
    return {
      tickets: r.tickets,
      gems: r.gems + r.gems_free,
      gemsPaid: r.gems,
      gemsFree: r.gems_free,
      entitlements: this.entitlementsOf(uid),
      passComplete: this.sql("SELECT at FROM pass_grants WHERE uid=?", uid)[0]?.at ?? null,
      purchasedFoils,
      secretFoilEligible: ownsAllButSecret(this.collectionOf(uid, purchasedFoils)),
      prices: { ticket: GEM_PER_TICKET, ticketBundle: TICKET_BUNDLE, battlepass: BATTLEPASS_GEMS, ether: ETHER_EXCHANGE },
      consumeOrder: GEM_CONSUME_ORDER,
      // 広告リワード。now があるときだけ入れる(いつの「今日」か決まらないと数えられない)
      adPerDay: ADS_PER_DAY,
      ...(used == null ? {} : { adsUsedToday: used, adsLeftToday: Math.max(0, ADS_PER_DAY - used) }),
      // バトルパスの周回上限(now があるとき)。残り枚数を画面に出す
      ...(passWeek == null ? {} : { passTicketsThisWeek: passWeek, passTicketsLeftThisWeek: Math.max(0, BATTLEPASS_WEEK_TICKET_MAX - passWeek) }),
    };
  }
  /** 広告を1本見た報酬(チケット1枚)。1日 ADS_PER_DAY 回まで。id で冪等 */
  adReward(uid, id, now) {
    const seen = this.sql("SELECT uid FROM wallet_ledger WHERE id=?", id)[0];
    if (seen) {
      if (seen.uid !== uid) throw new Error("他の人の出来事です。");
      return { applied: false, ...this.summary(uid, now) };
    }
    if (this.adsUsedToday(uid, now) >= ADS_PER_DAY)
      throw new Error("今日の広告の回数を使い切りました。");
    // ref=日付にして、その日の回数を数えられるようにする
    const r = this.apply(uid, id, { tickets: AD_REWARD_TICKETS }, "ad", dayOf(now), now);
    return { ...r, ...this.summary(uid, now) };
  }
  /**
   * バトルパスのマスをクリアした報酬(チケット1枚)。**パス所持者だけ**。
   * マス×周ごとに id で冪等。週(UTC月曜始まり)72枚(3周ぶん)まで。無料の earn とは別枠
   */
  passReward(uid, id, now) {
    if (!this.entitlementsOf(uid).includes(BATTLEPASS_ENTITLEMENT))
      throw new Error("バトルパスを持っていません。");
    const seen = this.sql("SELECT uid FROM wallet_ledger WHERE id=?", id)[0];
    if (seen) {
      if (seen.uid !== uid) throw new Error("他の人の出来事です。");
      return { applied: false, ...this.summary(uid, now) };
    }
    if (this.passTicketsThisWeek(uid, now) + 1 > BATTLEPASS_WEEK_TICKET_MAX)
      throw new Error("今週のバトルパスの上限に達しました。");
    // ref=週にして、その週の枚数を数えられるようにする
    const r = this.apply(uid, id, { tickets: 1 }, "pass", weekOf(now), now);
    return { ...r, ...this.summary(uid, now) };
  }
  /** 出来事 id で冪等に増減する。減らす場合は残高を超えない */
  apply(uid, id, { tickets = 0, gemsPaid = 0, gemsFree = 0 }, kind, ref, now) {
    if (typeof id !== "string" || !/^[\w:.+-]{1,128}$/.test(id))
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
  /**
   * 記念配布(src/game/campaigns.js)。uid ごとに一度きり。枚数は台帳から読む(端末は id だけ送る)。
   * 出来事 id に uid を含めるのは、台帳の id が全体で一意(他の人の出来事を弾く)なため
   */
  campaign(uid, campaignId, now) {
    const c = campaignOf(campaignId);
    if (!c) throw new Error("その配布はありません。");
    if (!campaignOpen(c, now)) throw new Error("この配布は期間外です。");
    const r = this.apply(uid, `campaign:${c.id}:${uid}`, { tickets: c.tickets }, "campaign", c.id, now);
    return { ...r, campaign: c.id, tickets_granted: r.applied ? c.tickets : 0 };
  }
  debit(uid, id, n, kind, now) { return this.apply(uid, id, { tickets: -n }, kind, null, now); }
  /** 無償ジェムを足す(端末の申告。上限つき) */
  earnGems(uid, id, n, now) { return this.apply(uid, id, { gemsFree: n }, "earn", null, now); }
  /** ジェムを使う。無償→有償の順に取り崩し、1つの出来事にする。extra は同時に足すもの(両替のチケットなど) */
  spendGems(uid, id, amount, kind, ref, now, extra = {}, { paidOnly = false, freeOnly = false } = {}) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("枚数が正しくありません。");
    const seen = this.sql("SELECT uid FROM wallet_ledger WHERE id=?", id)[0];
    if (seen) return this.apply(uid, id, { gemsPaid: -1 }, kind, ref, now); // 冪等の判定だけ通す
    const r = this.row(uid);
    const pools = { free: r.gems_free, paid: r.gems };
    // 有償だけで払う品(フォイルの直接購入。本人の決め 2026-09-16)は無償に触れない
    if (paidOnly) {
      if (pools.paid < amount) throw new Error(`有償ジェムが足りません(あと${amount - pools.paid})`);
      return this.apply(uid, id, { ...extra, gemsPaid: -amount }, kind, ref, now);
    }
    // 無償だけで払う品(エーテル両替)は有償に触れない
    if (freeOnly) {
      if (pools.free < amount) throw new Error(`無償ジェムが足りません(あと${amount - pools.free})`);
      return this.apply(uid, id, { ...extra, gemsFree: -amount }, kind, ref, now);
    }
    if (pools.free + pools.paid < amount)
      throw new Error(`ジェムが足りません(あと${amount - pools.free - pools.paid})`);
    let left = amount; const take = { free: 0, paid: 0 };
    for (const p of GEM_CONSUME_ORDER) { take[p] = Math.min(pools[p], left); left -= take[p]; }
    return this.apply(uid, id, { ...extra, gemsFree: -take.free, gemsPaid: -take.paid }, kind, ref, now);
  }
  /**
   * フォイルを有償ジェムで買う(src/skins/foil-shop.js)。値段はサーバーがここで決める。
   * 出来事の id は uid・商品・札で決まるので、同じ札を二度は買えない(二度目は applied:false で返す)
   */
  buyFoil(uid, productId, skins, now) {
    const product = foilProductOf(productId);
    if (!product) throw new Error("その商品はありません。");
    const price = foilPriceFor(product, skins);
    if (price === null) throw new Error("買う札の指定が正しくありません。");
    const id = foilEventId(uid, product.id, skins);
    const prior = this.sql("SELECT uid, kind, gems FROM wallet_ledger WHERE id=?", id)[0];
    // 支払済みの同一要求は、所持同期の変化・再非公開・残高不足より先に復元する。
    if (prior) {
      if (prior.uid !== uid || prior.kind !== "foil" || prior.gems >= 0)
        throw new Error("購入の記録を確認できませんでした。");
      return { applied: false, ...this.summary(uid), product: product.id, skins: [...skins], price: -prior.gems };
    }
    if (product.pending) throw new Error("その商品はありません。");
    this.checkFoilOwnership(uid, product, skins);
    // WorkerのtransactionSyncが減算と付与をまとめて確定し、途中の例外では両方を戻す。
    const r = this.spendGems(uid, id, price, "foil", `${product.id}:${skins.join(",")}`, now, {}, { paidOnly: true });
    this.rememberFoils(uid, skins, id, now);
    return { ...r, ...this.summary(uid), product: product.id, skins: [...skins], price };
  }
  /** 検証済みの Apple の取引(ジェムのパック)を財布に反映する。取引 ID で冪等。円の分は有償、おまけは無償 */
  purchase(uid, tx, now) {
    const product = productOf(tx.productId);
    if (!product) throw new Error("知らない商品の取引です。");
    const prior = this.sql("SELECT * FROM purchases WHERE transactionId=?", tx.transactionId)[0];
    // 初課金判定は、この取引を記録する前に「この uid に過去の購入があるか」で決める
    const hadPurchase = this.sql("SELECT 1 AS x FROM purchases WHERE uid=? LIMIT 1", uid)[0];
    if (!prior)
      this.sql("INSERT INTO purchases VALUES (?,?,?,?,?,?)",
        tx.transactionId, uid, tx.productId, tx.environment, Number(tx.purchaseDate) || now, now);
    let granted = false;
    // 世界で一度だけ。別の uid で既に渡していれば、ここでは渡さない
    if (!prior)
      granted = this.apply(uid, `iap:${tx.transactionId}`, { gemsPaid: product.paid, gemsFree: product.free }, "purchase", tx.productId, now).applied;
    // 初課金特典(uid ごとに一度だけ): 購入ジェムを2倍(おまけは無償)＋スキンのフラグ。
    // 資金決済法の未使用残高は有償だけなので、2倍分は無償(gemsFree)で足す
    let firstPurchase = false;
    if (granted && !hadPurchase && !this.sql("SELECT 1 AS x FROM wallet_ledger WHERE uid=? AND kind='first-bonus' LIMIT 1", uid)[0]) {
      this.apply(uid, `iap:firstbonus:${tx.transactionId}`, { gemsFree: product.paid }, "first-bonus", tx.productId, now);
      firstPurchase = true;
    }
    return { granted, duplicate: !!prior, firstPurchase, firstSkin: firstPurchase ? FIRST_PURCHASE_SKIN : null, product: product.id, ...this.summary(uid) };
  }
  /** ジェムでチケットを買う(両替)。1つの出来事なので、片方だけ効くことはない */
  exchange(uid, id, tickets, now) {
    if (!Number.isSafeInteger(tickets) || tickets < 1 || tickets > 100)
      throw new Error("枚数が正しくありません。");
    return this.spendGems(uid, id, ticketsPrice(tickets), "exchange", null, now, { tickets });
  }
  /**
   * 無償ジェムをエーテルに(src/iap/catalog.js の ETHER_EXCHANGE)。**無償だけ**で払う(有償は溶かさない)。
   * エーテルは端末の持ち物なので、ここでは減らすだけ。返り値の ether を端末が足す
   */
  buyEther(uid, id, gems, now) {
    const ether = etherFor(gems);
    if (ether === null) throw new Error("ジェムの数が正しくありません(10 の倍数、1,000 まで)。");
    const r = this.spendGems(uid, id, gems, "ether", null, now, {}, { freeOnly: true });
    return { ...r, ether: r.applied ? ether : 0 };
  }
  /** ジェムでバトルパス(買い切りの権利)を買う。既に持っていれば減らさない */
  buyPass(uid, id, now) {
    if (this.entitlementsOf(uid).includes(BATTLEPASS_ENTITLEMENT))
      return { applied: false, ...this.summary(uid) };
    // バトルパスは**有償ジェムだけ**で買う(無償・おまけでは買えない。2026-09-13 本人の決め)。
    // 冪等: 同じ id が既にあれば apply が applied:false を返し、二重には減らない
    const seen = this.sql("SELECT uid FROM wallet_ledger WHERE id=?", id)[0];
    if (!seen && this.row(uid).gems < BATTLEPASS_GEMS)
      throw new Error(`有償ジェムが足りません(あと${BATTLEPASS_GEMS - this.row(uid).gems})`);
    const r = this.apply(uid, id, { gemsPaid: -BATTLEPASS_GEMS }, "pass", BATTLEPASS_ENTITLEMENT, now);
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
  /** 運営が手で付与する(チケット・無償ジェム)。上限は無いが桁は見張る。id で冪等 */
  adminGrant(uid, { tickets = 0, gemsFree = 0 }, id, now) {
    if (typeof uid !== "string" || !uid) throw new Error("相手のuidが必要です。");
    const t = Number(tickets) || 0;
    const g = Number(gemsFree) || 0;
    if (!Number.isSafeInteger(t) || !Number.isSafeInteger(g) || t < 0 || g < 0 || t > 100000 || g > 100000)
      throw new Error("枚数が正しくありません。");
    if (t === 0 && g === 0) throw new Error("付与する数を入れてください。");
    // 有償ジェムは付与しない(資金決済法の未使用残高は「買った分」だけにするため、付与は無償)
    return this.apply(uid, id, { tickets: t, gemsFree: g }, "grant", null, now);
  }
  /**
   * 運営: バトルパスをクリア状態にする(本人の指示 2026-09-16)。
   * 権利(解放)が無ければ付け、印(pass_grants)を置く。盤そのものは端末にあるので、端末が summary の
   * passComplete を見て埋める(src/ui/battlepass.jsx)。二度押しても印の時刻が進むだけ
   */
  adminPassComplete(uid, now) {
    if (typeof uid !== "string" || !uid) throw new Error("相手のuidが必要です。");
    this.sql("INSERT OR IGNORE INTO entitlements (uid, productId, transactionId, at) VALUES (?,?,?,?)", uid, BATTLEPASS_ENTITLEMENT, `grant:${now}`, now);
    this.sql("INSERT OR REPLACE INTO pass_grants (uid, at) VALUES (?,?)", uid, now);
    return { ok: true, uid, ...this.summary(uid, now) };
  }
  /** 購入履歴(運営用)。uid を渡せばその人、無ければ全体の新しい順 */
  purchaseHistory(uid) {
    const rows = uid
      ? this.sql("SELECT transactionId, uid, productId, environment, purchasedAt, grantedAt FROM purchases WHERE uid=? ORDER BY grantedAt DESC LIMIT 200", uid)
      : this.sql("SELECT transactionId, uid, productId, environment, purchasedAt, grantedAt FROM purchases ORDER BY grantedAt DESC LIMIT 200");
    return { purchases: rows };
  }
  /** ガチャの結果を記録する(端末の申告)。1回引くごとに呼ばれ、引いた札を残す */
  logGacha(uid, items, now) {
    if (!Array.isArray(items) || !items.length) return { logged: 0 };
    let n = 0;
    for (const it of items.slice(0, 20)) {
      const skinId = it && typeof it.id === "string" ? it.id.slice(0, 64) : null;
      if (!skinId) continue;
      this.sql("INSERT INTO gacha_log (uid, skinId, isNew, at) VALUES (?,?,?,?)", uid, skinId, it.isNew ? 1 : 0, now);
      n++;
    }
    return { logged: n };
  }
  /** ガチャ履歴(運営用)。uid を渡せばその人、無ければ全体の新しい順 */
  gachaHistory(uid) {
    const rows = uid
      ? this.sql("SELECT uid, skinId, isNew, at FROM gacha_log WHERE uid=? ORDER BY at DESC LIMIT 200", uid)
      : this.sql("SELECT uid, skinId, isNew, at FROM gacha_log ORDER BY at DESC LIMIT 200");
    return { gacha: rows };
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
  /** 店の診断を控える(端末の申告)。値は形だけ見て切り詰める。uid ごとに最新の1件だけ残す */
  logDiag(uid, d, now) {
    const o = d && typeof d === "object" ? d : {};
    const int = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
    const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
    this.sql(
      "INSERT OR REPLACE INTO iap_diag (uid, at, build, storefront, count, error, ms) VALUES (?,?,?,?,?,?,?)",
      uid, now, int(o.build), str(o.storefront, 16), int(o.count), str(o.error, 200), int(o.ms),
    );
    return { ok: true };
  }
  /** 店の診断の一覧(運営用)。新しい順 */
  diagList() {
    return { diag: this.sql("SELECT uid, at, build, storefront, count, error, ms FROM iap_diag ORDER BY at DESC LIMIT 100") };
  }
  /**
   * 引き継ぎの控えを預かる(機種変更用)。uid ごとに最新の1件だけ。
   * 中身は端末が作った JSON の文字列。サーバーは形を見ず、大きさだけ見る
   * (残高と権利の正はこの控えではなく台帳。端末は復元のあと summary で上書きする)
   */
  saveBackup(uid, blob, now) {
    if (typeof blob !== "string" || !blob || blob.length > BACKUP_MAX)
      return { ok: false, error: "控えを預かれませんでした。" };
    this.sql("INSERT OR REPLACE INTO profile_backups (uid, blob, at) VALUES (?,?,?)", uid, blob, now);
    return { ok: true, at: now };
  }
  /** 預けた控えを返す。無ければ blob は null */
  loadBackup(uid) {
    const row = this.sql("SELECT blob, at FROM profile_backups WHERE uid=?", uid)[0];
    return { blob: row ? row.blob : null, at: row ? row.at : null };
  }
  /** 自分の記録を消す(5.1.1(v))。購入の記録は会計のため残す(uid は伏せる) */
  forget(uid) {
    this.sql("DELETE FROM profile_backups WHERE uid=?", uid);
    this.sql("DELETE FROM collection_skins WHERE uid=?", uid);
    this.sql("DELETE FROM foil_purchases WHERE uid=?", uid);
    this.sql("DELETE FROM iap_diag WHERE uid=?", uid);
    this.sql("DELETE FROM pass_grants WHERE uid=?", uid);
    this.sql("DELETE FROM wallets WHERE uid=?", uid);
    this.sql("DELETE FROM wallet_ledger WHERE uid=?", uid);
    this.sql("DELETE FROM wallet_events WHERE uid=?", uid);
    this.sql("DELETE FROM entitlements WHERE uid=?", uid);
    this.sql("DELETE FROM migrations WHERE uid=?", uid);
    this.sql("UPDATE purchases SET uid='' WHERE uid=?", uid);
    return { ok: true };
  }
}
