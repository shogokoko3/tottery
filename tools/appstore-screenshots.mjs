/**
 * App Store の掲載用スクリーンショットを撮る(2026-11-09。tools/play-screenshots.mjs と同じ作り)。
 *
 *   iphone … iPhone 6.9 インチの欄。CSS 440×956 を3倍で 1320×2868
 *   ipad   … iPad 13 インチの欄。CSS 1032×1376 を2倍で 2064×2752
 *
 * 使い方:
 *   PORT=4300 node tools/serve.mjs &
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --remote-debugging-port=9333 --user-data-dir=/tmp/tottery-chrome-<毎回新しく> --no-first-run about:blank &
 *   node tools/appstore-screenshots.mjs iphone reports/appstore/screenshots-20261109
 */
import fs from "node:fs";

const DEVICE = process.argv[2] || "iphone";
const OUT = process.argv[3] || "reports/appstore/screenshots";
const METRICS = {
  iphone: { width: 440, height: 956, deviceScaleFactor: 3, mobile: true },
  ipad: { width: 1032, height: 1376, deviceScaleFactor: 2, mobile: true },
}[DEVICE];
fs.mkdirSync(OUT, { recursive: true });
const targets = await (await fetch("http://localhost:9333/json")).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = {};
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending[i] = { res, rej };
    ws.send(JSON.stringify({ id: i, method, params }));
  });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending[m.id]) {
    m.error ? pending[m.id].rej(new Error(JSON.stringify(m.error))) : pending[m.id].res(m.result);
    delete pending[m.id];
  }
};
await new Promise((r) => (ws.onopen = r));
await send("Page.enable");
await send("Runtime.enable");
// 本物の待機中の人と組まないよう、通信の相手は遮る
await send("Network.enable");
await send("Network.setBlockedURLs", { urls: ["*firebaseio.com*", "*firebase*"] });

const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * 撮る前に、**手元の確かめでだけ出るもの**を隠す。
 * 通信(Firebase)を遮って撮っているので「成績を保存できていません」の帯が出るが、
 * これは配るアプリの姿ではない。中身の画面には触らない
 */
const 掲載用に整える = () =>
  ev(`(()=>{let e=document.getElementById("play-shot-style"); if(!e){e=document.createElement("style"); e.id="play-shot-style"; document.head.append(e);} e.textContent=".profile-sync-notice,.test-badge,.home-alerts,.title-award{display:none !important}"; return true;})()`);

