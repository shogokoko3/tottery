/**
 * Android 版の土台を確かめる。
 *
 * 見るのは「Play に出すときに間違えると気づきにくいところ」だけ:
 *   - 版の番号(versionCode)が Play の上限に収まり、単調に増えるか
 *   - 運営用の画面(admin.html)が AAB に入らないようになっているか
 *   - 店・広告・近接・強制アップデートが、Android では出ない側に倒れているか
 *     (サーバーの検証が Apple 専用なので、いまの Android は「店なし」が正しい)
 */
import assert from "node:assert/strict";
import fs from "node:fs";

let ok = 0;
const fail = [];
const is = (label, got, want) => {
  try {
    assert.deepEqual(got, want);
    ok++;
    console.log(`  ok   ${label}`);
  } catch {
    fail.push(label);
    console.log(
      `  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`,
    );
  }
};
const read = (p) => fs.readFileSync(p, "utf8");

const HAS_ANDROID = fs.existsSync("android/app/build.gradle");

console.log("版の番号(versionCode)");
// tools/android-release.sh と同じ式。Play は 2,100,000,000 未満の整数しか受け取らない
const codeAt = (ms) => Math.floor((ms - Date.UTC(2020, 0, 1)) / 60000);
is("いまの番号は Play の上限内", codeAt(Date.now()) < 2100000000, true);
is("正の整数になる", Number.isSafeInteger(codeAt(Date.now())) && codeAt(Date.now()) > 0, true);
is("1分後のほうが大きい", codeAt(Date.now() + 60000) > codeAt(Date.now()), true);
// 2100000000 分 ≒ 3993年。当分あふれない
is("2100年でもまだ上限内", codeAt(Date.UTC(2100, 0, 1)) < 2100000000, true);
is(
  "iOS の番号(12桁)をそのまま使うと上限を超える(だから別系統にしている)",
  202609190705 > 2100000000,
  true,
);

console.log("\nアプリに入れないもの");
const strip = read("tools/strip-public.mjs");
is("写し先に android がある", strip.includes("android/app/src/main/assets/public"), true);
is("admin.html を落とす", strip.includes("admin.html"), true);
is(
  "同期でできた控え(「skins 3」など)も落とす",
  /控えを落とす/.test(strip),
  true,
);
// 実際に落ちるかを、作り話のフォルダで確かめる
{
  const tmp = fs.mkdtempSync("/tmp/tottery-strip-");
  fs.mkdirSync(tmp + "/skins 3/board", { recursive: true });
  fs.mkdirSync(tmp + "/skins/board", { recursive: true });
  fs.writeFileSync(tmp + "/skins/board/a.webp", "x");
  fs.writeFileSync(tmp + "/skins/board/a 2.webp", "x");
  fs.writeFileSync(tmp + "/index.html", "x");
  const 落とす = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (/ \d+(\.[^.]+)?$/.test(e.name)) {
        fs.rmSync(dir + "/" + e.name, { recursive: true, force: true });
        continue;
      }
      if (e.isDirectory()) 落とす(dir + "/" + e.name);
    }
  };
  落とす(tmp);
  is("控えのフォルダが消える", fs.existsSync(tmp + "/skins 3"), false);
  is("入れ子の控えも消える", fs.existsSync(tmp + "/skins/board/a 2.webp"), false);
  is("本体は残る", fs.existsSync(tmp + "/skins/board/a.webp"), true);
  fs.rmSync(tmp, { recursive: true, force: true });
}
const pkg = JSON.parse(read("package.json"));
is(
  "android:sync が写したあとに落としている",
  /cap copy android && node tools\/strip-public\.mjs android/.test(pkg.scripts["android:sync"] || ""),
  true,
);
is(
  "ios:sync も同じ道具を使う",
  /strip-public\.mjs ios/.test(pkg.scripts["ios:sync"] || ""),
  true,
);

