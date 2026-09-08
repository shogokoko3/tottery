// Local operator fixture. All authentication, data and mutations stay in memory.
import { build } from "esbuild";
import fs from "node:fs";
import http from "node:http";
import worker from "../src/server/worker.js";
import { OPERATOR_UID } from "../src/net/auth.js";
const stats = { signups: 0, dataReads: 0, writes: 0 };
const row = {
  name: "確認用プレイヤー",
  icon: "",
  title: "",
  plays: 12,
  wins: 7,
  rating: 900,
  rated: 10,
  since: Date.now() - 86400000,
  at: Date.now(),
};
const data = {
  players: { fixture: row },
  ranks: { fixture: row },
  bans: {},
  lobby: {},
  letters: { all: {}, to: {} },
};
globalThis.fetch = async (_url, init) => {
  const token = JSON.parse(init.body).idToken;
  return token === "operator-token"
    ? Response.json({ users: [{ localId: OPERATOR_UID }] })
    : token === "reader-token"
      ? Response.json({ users: [{ localId: "reader" }] })
      : Response.json({ error: "invalid" }, { status: 400 });
};
const result = await build({
  entryPoints: ["src/admin/admin.jsx"],
  bundle: true,
  jsx: "automatic",
  write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  plugins: [
    {
      name: "local-auth",
      setup(b) {
        b.onLoad({ filter: /src\/net\/auth\.js$/ }, () => ({
          loader: "js",
          contents:
            `const fetch=(url,init)=>window.fetch('/fixture?target='+encodeURIComponent(url),init);\n` +
            fs.readFileSync("src/net/auth.js", "utf8"),
        }));
      },
    },
  ],
});
const html = fs
  .readFileSync("admin.template.html", "utf8")
  .replace("__BUNDLE__", () => result.outputFiles[0].text)
  .replace(
    '<div id="root">',
    '<p style="color:#f0d98a;font:12px sans-serif;padding:8px">ローカル検証用 · ダミーデータのみ</p><div id="root">',
  );
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1:4258");
    const reply = (body, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/fixture/stats") return reply(stats);
    if (url.pathname === "/api/admin/session") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const r = await worker.fetch(
        new Request(url, { method: req.method, headers: req.headers, body }),
        {},
      );
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(await r.text());
      return;
    }
    if (url.pathname === "/fixture") {
      const target = new URL(url.searchParams.get("target"));
      let raw = "";
      for await (const chunk of req) raw += chunk;
      if (target.pathname.endsWith("accounts:signUp")) {
        stats.signups++;
        return reply({ error: { message: "UNEXPECTED_SIGNUP" } }, 400);
      }
      if (target.pathname.endsWith("accounts:signInWithPassword")) {
        const body = JSON.parse(raw),
          op = body.email === "operator@example.test";
        if (body.password !== "demo-password")
          return reply(
            { error: { message: "INVALID_LOGIN_CREDENTIALS" } },
            400,
          );
        return reply({
          localId: op ? OPERATOR_UID : "reader",
          idToken: op ? "operator-token" : "reader-token",
          refreshToken: op ? "operator-refresh" : "reader-refresh",
          expiresIn: "3600",
        });
      }
      if (target.hostname === "securetoken.googleapis.com") {
        const op =
          new URLSearchParams(raw).get("refresh_token") === "operator-refresh";
        return reply({
          user_id: op ? OPERATOR_UID : "reader",
          id_token: op ? "operator-token" : "reader-token",
          refresh_token: op ? "operator-refresh" : "reader-refresh",
          expires_in: "3600",
        });
      }
      if (target.searchParams.get("auth") !== "operator-token")
        return reply({ error: "Permission denied" }, 401);
      const path = target.pathname
        .replace(/^\//, "")
        .replace(/\.json$/, "")
        .split("/");
      if (!Object.hasOwn(data, path[0])) return reply({}, 404);
      if (req.method === "GET") {
        stats.dataReads++;
        let value = data;
        for (const part of path) value = value?.[part];
        return reply(value ?? null);
      }
      stats.writes++;
      let parent = data;
      for (const part of path.slice(0, -1)) parent = parent[part] ??= {};
      const key = path.at(-1);
      if (req.method === "DELETE") delete parent[key];
      else parent[key] = JSON.parse(raw);
      return reply(parent[key] ?? null);
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
  })
  .listen(4258, "127.0.0.1", () =>
    console.log("Local admin fixture: http://127.0.0.1:4258/admin"),
  );
