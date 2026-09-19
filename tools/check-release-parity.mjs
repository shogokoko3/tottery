/**
 * iOS 版と Google Play 版が、同じ中身から作られているかを確かめる。
 *
 * 片方だけ組み直して、もう片方が古いまま出るのを防ぐための見張り。
 * build.mjs が書き出す build-info.json を、両方のアプリの中から読んで比べる。
 *
 *   codeHash … src/ と組み立ての道具から作る。**これが同じなら中身は同じ**
 *   version  … package.json の版
 *   assets   … 絵の重さ。iOS は full、Android は compact で**違って当たり前**
 *   build    … 版の番号。iOS は12桁の時刻、Android は経過分数で**違って当たり前**
 *
 * どちらかがまだ作られていなければ、何も言わずに通す(手元や新しい clone のため)。
 * --strict を付けると、作られていないこと自体を NG にする(出す直前の確認用)。
 */
import fs from "node:fs";

const strict = process.argv.includes("--strict");
const 置き場 = {
  iOS: { path: "ios/App/App/public/build-info.json", assets: "full" },
  Android: {
    path: "android/app/src/main/assets/public/build-info.json",
    assets: "compact",
  },
};

let ok = 0;
const fail = [];
const is = (label, cond, detail = "") => {
  if (cond) {
    ok++;
    console.log(`  ok   ${label}`);
  } else {
    fail.push(label);
    console.log(`  NG   ${label}${detail ? "  " + detail : ""}`);
  }
};

const 読む = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};

const read = (f) => fs.readFileSync(f, "utf8");

console.log("2つの版の作り方");
const build = read("build.mjs");
is("絵の重さを ASSETS で切り替える", /process\.env\.ASSETS === "compact"/.test(build));
is("compact は cwebp で webp にする", /cwebp/.test(build) && /sharp_yuv/.test(build));
is("変換の結果を貯めて2度目を速くする", /\.webp-cache/.test(build));
is("身元(build-info.json)を書き出す", /dist\/build-info\.json/.test(build));
is(
  "身元には中身の印(codeHash)が入る",
  /codeHash/.test(build) && /hashTree\("src"\)/.test(build),
);
is(
  "称号の絵が残っていたら止める(黙って壊れた参照を配らない)",
  /称号の png が残っている/.test(build),
);
is(
  "称号のアイコンの拡張子を本体に渡す",
  /__HONOR_IMG_EXT__/.test(build) &&
    /__HONOR_IMG_EXT__/.test(read("src/game/formation-honors.js")),
);
const pkg = JSON.parse(read("package.json"));
is("iOS は full で組む", /ASSETS=full/.test(pkg.scripts["ios:sync"] || ""));
is("Android は compact で組む", /ASSETS=compact/.test(pkg.scripts["android:sync"] || ""));
is("両方を一度に作る道具がある", fs.existsSync("tools/release-all.sh"));
if (fs.existsSync("tools/release-all.sh")) {
  const sh = read("tools/release-all.sh");
  is("両方作ったあとに、この検査を通す", /check-release-parity\.mjs --strict/.test(sh));
  is("最後に dist を画質そのままへ戻す", /ASSETS=full node build\.mjs/.test(sh));
}
is(
  "同期でできた控えを落とす道具を、写しと両方の組み立てで通す",
  /drop-dupes/.test(read("tools/strip-public.mjs")) &&
    /drop-dupes/.test(read("tools/android-release.sh")) &&
    /drop-dupes/.test(read("tools/ios-release.sh")),
);

// 束ねた表と、実際に置いた絵が食い違っていないか(組み立て済みのときだけ)
if (fs.existsSync("dist/index.html") && fs.existsSync("dist/fields")) {
  const m = read("dist/index.html").match(/\{earth:"[^"]+"[^}]*\}/);
  if (m) {
    const names = [...m[0].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    const ng = names.filter((n) => !fs.existsSync(`dist/fields/${n}`));
    is(
      "盤面エリアの表と、置いた絵が一致する",
      names.length >= 7 && ng.length === 0,
      ng.join(", "),
    );
  }
}

console.log("\niOS 版と Google Play 版が同じ中身か");
const info = {};
let 足りない = false;
for (const [name, o] of Object.entries(置き場)) {
  info[name] = 読む(o.path);
  if (!info[name]) {
    足りない = true;
    if (strict) is(`${name} が作られている`, false, o.path);
    else console.log(`  --   ${name} はまだ作られていない(${o.path})`);
  }
}

if (!足りない) {
  const [a, b] = [info.iOS, info.Android];
  is(
    "中身(codeHash)が同じ",
    a.codeHash === b.codeHash,
    a.codeHash === b.codeHash
      ? ""
      : `iOS ${a.codeHash}(${a.builtAt}) ≠ Android ${b.codeHash}(${b.builtAt})` +
        ` → 古いほうを組み直すこと`,
  );
  is("版(version)が同じ", a.version === b.version, `${a.version} / ${b.version}`);
  for (const [name, o] of Object.entries(置き場))
    is(
      `${name} の絵の重さは ${o.assets}`,
      info[name].assets === o.assets,
      `いまは ${info[name].assets}`,
    );
  // 版の番号は別系統。Android は Play の上限(21億)に収まっていること
  if (b.build > 0)
    is("Android の版の番号が Play の上限内", b.build < 2100000000, String(b.build));
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
