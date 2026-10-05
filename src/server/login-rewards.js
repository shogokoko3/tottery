import { dayOf, ticketsOf, loginDay, legacyLoginIndex } from "../game/login-bonus.js";

/** 呼び出し元の Durable Object transactionSync 内で、受取記録と残高を一括確定する。 */
export class LoginRewards {
  constructor(wallet) { this.wallet = wallet; this.sql = wallet.sql; }
  legacyRows(uid) {
    return this.sql("SELECT id, tickets, at FROM wallet_ledger WHERE uid=? AND kind='earn' AND id LIKE 'login:%'", uid)
      .filter(r => legacyLoginIndex(r.id) !== null && r.tickets === ticketsOf(dayOf(legacyLoginIndex(r.id))));
  }
  progress(uid) {
    const n = this.sql("SELECT COALESCE(MAX(taken),0) AS n FROM login_rewards WHERE uid=? AND claimedAt IS NOT NULL", uid)[0].n;
    return this.legacyRows(uid).reduce((max, r) => Math.max(max, legacyLoginIndex(r.id) + 1), n);
  }
  packet(uid, row, now) {
    const received = row.claimedAt !== null;
    const taken = received ? row.taken - 1 : this.progress(uid);
    return { ...this.wallet.summary(uid, now), uid, login: {
      day: row.day, taken, amount: received ? row.amount : ticketsOf(dayOf(taken)), received,
    } };
  }
  status(uid, now) {
    const day = loginDay(now);
    // 今日アクセスした証拠を残す。未受取の間は周回を進めない。
    this.sql("INSERT OR IGNORE INTO login_rewards (uid,day,issuedAt,taken,amount,claimedAt) VALUES (?,?,?,0,0,NULL)", uid, day, now);
    const old = this.legacyRows(uid).filter(r => loginDay(r.at) === day).sort((a,b) => b.at-a.at)[0];
    // 旧版で今日すでに入金されていた本人には二重付与しない。他人の login:0 は関係しない。
    if (old) this.sql("UPDATE login_rewards SET taken=?,amount=?,claimedAt=? WHERE uid=? AND day=? AND claimedAt IS NULL",
      legacyLoginIndex(old.id)+1, old.tickets, old.at, uid, day);
    return this.packet(uid, this.sql("SELECT * FROM login_rewards WHERE uid=? AND day=?", uid, day)[0], now);
  }
  claim(uid, day, now) {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > loginDay(now))
      throw new Error("ログイン報酬の日付が正しくありません。");
    const row = this.sql("SELECT * FROM login_rewards WHERE uid=? AND day=?", uid, day)[0];
    // 過去の日付を自己申告して増やすことはできない。サーバーが発行した日の分だけ再送できる。
    if (!row) throw new Error("ログイン報酬を確認してから、もう一度お試しください。");
    if (row.claimedAt !== null) return { applied: false, ...this.packet(uid, row, now) };
    const taken = this.progress(uid) + 1, amount = ticketsOf(dayOf(taken - 1));
    const result = this.wallet.apply(uid, `login:${uid}:${day}`, { tickets: amount }, "login", day, now);
    this.sql("UPDATE login_rewards SET taken=?,amount=?,claimedAt=? WHERE uid=? AND day=?", taken, amount, now, uid, day);
    return { applied: result.applied, ...this.packet(uid, { ...row, taken, amount, claimedAt: now }, now) };
  }
  legacy(uid, id, now) {
    if (legacyLoginIndex(id) === null) throw new Error("ログイン報酬の指定が正しくありません。");
    if (this.legacyRows(uid).some(r => r.id === id)) return { applied: false, ...this.wallet.summary(uid, now) };
    const alias = this.sql("SELECT day FROM login_legacy_receipts WHERE uid=? AND id=?", uid, id)[0];
    if (alias) return this.claim(uid, alias.day, now);
    const status = this.status(uid, now);
    const result = this.claim(uid, status.login.day, now);
    // 古い端末の再送も別の日の報酬にならないよう、元の番号との対応を記録する。
    this.sql("INSERT INTO login_legacy_receipts (uid,id,day) VALUES (?,?,?)", uid, id, status.login.day);
    return result;
  }
}
