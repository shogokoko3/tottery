/**
 * src/ を1枚の HTML に束ねる。
 * 画像は data URI として、CSS は文字列として埋め込むので、
 * 出来上がった index.html はそれ単体で動く（サーバー側の設定に依存しない）。
 *
 * 音だけは別にして、assets/audio/ の m4a を audio/ と dist/audio/ へ写す。
 * 7曲を data URI で入れると HTML が1MB以上太り、1曲も鳴らないうちに
 * 全部を落としてくることになる。置くファイルが増えるだけで、
 * サーバー側の設定に頼らないのは変わらない。
 *
 * 写すときは中身のハッシュを名前に埋める(title.m4a → title.a1b2c3d4.m4a)。
 * 配信側(_headers)は audio/ を1年キャッシュしてよく、曲を差し替えたときだけ
 * 新しい名前で落ちてくる。元の名前との対応表は __AUDIO_FILES__ として
 * スクリプトに埋め込み、src/audio/tracks.js の audioUrl() が引く。
 */
import { build } from "esbuild";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { SUPPORT_EMAIL } from "./src/game/support.js";

const dev = process.argv.includes("--dev");

// 音。index.html からは audio/ という相対の場所として見えている。
// 束ねる前に写して、元の名前 → ハッシュ付きの名前 の表を作っておく
const audioFiles = {};
let audioKb = 0;
for (const dir of ["audio", "dist/audio"]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
if (fs.existsSync("assets/audio"))
  for (const name of fs.readdirSync("assets/audio")) {
    if (!name.endsWith(".m4a")) continue;
    const data = fs.readFileSync(`assets/audio/${name}`);
    audioKb += data.length;
    const hash = createHash("sha256").update(data).digest("hex").slice(0, 8);
    const hashed = name.replace(/\.m4a$/, `.${hash}.m4a`);
    audioFiles[name] = hashed;
    for (const dir of ["audio", "dist/audio"])
      fs.writeFileSync(`${dir}/${hashed}`, data);
  }

// 盤面画像は使うエリアだけ読み込む。画像更新時はハッシュでキャッシュを更新。
const fieldFiles = {};
for (const dir of ["fields", "dist/fields"]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
for (const name of fs.readdirSync("assets/fields")) {
  if (!name.endsWith(".png")) continue;
  const data = fs.readFileSync(`assets/fields/${name}`);
  const hash = createHash("sha256").update(data).digest("hex").slice(0, 8);
  const hashed = name.replace(".png", `.${hash}.png`);
  fieldFiles[name.slice(0, -4)] = hashed;
  for (const dir of ["fields", "dist/fields"])
    fs.writeFileSync(`${dir}/${hashed}`, data);
}

// Version the approved formation scenes independently and load them only on award.
const honorHash = createHash("sha256");
function hashHonor(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const path = `${dir}/${name}`;
    if (fs.statSync(path).isDirectory()) hashHonor(path);
    else {
      honorHash.update(path);
      honorHash.update(fs.readFileSync(path));
    }
  }
}
hashHonor("assets/honors");
const honorVersion = honorHash.digest("hex").slice(0, 12);
for (const out of ["honors", "dist/honors"]) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync("assets/honors", `${out}/${honorVersion}`, { recursive: true });
}

/** 束ね方。本体と管理画面で同じ */
const bundleOptions = {
  bundle: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  minify: !dev,
  legalComments: "none",
  loader: {
    ".jsx": "jsx",
    ".webp": "dataurl",
    ".png": "dataurl",
    ".css": "text",
  },
  write: false,
  logLevel: "info",
  define: {
    // リワード広告のユニット ID(本物)。上書きしたいときだけ ADMOB_REWARDED_ID を渡す
    __ADMOB_REWARDED_ID__: JSON.stringify(
      process.env.ADMOB_REWARDED_ID || "ca-app-pub-8562097921065694/4541553185",
    ),
    // テスト広告を出すか。既定は true(TestFlight・手元は安全にテスト広告)。
    // App Store 配信ビルドだけ ADMOB_TESTING=false で本物の広告に
    __ADMOB_TESTING__: JSON.stringify(process.env.ADMOB_TESTING !== "false"),
    __AUDIO_FILES__: JSON.stringify(audioFiles),
    __HONOR_VERSION__: JSON.stringify(honorVersion),
    __FIELD_FILES__: JSON.stringify(fieldFiles),
  },
};

/** 入口と枠を渡して、1枚の HTML にする */
async function bundleInto(entry, templateFile) {
  const result = await build({ ...bundleOptions, entryPoints: [entry] });
  const js = result.outputFiles[0].text;
  const template = fs.readFileSync(templateFile, "utf8");
  return { html: template.replace("__BUNDLE__", () => js), js };
}

const { html, js } = await bundleInto("src/main.jsx", "index.template.html");
fs.writeFileSync("index.html", html);

