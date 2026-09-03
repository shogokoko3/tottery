/** 動作確認用の素朴な静的サーバ。index.html を配るだけ。 */
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
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  const rel = normalize(path === "/" ? "/index.html" : path).replace(
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
