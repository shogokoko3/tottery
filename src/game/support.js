/**
 * 運営の連絡先と、外部に置く文書の場所。
 *
 * App Store のガイドライン 1.2 は、利用者が作った文章を他人に見せるアプリに
 * 「公開された連絡先」を求めている。5.1.1 はプライバシーポリシーの URL を求める。
 * どちらもアプリの中と App Store Connect の両方に出るので、ここ1箇所にまとめる。
 *
 * **どちらも未設定のままでは提出できない。**
 * 値を入れたら `node tools/check-submit.mjs` が通るようになる。
 * この検査は npm run check には入れていない(日々の作業を止めないため)。
 * 提出の前に必ず走らせること。
 */

/**
 * 問い合わせ先。このアプリ専用のアドレスを用意して入れる。
 * 個人の常用アドレスは入れない — App Store とアプリの中から誰でも読める。
 */
export const SUPPORT_EMAIL = "TS_manager@tottery.support"; // 2026-09-12 本人が用意したアプリ専用のアドレス(独自ドメイン)

/**
 * プライバシーポリシーを置く場所。誰でも読める URL でなければならない。
 * 配信先は Cloudflare Workers(tottery.tsmanager.workers.dev)。
 */
// build.mjs が プライバシーポリシー.md から privacy.html を作り、dist/ に置く
export const PRIVACY_URL = "https://tottery.tsmanager.workers.dev/privacy";

/** 連絡先が決まっているか。画面はこれを見て出し分ける */
export function hasSupportContact() {
  return typeof SUPPORT_EMAIL === "string" && SUPPORT_EMAIL.includes("@");
}

/** ポリシーの置き場所が決まっているか */
export function hasPrivacyUrl() {
  return typeof PRIVACY_URL === "string" && PRIVACY_URL.startsWith("https://");
}

/** 問い合わせ用の mailto。件名に版を入れて、どの版からの連絡か分かるようにする */
export function supportMailto(version) {
  if (!hasSupportContact()) return null;
  const subject = encodeURIComponent(`トッタリー ${version || ""} お問い合わせ`);
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
}
