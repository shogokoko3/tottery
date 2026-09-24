/**
 * 動作確認用の素朴な静的サーバ。index.html を配る。
 *
 * 本番ではシーズン(月間ランキング)を Cloudflare Worker(src/server/worker.js)が
 * 返すが、ここには無い。何も返さないと画面が「読み込めませんでした」で止まり、
 * ランキングの行(通報の「⋯」など)を確かめられないので、/api/season/summary
 * にだけ**見本の一覧**を返す。名前に「見本」と入れてあり、対局を記録したり
 * 報酬を配ったりはしない(finish / claim / equip は断る)。
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Friends } from "../src/server/friends.js";
import { Wallet } from "../src/server/wallet.js";

const root = process.cwd();
const firstPort = Number(process.env.PORT || 4199);
/** 埋まっていたら順に試す回数 */
const TRIES = 10;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".png": "image/png",
  ".json": "application/json",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
};

/** シーズン API の見本。summary と forget だけ答える */
function fakeSeason(req, res, path) {
  const send = (status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  const op = path.slice("/api/season/".length);
  if (op === "health") return send(200, { ok: true, version: 0, local: true });
  if (req.method !== "POST") return send(405, { error: "POSTを使用してください。" });
  if (op === "forget") return send(200, { ok: true });
  if (op !== "summary")
    return send(404, {
      error: `手元のサーバー(tools/serve.mjs)にシーズンの台帳はありません(${op})。一覧は見本です。`,
    });
  const now = Date.now();
  const d = new Date(now + 9 * 3600e3);
  const y = d.getUTCFullYear(),
    m = d.getUTCMonth();
  const id = `${y}-${String(m + 1).padStart(2, "0")}`;
  const start = Date.UTC(y, m, 1, 5 - 9),
    end = Date.UTC(y, m + 1, 1, 5 - 9);
  const row = (uid, name, rating, place) => ({
    uid,
    name,
    icon: "",
    rating,
    rated: 12,
    place,
    frame: null,
  });
  send(200, {
    uid: null,
    now,
    season: { id, start, end },
    player: null,
    list: [
      row("sample-1", "見本の一", 1680, 1),
      row("sample-2", "見本の二", 1590, 2),
      row("sample-3", "見本の三", 1520, 3),
    ],
    history: [],
    claims: [],
    owned: { backs: [], frames: [], titles: [] },
    appearance: { back: null, frame: null },
  });
}

/**
 * フレンドの見本(2026-09-23)。本物の src/server/friends.js をメモリの SQLite で動かす。
 * 本人確認は無く、誰が呼んでも uid は "me"。開くたびに消える。
 * 最初から: フレンド「見本のたろう」(贈り物と招待つき)、申請「見本のはなこ」
 */
const fdb = new DatabaseSync(":memory:");
const fsql = (q, ...a) => fdb.prepare(q).all(...a);
const friends = new Friends(fsql);
const fwallet = new Wallet(fsql);
{
  const t = Date.now();
  friends.setProfile("taro", { name: "見本のたろう", icon: "spade", title: "rank-shi", pinnedTitle: "fortress", bg: "sea", level: 22, showcase: ["rating", "wins", "streak"], stats: { battles: 120, wins: 70, draws: 3, rated: 40, titles: 9, streak: 12, days: 60, mastery: 300, tsume: 15 } }, t - 3600e3);
  friends.setProfile("hana", { name: "見本のはなこ", icon: "heart", title: "novice", level: 5, showcase: [], stats: { battles: 8, wins: 3 } }, t - 86400e3);
  friends.link("me", "taro", t - 86400e3 * 3);
  friends.request("hana", friends.codeOf("me", t), t - 600e3);
  friends.gift("taro", "me", t - 1800e3);
  friends.invite("taro", "me", "ABCDEF", t - 30e3);
  // たろうは対戦中(観戦の見本)。フレンド戦なので審判視点
  friends.enterRoom("taro", "WATCH1", false, "見本の相手", t - 60e3);
}
function fakeFriends(req, res, path) {
  const send = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(data));
  };
  if (req.method !== "POST") return send(405, { error: "POSTを使用してください。" });
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {}
    const op = path.slice("/api/friends/".length);
    const uid = "me",
      now = Date.now();
    const rating = (u) => (u === "taro" ? 1612 : u === "hana" ? 1500 : 1637);
    const withRating = (tag) => ({ ...tag, rating: rating(tag.uid) });
    try {
      if (op === "state") {
        const st = friends.state(uid, now);
        return send(200, { ...st, friends: st.friends.map(withRating), requestsIn: st.requestsIn.map(withRating), requestsOut: st.requestsOut.map(withRating) });
      }
      if (op === "request" && typeof body.code === "string") return send(200, friends.request(uid, body.code, now, "code"));
      if (op === "request") return send(200, friends.requestUid(uid, body.uid, now, body.source));
      if (op === "accept") return send(200, friends.accept(uid, body.uid, now));
      if (op === "decline") return send(200, friends.decline(uid, body.uid));
      if (op === "cancel") return send(200, friends.cancel(uid, body.uid));
      if (op === "remove") return send(200, friends.remove(uid, body.uid));
      if (op === "gift") return send(200, friends.gift(uid, body.uid, now));
      if (op === "claim") {
        const list = friends.claimGifts(uid, now);
        for (const g of list) fwallet.credit(uid, g.id, 1, "friend-gift", now);
        return send(200, { claimed: list.map((g) => ({ ...g, from: friends.tag(g.fromUid) })), wallet: fwallet.summary(uid, now) });
      }
      if (op === "invite") return send(200, friends.invite(uid, body.uid, body.code, now));
      if (op === "cancel-invite") return send(200, friends.cancelInvite(uid, body.uid));
      if (op === "enter-room") return send(200, friends.enterRoom(uid, body.code, body.online, body.opp, now));
      if (op === "leave-room") return send(200, friends.leaveRoom(uid));
      if (op === "ping") return send(200, friends.seenNow(uid, now));
      if (op === "profile-set") return send(200, friends.setProfile(uid, body.card, now));
      if (op === "profile-get") {
        // 端末の本当の uid は Firebase のもの。見本の2人以外は「自分」とみなす
        const target = ["taro", "hana"].includes(body.uid) ? body.uid : uid;
        if (target !== uid && !friends.isFriend(uid, target)) return send(400, { error: "フレンドのプロフィールだけ見られます。" });
        return send(200, { uid: target, card: friends.profileOf(target), rating: rating(target), place: target === "taro" ? 12 : null, best: target === "taro" ? 4 : null, rated: 0, appearance: { back: null, frame: null }, friend: true });
      }
      return send(404, { error: "見つかりません。" });
    } catch (e) {
      return send(400, { error: e.message });
    }
  });
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  if (path.startsWith("/api/season/")) return fakeSeason(req, res, path);
  if (path.startsWith("/api/friends/")) return fakeFriends(req, res, path);
  // 本番は /privacy で privacy.html が出る(Cloudflare の静的配信の既定)。手元でも同じに
  if (path === "/privacy") req.url = "/privacy.html";
  const rel = normalize(
    path === "/" ? "/index.html" : path === "/privacy" ? "/privacy.html" : path,
  ).replace(
    /^(\.\.[/\\])+/,
    "",
  );
  try {
    const body = await readFile(join(root, rel));
    res.writeHead(200, {
      "Content-Type": types[extname(rel)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
});

let port = firstPort;

// 同じサーバーが既に動いていることは珍しくないので、
// 例外を投げて終わらずに、空いている番号へずらして知らせる
server.on("error", (err) => {
  if (err.code !== "EADDRINUSE") throw err;
  if (port === firstPort) {
    console.log(
      `${firstPort} 番はすでに使われています。` +
        `同じサーバーが動いているなら http://localhost:${firstPort}/ をそのまま開けます。`,
    );
  }
  if (port - firstPort >= TRIES) {
    console.error(
      `${firstPort}〜${firstPort + TRIES} 番がすべて埋まっています。PORT=8080 のように指定してください。`,
    );
    process.exit(1);
  }
  port++;
  server.listen(port);
});

server.listen(port, () => console.log(`http://localhost:${port}/`));
