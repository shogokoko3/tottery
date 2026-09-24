/**
 * フレンドとプロフィール(サーバー側。Worker の台帳と同じ Durable Object に置く。2026-09-23 本人の指示)。
 *
 * - フレンド登録: 8文字のフレンド ID(サーバーが uid ごとに1つ作る)で申請し、相手が承認すると双方向に結ぶ。
 *   50人まで(FRIEND_MAX)。互いに申請していれば、その場で結ぶ
 * - 贈り物: 1日に**フレンド1人あたり1枚**(日本時間の日付で数える。最大でフレンドの数=50人ぶん)ガチャチケットを贈れる。送る側は減らない(サーバーが作る)。
 *   受け取る側は「受け取る」で財布へ(財布への加算は Durable Object 側で行う。ここは印だけ)
 * - 招待: フレンド対戦の合言葉(部屋の code)を相手に届ける。3分で古くなる
 * - プロフィール: 端末が申告する写し(名前・アイコン・称号・レベル・記録・背景・アピール・固定の称号)。
 *   フレンドだけが読める。持ち点はここには置かず、台帳(elo_ratings)から足す
 *
 * 通信はしない。検証は tools/check-friends.mjs(node:sqlite)。
 */

export const FRIEND_MAX = 50;
export const FRIEND_CODE_LEN = 8;
/** 招待が生きている時間。合言葉の部屋は 3 分で片付くので同じにする */
export const INVITE_TTL_MS = 3 * 60 * 1000;
/** 在席(対戦中)の印が生きている時間。端末が2分ごとに打ち直すので、落ちた端末は6分で消える */
export const PRESENCE_TTL_MS = 6 * 60 * 1000;
/** 部屋の合言葉として通す形(フレンド戦は6文字、ランダムは8文字。招待と同じ緩さ) */
const ROOM_CODE_RE = /^[\w-]{4,16}$/;
/** 紛らわしい文字(0/O、1/I/L)を抜いた字種 */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** プロフィールのアピールに選べる記録。ここに無い id は捨てる */
export const SHOWCASE_IDS = [
  "rating",
  "battles",
  "wins",
  "winRate",
  "rated",
  "titles",
  "level",
  "streak",
  "days",
  "mastery",
  "tsume",
  "bestPlace",
];
export const SHOWCASE_MAX = 3;
/** 申請の入口。code = フレンド ID、match = 対戦した相手、rank = ランキング。受け付けるかは本人が入口ごとに決める */
export const REQUEST_SOURCES = ["code", "match", "rank"];
/** 受け付けていない入口からの申請に返す文。断っていることは相手に伝えない(「いっぱい」と同じ文にする。2026-09-24 本人の指示) */
export const FULL_MESSAGE = "相手のフレンドがいっぱいです。";
const NAME_MAX = 10;
const TAG_MAX = 40;

/** 日本時間の日付 "2026-09-23"。端末の時計に頼らない(贈り物の1日1回はここで数える) */
export function jstDay(now) {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

const str = (x, max) => (typeof x === "string" ? x.slice(0, max) : "");
const num = (x, max) => {
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), max) : 0;
};

/** 端末が申告するプロフィールの写しを、決まった形に整える(桁と長さを見張る) */
export function sanitizeProfileCard(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const stats = p.stats && typeof p.stats === "object" ? p.stats : {};
  const showcase = Array.isArray(p.showcase)
    ? [...new Set(p.showcase.filter((id) => SHOWCASE_IDS.includes(id)))].slice(0, SHOWCASE_MAX)
    : [];
  return {
    name: str(p.name, NAME_MAX),
    icon: str(p.icon, TAG_MAX),
    title: str(p.title, TAG_MAX),
    pinnedTitle: str(p.pinnedTitle, TAG_MAX),
    bg: str(p.bg, TAG_MAX) || "standard",
    frame: str(p.frame, TAG_MAX),
    level: num(p.level, 100),
    showcase,
    // 申請の受付(入口ごと)。無ければ全部受ける
    accept: Object.fromEntries(
      REQUEST_SOURCES.map((k) => [k, !(p.accept && typeof p.accept === "object" && p.accept[k] === false)]),
    ),
    stats: {
      battles: num(stats.battles, 1e9),
      wins: num(stats.wins, 1e9),
      draws: num(stats.draws, 1e9),
      rated: num(stats.rated, 1e9),
      titles: num(stats.titles, 1e4),
      streak: num(stats.streak, 1e6),
      days: num(stats.days, 1e6),
      mastery: num(stats.mastery, 1e9),
      tsume: num(stats.tsume, 1e6),
      bestPlace: num(stats.bestPlace, 1e9),
      since: num(stats.since, 1e14),
    },
  };
}

