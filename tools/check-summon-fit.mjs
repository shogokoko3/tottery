/**
 * ガチャの演出(めくった札。skins.jsx の SummonReveal)と、英雄の召喚のタブが、iPhone の幅で字を切らずに読めるかを、
 * 本物の部品と本物の CSS で描いて測る(2026-10-06 見直し)。頭なしの Chrome(CDP)を使うので npm run check には
 * 入れていない。手で走らせる:
 *
 *   perl -e 'alarm 300; exec @ARGV' node tools/check-summon-fit.mjs [--shots=<dir>]
 *
 * 見ること(320×568 と 9機種。check-story-fit と同じ機種):
 *   A. 10連(ガチャの15キャラ全部を2回に分けて)と1連の、めくり終えた札:
 *      - 名を「…」で切らない。名は句の塊(.text-phrase。phrase-split.js の namePhrases)だけで書き、
 *        どの句も1行に収まり札からはみ出さない(前は1行に収めて「…」で切っていて、4列の札(320 幅で 63px、
 *        375 幅で 77px)で「墓守のレヴ…」「黄昏のレヴ…」としか読めなかった)
 *      - 名は、下の所持の札(通常×1・箔—)にも、上の格・NEW にも重ならない
 *      - 左上の格(SSR)と右上の NEW が重ならない(320 幅で「SS」としか読めなかった)
 *   B. 英雄の召喚のタブ(ガチャ・所持・装備・錬成・加工): どのタブも字が箱に入る(320 幅で「所持・…」と切れた)
 *
 * 札の絵は assets/ をそのまま読む(一時の入れ物に置いた頁から、assets の下の入れ物へリンクを張る。リポジトリには
 * 何も書かない)。Chrome は空いているポートに自分で立て、終わったら(時間切れ・失敗でも)止める。外へは書体
 * (Google Fonts)だけ通す
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { POOL } from "../src/skins/catalog.js";

const repo = fileURLToPath(new URL("..", import.meta.url));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const shotsArg = process.argv.find((a) => a.startsWith("--shots="));
const shots = shotsArg ? path.resolve(shotsArg.slice(8)) : null;
if (!fs.existsSync(CHROME)) {
  console.error(`Chrome が見つからない(${CHROME})。CHROME=… で場所を渡す`);
  process.exit(2);
}

let fail = 0;
let passed = 0;
const ok = (label, cond, extra) => {
  if (!cond || process.env.VERBOSE) console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) fail++;
  else passed++;
};

/* ---------------- 頁を束ねる(リポジトリには何も書かない) ---------------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-summon-fit-"));
let chrome = null;
const cleanup = () => {
  try {
    if (chrome) chrome.kill("SIGKILL");
  } catch {
    /* もう止まっている */
  }
  chrome = null;
  try {
    // assets へのリンクは、先にリンクだけ外す(リンクの先は消さない)
    for (const e of fs.readdirSync(dir)) {
      const f = path.join(dir, e);
      if (fs.lstatSync(f).isSymbolicLink()) fs.unlinkSync(f);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* 消せなくても進める */
  }
};
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM", "SIGALRM"])
  process.on(sig, () => {
    cleanup();
    process.exit(2);
  });
// 外の上限(perl alarm)とは別に、自分でも止まる
const guard = setTimeout(() => {
  console.error("時間切れ(270 秒)");
  cleanup();
  process.exit(2);
}, 270000);

// 頁は1つ。画面は window.__show で描き替える(端末の幅は Emulation で変える)
const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import { GameShell } from "./src/ui/screens.jsx";
import { SkinsScreen, SummonReveal } from "./src/ui/skins.jsx";

