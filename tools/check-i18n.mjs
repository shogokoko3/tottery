/**
 * 英語版の検査(2026-11-11 本人の指示。決めごとは reports/i18n-20261111/)。
 *
 *  1. 日本語が変わっていない … 英語化の前に拾った日本語の文(tools/i18n-baseline.json)が、
 *     いまも src/ のどこかにそのまま残っていること。英語化で日本語の文が増えていないこと
 *     ({名前} と ${…} は同じ「差し込み」として比べる)
 *  2. 取り残し … 英語にすると決めたファイルで、日本語の文が L()・Lk() を通っていること
 *     (console.* と、前の行か同じ行に「i18n-ignore」と書いた文は除く)
 *  3. 抜け … L()・Lk() のキーが全部、英語の辞書にあること。差し込みの名前がそろっていること。
 *     英語の文に日本語の字が無いこと。同じキーが2つの辞書で違う英語になっていないこと
 *  4. 日本語の端末 … L(キー) がキーそのものを返すこと
 *     英語の端末  … L(キー) が日本語の字を含まないこと
 *  5. 使われていない英訳 … 知らせるだけ(落とさない)
 *
 * 英語化の前の一覧を撮り直すとき(日本語の文を本人の指示で直したあと)は
 *   node tools/check-i18n.mjs --write-baseline
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default || traverseModule;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASELINE = path.join(ROOT, "tools/i18n-baseline.json");
const JA = /[぀-ヿ㐀-鿿！-｠]/;
const HOLE = "□";

/** 日本語のままにすると本人が決めたもの(文の一覧.md の C1〜C3) */
const KEEP_JAPANESE = [
  /^src\/admin\//, // 管理画面
  /^src\/game\/story-phrases\.js$/, // ストーリーの漫画の見出し
  /^src\/game\/story-narrative\.js$/, // ストーリーの本文
  /^src\/game\/welcome-comic\.js$/, // 漫画
  /^src\/game\/badwords\.js$/, // NGワードの表
  /^src\/server\/(test-players|rating-restore|tf-players)/, // テスト用のデータ
  /^src\/i18n\//, // 辞書そのもの
];

/** まだ英語に移していないファイル。移し終えたら消す(最後は空になる) */
const PENDING = new Set(
  fs.existsSync(path.join(ROOT, "tools/i18n-pending.txt"))
    ? fs
        .readFileSync(path.join(ROOT, "tools/i18n-pending.txt"), "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
    : [],
);
// 移している途中のファイルを確かめるとき: I18N_DONE="src/ui/a.jsx src/ui/b.jsx" で、まだ一覧にあっても移し終えたものとして見る
for (const f of (process.env.I18N_DONE || "").split(/\s+/).filter(Boolean)) PENDING.delete(f);

function* walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(js|jsx|mjs)$/.test(name)) yield full;
  }
}
const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");

const parseCode = (code) =>
  parse(code, {
    sourceType: "module",
    plugins: ["jsx", "importAttributes", "topLevelAwait"],
    errorRecovery: true,
  });

const norm = (s) => s.replace(/\$\{\}|\{\w+\}/g, HOLE).replace(/\s+/g, " ").trim();

/** ファイルの日本語の文をすべて拾う */
function collect(code) {
  const ast = parseCode(code);
  const lines = code.split("\n");
  const ignored = (line) =>
    /i18n-ignore/.test(lines[line - 1] || "") || /i18n-ignore/.test(lines[line - 2] || "");
  const out = [];
  const calledBy = (p) => {
    // 文を直に受けている呼び出し(テンプレートの中の文も含む)
    let q = p.parentPath;
    while (q && (q.isTemplateLiteral() || q.isBinaryExpression() || q.isConditionalExpression() || q.isLogicalExpression())) q = q.parentPath;
    if (!q || !q.isCallExpression()) return null;
    const c = q.node.callee;
    if (c.type === "Identifier") return { name: c.name, first: q.node.arguments[0] === p.node || q.node.arguments[0] === p.parentPath?.node };
    if (c.type === "MemberExpression" && c.object.type === "Identifier" && c.object.name === "console") return { name: "console" };
    return null;
  };
  const push = (p, kind, text) => {
    const line = p.node.loc.start.line;
    const by = calledBy(p);
    out.push({
      kind,
      text,
      line,
      wrapped: !!by && (by.name === "L" || by.name === "Lk") && kind === "str" && by.first,
      skip: (by && by.name === "console") || ignored(line),
    });
  };
  traverse(ast, {
    StringLiteral(p) {
      if (JA.test(p.node.value)) push(p, "str", p.node.value);
    },
    JSXText(p) {
      const t = p.node.value.trim();
      if (JA.test(t)) push(p, "jsx", t);
    },
    TemplateLiteral(p) {
      const t = p.node.quasis.map((q) => q.value.cooked).join("${}");
      if (JA.test(t)) push(p, "tpl", t);
    },
  });
  return { ast, items: out };
}