export class Friends {
  constructor(sql, random = Math.random) {
    this.sql = sql;
    this.random = random;
    sql("CREATE TABLE IF NOT EXISTS friend_codes (uid TEXT PRIMARY KEY, code TEXT UNIQUE, at INTEGER)");
    // 双方向に1行ずつ持つ(数える・並べるのが素直になる)
    sql("CREATE TABLE IF NOT EXISTS friends (uid TEXT, fid TEXT, at INTEGER, PRIMARY KEY(uid, fid))");
    sql("CREATE TABLE IF NOT EXISTS friend_requests (from_uid TEXT, to_uid TEXT, at INTEGER, PRIMARY KEY(from_uid, to_uid))");
    sql("CREATE INDEX IF NOT EXISTS friend_requests_to ON friend_requests(to_uid)");
    // id = gift:<from>:<day>。送る側は1日1つしか作れない(主キーで守る)
    sql("CREATE TABLE IF NOT EXISTS friend_gifts (id TEXT PRIMARY KEY, from_uid TEXT, to_uid TEXT, day TEXT, at INTEGER, claimed INTEGER)");
    sql("CREATE INDEX IF NOT EXISTS friend_gifts_to ON friend_gifts(to_uid, claimed)");
    sql("CREATE TABLE IF NOT EXISTS friend_invites (from_uid TEXT, to_uid TEXT, code TEXT, at INTEGER, PRIMARY KEY(from_uid, to_uid))");
    sql("CREATE TABLE IF NOT EXISTS friend_profiles (uid TEXT PRIMARY KEY, data TEXT, at INTEGER, seen INTEGER)");
    // 対戦中の在席。code = 観戦できる部屋、online = ランダムマッチか(1)フレンド戦か(0)、opp = 相手の名前
    sql("CREATE TABLE IF NOT EXISTS friend_presence (uid TEXT PRIMARY KEY, code TEXT, online INTEGER, opp TEXT, at INTEGER)");
  }

  /** フレンド ID。無ければ作る。衝突したら作り直す */
  codeOf(uid, now) {
    const row = this.sql("SELECT code FROM friend_codes WHERE uid=?", uid)[0];
    if (row) return row.code;
    for (let i = 0; i < 20; i++) {
      let code = "";
      for (let k = 0; k < FRIEND_CODE_LEN; k++)
        code += CODE_CHARS[Math.floor(this.random() * CODE_CHARS.length) % CODE_CHARS.length];
      if (this.sql("SELECT uid FROM friend_codes WHERE code=?", code).length) continue;
      this.sql("INSERT INTO friend_codes VALUES (?,?,?)", uid, code, now);
      return code;
    }
    throw new Error("フレンド ID を作れませんでした。もう一度お試しください。");
  }
  static normalizeCode(raw) {
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .replace(/O/g, "0")
      .replace(/0/g, "O")
      .replace(/[IL]/g, "1")
      .replace(/1/g, "I")
      .slice(0, FRIEND_CODE_LEN);
  }
  uidOfCode(raw) {
    const code = Friends.normalizeCode(raw);
    if (code.length !== FRIEND_CODE_LEN) return null;
    return this.sql("SELECT uid FROM friend_codes WHERE code=?", code)[0]?.uid || null;
  }
  count(uid) {
    return this.sql("SELECT COUNT(*) AS n FROM friends WHERE uid=?", uid)[0].n;
  }
  isFriend(a, b) {
    return this.sql("SELECT 1 FROM friends WHERE uid=? AND fid=?", a, b).length > 0;
  }
  link(a, b, now) {
    this.sql("INSERT OR IGNORE INTO friends VALUES (?,?,?)", a, b, now);
    this.sql("INSERT OR IGNORE INTO friends VALUES (?,?,?)", b, a, now);
    this.sql("DELETE FROM friend_requests WHERE (from_uid=? AND to_uid=?) OR (from_uid=? AND to_uid=?)", a, b, b, a);
  }

