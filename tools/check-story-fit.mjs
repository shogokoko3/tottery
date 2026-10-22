/**
 * ストーリー(灰冠の年代記)の短い文が、iPhone の幅で語の途中で折れないかを、本物の部品と本物の CSS で描いて測る
 * (2026-10-06 見直し)。頭なしの Chrome(CDP)を使うので npm run check には入れていない。手で走らせる:
 *
 *   perl -e 'alarm 600; exec @ARGV' node tools/check-story-fit.mjs [--audit] [--shots=<dir>]
 *
 * 見ること(320×568 と 9機種):
 *   A. 一覧(StoryScreen): 年代記の見出しの一言・フェーズの札の名・フェーズの目的(2・3)・閉じた頁の一言・
 *      ステージの立場と主題・章の名・ステージの一行・札の下の一行
 *   B. 物語の頁(StoryReader。21話の全部の頁): 章の名・頁の小見出し・あなたの目的・次へ続く一言
 *   C. 対局説明(StoryIntro。21話): 章の名・登場人物の一言・あなたの目的・対立する理由の見出し・信念・この局のねらい
 *   どれも句の塊(.text-phrase)だけで書き、句が1行に収まり列からはみ出さないこと。
 *   一覧の下の案内(昇格の条件・最後のフェーズ・ランダムマッチまで)と対局説明の結びの行も句の塊で(2026-10-06)。
 *   長い地の文(語り・台詞・あらすじ・対立する理由の本文・世界の説明)は段落のまま自然に折れてよいので見ない
 *   (2026-10-06 に 320・375 幅で撮って見直し、読みにくくないのでそのままにした)。
 *   D. 対局説明の見た目: 送っても札の角の数字が釦の帯の上に乗らない・登場人物の札が潰れない・
 *      フェーズ2・3 の段落は行頭をそろえる(2026-10-06)
 *   --audit は、見る欄と段落の行の切れ目を全部書き出す(確かめ用。失敗にはしない)
 *
 * iPhone の WebKit は word-break: auto-phrase を知らない。ここではその宣言を消して描く(WebKit の代わり)。
 * 画面の上下の切り欠き(safe-area)は env() を端末ごとの値に置き換える(あとから足される <style> にも)。
 * Chrome は空いているポートに自分で立て、終わったら(時間切れ・失敗でも)止める。外へは書体(Google Fonts)だけ通す
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repo = fileURLToPath(new URL("..", import.meta.url));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const shotsArg = process.argv.find((a) => a.startsWith("--shots="));
const shots = shotsArg ? path.resolve(shotsArg.slice(8)) : null;
const audit = process.argv.includes("--audit");
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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-story-fit-"));
let chrome = null;
const cleanup = () => {
  try {
    if (chrome) chrome.kill("SIGKILL");
  } catch {
    /* もう止まっている */
  }
  chrome = null;
  try {
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
  console.error("時間切れ(540 秒)");
  cleanup();
  process.exit(2);
}, 540000);

// 頁は1つ。画面は window.__show で描き替える(端末の幅は Emulation で変える)
const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import { GameShell } from "./src/ui/screens.jsx";
import { StoryScreen, StoryIntro } from "./src/ui/story.jsx";
import { StoryReader } from "./src/ui/story-chronicle.jsx";
import { PHASE_EPOCH, STORY_AXES } from "./src/game/phase.js";

