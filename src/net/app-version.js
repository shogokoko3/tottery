/**
 * 起動時のバージョン確認(強制アップデート)。
 *
 * iOS アプリのときだけ、Worker の /api/app-version から最低ビルド番号を取り、
 * このアプリのビルド(__APP_BUILD__)がそれ未満なら「更新して」の画面でブロックする。
 * 通信できない・値が 0/不明のときは通す(フェイルオープン。サーバー障害で締め出さない)。
 * 詳しい方針は src/server/app-version.js。
 */
import { Capacitor } from "@capacitor/core";
import { seasonApiBase } from "./season.js";

// このビルドの番号(build.mjs が埋める)。Web や手元・テストでは 0(＝ゲート無効)
export const APP_BUILD =
  typeof __APP_BUILD__ !== "undefined" ? __APP_BUILD__ : 0;
const FALLBACK_STORE_URL = "https://apps.apple.com/app/id6811241552";

/**
 * 更新が必要かを返す。{ blocked, storeUrl }。
 * ブロックするのは iOS で、両方が正の整数で、アプリのビルドが最低未満のときだけ。
 */
export async function checkAppVersion() {
  // iOS だけ。Android は versionCode が別系統(2020-01-01 からの経過分数)で、
  // 同じ MIN_APP_BUILD と比べると必ずブロックになってしまう。
  // Android の強制アップデートは、Play の In-App Update か別の環境変数で後から足す
  // (2026-09-19 Android 版の土台を足したとき)
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios")
    return { blocked: false };
  try {
    const res = await fetch(`${seasonApiBase()}/api/app-version`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { blocked: false };
    const data = await res.json();
    const minBuild = Number(data.minBuild);
    if (
      Number.isSafeInteger(APP_BUILD) &&
      APP_BUILD > 0 &&
      Number.isSafeInteger(minBuild) &&
      minBuild > 0 &&
      APP_BUILD < minBuild
    )
      return { blocked: true, storeUrl: data.storeUrl || FALLBACK_STORE_URL };
    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}