/** L("…")・Lk("…") のキーを拾う */
function keysOf(ast) {
  const keys = [];
  traverse(ast, {
    CallExpression(p) {
      const c = p.node.callee;
      if (c.type !== "Identifier" || (c.name !== "L" && c.name !== "Lk")) return;
      const a = p.node.arguments[0];
      if (a && a.type === "StringLiteral") keys.push({ key: a.value, line: p.node.loc.start.line, fn: c.name });
      else keys.push({ key: null, line: p.node.loc.start.line, fn: c.name });
    },
  });
  return keys;
}

const files = [...walk(path.join(ROOT, "src"))].map((f) => ({ file: rel(f), code: fs.readFileSync(f, "utf8") }));

// ---- 英語化の前の一覧を撮る ----
if (process.argv.includes("--write-baseline")) {
  const base = {};
  for (const { file, code } of files) {
    if (KEEP_JAPANESE.some((re) => re.test(file))) continue;
    const texts = [...new Set(collect(code).items.filter((i) => !i.skip).map((i) => norm(i.text)))];
    if (texts.length) base[file] = texts.sort();
  }
  fs.writeFileSync(BASELINE, JSON.stringify(base, null, 1) + "\n");
  console.log(`撮りました: ${Object.keys(base).length} ファイル`);
  process.exit(0);
}

const errors = [];
const warns = [];
const fail = (m) => errors.push(m);

// ---- 2. 取り残しと、キーの拾い出し ----
const usedKeys = new Map(); // key → 場所
const currentTexts = []; // { file, text(norm) }
const remaining = {}; // file → 取り残しの数(PENDING のもの)
for (const { file, code } of files) {
  if (KEEP_JAPANESE.some((re) => re.test(file))) continue;
  const { ast, items } = collect(code);
  for (const i of items) if (!i.skip) currentTexts.push({ file, text: norm(i.text) });
  for (const k of keysOf(ast)) {
    if (k.key === null) {
      fail(`${file}:${k.line} ${k.fn}() の1つ目は文字列そのものにする(キーを決まった文にするため)`);
      continue;
    }
    if (!usedKeys.has(k.key)) usedKeys.set(k.key, `${file}:${k.line}`);
  }
  const loose = items.filter((i) => !i.skip && !i.wrapped);
  if (!loose.length) continue;
  if (PENDING.has(file)) {
    remaining[file] = loose.length;
    continue;
  }
  for (const i of loose.slice(0, 8)) fail(`${file}:${i.line} L() を通っていない日本語: ${i.text.slice(0, 50)}`);
  if (loose.length > 8) fail(`${file}: ほか ${loose.length - 8} か所`);
}

