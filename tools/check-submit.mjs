/**
 * App Store に出す前の関門。
 *
 * 「あとで直す」と決めたまま提出してしまうものを、機械に見張らせる。
 * **npm run check には入れていない。** 日々の作業を止めないため。
 * 提出する前に必ず `node tools/check-submit.mjs` を走らせること。
 *
 * 新しく「提出前に必ず直すもの」が見つかったら、ここに1つ足す。
 */
import fs from "node:fs";
import crypto from "node:crypto";

const 落ちた = [];
const 通った = [];

function 見る(名, 条件, どうする) {
  if (条件) 通った.push(名);
  else 落ちた.push({ 名, どうする });
}

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
const sha = (p) =>
  fs.existsSync(p)
    ? crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")
    : null;

// ---- 連絡先とポリシー(ガイドライン 1.2 / 5.1.1) ----
const support = read("src/game/support.js") || "";
見る(
  "運営の連絡先が決まっている",
  /export const SUPPORT_EMAIL = "[^"]+@[^"]+"/.test(support),
  "src/game/support.js の SUPPORT_EMAIL に、このアプリ専用のアドレスを入れる",
);
見る(
  "プライバシーポリシーの URL が決まっている",
  /export const PRIVACY_URL = "https:\/\/[^"]+"/.test(support),
  "src/game/support.js の PRIVACY_URL に、誰でも読める URL を入れる。先にその場所へ公開すること",
);

// ---- 1.2 が求める4点が実装に残っているか ----
見る(
  "名前の不適切語フィルタがある",
  /findBadWord/.test(read("src/game/profile.js") || ""),
  "src/game/profile.js の nameError() から findBadWord() を呼ぶ",
);
見る(
  "通報の導線がある",
  fs.existsSync("src/net/reports.js") &&
    /PlayerActionModal/.test(read("src/ui/season.jsx") || ""),
  "ランキングの行から通報できるようにする(src/ui/report.jsx)",
);
見る(
  "ブロックの手立てがある",
  fs.existsSync("src/game/blocked.js") &&
    /withoutBlocked/.test(read("src/ui/season.jsx") || ""),
  "src/game/blocked.js を使って、見えなくした相手を一覧から外す",
);
見る(
  "自分の記録を消せる(5.1.1(v))",
  /forgetMe/.test(read("src/ui/overlays.jsx") || "") &&
    /deleteRank/.test(read("src/net/ranking.js") || ""),
  "設定から forgetMe() と deleteRank() の両方を呼ぶ導線を出す",
);
見る(
  "記録の削除がシーズンの台帳にも及ぶ(5.1.1(v))",
  /forgetSeason/.test(read("src/ui/overlays.jsx") || "") &&
    /op === "forget"/.test(read("src/server/worker.js") || ""),
  "src/net/season.js の forgetSeason() を「自分の記録を消す」から呼び、worker.js で forget を受ける",
);
見る(
  "Firebase のルールに reports がある",
  /"reports"/.test(read("firebase-rules.json") || ""),
  "firebase-rules.json に reports を足し、Firebase のコンソールで公開する",
);

// ---- 配信ビルドの旗 ----
見る(
  "TEST_BUILD が false になっている",
  /export const TEST_BUILD = false/.test(read("src/game/profile.js") || ""),
  "src/game/profile.js の TEST_BUILD を false にする。true のままだと本番でも ?test=1 で時計が止まる",
);

// ---- iOS の見た目と設定 ----

/**
 * PNG のヘッダを直接読む。寸法と色の種類、透明の有無を返す。
 * 外部の道具を使わずに済ませたいので、IHDR と tRNS だけを見る。
 * colorType 2 = RGB(アルファ無し)、6 = RGBA、3 = パレット(tRNS で透明を持てる)。
 */
function png(p) {
  if (!fs.existsSync(p)) return null;
  const b = fs.readFileSync(p);
  if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47) return null;
  const info = {
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
    colorType: b[25],
    tRNS: false,
  };
  // チャンクをたどって tRNS があるかを見る
  let i = 8;
  while (i + 8 <= b.length) {
    const len = b.readUInt32BE(i);
    const type = b.toString("ascii", i + 4, i + 8);
    if (type === "tRNS") info.tRNS = true;
    if (type === "IEND") break;
    i += 12 + len;
  }
  return info;
}

const 既定のアイコン =
  "29e4777e319de3ee5a52c3a8004ec19d0568414004257e36d7c94a077d71c93b";
const 既定の起動画像 =
  "1b5002b74a5500e697298ced06ca2811ac33f2771f236f3c720ff23243890530";

/** 絵として出せる状態か。指紋だけでなく中身も見る */
function 絵を見る(名, p, size, 既定, どうする) {
  const i = png(p);
  const 良い =
    i !== null &&
    i.width === size &&
    i.height === size &&
    i.colorType === 2 &&
    !i.tRNS &&
    sha(p) !== 既定;
  let なぜ = どうする;
  if (i === null) なぜ = `${p} が無いか PNG として読めない。${どうする}`;
  else if (i.width !== size || i.height !== size)
    なぜ = `いまは ${i.width}x${i.height}。${size}x${size} にする`;
  else if (i.colorType !== 2 || i.tRNS)
    なぜ = `アルファか透明を持っている(colorType=${i.colorType}${i.tRNS ? ", tRNS あり" : ""})。アップロード時に ITMS-90717 で弾かれる。bash tools/make-icon.sh に通すと落とせる`;
  else if (sha(p) === 既定) なぜ = どうする;
  見る(名, 良い, なぜ);
}

絵を見る(
  "アプリアイコンが差し替わっていて、寸法とアルファも正しい",
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
  1024,
  既定のアイコン,
  "Capacitor の既定のロゴのまま。1024x1024(アルファ無し)の自前の絵に差し替える",
);
絵を見る(
  "起動画像が差し替わっていて、寸法とアルファも正しい",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
  2732,
  既定の起動画像,
  "Capacitor の既定の白紙のまま。2732x2732 の自前の絵に差し替える",
);

const plist = read("ios/App/App/Info.plist") || "";
const iPad対応 = /TARGETED_DEVICE_FAMILY = "1,2"/.test(
  read("ios/App/App.xcodeproj/project.pbxproj") || "",
);
見る(
  "iPad の向きの宣言が足りている",
  !iPad対応 ||
    (/UISupportedInterfaceOrientations~ipad/.test(plist) &&
      /UIInterfaceOrientationLandscapeLeft/.test(plist)),
  "iPad を対象にするなら Info.plist に UISupportedInterfaceOrientations~ipad で4方向を宣言する(無いと ITMS-90474 でアップロードが弾かれる)",
);
見る(
  "ITSAppUsesNonExemptEncryption を答えてある",
  /ITSAppUsesNonExemptEncryption/.test(plist),
  "Info.plist に ITSAppUsesNonExemptEncryption を足す(無いと提出のたびに暗号の質問が出る)",
);

// ---- 同梱物 ----
見る(
  "管理画面がアプリに入っていない",
  !fs.existsSync("ios/App/App/public/admin.html"),
  "npm run ios:sync を使って写す(cap copy を単体で使うと admin.html が入る)",
);

// ---- 結果 ----
for (const n of 通った) console.log(`  ○ ${n}`);
if (!落ちた.length) {
  console.log(`\n提出前の確認 ${通った.length}件、すべて通った。`);
  process.exit(0);
}
console.log("");
for (const f of 落ちた) console.log(`  × ${f.名}\n      → ${f.どうする}`);
console.log(`\n${落ちた.length}件が未了。直すまで提出しないこと。`);
process.exit(1);