const noop = () => {};
const PROFILES = {
  // はじめの一局のあと(フェーズ1、二と三の王だけクリア)
  fresh: { name: "t", phase: 1, phaseEpoch: PHASE_EPOCH, phaseWins: { 1: 0, 2: 0, 3: 0 }, story: { 1: ["23"], 2: [], 3: [] } },
  // フェーズ3 まで進み、1・2 は全部、3 は三つクリア(どの頁も後日談まで読める)
  late: { name: "t", phase: 3, phaseEpoch: PHASE_EPOCH, phaseWins: { 1: 5, 2: 5, 3: 0 }, story: { 1: [...STORY_AXES], 2: [...STORY_AXES], 3: [...STORY_AXES] } },
};
const root = createRoot(document.getElementById("root"));
let n = 0;
function App({ view }) {
  const key = String(++n);
  if (view.kind === "screen")
    return (
      <GameShell showRules={false} setShowRules={noop} onHome={noop}>
        <StoryScreen key={key} onBack={noop} onStart={noop} onGuide={noop} />
      </GameShell>
    );
  if (view.kind === "reader")
    return (
      <GameShell showRules={false} setShowRules={noop} onHome={noop}>
        <StoryReader key={key} axis={view.axis} phase={view.phase} part={view.opening ? "before" : "all"} battle={Boolean(view.opening)} onDone={noop} onClose={noop} />
      </GameShell>
    );
  return (
    <GameShell showRules={false} setShowRules={noop} onHome={noop}>
      <StoryIntro key={key} axis={view.axis} phase={view.phase} onStart={noop} onBack={noop} />
    </GameShell>
  );
}
window.__show = (view) => {
  localStorage.setItem("tottery.account.v1", JSON.stringify(PROFILES[view.profile || "late"]));
  root.render(<App view={view} />);
  return true;
};
window.__ready = true;
`;
const bundled = await build({
  stdin: { contents: entry, resolveDir: repo, loader: "jsx", sourcefile: "story-fit-entry.jsx" },
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
});
const tpl = fs.readFileSync(path.join(repo, "index.template.html"), "utf8").replace(`media="print" onload="this.media='all'" `, "");
fs.cpSync(path.join(repo, "assets/story/comics"), path.join(dir, "story-comics"), {recursive:true});
const page = path.join(dir, "page.html");
fs.writeFileSync(page, tpl.replace("__BUNDLE__", () => bundled.outputFiles[0].text));

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

// 名前・幅・高さ・上の切り欠き・下の切り欠き・倍率(check-intro-fit と同じ機種)
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
    await js(`Promise.race([document.fonts.ready.then(() => document.fonts.load('16px "Shippori Mincho"', "王")), new Promise((r) => setTimeout(r, 6000))]).then(() => true)`);
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

/*
 * 句で書く欄(短い文)。欄の中の字はどれも句の塊(.text-phrase)の中に置く。
 * keep は句の外に置いてよい子(次へ続く一言の「フェーズ 2 へ続く」)
 */
const SLOTS = {
  screen: [
    [".chronicle-hero-top > span", "見出しの一言(7つの立場)"],
    [".chronicle-hero > div > p", "年代記の一言"],
    [".chronicle-phases b", "フェーズの札の名"],
    [".chronicle-locked > b", "閉じた頁の一言"],
    [".story-stage-body .chronicle-role", "立場と主題"],
    [".story-stage-body > b", "章の名"],
    [".story-stage-body > small", "ステージの一行"],
    [".chronicle-chapter-tail small", "札の下の一行"],
    // 一覧の下の案内(2026-10-06 見直し。320・375 幅で「全部のク/リアと、」「ステ/ージは」と割れた)
    [".story-promotion .hint", "昇格の条件"],
    [".chronicle-main > p.hint", "最後のフェーズ・ランダムマッチまでの案内"],
  ],
  reader: [
    [".chronicle-reader-head h3", "章の名"],
    [".chronicle-reader-copy .chronicle-kicker", "頁の小見出し"],
    [".chronicle-reader-copy .chronicle-purpose p", "あなたの目的"],
    [".chronicle-next-voice", "次へ続く一言", "small"],
  ],
  intro: [
    [".story-intro-head h3", "章の名"],
    [".story-intro .chronicle-roster > div > span > small", "登場人物の一言"],
    [".story-intro .chronicle-purpose > p", "あなたの目的"],
    [".story-intro .chronicle-purpose summary", "対立する理由の見出し"],
    [".story-intro .chronicle-purpose dd", "信念"],
    [".story-intro .story-rival small", "この局のねらい"],
    // 結びの行(2026-10-06 見直し。フェーズ3 の2行目が「…その数字のフォイル/を装備して…」と割れた)
    [".story-intro-note > span", "結びの行"],
  ],
};
// 段落(自然に折れてよい)。--audit で書き出すだけ
// (対局説明のフェーズ2・3 の王の力・エリアの文と、結びの行も、ここで書き出すだけ)
const PARAS = [".story-intro-items li > span", ".story-lesson", ".chronicle-phase-intro > p:not(.story-phase)", ".chronicle-reader-copy > div > p:not(.chronicle-next-voice)", ".chronicle-purpose details > p", ".story-rival-quote", ".chronicle-recap p"];

// 句(.text-phrase)が1行に収まり、列からはみ出さないか(check-intro-fit と同じ測り方)。欄の中で句の外にある字も拾う
const MEASURE = (slots) => `(() => {
  const vis = (el) => { if (!el.getClientRects().length) return false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return false; } return true; };
  const linesOf = (el) => {
    const boxes = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const n = w.currentNode; for (let i = 0; i < n.length; i++) { if (/\\s/.test(n.data[i])) continue; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const rs = r.getClientRects(); if (rs.length) boxes.push([rs[0].top, rs[0].bottom, n.data[i], rs[0].left]); } }
    return boxes;
  };
  const tops = (boxes) => { const s = [...boxes].sort((a, b) => a[0] - b[0]); const t = new Set(); let lb = -Infinity; for (const [a, b] of s) { if (a >= lb - 2) { t.add(Math.round(a)); lb = b; } else lb = Math.max(lb, b); } return t; };
  const bad = [];
  let count = 0;
  for (const el of document.querySelectorAll(".text-phrase")) {
    if (!vis(el)) continue;
    count++;
    const box = el.parentElement.getBoundingClientRect();
    const cs = getComputedStyle(el.parentElement);
    const right = box.right - parseFloat(cs.paddingRight || 0) - parseFloat(cs.borderRightWidth || 0);
    const me = el.getBoundingClientRect();
    const t = tops(linesOf(el));
    if (t.size > 1 || me.right > right + 0.5) bad.push(el.textContent + (t.size > 1 ? "(句の中で折れた)" : "(列からはみ出た)"));
  }
  const bare = [];
  const empty = [];
  for (const [sel, label, keep] of ${JSON.stringify(slots)}) {
    for (const slot of document.querySelectorAll(sel)) {
      if (!vis(slot)) continue;
      const w = document.createTreeWalker(slot, NodeFilter.SHOW_TEXT);
      let phrased = 0;
      while (w.nextNode()) {
        const n = w.currentNode;
        if (!n.data.trim()) continue;
        const p = n.parentElement;
        if (p.closest(".text-phrase")) { phrased++; continue; }
        if (keep && p.closest(keep) && slot.contains(p.closest(keep))) continue;
        bare.push(label + ": " + n.data.trim().slice(0, 30));
      }
      if (!phrased) empty.push(label);
    }
  }
  return { count, bad, bare, empty };
})()`;

// 行の切れ目を書き出す(--audit)。欄の幅と字の大きさも
const LINES = (sels) => `(() => {
  const out = [];
  for (const sel of ${JSON.stringify(sels)}) for (const el of document.querySelectorAll(sel)) {
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const lines = []; let cur = "", last = null;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const n = w.currentNode; for (let i = 0; i < n.length; i++) { const ch = n.data[i]; if (/\\s/.test(ch)) { cur += ch; continue; } const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const rs = r.getClientRects(); if (!rs.length) continue; const top = rs[0].top; if (last !== null && top > last + rs[0].height * 0.5) { lines.push(cur.trim()); cur = ""; } cur += ch; last = top; } }
    lines.push(cur.trim());
    const b = el.getBoundingClientRect();
    const inner = b.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    out.push({ sel, width: Math.round(inner * 10) / 10, font: cs.fontSize, ls: cs.letterSpacing, lines });
  }
  return out;
})()`;

/*
 * D. 対局説明の見た目(2026-10-06 見直し)。320 幅で送ると、下の段の札(4♠ など)の角の数字が、貼り付いた釦の帯
 *    (戻る・はじめる。.setup-actions)の上に乗っていた(札の中の z-index: 2 が札の外の重なりの順に出ていた)。
 *    札の角の数字を1つずつ帯の高さまで送り、その点でいちばん上に描かれているのが帯かを見る(角の数字は
 *    pointer-events: none なので、測るあいだだけ auto にする)。
 *    あわせて、登場人物の札は縮まない(38×51。横の一言が長いと 22px まで潰れた)。
 *    フェーズ2・3 の王の力・エリアの段落は行頭をそろえる(中寄せの段落で行頭がずれていた)
 */
const LOOKS = `(async () => {
  const box = document.querySelector(".story-intro");
  const bar = box.querySelector(".setup-actions");
  const wait = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const covered = [];
  let probes = 0;
  for (const idx of box.querySelectorAll(".card-face .card-index")) {
    const b0 = bar.getBoundingClientRect(), r0 = idx.getBoundingClientRect();
    box.scrollTop += (r0.top + r0.height / 2) - (b0.top + b0.height / 2);
    await wait();
    const b = bar.getBoundingClientRect(), r = idx.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    // 送りきれず帯の高さに来ない札(帯より下の段の終わり近く)は見ない
    if (y < b.top + 1 || y > b.bottom - 1) continue;
    probes++;
    const keep = idx.style.pointerEvents;
    idx.style.pointerEvents = "auto";
    const top = document.elementFromPoint(x, y);
    idx.style.pointerEvents = keep;
    if (!top || !top.closest(".setup-actions")) covered.push(idx.textContent + "(上に " + (top ? top.className || top.tagName : "なし") + ")");
  }
  box.scrollTop = 0;
  await wait();
  const cards = [...box.querySelectorAll(".chronicle-roster .card-face")].map((c) => { const r = c.getBoundingClientRect(); return Math.round(r.width) + "x" + Math.round(r.height); });
  const aligns = [...box.querySelectorAll(".story-intro-items li > span")].map((el) => getComputedStyle(el).textAlign);
  return { probes, covered, cards, aligns };
})()`;
let barProbes = 0;
async function looks(label, phase) {
  const m = await js(LOOKS);
  const name = `${device[0]} ${label}`;
  barProbes += m.probes;
  ok(`${name}: 送っても札の角の数字が釦の帯の上に乗らない(帯の高さで ${m.probes} か所)`, m.covered.length === 0, m.covered.join(" / "));
  ok(`${name}: 登場人物の札は 38x51 のまま`, m.cards.length > 0 && m.cards.every((c) => c === "38x51"), m.cards.join(" "));
  if (phase > 1) ok(`${name}: 王の力・エリアの段落は行頭をそろえる`, m.aligns.length > 0 && m.aligns.every((a) => a === "left"), m.aligns.join(" "));
}

const report = [];
// フェーズの目的(.chronicle-journey p)はフェーズ2・3 だけ句で書く(フェーズ1 は「あなたが戦う理由」の段落)
const JOURNEY = [".chronicle-journey p", "フェーズの目的"];
async function measure(kind, label, extra = []) {
  if (kind === "reader") {
    const loaded = await js(`Promise.all([...document.querySelectorAll('.chronicle-comic-image image')].map(el=>{const i=new Image();i.src=el.getAttribute('href');return i.decode().then(()=>i.naturalWidth>0).catch(()=>false)}))`);
    ok(`${device[0]} ${label}: 完成ページの画像を読める`, loaded.length === 1 && loaded.every(Boolean));
  }
  if (kind === "reader") {
    const layout = await js(`(() => {
      const failures=[];
      const reader=document.querySelector('.chronicle-reader'),page=reader.querySelector('[data-comic-page]');
      const body=reader.querySelector('.chronicle-comic-copy');
      if(body.scrollHeight>body.clientHeight+1)failures.push('一画面の漫画が縦スクロールを必要とする');
      if(page.querySelectorAll('.chronicle-comic-panel').length!==1)failures.push('一画面に複数ページを縦積みしている');
      if(page.scrollWidth>page.clientWidth+1)failures.push('標準表示のページが画面幅を超えた');
      for(const figure of document.querySelectorAll('.chronicle-comic-panel')) {
        const art=figure.querySelector('.chronicle-comic-image').getBoundingClientRect();
        const image=figure.getBoundingClientRect();
        const printed=figure.classList.contains('has-printed-lettering');
        if(printed) {
          const transcript=figure.querySelector('.printed-comic-transcript');
          if(!transcript || getComputedStyle(transcript).clipPath!=='inset(50%)') failures.push('画像内の台詞と別に字幕欄が表示されている');
          if(art.width<200 || art.height<art.width) failures.push('完成ページの構図が潰れている');
        }
        for(const letter of figure.querySelectorAll('.comic-letter')) {
          const box=letter.getBoundingClientRect(),p=letter.querySelector('p');
          if(printed) {
            if(letter.classList.contains('comic-balloon')&&letter.getAttribute('aria-label')!==letter.dataset.speaker) failures.push('読み上げ用の話者名なし');
            if(letter.querySelector('.comic-speaker')) failures.push('削除した名前の見出しが残っている');
            continue;
          }
          if(box.top<art.bottom-1) failures.push('絵への重なり：'+p.textContent);
          if(letter.classList.contains('comic-balloon')&&letter.getAttribute('aria-label')!==letter.dataset.speaker)failures.push('読み上げ用の話者名なし：'+p.textContent);
          if(letter.querySelector('.comic-speaker')) failures.push('削除した名前の見出しが残っている');
          if(box.left<image.left-1||box.right>image.right+1||box.top<image.top-1||box.bottom>image.bottom+1) failures.push('枠外：'+p.textContent);
          if(p.scrollHeight>p.clientHeight+1||p.scrollWidth>p.clientWidth+1) failures.push('切れ：'+p.textContent);
        }
      }
      if(reader.querySelector('.chronicle-comic-toolbar button'))failures.push('削除した文字拡大ボタンが残っている');
      return failures;
    })()`);
    ok(`${device[0]} ${label}: 漫画ページが画面幅に収まり、名前の見出しと独立した字幕欄が出ない`, layout.length===0, layout.join(' / '));
  }
  const slots = [...SLOTS[kind], ...extra];
  const m = await js(MEASURE(slots));
  const name = `${device[0]} ${label}`;
  ok(`${name}: 句(${m.count})がどれも1行に収まる`, m.count > 0 && m.bad.length === 0, m.bad.join(" / "));
  ok(`${name}: 短い文は句の塊だけで書く`, m.bare.length === 0 && m.empty.length === 0, [...m.bare, ...m.empty.map((e) => e + "(句が無い)")].join(" / "));
  if (audit) {
    const lines = await js(LINES([...slots.map((s) => s[0]), ...PARAS, ...(kind === "screen" && !extra.length ? [JOURNEY[0]] : [])]));
    for (const l of lines) if (l.lines.length > 1) report.push(`${name} ${l.sel} [${l.width}px ${l.font}${l.ls !== "normal" ? " ls " + l.ls : ""}] ${l.lines.join(" | ")}`);
  }
}

const AXES = ["prologue", "23", "45", "67", "89", "10", "jq", "k"];
// ONLY=320,375x667 のように機種を絞れる(確かめ用)
const devices = process.env.ONLY ? IPHONES.filter((d) => process.env.ONLY.split(",").some((k) => d[0].includes(k))) : IPHONES;
for (const dev of devices) {
  await use(dev);
  console.log(`\n${dev[0]}`);
  // A. 一覧: はじめの一局のあと(フェーズ1)・フェーズ3 まで進んだあと(1・2・3 の札を順に)・閉じた頁
  await show({ kind: "screen", profile: "fresh" });
  await measure("screen", "一覧(はじめの一局のあと)");
  if (dev[1] === 320 || dev[1] === 375) {
    await shot(`${dev[0].split(" ")[0]}-list-top.png`);
    await js(`(() => { document.querySelector(".story-list").scrollIntoView(); return true; })()`);
    await settle();
    await shot(`${dev[0].split(" ")[0]}-list-stages.png`);
  }
  await js(`(() => { document.querySelectorAll(".chronicle-phases button")[1].click(); return true; })()`);
  await settle();
  await measure("screen", "一覧(閉じた頁)");
  for (const p of [1, 2, 3]) {
    await show({ kind: "screen", profile: "late" });
    await js(`(() => { document.querySelectorAll(".chronicle-phases button")[${p - 1}].click(); return true; })()`);
    await settle();
    await measure("screen", `一覧(フェーズ${p})`, p > 1 ? [JOURNEY] : []);
    if (p === 3 && (dev[1] === 320 || dev[1] === 375)) {
      await js(`(() => { document.querySelector(".chronicle-journey").scrollIntoView(); return true; })()`);
      await settle();
      await shot(`${dev[0].split(" ")[0]}-list-phase3.png`);
    }
  }
  // B. 物語の頁(全部の頁)・C. 対局説明
  for (const axis of AXES.filter(a => !process.env.AXIS || process.env.AXIS.split(",").includes(a)))
    for (const p of (axis === "prologue" ? [1] : [1, 2, 3]).filter(p => !process.env.PHASE || p === Number(process.env.PHASE))) {
      await show({ kind: "reader", axis, phase: p });
      const pages = await js(`(() => { const s = document.querySelector(".chronicle-reader-controls span"); return s ? Number(s.textContent.split("/")[1]) : 0; })()`);
      for (let i = 0; i < pages; i++) {
        if (i) {
          await js(`(() => { document.querySelector(".chronicle-reader-controls .btn-primary").click(); return true; })()`);
          await settle(30);
        }
        // 目的と次へ続く一言は送る箱の中にある。見えていなくても字の位置は測れる
        await measure("reader", `物語 ${axis}/${p} 頁${i + 1}`);
        if ((axis === "prologue" && [0,1,2].includes(i)) || ((axis === "k" && p===3 && i>=4) || (axis === "23" && p===1))) await shot(`${dev[0].split(" ")[0].replaceAll("/", "-")}-${axis}-${p}-page${i+1}.png`);
        if ((dev[1] === 320 || dev[1] === 375) && axis === "45" && p === 1 && i === 0) await shot(`${dev[0].split(" ")[0]}-reader-45-1.png`);
      }
      if (axis === "prologue") continue;
      if (axis === "23" && p === 1) {
        await show({kind:"reader",axis,phase:p,opening:true});
        const count=await js(`Number(document.querySelector('.chronicle-reader-controls span').textContent.split('/')[1])`);
        ok(`${dev[0]} 最初の対局まで導入を含め6ページ`,count===6);
        for(let i=0;i<count;i++) {
          if(i) {await js(`document.querySelector('.chronicle-reader-controls .btn-primary').click()`);await settle(30);}
          await measure("reader",`初回対局前 ${i+1}/6`);
          if(shots)await shot(`${dev[0].split(" ")[0].replaceAll("/", "-")}-opening-page${i+1}.png`);
        }
      }
      await show({ kind: "intro", axis, phase: p });
      await js(`(() => { const b = document.querySelector(".chronicle-reader-head .chronicle-text-button"); if (b) b.click(); return true; })()`);
      await settle();
      await js(`(() => { for (const d of document.querySelectorAll(".story-intro details")) d.open = true; return true; })()`);
      await settle();
      await measure("intro", `対局説明 ${axis}/${p}`);
      await looks(`対局説明 ${axis}/${p}`, p);
      if ((dev[1] === 320 || dev[1] === 375) && axis === "45" && p === 1) await shot(`${dev[0].split(" ")[0]}-intro-45-1.png`);
      if ((dev[1] === 320 || dev[1] === 375) && axis === "89" && p === 3) {
        await js(`(() => { document.querySelector(".story-intro .chronicle-purpose dl").scrollIntoView({ block: "center" }); return true; })()`);
        await settle();
        await shot(`${dev[0].split(" ")[0]}-intro-89-3.png`);
      }
    }
}

// 320 幅では、どこかで札が帯の高さまで送れる(帯の下を通る札が無いと、上の見方は何も見ていない)
if (!process.env.ONLY || /320/.test(process.env.ONLY)) ok(`対局説明: 札の角の数字を帯の高さで ${barProbes} か所見た`, barProbes > 0);
clearTimeout(guard);
ws.close();
cleanup();
if (audit) {
  const out = path.join(os.tmpdir(), "tottery-story-fit-audit.txt");
  fs.writeFileSync(out, report.join("\n") + "\n");
  console.log(`\n行の切れ目を書き出した: ${out}(${report.length} 行)`);
}
console.log(fail ? `\n${fail} 件の失敗(${passed} 件は通った)` : `\nストーリーの短い文の折り返し: すべて通りました(${passed} 件)`);
process.exit(fail ? 1 : 0);
