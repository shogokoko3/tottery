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

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  if (path.startsWith("/api/season/")) return fakeSeason(req, res, path);
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