  /** その入口からの申請を受け付けているか(写しを送っていない人は全部受ける) */
  acceptsFrom(uid, source) {
    const p = this.profileOf(uid);
    return !p || !p.accept || p.accept[source] !== false;
  }
  /** フレンド ID で申請する。互いに申請していれば、その場で結ぶ */
  request(uid, code, now, source = "code") {
    const target = this.uidOfCode(code);
    if (!target) throw new Error("そのフレンド ID は見つかりません。");
    if (target === uid) throw new Error("自分のフレンド ID です。");
    return this.requestUid(uid, target, now, source);
  }
  /**
   * 相手の uid で申請する(対戦した相手・ランキング)。source で相手の受付の設定を見る。
   * 受け付けていないときは「いっぱい」と同じ文で断る(断っていることを相手に伝えない)
   */
  requestUid(uid, target, now, source = "code") {
    if (!REQUEST_SOURCES.includes(source)) throw new Error("申請の入口が正しくありません。");
    if (typeof target !== "string" || !target) throw new Error("相手が見つかりません。");
    if (target === uid) throw new Error("自分には申請できません。");
    if (this.isFriend(uid, target)) return { ok: true, friend: true, uid: target };
    if (this.count(uid) >= FRIEND_MAX) throw new Error(`フレンドは${FRIEND_MAX}人までです。`);
    if (this.count(target) >= FRIEND_MAX) throw new Error(FULL_MESSAGE);
    if (!this.acceptsFrom(target, source)) throw new Error(FULL_MESSAGE);
    if (this.sql("SELECT 1 FROM friend_requests WHERE from_uid=? AND to_uid=?", target, uid).length) {
      this.link(uid, target, now);
      return { ok: true, friend: true, uid: target };
    }
    this.sql("INSERT OR REPLACE INTO friend_requests VALUES (?,?,?)", uid, target, now);
    return { ok: true, friend: false, uid: target };
  }
  accept(uid, from, now) {
    if (!this.sql("SELECT 1 FROM friend_requests WHERE from_uid=? AND to_uid=?", from, uid).length)
      throw new Error("その申請はもうありません。");
    if (this.count(uid) >= FRIEND_MAX) throw new Error(`フレンドは${FRIEND_MAX}人までです。`);
    if (this.count(from) >= FRIEND_MAX) {
      this.sql("DELETE FROM friend_requests WHERE from_uid=? AND to_uid=?", from, uid);
      throw new Error("相手のフレンドがいっぱいです。");
    }
    this.link(uid, from, now);
    return { ok: true };
  }
  decline(uid, from) {
    this.sql("DELETE FROM friend_requests WHERE from_uid=? AND to_uid=?", from, uid);
    return { ok: true };
  }
  cancel(uid, to) {
    this.sql("DELETE FROM friend_requests WHERE from_uid=? AND to_uid=?", uid, to);
    return { ok: true };
  }
  remove(uid, fid) {
    this.sql("DELETE FROM friends WHERE (uid=? AND fid=?) OR (uid=? AND fid=?)", uid, fid, fid, uid);
    this.sql("DELETE FROM friend_invites WHERE (from_uid=? AND to_uid=?) OR (from_uid=? AND to_uid=?)", uid, fid, fid, uid);
    return { ok: true };
  }

  /** 今日すでに贈ったフレンドの一覧(1日にフレンド1人あたり1枚。最大でフレンドの数=50人) */
  giftedToday(uid, now) {
    return this.sql("SELECT to_uid FROM friend_gifts WHERE from_uid=? AND day=?", uid, jstDay(now)).map((r) => r.to_uid);
  }
  /** フレンドにチケットを1枚贈る。1日にフレンド1人あたり1枚(最大50人ぶん)・フレンドだけ。送る側は減らない */
  gift(uid, fid, now) {
    if (!this.isFriend(uid, fid)) throw new Error("フレンドにだけ贈れます。");
    const day = jstDay(now);
    // id は (送り主・相手・日)ごと。同じ相手には1日1枚まで(主キーと重複確認で守る)
    const id = `gift:${uid}:${fid}:${day}`;
    if (this.sql("SELECT 1 FROM friend_gifts WHERE id=?", id).length) throw new Error("この人には今日もう贈りました。また明日。");
    this.sql("INSERT INTO friend_gifts VALUES (?,?,?,?,?,0)", id, uid, fid, day, now);
    return { ok: true, to: fid, day };
  }
  /** 受け取っていない贈り物 */
  pendingGifts(uid) {
    return this.sql("SELECT id, from_uid AS fromUid, day, at FROM friend_gifts WHERE to_uid=? AND claimed=0 ORDER BY at ASC", uid);
  }
  /** 受け取る印を付けて返す。財布への加算は呼ぶ側(1つの id に1枚) */
  claimGifts(uid, now) {
    const list = this.pendingGifts(uid);
    for (const g of list) this.sql("UPDATE friend_gifts SET claimed=? WHERE id=?", now, g.id);
    return list;
  }

  invite(uid, fid, code, now) {
    if (!this.isFriend(uid, fid)) throw new Error("フレンドにだけ招待を送れます。");
    if (typeof code !== "string" || !/^[\w-]{4,16}$/.test(code)) throw new Error("合言葉が正しくありません。");
    this.sql("INSERT OR REPLACE INTO friend_invites VALUES (?,?,?,?)", uid, fid, code, now);
    return { ok: true };
  }
  cancelInvite(uid, fid) {
    this.sql("DELETE FROM friend_invites WHERE from_uid=? AND to_uid=?", uid, fid);
    return { ok: true };
  }
  invitesFor(uid, now) {
    this.sql("DELETE FROM friend_invites WHERE at<?", now - INVITE_TTL_MS);
    return this.sql("SELECT from_uid AS fromUid, code, at FROM friend_invites WHERE to_uid=? ORDER BY at DESC", uid);
  }