// 配信用。ここに置いたものだけが公開される。
// リポジトリの中身(src や tools)を一緒に配らないための箱
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/index.html", html);

// スキンの画像と映像は別ファイルで必要な場面だけ読み込む。
for (const dir of ["skins", "dist/skins"]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync("assets/skins", dir, { recursive: true });
}

// 公開するのはログイン画面。運営データはサーバー照合後にのみ読み込む。
const admin = await bundleInto("src/admin/admin.jsx", "admin.template.html");
fs.writeFileSync("admin.html", admin.html);
fs.writeFileSync("dist/admin.html", admin.html);

// プライバシーポリシー。プライバシーポリシー.md を HTML にして privacy.html と
// dist/privacy.html に置く。本番では /privacy で開ける(Cloudflare の静的配信は
// 拡張子無しの要求に .html を当てる)。連絡先は src/game/support.js から埋める
const privacy = renderPrivacy(
  fs.readFileSync("プライバシーポリシー.md", "utf8"),
  fs.readFileSync("privacy.template.html", "utf8"),
);
fs.writeFileSync("privacy.html", privacy);
fs.writeFileSync("dist/privacy.html", privacy);

// 配信側の設定。Cloudflare Pages と Netlify のどちらも、この2ファイルを
// 公開フォルダに置くだけで読む(キャッシュの期限・セキュリティ用のヘッダー)
for (const name of ["_headers", "_redirects"])
  if (fs.existsSync(name)) fs.copyFileSync(name, `dist/${name}`);

const kb = (n) => (n / 1024).toFixed(0) + "KB";
console.log(
  `\nindex.html と dist/index.html を書き出しました: ${kb(Buffer.byteLength(html))} (スクリプト ${kb(Buffer.byteLength(js))})`,
);
console.log(`audio/ と dist/audio/ に曲を写しました: ${kb(audioKb)}`);
console.log(
  `admin.html と dist/admin.html を書き出しました: ${kb(Buffer.byteLength(admin.html))}`,
);
console.log(
  `privacy.html と dist/privacy.html を書き出しました: ${kb(Buffer.byteLength(privacy))}` +
    (SUPPORT_EMAIL ? "" : " (連絡先が未設定)"),
);

/**
 * プライバシーポリシー.md を HTML にする。
 *
 * 外の Markdown 処理系を入れずに済むよう、あの文書で使っている書き方だけを扱う:
 * 見出し(# / ##)、段落、箇条書き(- )、表(| |)、区切り(---)、
 * 「**用語**」の次の行が「: 説明」の定義、太字(**)、コード(`)、URL。
 * {{SUPPORT_EMAIL}} と {{UPDATED}} は support.js と今日の日付で埋める。
 */
function renderPrivacy(md, template) {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(
        /(https?:\/\/[^\s)]+)/g,
        '<a href="$1" rel="noopener noreferrer">$1</a>',
      );
  const lines = md.replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  const para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para.length = 0;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    if (line === "---") {
      flush();
      out.push("<hr>");
      i++;
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,3}) (.+)$/))) {
      flush();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|"))
        rows.push(lines[i++]);
      const cells = (r) =>
        r
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const [head, , ...body] = rows;
      out.push(
        "<table><thead><tr>" +
          cells(head)
            .map((c) => `<th>${inline(c)}</th>`)
            .join("") +
          "</tr></thead><tbody>" +
          body
            .map(
              (r) =>
                "<tr>" +
                cells(r)
                  .map((c) => `<td>${inline(c)}</td>`)
                  .join("") +
                "</tr>",
            )
            .join("") +
          "</tbody></table>",
      );
      continue;
    }
    if (line.startsWith("- ")) {
      flush();
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        let item = lines[i++].slice(2);
        while (i < lines.length && /^ {2,}\S/.test(lines[i]))
          item += " " + lines[i++].trim();
        items.push(item);
      }
      out.push(
        `<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`,
      );
      continue;
    }
    if (
      /^\*\*.+\*\*$/.test(line) &&
      i + 1 < lines.length &&
      lines[i + 1].startsWith(": ")
    ) {
      flush();
      const items = [];
      while (
        i + 1 < lines.length &&
        /^\*\*.+\*\*$/.test(lines[i]) &&
        lines[i + 1].startsWith(": ")
      ) {
        const term = lines[i].slice(2, -2);
        i++;
        let desc = lines[i++].slice(2);
        while (i < lines.length && /^ {2,}\S/.test(lines[i]))
          desc += " " + lines[i++].trim();
        items.push(`<dt>${inline(term)}</dt><dd>${inline(desc)}</dd>`);
        while (i < lines.length && !lines[i].trim()) i++;
      }
      out.push(`<dl>${items.join("")}</dl>`);
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  const contact = SUPPORT_EMAIL
    ? `<a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a>`
    : "（準備中）";
  return template
    .replace("__BODY__", () => out.join("\n"))
    .replace(/\{\{SUPPORT_EMAIL\}\}/g, () => contact);
}
