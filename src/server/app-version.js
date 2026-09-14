/**
 * 強制アップデート(最低ビルド番号)。
 *
 * これ未満の iOS アプリは、起動時に更新を促して先へ進ませない(遊べない)。
 * 既定は 0 = 誰もブロックしない。強制するときは **Worker の環境変数 MIN_APP_BUILD** を、
 * 締め出したいビルド番号の上限(＝配布した最新ビルドの番号)に設定する。
 * ビルド番号は時刻から作る単調増加の整数(例 202609140130。ios-release.sh が印字する
 * CURRENT_PROJECT_VERSION)なので、数の大小だけで比較できる。
 *
 * 安全側に倒す(フェイルオープン): サーバーに届かない・値が 0/不明のときはブロックしない。
 * サーバー障害で全員が締め出される事故を避ける。対象は iOS だけ(判定はアプリ側)。
 */
export const MIN_APP_BUILD_DEFAULT = 0;
/** App Store のアプリID(App Store Connect のアプリURLの数字)。更新ページに使う */
export const APP_STORE_ID = "6811241552";
export const appStoreUrl = () => `https://apps.apple.com/app/id${APP_STORE_ID}`;

/**
 * 更新ページの URL。環境変数 APP_UPDATE_URL(https のみ)があればそれ、無ければ App Store。
 * TestFlight の期間は App Store にまだ無いので、パブリックリンク(testflight.apple.com/join/…)を入れる。
 * 正式リリース後は空にして App Store に戻す(wrangler.jsonc の vars)
 */
export function updateUrl(env) {
  const u =
    env && typeof env.APP_UPDATE_URL === "string"
      ? env.APP_UPDATE_URL.trim()
      : "";
  return /^https:\/\/[\w.-]+\.apple\.com\/\S*$/.test(u) ? u : appStoreUrl();
}

/** 環境変数から最低ビルド番号を読む。正の整数でなければ既定(0=ブロックしない) */
export function minAppBuild(env) {
  const n = Number(env && env.MIN_APP_BUILD);
  return Number.isSafeInteger(n) && n > 0 ? n : MIN_APP_BUILD_DEFAULT;
}

/**
 * 更新が要るか。両方が正の整数で、アプリのビルドが最低未満のときだけ true。
 * どちらかが 0/不明ならブロックしない(フェイルオープン)。
 */
export function needsUpdate(appBuild, minBuild) {
  const a = Number(appBuild),
    m = Number(minBuild);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(m) || a <= 0 || m <= 0)
    return false;
  return a < m;
}