  /**
   * 対戦中の在席を置く。観戦できる部屋の合言葉つき。
   * 本人が設定で観戦をオンにしているときだけ端末が呼ぶ(サーバーは形だけ見張る)。
   */
  enterRoom(uid, code, online, opp, now) {
    if (typeof code !== "string" || !ROOM_CODE_RE.test(code)) throw new Error("合言葉が正しくありません。");
    this.sql(
      "INSERT INTO friend_presence VALUES (?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET code=excluded.code, online=excluded.online, opp=excluded.opp, at=excluded.at",
      uid,
      code,
      online ? 1 : 0,
      str(opp, NAME_MAX),
      now,
    );
    return { ok: true };
  }
  /** 対戦を離れた印(観戦を締める) */
  leaveRoom(uid) {
    this.sql("DELETE FROM friend_presence WHERE uid=?", uid);
    return { ok: true };
  }
  /** その人が今どの部屋にいるか(古い印は無視)。フレンドにだけ見せる */
  presenceOf(uid, now) {
    const row = this.sql("SELECT code, online, opp, at FROM friend_presence WHERE uid=?", uid)[0];
    if (!row || row.at < now - PRESENCE_TTL_MS) return null;
    return { code: row.code, online: !!row.online, opp: row.opp || "" };
  }

  setProfile(uid, raw, now) {
    const card = sanitizeProfileCard(raw);
    this.sql(
      "INSERT INTO friend_profiles VALUES (?,?,?,?) ON CONFLICT(uid) DO UPDATE SET data=excluded.data, at=excluded.at, seen=excluded.seen",
      uid,
      JSON.stringify(card),
      now,
      now,
    );
    return { ok: true };
  }
  touch(uid, now) {
    this.sql("UPDATE friend_profiles SET seen=? WHERE uid=?", now, uid);
  }
  profileOf(uid) {
    const row = this.sql("SELECT data, at, seen FROM friend_profiles WHERE uid=?", uid)[0];
    if (!row) return null;
    let card = null;
    try {
      card = sanitizeProfileCard(JSON.parse(row.data));
    } catch {
      card = sanitizeProfileCard({});
    }
    return { ...card, at: row.at, seen: row.seen };
  }
  /** 名札(一覧に出す最小限)。プロフィールを送っていない人は名前が空 */
  tag(uid) {
    const p = this.profileOf(uid);
    return {
      uid,
      name: p?.name || "",
      icon: p?.icon || "",
      title: p?.title || "",
      frame: p?.frame || "",
      level: p?.level || 0,
      seen: p?.seen || 0,
    };
  }

  /** フレンド画面に要るものを一度に。rating は呼ぶ側が台帳から足す */
  state(uid, now) {
    this.touch(uid, now);
    const friends = this.sql("SELECT fid, at FROM friends WHERE uid=? ORDER BY at ASC", uid).map((r) => ({
      ...this.tag(r.fid),
      since: r.at,
      // 対戦中なら観戦できる部屋を添える(古い印は presenceOf が落とす)
      match: this.presenceOf(r.fid, now),
    }));
    const requestsIn = this.sql("SELECT from_uid AS uid, at FROM friend_requests WHERE to_uid=? ORDER BY at DESC", uid).map((r) => ({
      ...this.tag(r.uid),
      at: r.at,
    }));
    const requestsOut = this.sql("SELECT to_uid AS uid, at FROM friend_requests WHERE from_uid=? ORDER BY at DESC", uid).map((r) => ({
      ...this.tag(r.uid),
      at: r.at,
    }));
    return {
      code: this.codeOf(uid, now),
      max: FRIEND_MAX,
      day: jstDay(now),
      giftedTo: this.giftedToday(uid, now),
      friends,
      requestsIn,
      requestsOut,
      gifts: this.pendingGifts(uid).map((g) => ({ ...g, from: this.tag(g.fromUid) })),
      invites: this.invitesFor(uid, now).map((i) => ({ ...i, from: this.tag(i.fromUid) })),
    };
  }

  /** 記録を消す人の分を全部消す(フレンドの側からも外れる) */
  forget(uid) {
    for (const t of ["friend_codes", "friend_profiles", "friend_presence"]) this.sql(`DELETE FROM ${t} WHERE uid=?`, uid);
    this.sql("DELETE FROM friends WHERE uid=? OR fid=?", uid, uid);
    this.sql("DELETE FROM friend_requests WHERE from_uid=? OR to_uid=?", uid, uid);
    this.sql("DELETE FROM friend_invites WHERE from_uid=? OR to_uid=?", uid, uid);
    this.sql("DELETE FROM friend_gifts WHERE from_uid=? OR to_uid=?", uid, uid);
    return { ok: true };
  }
}