const noop = () => {};
const root = createRoot(document.getElementById("root"));
let n = 0;
function App({ view }) {
  const key = String(++n);
  if (view.kind === "tabs")
    return (
      <GameShell showRules={false} setShowRules={noop} onHome={noop}>
        <SkinsScreen key={key} onBack={noop} initialTab="gacha" />
      </GameShell>
    );
  // 導入の10連と同じ(plain)。演出を省く形(reduce)で、めくり終えた札の形だけを見る
  return (
    <GameShell showRules={false} setShowRules={noop} onHome={noop}>
      <SummonReveal key={key} results={view.results.map((id) => ({ id, isNew: true }))} onFinish={noop} reduce plain />
    </GameShell>
  );
}
window.__show = (view) => {
  root.render(<App view={view} />);
  return true;
};
window.__ready = true;
`;
const bundled = await build({
  stdin: { contents: entry, resolveDir: repo, loader: "jsx", sourcefile: "summon-fit-entry.jsx" },
  bundle: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  write: false,
  logLevel: "silent",
  loader: { ".jsx": "jsx", ".webp": "dataurl", ".png": "dataurl", ".jpg": "dataurl", ".css": "text", ".mp4": "dataurl", ".mp3": "dataurl", ".svg": "dataurl" },
  define: {
    __ADMOB_REWARDED_ID__: '"x"',
    __ADMOB_TESTING__: "true",
    __AUDIO_FILES__: "{}",
    __HONOR_VERSION__: '"x"',
    __FIELD_FILES__: "{}",
    __HONOR_IMG_EXT__: '".png"',
    __APP_BUILD__: "0",
    __BUILD_VERSION__: '"check"',
  },
  // SummonReveal は skins.jsx の中だけの部品。束ねるときだけ外へ出す(tools/preview-summon.mjs と同じ)
  plugins: [
    {
      name: "export-summon-reveal",
      setup(b) {
        b.onLoad({ filter: /src\/ui\/skins\.jsx$/ }, (args) => ({
          contents: fs.readFileSync(args.path, "utf8") + "\nexport { SummonReveal };",
          loader: "jsx",
        }));
      },
    },
  ],
});
const tpl = fs.readFileSync(path.join(repo, "index.template.html"), "utf8").replace(`media="print" onload="this.media='all'" `, "");
const page = path.join(dir, "page.html");
fs.writeFileSync(page, tpl.replace("__BUNDLE__", () => bundled.outputFiles[0].text));
// 札の絵(skins/cards/…)は頁からの相対の道で読む。assets の下の入れ物へリンクを張る
for (const sub of fs.readdirSync(path.join(repo, "assets")))
  if (fs.statSync(path.join(repo, "assets", sub)).isDirectory()) fs.symlinkSync(path.join(repo, "assets", sub), path.join(dir, sub));

/* ---------------- 頭なしの Chrome ---------------- */
const port = await new Promise((res) => {
  const s = net.createServer();
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => res(p));
  });
});
chrome = spawn(
  CHROME,
  ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(dir, "profile")}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--allow-file-access-from-files",
    "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE fonts.googleapis.com , EXCLUDE fonts.gstatic.com", "about:blank"],
  { stdio: "ignore" },
);
let targets = [];
for (let i = 0; i < 75 && !targets.length; i++) {
  try {
    targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === "page");
  } catch {
    /* まだ立っていない */
  }
  if (!targets.length) await new Promise((r) => setTimeout(r, 200));
}
if (!targets.length) {
  console.error("Chrome が立たなかった");
  process.exit(2);
}
const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
let seq = 0;
const waiting = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && waiting.has(d.id)) {
    waiting.get(d.id)(d);
    waiting.delete(d.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++seq;
    waiting.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const js = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600));
  return r.result.result.value;
};
await send("Page.enable");
await send("Runtime.enable");

// 名前・幅・高さ・上の切り欠き・下の切り欠き・倍率(check-story-fit と同じ機種)
const IPHONES = [
  ["SE1 320x568", 320, 568, 20, 0, 2],
  ["SE 375x667", 375, 667, 20, 0, 2],
  ["mini 375x812", 375, 812, 50, 34, 3],
  ["12-14 390x844", 390, 844, 47, 34, 3],
  ["15/16 393x852", 393, 852, 59, 34, 3],
  ["16Pro 402x874", 402, 874, 62, 34, 3],
  ["11/XR 414x896", 414, 896, 48, 34, 2],
  ["Plus 428x926", 428, 926, 47, 34, 3],
  ["ProMax 430x932", 430, 932, 59, 34, 3],
  ["16PM 440x956", 440, 956, 62, 34, 3],
];

await send("Page.navigate", { url: `file://${page}` });
await js(`new Promise((r, j) => { const until = Date.now() + 15000; const t = () => window.__ready ? r(true) : Date.now() > until ? j(new Error("頁が描けない")) : setTimeout(t, 50); t(); })`);