// ---- 1. 日本語が変わっていない ----
if (!fs.existsSync(BASELINE)) fail("tools/i18n-baseline.json がありません(--write-baseline で撮る)");
else {
  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const pieces = [...new Set(Object.values(base).flat())];
  const nowTexts = currentTexts.map((c) => c.text);
  const nowJoined = nowTexts.join("\n");
  // 英語化の前の文は、いまも(差し込みの位置で切った形で)どこかに残っている
  for (const [file, texts] of Object.entries(base)) {
    for (const t of texts) {
      const parts = t.split(HOLE).map((s) => s.trim()).filter((s) => JA.test(s));
      for (const part of parts) {
        if (!nowJoined.includes(part)) {
          fail(`日本語が変わった/消えた(${file}): 「${t.slice(0, 60)}」の「${part.slice(0, 30)}」が見つからない`);
          break;
        }
      }
    }
  }
  // いまの文は、英語化の前の文のかけらだけでできている(日本語を足していない)
  const byLen = pieces
    .flatMap((t) => t.split(HOLE).map((s) => s.trim()))
    .filter((s) => JA.test(s))
    .sort((a, b) => b.length - a.length);
  const pieceSet = [...new Set(byLen)];
  for (const { file, text } of currentTexts) {
    let rest = text;
    for (const part of rest.split(HOLE).map((s) => s.trim())) {
      if (!JA.test(part)) continue;
      let left = part;
      for (const p of pieceSet) {
        if (left.includes(p)) left = left.split(p).join(" ");
        if (!JA.test(left)) break;
      }
      if (JA.test(left)) {
        fail(`日本語が増えた/変わった(${file}): 「${part.slice(0, 60)}」(前に無い字: ${left.replace(/\s+/g, " ").trim().slice(0, 30)})`);
        break;
      }
    }
  }
}

// ---- 3. 辞書 ----
const { EN_PARTS } = await import("../src/i18n/en/index.js");
const EN = {};
const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
for (const [part, dict] of Object.entries(EN_PARTS)) {
  for (const [ja, en] of Object.entries(dict)) {
    if (typeof en !== "string" || !en.trim()) fail(`辞書 ${part}: 「${ja}」の英語が空`);
    else if (JA.test(en.replace(/[・ー]/g, ""))) fail(`辞書 ${part}: 「${ja}」の英語に日本語の字: ${en}`);
    else if (holes(ja) !== holes(en)) fail(`辞書 ${part}: 「${ja}」と英語で差し込みが違う(${holes(ja)} / ${holes(en)})`);
    if (Object.prototype.hasOwnProperty.call(EN, ja) && EN[ja] !== en) fail(`辞書: 「${ja}」が2つの辞書で違う英語(${EN[ja]} / ${en})`);
    EN[ja] = en;
  }
}
for (const [key, at] of usedKeys) {
  if (!Object.prototype.hasOwnProperty.call(EN, key)) fail(`${at} 英訳が無い: 「${key}」`);
}
for (const key of Object.keys(EN)) if (!usedKeys.has(key)) warns.push(`使われていない英訳: 「${key.slice(0, 40)}」`);

// ---- 4. 端末の言語ごとの出方 ----
const probe = (lang) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { L, LANG } from ${JSON.stringify(path.join(ROOT, "src/i18n/index.js"))};
         const keys = JSON.parse(process.argv[1]);
         process.stdout.write(JSON.stringify({ LANG, out: keys.map((k) => L(k)) }));`,
        JSON.stringify([...usedKeys.keys()]),
      ],
      { env: { ...process.env, TOTTERY_LANG: lang }, maxBuffer: 64 << 20 },
    ).toString(),
  );
const keys = [...usedKeys.keys()];
const ja = probe("ja");
if (ja.LANG !== "ja") fail("TOTTERY_LANG=ja で日本語にならない");
keys.forEach((k, i) => ja.out[i] !== k && fail(`日本語の端末で文が変わる: 「${k}」→「${ja.out[i]}」`));
const en = probe("en");
if (en.LANG !== "en") fail("TOTTERY_LANG=en で英語にならない");
keys.forEach((k, i) => JA.test(en.out[i].replace(/[・ー]/g, "")) && fail(`英語の端末で日本語が出る: 「${k}」`));

// ---- 結果 ----
const pendingLeft = Object.values(remaining).reduce((a, b) => a + b, 0);
if (warns.length) console.log(`知らせ: 使われていない英訳 ${warns.length} 件`);
if (errors.length) {
  console.error(errors.slice(0, 80).join("\n"));
  if (errors.length > 80) console.error(`…ほか ${errors.length - 80} 件`);
  console.error(`check-i18n: NG (${errors.length} 件)`);
  process.exit(1);
}
console.log(
  `check-i18n: OK — 英訳 ${Object.keys(EN).length} 件・キー ${usedKeys.size} 件。` +
    `まだ移していないファイル ${Object.keys(remaining).length}(日本語 ${pendingLeft} か所)`,
);