const shot = async (name) => {
  await 掲載用に整える();
  // 絵が読み込み終わるまで待つ(最大8秒。iPad のストーリーで話の絵が空のまま撮れた)
  for (let i = 0; i < 32; i++) {
    if (await ev(`[...document.images].filter(i=>i.getClientRects().length>0).every(i=>i.complete&&i.naturalWidth>0)`)) break;
    await sleep(250);
  }
  const r = await send("Page.captureScreenshot", { format: "png" });
  const buf = Buffer.from(r.data, "base64");
  fs.writeFileSync(`${OUT}/${DEVICE}-${name}.png`, buf);
  console.log(`  撮った: ${DEVICE}-${name}.png (${(buf.length / 1024).toFixed(0)}KB)`);
};
const tapText = async (t) => {
  const r = await ev(
    `(()=>{const b=[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length>0 && !b.disabled).find(b=>(b.textContent+" "+(b.getAttribute("aria-label")||"")).includes(${JSON.stringify(t)})); if(!b) return null; const q=b.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2};})()`,
  );
  if (!r) return false;
  for (const type of ["mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", { type, x: r.x, y: r.y, button: "left", clickCount: 1 });
  return true;
};
/** ボタンでない要素(「CPUと対戦する」の札など)も、文字を含むいちばん内側の要素を押す */
const tapAnyText = async (t) => {
  const r = await ev(
    `(()=>{const t=${JSON.stringify(t)};const all=[...document.querySelectorAll("main *")].filter(e=>e.getClientRects().length>0&&e.textContent.includes(t)&&e.closest("button,[role=button],a,.choice,.mode-card,[class*=card],[class*=option]"));const inner=all.filter(e=>![...e.children].some(c=>c.textContent.includes(t)));const e=inner[0]; if(!e) return null; const q=e.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2};})()`,
  );
  if (!r) return false;
  for (const type of ["mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", { type, x: r.x, y: r.y, button: "left", clickCount: 1 });
  return true;
};
const waitTap = async (t, ms = 12000) => {
  for (let i = 0; i < ms / 250; i++) {
    if (await tapText(t) || await tapAnyText(t)) return true;
    await sleep(250);
  }
  console.log(`  × 「${t}」が出なかった`);
  return false;
};
const tapSel = async (sel, i = 0) => {
  const r = await ev(
    `(()=>{const c=document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if(!c) return null; const b=c.getBoundingClientRect(); if(!b.width) return null; return {x:b.left+b.width/2,y:b.top+b.height/2};})()`,
  );
  if (!r) return false;
  for (const type of ["mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", { type, x: r.x, y: r.y, button: "left", clickCount: 1 });
  return true;
};
/** 重なって出るもの(ログインボーナス・お知らせ・案内)を閉じる */
const 窓の釦 = async (words) => {
  const r = await ev(
    `(()=>{const w=${JSON.stringify(words)};const m=[...document.querySelectorAll(".modal-overlay, .notice-sheet, [role=dialog]")].pop(); if(!m) return null; const bs=[...m.querySelectorAll("button")].filter(b=>b.getClientRects().length>0&&!b.disabled); for(const t of w){const b=bs.find(b=>b.textContent.includes(t)); if(b){const q=b.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2};}} return null;})()`,
  );
  if (!r) return false;
  for (const type of ["mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", { type, x: r.x, y: r.y, button: "left", clickCount: 1 });
  return true;
};
const 重なりを閉じる = async () => {
  for (let i = 0; i < 6; i++) {
    if (await 窓の釦(["確認した", "あとで", "とじる", "閉じる", "ホームへ", "OK", "受け取る"])) { await sleep(800); continue; }
    let hit = false;
    for (const t of ["確認した", "あとで", "ホームへ", "とじる", "閉じる", "OK"])
      if (await tapText(t)) { hit = true; await sleep(800); break; }
    if (!hit) return;
  }
};

const home = async () => {
  for (let i = 0; i < 8; i++) {
    await 重なりを閉じる();
    if (await ev(`!!document.querySelector(".home-grid")`)) return true;
    if (await tapText("ホームに戻る")) { await sleep(700); continue; }
    if (await tapText("戻る")) { await sleep(700); continue; }
    await sleep(400);
  }
  return false;
};


await send("Emulation.setDeviceMetricsOverride", METRICS);

console.log("はじめの画面を作る");
await send("Page.navigate", { url: "http://localhost:4300/" });
await sleep(2500);
// 音は鳴らさない
await ev(`localStorage.setItem("tottery.audio.v1", JSON.stringify({muted:true}))`);
// SEED=<json> があれば、導入を終えた端末の記録(localStorage)を入れてから始める
if (process.env.SEED) {
  const seed = JSON.parse(fs.readFileSync(process.env.SEED, "utf8"));
  await ev(`(()=>{const s=${JSON.stringify(JSON.stringify(seed))};const o=JSON.parse(s);for(const k in o)localStorage.setItem(k,o[k]);return Object.keys(o).length})()`);
  await send("Page.navigate", { url: "http://localhost:4300/" });
  await sleep(2500);
}
const 状態 = () => ev(`(document.querySelector("main")||document.body).innerText.slice(0,160).replace(/\\s+/g," ")`);
for (let i = 0; i < 40; i++) {
  await sleep(900);
  if (await ev(`!!document.querySelector(".home-grid")`)) break;
  if (await ev(`!!document.querySelector("input.name-input")`)) {
    await ev(
      `(()=>{const inp=document.querySelector("input.name-input");const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;set.call(inp,"あなた");inp.dispatchEvent(new Event("input",{bubbles:true}));})()`,
    );
    await sleep(200);
    if (await tapText("はじめる") || await tapText("決定") || await tapText("つぎへ")) continue;
  }
  let hit = false;
  for (const t of ["ゲームスタート", "スキップ", "飛ばす", "あとで", "とじる", "閉じる", "ホームへ", "ホームに戻る", "OK"])
    if (await tapText(t)) { hit = true; break; }
  if (!hit && i % 5 === 4) console.log("  いまの画面:", await 状態());
}

// 9×9 は Lv4 から開く(src/game/card-unlock.js)。掲載用には 9×9 を見せたいので経験値を入れる。遊べば誰でも届くところ
await ev(
  `(()=>{const k="tottery.account.v1";const a=JSON.parse(localStorage.getItem(k)||"{}");a.xp=4000;localStorage.setItem(k,JSON.stringify(a));return a.xp;})()`,
);

console.log("① タイトル");
await send("Page.navigate", { url: "http://localhost:4300/" });
await sleep(3000);
await shot("01-title");

console.log("② ホーム");
await waitTap("ゲームスタート");
await sleep(1800);
for (let i = 0; i < 10; i++) {
  const clean = await ev(`!!document.querySelector(".home-grid") && !document.querySelector(".modal-overlay, .notice-sheet")`);
  if (clean) break;
  await 重なりを閉じる();
  await sleep(700);
}
await sleep(600);
await shot("02-home");

console.log("③ ストーリー");
await ev(`[...document.querySelectorAll(".home-grid .home-tile")].find(b=>b.textContent.includes("ストーリー"))?.click()`);
await sleep(2000);
await 重なりを閉じる();
await sleep(600);
await shot("03-story");
await home();

console.log("④ 手札 ⑤ 王を選ぶ ⑥ 盤");
await waitTap("対戦する");
await sleep(800);
await waitTap("CPUと対戦");
await sleep(900);
await tapSel(".board-choice", 1); // 9×9
await sleep(400);
await waitTap("ゲームを始める");
await sleep(2500);
for (let i = 0; i < 12; i++) {
  if (await ev(`!!document.querySelector(".mulligan-order, .mulligan")`)) break;
  if (await tapText("サイコロを振る")) { await sleep(2200); continue; }
  if (await tapText("振り直す")) { await sleep(2200); continue; }
  if (await tapText("次へ")) { await sleep(900); continue; }
  await sleep(600);
}
await sleep(800);
await shot("04-hand");
await tapText("このまま");
await sleep(2000);
// 自動配置 → 王を選ぶ画面
for (let i = 0; i < 10 && !(await tapText("自動配置")); i++) await sleep(500);
await sleep(800);
await tapText("王を選ぶ");
await sleep(1500);
await shot("05-king");
await tapText("決定") || await tapText("この王で") || await tapText("確定");
// 両軍の駒が並んで指し始めたところで撮る。CPU の手も待つ
for (let i = 0; i < 80; i++) {
  for (const t of ["決定", "確定", "この王で", "OK", "とじる"]) if (await tapText(t)) break;
  await sleep(1000);
  const 駒 = await ev(`document.querySelectorAll(".board-grid .piece").length`);
  const 重なり = await ev(`!!document.querySelector(".modal-overlay")`);
  if (駒 >= 14 && !重なり) break;
}
// 数手指して、盤が動いているところにする(CPU どうしでは無いので、自分の駒を前へ1つ)
await sleep(2500);
await shot("06-board");
await home();

console.log("⑦ ガチャ");
await ev(`[...document.querySelectorAll(".home-grid .home-tile")].find(b=>b.textContent.includes("ガチャ"))?.click()`);
await sleep(2500);
await 重なりを閉じる();
await shot("07-gacha");
await home();

console.log("⑧ 詰めトッタリー");
await ev(`[...document.querySelectorAll(".home-grid .home-tile")].find(b=>b.textContent.includes("詰め"))?.click()`);
await sleep(2000);
await shot("08-tsume");

console.log("\n撮り終わり:", fs.readdirSync(OUT).filter((f) => f.startsWith(DEVICE)).sort().join(", "));
ws.close();