let device = null;
async function use(dev) {
  const [, w, h, , , dpr] = dev;
  device = dev;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: true });
}
// WebKit の代わり: auto-phrase を消す。切り欠きは端末の値に(部品ごとの <style> もあるので描くたびに)
const fixStyles = () =>
  js(`(() => { for (const st of document.querySelectorAll("style")) { const t = st.textContent; if (!/auto-phrase|safe-area-inset/.test(t)) continue; st.textContent = t.replace(/env\\(safe-area-inset-top(,[^)]*)?\\)/g, "${device[3]}px").replace(/env\\(safe-area-inset-bottom(,[^)]*)?\\)/g, "${device[4]}px").replace(/env\\(safe-area-inset-(left|right)(,[^)]*)?\\)/g, "0px").replace(/word-break:\\s*auto-phrase;?/g, ""); } return true; })()`);
const settle = (ms = 60) => js(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => r(true), ${ms}))))`);
let fontsReady = false;
async function show(view) {
  await js(`window.__show(${JSON.stringify(view)})`);
  await settle();
  await fixStyles();
  if (!fontsReady) {
    await js(`Promise.race([document.fonts.ready.then(() => document.fonts.load('700 10px "Shippori Mincho"', "王")), new Promise((r) => setTimeout(r, 6000))]).then(() => true)`);
    fontsReady = true;
  }
  await settle();
}
async function shot(file) {
  if (!shots) return;
  fs.mkdirSync(shots, { recursive: true });
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(shots, file), Buffer.from(r.result.data, "base64"));
}

// めくり終えた札を1枚ずつ測る。句の行は字の縦の幅が重なるもの同士(check-story-fit と同じ数え方)
const CARDS = `(() => {
  const glyphs = (el) => {
    const boxes = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const n = w.currentNode; for (let i = 0; i < n.length; i++) { if (/\\s/.test(n.data[i])) continue; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const rs = r.getClientRects(); if (rs.length) boxes.push(rs[0]); } }
    return boxes;
  };
  const lines = (boxes) => { const s = [...boxes].sort((a, b) => a.top - b.top); let n = 0, lb = -Infinity; for (const b of s) { if (b.top >= lb - 2) { n++; lb = b.bottom; } else lb = Math.max(lb, b.bottom); } return n; };
  return [...document.querySelectorAll(".reveal-card")].map((card) => {
    const name = card.querySelector(".reveal-name");
    if (!name) return { missing: true, label: card.getAttribute("aria-label") };
    const cs = getComputedStyle(name);
    const nb = name.getBoundingClientRect();
    // 名の箱は札の幅いっぱい(inset: auto 0 0)。句がその箱(札)の中にあるか
    const left = nb.left, right = nb.right;
    const phrases = [...name.querySelectorAll(".text-phrase")];
    const bad = [];
    for (const p of phrases) {
      const r = p.getBoundingClientRect();
      if (lines(glyphs(p)) > 1) bad.push(p.textContent + "(句の中で折れた)");
      else if (r.left < left - 0.5 || r.right > right + 0.5) bad.push(p.textContent + "(札からはみ出た " + [r.left, r.right, left, right].map((v) => Math.round(v * 10) / 10).join(",") + ")");
    }
    // 句の外に置いた字(句の塊でない字)
    const loose = [];
    const w = document.createTreeWalker(name, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const t = w.currentNode; if (t.data.trim() && !t.parentElement.closest(".text-phrase")) loose.push(t.data.trim()); }
    const text = glyphs(name);
    // 名の行の上端と下端(行の箱。字の箱は書体の上下の幅を含み、字の形より大きい)
    const top = nb.top + parseFloat(cs.paddingTop), bottom = nb.bottom - parseFloat(cs.paddingBottom);
    const owned = card.querySelector(".reveal-owned")?.getBoundingClientRect();
    const rarity = card.querySelector(".reveal-rarity")?.getBoundingClientRect();
    const fresh = card.querySelector(".reveal-new")?.getBoundingClientRect();
    const head = Math.max(rarity ? rarity.bottom : 0, fresh ? fresh.bottom : 0);
    return {
      name: name.textContent,
      label: card.getAttribute("aria-label"),
      phrases: phrases.map((p) => p.textContent),
      bad, loose,
      cut: name.scrollWidth > name.clientWidth + 1 || cs.textOverflow === "ellipsis",
      lines: lines(text),
      overOwned: owned ? bottom > owned.top + 0.5 : false,
      underHead: top < head - 0.5,
      badges: rarity && fresh ? Math.round((fresh.left - rarity.right) * 10) / 10 : null,
      width: Math.round(card.getBoundingClientRect().width),
    };
  });
})()`;

async function summon(results, label) {
  await show({ kind: "summon", results });
  await js(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("すべてめくる")); b && b.click(); return !!b; })()`);
  await js(`new Promise((r) => { const until = Date.now() + 8000; const t = () => (document.querySelectorAll(".reveal-name").length >= ${results.length} || Date.now() > until) ? r(true) : setTimeout(t, 60); t(); })`);
  // 配る動き(reveal-deal)と裏返す動き(rotateY 0.45 秒)が終わるまで待つ(途中は札が傾いていて、測った位置がずれる)
  await js(`Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().endTime !== Infinity).map((a) => a.finished.catch(() => null))).then(() => true)`);
  await settle(120);
  const cards = await js(CARDS);
  const name = `${device[0]} ${label}`;
  ok(`${name}: ${results.length}枚ともめくり終えて名が出る`, cards.length === results.length && cards.every((c) => !c.missing), JSON.stringify(cards.filter((c) => c.missing)));
  const shown = cards.filter((c) => !c.missing);
  ok(`${name}: 名を「…」で切らない`, shown.every((c) => !c.cut), shown.filter((c) => c.cut).map((c) => c.name).join(" / "));
  ok(`${name}: 名は句の塊だけで書き、句をつなぐと名のまま`, shown.every((c) => c.loose.length === 0 && c.phrases.join("") === c.label), shown.filter((c) => c.loose.length || c.phrases.join("") !== c.label).map((c) => c.name).join(" / "));
  ok(`${name}: 名の句はどれも1行に収まり札からはみ出さない`, shown.every((c) => c.bad.length === 0), shown.flatMap((c) => c.bad).join(" / "));
  ok(`${name}: 名は所持の札にも、格・NEW にも重ならない`, shown.every((c) => !c.overOwned && !c.underHead), shown.filter((c) => c.overOwned || c.underHead).map((c) => `${c.name}(${c.overOwned ? "所持の札に" : "格・NEW に"}重なる)`).join(" / "));
  ok(`${name}: 格と NEW が重ならない`, shown.every((c) => c.badges === null || c.badges >= 1), shown.filter((c) => c.badges !== null && c.badges < 1).map((c) => `${c.name}(${c.badges}px)`).join(" / "));
  return shown;
}