console.log("\nAndroid では出さないもの");
const platform = read("src/net/platform.js");
is("店の判定は iOS だけ", /getPlatform\(\) === "ios"/.test(platform), true);
is("hasStore を配っている", /export function hasStore/.test(platform), true);
const iap = read("src/net/iap.js");
is("店は hasStore で判定する", iap.includes("hasStore()"), true);
is(
  "店の判定に素の isNativePlatform を使っていない",
  /Capacitor\.isNativePlatform\(\)/.test(iap),
  false,
);
for (const p of ["src/ui/battlepass-access.js", "src/ui/battlepass-track.jsx"]) {
  const s = read(p);
  is(`${p}: バトルパスの解放も hasStore で見る`, s.includes("hasStore()"), true);
  is(
    `${p}: 素の isNativePlatform で閉じていない(店の無い Android で行き止まりになる)`,
    /Capacitor\.isNativePlatform\(\)/.test(s),
    false,
  );
}
is(
  "広告は iOS だけ",
  /getPlatform\(\) !== "ios"/.test(read("src/net/ads.js")),
  true,
);
is(
  "強制アップデートは iOS だけ(番号が別系統なので)",
  /getPlatform\(\) !== "ios"/.test(read("src/net/app-version.js")),
  true,
);
is(
  "Apple でのサインインは iOS だけ",
  /getPlatform\(\) === "ios"/.test(read("src/net/apple-signin.js")),
  true,
);
is(
  "近くの端末はプラグインが載っているときだけ(Android には無い)",
  /isPluginAvailable\("Nearby"\)/.test(read("src/net/nearby.js")),
  true,
);

if (HAS_ANDROID) {
  console.log("\nAndroid プロジェクト");
  const gradle = read("android/app/build.gradle");
  const vars = read("android/variables.gradle");
  const strings = read("android/app/src/main/res/values/strings.xml");
  const cap = JSON.parse(read("capacitor.config.json"));
  is(
    "versionCode は外から渡す(1 の固定ではない)",
    /versionCode project\.hasProperty\("totteryVersionCode"\)/.test(gradle),
    true,
  );
  is(
    "versionName も外から渡す",
    /versionName project\.hasProperty\("totteryVersionName"\)/.test(gradle),
    true,
  );
  is(
    "applicationId は capacitor.config.json と同じ",
    new RegExp(`applicationId "${cap.appId}"`).test(gradle),
    true,
  );
  const target = Number((vars.match(/targetSdkVersion = (\d+)/) || [])[1]);
  const min = Number((vars.match(/minSdkVersion = (\d+)/) || [])[1]);
  // Play は新しいアプリに比較的新しい targetSdk を要求する。35 を下回ったら気づけるように
  is("targetSdk は 35 以上", target >= 35, true);
  is("minSdk は 24 以上", min >= 24, true);
  is("アプリ名は「トッタリー」", strings.includes("<string name=\"app_name\">トッタリー</string>"), true);
  is(
    "写した web は追わない(.gitignore)",
    read("android/.gitignore").includes("app/src/main/assets/public"),
    true,
  );
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  is("画面は縦だけ(iOS と同じ)", /android:screenOrientation="portrait"/.test(manifest), true);
  is(
    "Android 12 以降の起動画面の地の色を決めてある(既定の白が出ない)",
    /windowSplashScreenBackground/.test(read("android/app/src/main/res/values/styles.xml")),
    true,
  );
  is(
    "起動画面の地の色はアプリの絵と同じ #060C18",
    read("android/app/src/main/res/values/ic_launcher_background.xml").includes("#060C18"),
    true,
  );
  // アプリの絵は iOS のものから作る。既定の Capacitor の絵のままだと気づきにくい
  const icon = fs.statSync("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png").size;
  is("ランチャーの絵を差し替えてある(既定より大きい)", icon > 20000, true);
  is(
    "Play に上げる鍵は keystore.properties から読む",
    /keystore\.properties/.test(gradle),
    true,
  );
  const ign = read("android/.gitignore");
  is(
    "鍵は git に入れない",
    /keystore\.properties/.test(ign) && /\*\.jks/.test(ign),
    true,
  );
  const sh = read("tools/android-release.sh");
  is("組む道具がある(debug と bundle)", /assembleDebug/.test(sh) && /bundleRelease/.test(sh), true);
  is("組む道具も同じ式で版の番号を作る", sh.includes("Date.UTC(2020,0,1)"), true);
} else {
  console.log("\n(android/ が無いので、プロジェクトの検査は飛ばした)");
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
