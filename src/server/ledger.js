import {
  seasonAt,
  validSeason,
  seasonRewards,
  rewardReady,
  tierOf,
  SEASON_BACK,
  SEASON_FRAME,
} from "../game/season.js";
import { displayRating, nextRating } from "../game/rating.js";

/** 記録を消した人の目印の代わり。matches に残る */
export const FORGOTTEN = "forgotten";

// Cloudflare SQLite と検証用 node:sqlite で同じ SQL を実行する。
export class Ledger {
  constructor(sql) {
    this.sql = sql;
    sql(
      "CREATE TABLE IF NOT EXISTS seasons (id TEXT PRIMARY KEY, start INTEGER, end INTEGER)",
    );
    sql(
      "CREATE TABLE IF NOT EXISTS players (season TEXT, uid TEXT, name TEXT, icon TEXT, wr REAL, rated INTEGER, wins INTEGER, draws INTEGER, highest INTEGER, best INTEGER, PRIMARY KEY(season, uid))",
    );
    sql("CREATE INDEX IF NOT EXISTS player_history ON players(uid, season)");
    // 旧テーブルの列数を変えずに、既存の点数を一度だけEloへ移行する。
    sql(
      "CREATE TABLE IF NOT EXISTS elo_ratings (season TEXT, uid TEXT, rating INTEGER, PRIMARY KEY(season, uid))",
    );
    for (const p of sql(
      "SELECT p.* FROM players p LEFT JOIN elo_ratings e ON e.season=p.season AND e.uid=p.uid WHERE e.uid IS NULL",
    )) {
      sql(
        "INSERT OR IGNORE INTO elo_ratings VALUES (?,?,?)",
        p.season,
        p.uid,
        displayRating(p.wr),
      );
    }
    sql(
      "CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, season TEXT, host TEXT, guest TEXT, winner INTEGER, finished INTEGER)",
    );
    sql(
      "CREATE TABLE IF NOT EXISTS claims (uid TEXT, id TEXT, season TEXT, claimed INTEGER, PRIMARY KEY(uid,id))",
    );
    sql(
      "CREATE TABLE IF NOT EXISTS appearance (uid TEXT PRIMARY KEY, back TEXT, frame TEXT)",
    );
  }
  current(now) {
    const season = seasonAt(now);
    this.sql(
      "INSERT OR IGNORE INTO seasons VALUES (?,?,?)",
      season.id,
      season.start,
      season.end,
    );
    // 対局数の段位条件を廃止。今季の既存プレイヤーも現在レートで到達扱いにする。
    // 過去に獲得した段位と終了済みシーズンの記録は保持する。
    for (const p of this.list(season.id)) {
      const highest = Math.max(p.highest, tierOf(p));
      if (highest !== p.highest)
        this.sql(
          "UPDATE players SET highest=? WHERE season=? AND uid=?",
          highest,
          season.id,
          p.uid,
        );
    }
    return season;
  }
  list(id) {
    const rows = this.sql(
      "SELECT p.*, e.rating FROM players p LEFT JOIN elo_ratings e ON e.season=p.season AND e.uid=p.uid WHERE p.season=? ORDER BY e.rating DESC, p.uid ASC",
      id,
    );
    let previous = null,
      place = 0,
      index = 0;
    return rows.map((p) => {
      const rating = p.rating ?? displayRating(p.wr);
      if (p.rated >= 10) {
        index++;
        if (rating !== previous) place = index;
        previous = rating;
      }
      return { ...p, rating, place: p.rated >= 10 ? place : null };
    });
  }
  result(uid, id) {
    const m = this.sql("SELECT * FROM matches WHERE id=?", id)[0];
    if (m && m.host !== uid && m.guest !== uid)
      throw new Error("この対局の参加者ではありません。");
    return m || null;
  }
  record(match, now) {
    if (this.result(match.host, match.id)) return;
    const season = this.current(now);
    const before = [match.host, match.guest].map((uid) => {
      const p = this.sql(
        "SELECT p.*, e.rating FROM players p LEFT JOIN elo_ratings e ON e.season=p.season AND e.uid=p.uid WHERE p.season=? AND p.uid=?",
        season.id,
        uid,
      )[0] || { wr: 0.5, rated: 0, wins: 0, draws: 0, highest: 0, best: null };
      return { ...p, rating: p.rating ?? displayRating(p.wr) };
    });
    for (const [seat, uid] of [match.host, match.guest].entries()) {
      const p = before[seat];
      const won = match.winner === null ? null : seat === match.winner;
      const next = {
        ...p,
        ...nextRating(p.rating, before[1 - seat].rating, won),
        rated: p.rated + 1,
      };
      next.wr =
        (p.wins +
          Number(won === true) +
          (p.draws + Number(won === null)) * 0.5) /
        next.rated;
      next.highest = Math.max(p.highest, tierOf(next));
      this.sql(
        "INSERT OR REPLACE INTO elo_ratings VALUES (?,?,?)",
        season.id,
        uid,
        next.rating,
      );
      this.sql(
        "INSERT OR REPLACE INTO players VALUES (?,?,?,?,?,?,?,?,?,?)",
        season.id,
        uid,
        match.names[seat],
        match.icons[seat],
        next.wr,
        next.rated,
        p.wins + Number(won === true),
        p.draws + Number(won === null),
        next.highest,
        p.best,
      );
    }
    this.sql(
      "INSERT INTO matches VALUES (?,?,?,?,?,?)",
      match.id,
      season.id,
      match.host,
      match.guest,
      match.winner,
      now,
    );
    for (const p of this.list(season.id)) {
      if (p.place && (!p.best || p.place < p.best))
        this.sql(
          "UPDATE players SET best=? WHERE season=? AND uid=?",
          p.place,
          season.id,
          p.uid,
        );
    }
  }
  claims(uid) {
    return this.sql(
      "SELECT id,season,claimed FROM claims WHERE uid=? ORDER BY claimed",
      uid,
    );
  }
  owned(uid) {
    const rewards = this.claims(uid)
      .map((c) => seasonRewards(c.season).find((r) => r.id === c.id))
      .filter(Boolean);
    return {
      backs: rewards.some((r) => r.back) ? [SEASON_BACK] : [],
      frames: rewards.some((r) => r.frame) ? [SEASON_FRAME] : [],
      titles: rewards.filter((r) => r.title).map((r) => r.title),
    };
  }
  appearance(uid) {
    const a = this.sql("SELECT back,frame FROM appearance WHERE uid=?", uid)[0];
    return a || { back: null, frame: null };
  }
  /**
   * 本人のシーズン記録を消す(アプリの「自分の記録を消す」から)。
   *
   * 成績・持ち点・受け取った報酬・裏面と枠は行ごと消す。
   * 対局の記録(matches)は相手の成績の根拠であり、同じ対局の二重記録を
   * 防ぐ鍵でもあるので残し、本人の目印だけ外す。
   */
  forget(uid) {
    for (const table of ["players", "elo_ratings", "claims", "appearance"])
      this.sql(`DELETE FROM ${table} WHERE uid=?`, uid);
    this.sql("UPDATE matches SET host=? WHERE host=?", FORGOTTEN, uid);
    this.sql("UPDATE matches SET guest=? WHERE guest=?", FORGOTTEN, uid);
    return { ok: true };
  }
  adminSummary(now) {
    const season = this.current(now);
    return {
      season,
      players: this.list(season.id),
      matches: this.sql(
        "SELECT COUNT(*) AS total FROM matches WHERE season=?",
        season.id,
      )[0].total,
    };
  }
  summary(uid, now) {
    const season = this.current(now),
      rows = this.list(season.id);
    const history = this.sql(
      "SELECT seasons.* FROM seasons JOIN players ON players.season=seasons.id WHERE players.uid=? AND seasons.end<=? ORDER BY seasons.id DESC",
      uid,
      now,
    ).map((s) => ({
      ...s,
      player: this.list(s.id).find((p) => p.uid === uid),
    }));
    return {
      uid,
      now,
      season,
      player: rows.find((p) => p.uid === uid) || null,
      list: rows
        .filter((p) => p.place)
        .slice(0, 100)
        .map((p) => ({
          uid: p.uid,
          name: p.name,
          icon: p.icon,
          rating: p.rating,
          rated: p.rated,
          place: p.place,
          frame: this.appearance(p.uid).frame,
        })),
      history,
      claims: this.claims(uid),
      owned: this.owned(uid),
      appearance: this.appearance(uid),
    };
  }
  claim(uid, id, now) {
    const season = typeof id === "string" ? id.slice(0, 7) : "";
    const reward =
      validSeason(season) && seasonRewards(season).find((r) => r.id === id);
    const period = this.sql("SELECT * FROM seasons WHERE id=?", season)[0];
    if (!reward || !period) throw new Error("報酬が見つかりません。");
    const player = this.list(season).find((p) => p.uid === uid);
    if (!rewardReady(reward, player, now >= period.end))
      throw new Error("まだ報酬の条件を満たしていません。");
    this.sql(
      "INSERT OR IGNORE INTO claims VALUES (?,?,?,?)",
      uid,
      id,
      season,
      now,
    );
    return this.summary(uid, now);
  }
  equip(uid, back, frame, now) {
    const owned = this.owned(uid);
    if (
      (back !== null && !owned.backs.includes(back)) ||
      (frame !== null && !owned.frames.includes(frame))
    )
      throw new Error("まだ獲得していない装飾です。");
    this.sql(
      "INSERT OR REPLACE INTO appearance VALUES (?,?,?)",
      uid,
      back,
      frame,
    );
    return this.summary(uid, now);
  }
}
