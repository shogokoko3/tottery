/**
 * 導入の画面が iPhone の大きさに収まり、日本語が語の途中で折れないかを、本物の部品と本物の CSS で描いて測る
 * (2026-10-05 見直し)。頭なしの Chrome(CDP)を使うので npm run check には入れていない。手で走らせる:
 *
 *   perl -e 'alarm 300; exec @ARGV' node tools/check-intro-fit.mjs
 *
 * 見ること:
 *   A. はじめの一局の結果(王5通りのうち 3♣ で 4♦ が討つ形): 9機種で「ガチャチケット 10枚」と「門へ進む」が
 *      最初の画面に見える。375×667 でも締めの一行(「一手に、読みを。一枚に、野望を。」)が送らずに見える
 *   B. 句ごとに折り返す文(.text-phrase)がどの句も1行に収まり、列からはみ出さない:
 *      ヒントの動きの図(2・3・5)・ストーリーの対局説明(フェーズ1 の7ステージ)・手引き(7枚)。
 *      320 幅(SE 第1世代)も見る
 *   C. 結果のあなたの王の一行(「あなたの王は、」「最後まで伏せたまま。」)が 375 幅から1行ずつ。
 *      320 幅では句の間で折れる(句の中では折れない)
 *   D. はじめの一局を、本物の対局の部品(GameCore)で 320×568 と 375×667 で通す(2026-10-06 見直し):
 *      待つ札(4♠ の両取り)が4段目(4♠・ねらわれた二枚)を覆わない。2手目とヒントを開いたあとに、
 *      王を討てる駒 4♦(e1)と的の e3 が上のバーと帯のあいだに見える。結果で締めと「門へ進む」が送らずに見える
 *
 * iPhone の WebKit は word-break: auto-phrase を知らない。ここではその宣言を消して描く(WebKit の代わり)。
 * 画面の上下の切り欠き(safe-area)は env() を端末ごとの値に置き換える。
 * Chrome は空いているポートに自分で立て、終わったら(時間切れ・失敗でも)止める。撮った絵は --shots=<dir> で残す
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
if (!fs.existsSync(CHROME)) {
  console.error(`Chrome が見つからない(${CHROME})。CHROME=… で場所を渡す`);
  process.exit(2);
}

let fail = 0;
const ok = (label, cond, extra) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) fail++;
};

/* ---------------- 頁を束ねる(リポジトリには何も書かない) ---------------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-intro-fit-"));
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
// 外の上限(perl alarm)とは別に、自分でも止まる(D の通しを足して 240 → 330 秒。2026-10-06 見直し)
const guard = setTimeout(() => {
  console.error("時間切れ(330 秒)");
  cleanup();
  process.exit(2);
}, 330000);

const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import { GameShell } from "./src/ui/screens.jsx";
import { GameView, GameCore } from "./src/ui/game.jsx";
import { firstGameStory } from "./src/game/intro.js";
import { SeatsProvider } from "./src/ui/names.jsx";
import { TutorialSheet } from "./src/ui/tutorial.jsx";
import { StoryIntro } from "./src/ui/story.jsx";
import { Primer } from "./src/ui/primer.jsx";
import { NameSetupScreen } from "./src/ui/account.jsx";
import { reducer } from "./src/game/reducer.js";
import { getLegalMoves, kingRankOf } from "./src/game/board.js";
import { GAME_RULE_VERSION } from "./src/game/rule-version.js";
import { FIRST_GAME, foeAction, openingState, stepLines, movesLeft } from "./src/game/tutorial.js";
import { primerOutroLines } from "./src/game/story.js";

const tut = FIRST_GAME;
const legal = (a, p) => getLegalMoves(p, a.board, a.boardSize, a.players[p.owner].armyRankCounts, kingRankOf(a, p.owner));
const moveOf = (a, id, row, col) => {
  const hit = legal(a, a.pieces[id]).find((m) => m.row === row && m.col === col);
  return { type: "MOVE_PIECE", pieceId: id, row, col, captures: hit.captures };
};
const settle = (a) => { for (let g = 0; g < 10 && a.interstitial; g++) a = reducer(a, { type: "DISMISS_INTERSTITIAL" }); return a; };
function held(king) {
  let s = openingState(tut, GAME_RULE_VERSION);
  s = reducer(s, { type: "SETUP_PICK_KING", player: 0, cardId: king });
  s = settle(reducer(s, { type: "SETUP_CONFIRM", player: 0 }));
  s = settle(reducer(s, moveOf(s, "t0", 1, 2)));
  return settle(reducer(s, { type: "DISMISS_CAPTURE" }));
}
const chooseState = (king) => { const s = held(king); return settle(reducer(s, foeAction(s, tut, 0, (p) => legal(s, p)))); };
function finished(king, by) {
  let s = chooseState(king);
  s = settle(reducer(s, moveOf(s, by, 2, 4)));
  return reducer(s, { type: "DISMISS_CAPTURE" });
}
const q = new URLSearchParams(location.search.slice(1));
const view = q.get("view");
const seats = { names: ["あなた", "二と三の王"], icons: [null, null], titles: [null, null], skins: [{}, {}] };
const story = { axis: "23", phase: 1, size: 5, king: "3", title: "二と三の王", fresh: true, next: { axis: "45", title: "四と五の王" }, allCleared: false, ready: true };
const noop = () => {};
function App() {
  // 本物の対局の部品で、はじめの一局を通す(D)。席の名前は screens.jsx と同じ形
  if (view === "game")
    return (
      <SeatsProvider value={seats}>
        <GameCore key="first-game" round={0} network={null} boardSize={tut.boardSize} cpu tutorial={tut} story={firstGameStory()}
          nextTutorial={null} onNextTutorial={null} onExit={noop} onHome={noop} onTutorialList={noop} onGate={noop}
          onNextStory={noop} onRetryStory={null} exitLabel="ストーリーに戻る" />
      </SeatsProvider>
    );
  if (view === "hint") {
    const s = chooseState("t3");
    const step = tut.steps[4];
    return (
      <GameShell showRules={false} setShowRules={noop} band>
        <div style={{ height: 600 }} />
        <TutorialSheet step={step} index={4} total={tut.steps.length} left={movesLeft(tut, 4)} lines={stepLines(step, s)}
          hint={step.need.choose.hint} hintGuide={step.need.choose.hintGuide} plain onNext={noop} low />
      </GameShell>
    );
  }
  if (view === "story")
    return (
      <GameShell showRules={false} setShowRules={noop} onHome={noop}>
        <StoryIntro axis={q.get("axis")} phase={1} onStart={noop} onBack={noop} />
      </GameShell>
    );
  if (view === "primer")
    return (
      <GameShell showRules={false} setShowRules={noop} onHome={noop}>
        <Primer outro={primerOutroLines({ phase: 1, story: { 1: ["23"], 2: [], 3: [] } })} onDone={noop} onSkip={noop} />
      </GameShell>
    );
  const s = finished("t3", "t2");
  return (
    <GameShell showRules={false} setShowRules={noop} onHome={noop}>
      <SeatsProvider value={seats}>
        <GameView state={s} size={5} viewer={0} youAre={0} dispatch={noop} onExit={noop} onHome={noop}
          tutorial={tut} nextTutorial={null} onNextTutorial={null} onTutorialList={noop} rating={null} rematch={null}
          seasonResult={{ active: false }} story={story} onGate={noop} onNextStory={noop} />
        {view === "name" && (
          <div className="modal-overlay intro-name-cover"><NameSetupScreen afterWin onDone={noop} onCancel={noop} /></div>
        )}
      </SeatsProvider>
    </GameShell>
  );
}
createRoot(document.getElementById("root")).render(<App />);
window.__ready = true;
`;
const bundled = await build({
  stdin: { contents: entry, resolveDir: repo, loader: "jsx", sourcefile: "intro-fit-entry.jsx" },
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
  // 外へは書体(Google Fonts)だけ通す。本物の対局の部品(D)は記録やランキングを送ろうとするので、名前を引けなくする
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

// 名前・幅・高さ・上の切り欠き・下の切り欠き・倍率
const IPHONES = [
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
const NARROW = [["SE1 320x568", 320, 568, 20, 0, 2]];

async function open(query, [name, w, h, top, bottom, dpr]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: true });
  await send("Page.navigate", { url: `file://${page}?${query}` });
  await js(`new Promise((r, j) => { const until = Date.now() + 15000; const t = () => (window.__ready && document.querySelector(".tottery-root")) ? r(true) : Date.now() > until ? j(new Error("頁が描けない")) : setTimeout(t, 50); t(); })`);
  await js(`Promise.race([document.fonts.ready.then(() => document.fonts.load('16px "Shippori Mincho"', "王")), new Promise((r) => setTimeout(r, 5000))]).then(() => true)`);
  // WebKit の代わり: auto-phrase を消す。切り欠きは端末の値に
  await js(`(() => { for (const st of document.querySelectorAll("style")) st.textContent = st.textContent.replace(/env\\(safe-area-inset-top\\)/g, "${top}px").replace(/env\\(safe-area-inset-bottom\\)/g, "${bottom}px").replace(/word-break:\\s*auto-phrase;?/g, ""); return true; })()`);
  await js(`new Promise((r) => setTimeout(r, 350))`);
}
async function shot(file) {
  if (!shots) return;
  fs.mkdirSync(shots, { recursive: true });
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(shots, file), Buffer.from(r.result.data, "base64"));
}

// 句(.text-phrase)が1行に収まり、列からはみ出さないか。収まらない句を返す
const PHRASES = `(() => {
  const bad = [];
  for (const el of document.querySelectorAll(".text-phrase")) {
    if (!el.getClientRects().length) continue;
    // 行は字の縦の幅が重なるもの同士(字の大きさが違う「3♦ だった。」の 3♦ を別の行に数えない。2026-10-06 見直し)
    const boxes = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const n = w.currentNode; for (let i = 0; i < n.length; i++) { if (/\s/.test(n.data[i])) continue; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const rs = r.getClientRects(); if (rs.length) boxes.push([rs[0].top, rs[0].bottom]); } }
    boxes.sort((a, b) => a[0] - b[0]);
    const tops = new Set();
    let lineBottom = -Infinity;
    for (const [t, b] of boxes) { if (t >= lineBottom - 2) { tops.add(Math.round(t)); lineBottom = b; } else lineBottom = Math.max(lineBottom, b); }
    const box = el.parentElement.getBoundingClientRect();
    const cs = getComputedStyle(el.parentElement);
    const right = box.right - parseFloat(cs.paddingRight || 0) - parseFloat(cs.borderRightWidth || 0);
    const me = el.getBoundingClientRect();
    if (tops.size > 1 || me.right > right + 0.5) bad.push(el.textContent + (tops.size > 1 ? "(句の中で折れた)" : "(列からはみ出た)"));
  }
  return { count: document.querySelectorAll(".text-phrase").length, bad };
})()`;

console.log("A. はじめの一局の結果(門へ進む)");
for (const dev of [...NARROW, ...IPHONES]) {
  await open("view=result", dev);
  const m = await js(`(() => {
    const body = document.querySelector(".gameover-body");
    const b = body.getBoundingClientRect();
    const seen = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const inBody = body.contains(el); return r.top >= (inBody ? b.top : 0) - 1 && r.bottom <= (inBody ? Math.min(b.bottom, innerHeight) : innerHeight) + 1; };
    const tag = document.querySelector(".tutorial-tagline"), reward = document.querySelector(".story-reward"), gate = document.querySelector(".result-gate");
    const rows = [...document.querySelectorAll(".tutorial-reveal-mine .tutorial-line-row")].map((el) => { const tops = new Set(); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const n = w.currentNode; for (let i = 0; i < n.length; i++) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const rs = r.getClientRects(); if (rs.length) tops.add(Math.round(rs[0].top)); } } return tops.size; });
    return { tag: seen(tag), reward: seen(reward), gate: seen(gate), rows, scroll: body.scrollHeight - body.clientHeight };
  })()`);
  ok(`${dev[0]}: 「ガチャチケット 10枚」と「門へ進む」が最初の画面に見える`, m.reward && m.gate, JSON.stringify(m));
  ok(`${dev[0]}: 締めの一行が送らずに見える`, m.tag, JSON.stringify(m));
  if (dev[1] >= 375) ok(`${dev[0]}: あなたの王の一行は1行ずつ`, m.rows.length === 2 && m.rows.every((n) => n === 1), JSON.stringify(m.rows));
  else {
    // 320 幅は半分の列に「最後まで伏せたまま。」が入らない。句の間でだけ折れる(2026-10-06 見直し)
    const p = await js(PHRASES);
    ok(`${dev[0]}: 結果の文は句の中で折れない(${p.count})`, p.bad.length === 0, p.bad.join(" / "));
  }
  if (dev[0].startsWith("SE")) await shot(`result-${dev[0].split(" ")[0]}.png`);
}
{
  await open("view=name", IPHONES[0]);
  const m = await js(`(() => { const card = document.querySelector(".intro-name-cover .name-card"); if (!card) return null; const r = card.getBoundingClientRect(); const bg = getComputedStyle(card).backgroundImage + getComputedStyle(card).backgroundColor; return { top: r.top, bottom: r.bottom, vh: innerHeight, back: [...card.querySelectorAll("button")].some((b) => b.textContent.includes("戻る")), bg }; })()`);
  ok("SE 375x667: 結果の上の名前の札は画面に収まり、「戻る」がある", !!m && m.top >= 0 && m.bottom <= m.vh && m.back, JSON.stringify(m));
  ok("名前の札は下の結果が透けない(背景がある)", !!m && /gradient|rgb\((?!0, 0, 0\))/.test(m.bg), m && m.bg);
  await shot("name-cover-SE.png");
}

console.log("\nB. 句ごとに折り返す文");
const phraseViews = [["view=hint", "ヒントの動きの図"], ...["23", "45", "67", "89", "10", "jq", "k"].map((axis) => [`view=story&axis=${axis}`, `対局説明 ${axis}`]), ["view=primer", "手引き"]];
for (const [query, label] of phraseViews)
  for (const dev of [...NARROW, ...IPHONES]) {
    await open(query, dev);
    let pages = [await js(PHRASES)];
    if (query.startsWith("view=story")) {
      // 物語を読み飛ばして対局説明へ
      await js(`(() => { const b = document.querySelector(".chronicle-reader-head .chronicle-text-button"); if (b) b.click(); return true; })()`);
      await js(`new Promise((r) => setTimeout(r, 250))`);
      pages = [await js(PHRASES)];
    }
    if (query === "view=primer")
      for (let i = 1; i < 7; i++) {
        await js(`(() => { document.querySelector(".primer-next").click(); return true; })()`);
        await js(`new Promise((r) => setTimeout(r, 120))`);
        pages.push(await js(PHRASES));
      }
    const count = pages.reduce((n, p) => n + p.count, 0);
    const bad = pages.flatMap((p) => p.bad);
    ok(`${label} ${dev[0]}: 句(${count})がどれも1行に収まる`, count > 0 && bad.length === 0, bad.join(" / "));
    if (dev[0].startsWith("SE 375") && (query === "view=hint" || query.endsWith("axis=45"))) await shot(`${query.replace(/[^a-z0-9]+/gi, "-")}-SE.png`);
  }

console.log("\nD. はじめの一局を本物の対局の部品で通す(320×568・375×667)");
{
  const sleep = (ms) => js(`new Promise((r) => setTimeout(r, ${ms}))`);
  const until = async (expr, ms, label) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await js(expr)) return true;
      await sleep(150);
    }
    ok(`${label}が出る`, false, "待ちきれない");
    return false;
  };
  const sheet = `(document.querySelector(".tutorial-sheet")?.innerText || "")`;
  // 盤のマス(行×5+列)の駒が、上のバーと札(帯)のあいだに見えるか。札が盤の右にあるときは画面の下まで
  const COVER = (cells) => `(() => {
    const bar = document.querySelector(".top-bar").getBoundingClientRect();
    const inner = document.querySelector(".tutorial-sheet-inner");
    const right = !!document.querySelector(".tutorial-sheet-dock-right");
    const floor = inner && !right ? inner.getBoundingClientRect().top : innerHeight;
    return ${JSON.stringify(cells)}.map((i) => {
      const cell = document.querySelectorAll(".board-frame .cell")[i];
      const el = cell && (cell.querySelector(".piece-slot") || cell);
      if (!el) return { i, seen: false, why: "無い" };
      const r = el.getBoundingClientRect();
      const mid = (r.top + r.bottom) / 2;
      return { i, top: Math.round(r.top), bottom: Math.round(r.bottom), floor: Math.round(floor), ceil: Math.round(bar.bottom), seen: r.top >= bar.bottom - 1 && r.bottom <= floor + 1, mid: mid > bar.bottom && mid < floor };
    });
  })()`;
  for (const dev of [NARROW[0], IPHONES[0]]) {
    const name = dev[0];
    try {
      await open("view=game", dev);
      await js(`(() => { try { localStorage.clear(); } catch {} return true; })()`);
      await until(`!!document.querySelector(".mini-cell")`, 15000, `${name}: 王を選ぶ画面`);
      await sleep(600);
      // 3♣(a2)を王に。確定
      await js(`(() => { document.querySelectorAll(".mini-cell")[15].click(); return true; })()`);
      await sleep(400);
      await js(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("布陣を確定")); b && b.click(); return !!b; })()`);
      await until(`!!document.querySelector(".board-frame") && ${sheet}.includes("その一枚が")`, 15000, `${name}: 1手目の札`);
      await sleep(900);
      const move1 = await js(COVER([17, 7]));
      ok(`${name}: 1手目で 4♠(c2)と的の c4 が見える`, move1.every((c) => c.seen), JSON.stringify(move1));
      await js(`(() => { document.querySelectorAll(".board-frame .cell")[17].querySelector(".piece-slot").click(); return true; })()`);
      await sleep(500);
      await js(`(() => { const c = document.querySelectorAll(".board-frame .cell")[7]; (c.querySelector(".piece-slot") || c).click(); return true; })()`);
      await sleep(500);
      await js(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "取る"); b && b.click(); return !!b; })()`);
      await until(`!!document.querySelector(".capture-scene-footer button:not([disabled])")`, 20000, `${name}: 撃破の札の釦`);
      await js(`(() => { document.querySelector(".capture-scene-footer button").click(); return true; })()`);
      await until(`${sheet}.includes("相手は、どちらを逃がす")`, 10000, `${name}: 待つ札`);
      await sleep(1200);
      // 待つ札が4段目(b4・c4 の 4♠・d4)を覆わない(札が説明している盤面)
      const hold = await js(COVER([6, 7, 8]));
      ok(`${name}: 待つ札が4段目(4♠ と、ねらわれた二枚)を覆わない`, hold.every((c) => c.seen), JSON.stringify(hold));
      const holdText = await js(PHRASES);
      ok(`${name}: 待つ札の文は句の中で折れない`, holdText.bad.length === 0, holdText.bad.join(" / "));
      if (shots) await shot(`game-hold-${name.split(" ")[0]}.png`);
      await js(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("つづき")); b && b.click(); return !!b; })()`);
      await until(`${sheet}.includes("逃げた一枚か")`, 12000, `${name}: 2手目の札`);
      await sleep(1300);
      const move2 = await js(COVER([24, 14, 6]));
      ok(`${name}: 2手目で、王を討てる駒 4♦(e1)・的の e3・残された b4 が見える`, move2.every((c) => c.seen), JSON.stringify(move2));
      if (shots) await shot(`game-move2-${name.split(" ")[0]}.png`);
      await js(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("ヒントを見る")); b && b.click(); return !!b; })()`);
      await sleep(1500);
      const hinted = await js(COVER([24, 14]));
      ok(`${name}: ヒントを開いたあとも、4♦(e1)と e3 が上のバーと帯のあいだに見える`, hinted.every((c) => c.seen), JSON.stringify(hinted));
      const hintText = await js(PHRASES);
      ok(`${name}: ヒントの文は句の中で折れない`, hintText.bad.length === 0, hintText.bad.join(" / "));
      if (shots) await shot(`game-hint-${name.split(" ")[0]}.png`);
      // 4♦ で e3 を討つ
      await js(`(() => { document.querySelectorAll(".board-frame .cell")[24].querySelector(".piece-slot").click(); return true; })()`);
      await sleep(500);
      await js(`(() => { const c = document.querySelectorAll(".board-frame .cell")[14]; (c.querySelector(".piece-slot") || c).click(); return true; })()`);
      await sleep(500);
      await js(`(() => { const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "取る"); b && b.click(); return !!b; })()`);
      await until(`!!document.querySelector(".capture-scene-footer button:not([disabled])")`, 25000, `${name}: 王の撃破の札の釦`);
      await js(`(() => { document.querySelector(".capture-scene-footer button").click(); return true; })()`);
      await until(`!!document.querySelector(".result-gate")`, 20000, `${name}: 結果の「門へ進む」`);
      await sleep(900);
      const res = await js(`(() => {
        const body = document.querySelector(".gameover-body"); const b = body.getBoundingClientRect();
        const seen = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const inBody = body.contains(el); return r.top >= (inBody ? b.top : 0) - 1 && r.bottom <= (inBody ? Math.min(b.bottom, innerHeight) : innerHeight) + 1; };
        return { tag: seen(document.querySelector(".tutorial-tagline")), gate: seen(document.querySelector(".result-gate")), afterword: /後日談/.test(document.querySelector(".gameover-panel").innerText) };
      })()`);
      ok(`${name}: 結果で締めの一行と「門へ進む」が送らずに見え、「後日談を読む」は出ない`, res.tag && res.gate && !res.afterword, JSON.stringify(res));
      if (shots) await shot(`game-result-${name.split(" ")[0]}.png`);
    } catch (e) {
      ok(`${name}: はじめの一局を通す`, false, String(e).slice(0, 300));
    }
  }
}

clearTimeout(guard);
ws.close();
cleanup();
console.log(fail ? `\n${fail} 件の失敗` : "\n導入の画面の収まり: すべて通りました");
process.exit(fail ? 1 : 0);
