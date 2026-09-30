/**
 * TestFlight のビルドの状態を読むだけ(書き込みはしない)。強制アップデートの前に確かめるため(2026-09-30)。
 *
 *   node tools/asc-testflight-state.mjs            … 新しい順に5本
 *   node tools/asc-testflight-state.mjs 202609300845 … その番号に印を付ける
 *
 * 出すもの:
 *   - ビルドごとの 処理(VALID = 配れる)・内部テスターへの配信・外部テスターへの配信
 *     外部の IN_BETA_TESTING = 公開リンクの人にも配っている。READY_FOR_BETA_SUBMISSION は外部の審査に出す前
 *   - グループごとのテスターの人数と、配っているビルド
 *
 * **強制アップデート(wrangler.jsonc の MIN_APP_BUILD)は、外部の「テスター」グループがそのビルドを
 * IN_BETA_TESTING で受け取れるようになってから上げる。** 先に上げると、公開リンクの人が更新先の無いまま止まる。
 *
 * 鍵は ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH(無ければ testflight.yml と同じ値と ~/.appstoreconnect の鍵)。Node 22 で動かす。
 */
import fs from "node:fs";
import { SignJWT, importPKCS8 } from "jose";
import { APP_STORE_ID } from "../src/server/app-version.js";

const KEY_ID = process.env.ASC_KEY_ID || "U94V7XX3LN";
const ISSUER = process.env.ASC_ISSUER_ID || "d709d4c7-c92d-411e-8eef-14639582b814";
const KEY_PATH = process.env.ASC_KEY_PATH || `${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`;
const key = await importPKCS8(fs.readFileSync(KEY_PATH, "utf8"), "ES256");
const tok = await new SignJWT({ aud: "appstoreconnect-v1" })
  .setProtectedHeader({ alg: "ES256", kid: KEY_ID, typ: "JWT" })
  .setIssuer(ISSUER)
  .setIssuedAt()
  .setExpirationTime("10m")
  .sign(key);
const get = async (u) => {
  const r = await fetch(`https://api.appstoreconnect.apple.com${u}`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw new Error(`${r.status} ${u} ${(await r.text()).slice(0, 300)}`);
  return r.json();
};
const mark = process.argv[2] || null;

console.log("■ ビルド(新しい順)");
const builds = await get(
  `/v1/builds?filter[app]=${APP_STORE_ID}&sort=-uploadedDate&limit=5` +
    `&fields[builds]=version,processingState,uploadedDate,expired,buildBetaDetail&include=buildBetaDetail` +
    `&fields[buildBetaDetails]=internalBuildState,externalBuildState`,
);
const detail = Object.fromEntries((builds.included || []).map((x) => [x.id, x.attributes]));
for (const b of builds.data) {
  const d = detail[b.relationships?.buildBetaDetail?.data?.id] || {};
  console.log(
    `  ${b.attributes.version}  処理:${b.attributes.processingState}  内部:${d.internalBuildState}  外部:${d.externalBuildState}` +
      `${b.attributes.expired ? "  (期限切れ)" : ""}${mark && b.attributes.version === mark ? "  ← これ" : ""}`,
  );
}

console.log("■ グループ");
const groups = await get(`/v1/apps/${APP_STORE_ID}/betaGroups?fields[betaGroups]=name,isInternalGroup,publicLinkEnabled`);
for (const g of groups.data) {
  const gb = await get(`/v1/betaGroups/${g.id}/builds?limit=5&fields[builds]=version`);
  const gt = await get(`/v1/betaGroups/${g.id}/betaTesters?limit=200&fields[betaTesters]=state`);
  const versions = gb.data.map((b) => b.attributes.version).sort().reverse();
  console.log(
    `  「${g.attributes.name}」${g.attributes.isInternalGroup ? "内部" : "外部"}${g.attributes.publicLinkEnabled ? "・公開リンク" : ""}` +
      `  テスター ${gt.data.length}人  配っているビルド: ${versions.join(", ") || "(なし)"}` +
      `${mark && versions.includes(mark) ? "  ← これを配っている" : mark && !g.attributes.isInternalGroup ? "  ← まだ配っていない" : ""}`,
  );
}
