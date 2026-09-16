/**
 * npm install / npm ci のあとに、Capacitor プラグインの Swift パッケージを直す(postinstall)。
 *
 * @capacitor-community/apple-sign-in 7.1.0 は Package.swift で capacitor-swift-pm を 7.x に縛っている。
 * このアプリは Capacitor 8(native-purchases は 8.x を要求)なので、そのままだと xcodebuild が
 * 「'apple-sign-in' depends on 'capacitor-swift-pm' 7.0.0..<8.0.0」で止まる(2026-09-16 に npm ci で踏んだ)。
 * Swift の中身は 8 でも動く(TestFlight の実機で Apple サインインが通っている)ので、下限を 8.0.0 に書き換える。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// パスに日本語が入る(トッタリー)。URL の pathname は %E3… になるので fileURLToPath で戻す
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "node_modules/@capacitor-community/apple-sign-in/Package.swift");
if (!fs.existsSync(target)) {
  console.log("patch-plugins: apple-sign-in の Package.swift が無い(未インストール)。何もしない");
  process.exit(0);
}
const before = fs.readFileSync(target, "utf8");
const after = before.replace(
  /\.package\(url: "https:\/\/github\.com\/ionic-team\/capacitor-swift-pm\.git", from: "7\.0\.0"\)/,
  '.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")',
);
if (after === before) {
  console.log(after.includes('from: "8.0.0"') ? "patch-plugins: apple-sign-in は直っている" : "patch-plugins: apple-sign-in の書き方が変わっている。tools/patch-plugins.mjs を見直す");
} else {
  fs.writeFileSync(target, after);
  console.log("patch-plugins: apple-sign-in の capacitor-swift-pm を 8.0.0 以上にした");
}