// ガチャの15キャラを2回の10連に(2回目は残りの5人と、名の長い5人をもう一度)
const ids = POOL.map((s) => s.id);
const SETS = [ids.slice(0, 10), [...ids.slice(10), ...ids.slice(0, 5)]];
// ONLY=320,390 のように機種を絞れる(確かめ用)
const devices = process.env.ONLY ? IPHONES.filter((d) => process.env.ONLY.split(",").some((k) => d[0].includes(k))) : IPHONES;
for (const dev of devices) {
  await use(dev);
  console.log(`\n${dev[0]}`);
  const narrow = dev[1] <= 375;
  for (const [i, set] of SETS.entries()) {
    const shown = await summon(set, `10連 ${i + 1}`);
    if (narrow && process.env.VERBOSE) console.log(`    名の行数: ${shown.map((c) => `${c.name}=${c.lines}`).join(" ")}(札の幅 ${shown[0]?.width}px)`);
    if (narrow && i === 0) await shot(`${dev[0].split(" ")[0]}-summon-10.png`);
  }
  await summon(["zombie-female"], "1連");
  // B. タブ
  await show({ kind: "tabs" });
  const tabs = await js(`[...document.querySelectorAll(".skins-tabs button")].map((b) => ({ text: b.textContent, sw: b.scrollWidth, cw: b.clientWidth }))`);
  ok(`${dev[0]}: 英雄の召喚のタブは4つとも字が箱に入る`, tabs.length === 4 && tabs.every((t) => t.sw <= t.cw + 0.5), tabs.map((t) => `${t.text} ${t.sw}/${t.cw}`).join(" · "));
  if (narrow) await shot(`${dev[0].split(" ")[0]}-tabs.png`);
}

clearTimeout(guard);
ws.close();
cleanup();
console.log(fail ? `\n${fail} 件の失敗(${passed} 件は通った)` : `\nガチャの演出の札の名とタブ: すべて通りました(${passed} 件)`);
process.exit(fail ? 1 : 0);
