/**
 * 店の診断を読む(運営用)。端末が App Store に商品を問い合わせた結果の控え(uid ごとに最新の1件)。
 *
 *   node tools/iap-diag.mjs
 *
 * 秘密のトークン(Worker の DIAG_TOKEN。`npx wrangler secret put DIAG_TOKEN` で入れたもの)を
 * ~/.config/tottery/diag-token から読む。トークンは読み取り専用で、この一覧しか読めない。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.TOTTERY_API || "https://tottery.tsmanager.workers.dev";
const file = process.env.DIAG_TOKEN_FILE || path.join(os.homedir(), ".config", "tottery", "diag-token");
const token = (process.env.DIAG_TOKEN || fs.readFileSync(file, "utf8")).trim();
const res = await fetch(`${BASE}/api/admin/diag`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: "{}",
});
const data = await res.json().catch(() => ({}));
if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
const rows = data.diag || [];
if (!rows.length) console.log("控えはまだありません(端末がまだ店を開いていない、または古いビルド)");
for (const r of rows) {
  const when = new Date(r.at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  console.log(
    `${when}  uid=${r.uid}  ビルド ${r.build ?? "?"}  ストア ${r.storefront || "?"}  ` +
      `${r.count ?? "?"}件  ${r.ms != null ? (r.ms / 1000).toFixed(1) + "秒" : ""}  ${r.error || "(成功)"}`,
  );
}
