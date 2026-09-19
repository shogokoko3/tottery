/**
 * Google Play の掲載用スクリーンショットを撮る。
 *
 * Play の「スマートフォン」の欄は **縦横比が 16:9〜9:16** でなければならない。
 * iPhone 用に撮ったもの(1290×2796 = 1:2.17)はこの範囲を外れるので流用できない。
 * ここでは CSS 360×640 を3倍密度で撮り、ちょうど 1080×1920(9:16)にする。
 *
 * 使い方:
 *   PORT=4300 node tools/serve.mjs &
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --remote-debugging-port=9333 --user-data-dir=/tmp/tottery-chrome --no-first-run about:blank &
 *   node tools/play-screenshots.mjs reports/play/screenshots
 */
import fs from "node:fs";

const OUT = process.argv[2] || "reports/play/screenshots";
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
  ev(`(()=>{let e=document.getElementById("play-shot-style"); if(!e){e=document.createElement("style"); e.id="play-shot-style"; document.head.append(e);} e.textContent=".profile-sync-notice,.test-badge{display:none !important}"; return true;})()`);

const shot = async (name) => {
  await 掲載用に整える();
  const r = await send("Page.captureScreenshot", { format: "png" });
  const buf = Buffer.from(r.data, "base64");
  fs.writeFileSync(`${OUT}/${name}.png`, buf);
  console.log(`  撮った: ${name}.png (${(buf.length / 1024).toFixed(0)}KB)`);
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
const waitTap = async (t, ms = 12000) => {
  for (let i = 0; i < ms / 250; i++) {
    if (await tapText(t)) return true;
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
const 重なりを閉じる = async () => {
  for (let i = 0; i < 6; i++) {
    let hit = false;
    for (const t of ["受け取る", "ホームへ", "あとで", "とじる", "閉じる", "OK"])
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

// 1080×1920(9:16)。Play の「スマートフォン」の決まりに合う
await send("Emulation.setDeviceMetricsOverride", {
  width: 360, height: 640, deviceScaleFactor: 3, mobile: true,
});

console.log("はじめの画面を作る");
await send("Page.navigate", { url: "http://localhost:4300/" });
await sleep(2500);
// 音は鳴らさない(本人の指示)
await ev(`localStorage.setItem("tottery.audio.v1", JSON.stringify({muted:true}))`);
for (let i = 0; i < 6; i++) {
  await sleep(1000);
  if (await ev(`!!document.querySelector("input.name-input")`)) {
    await ev(
      `(()=>{const inp=document.querySelector("input.name-input");const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;set.call(inp,"あなた");inp.dispatchEvent(new Event("input",{bubbles:true}));})()`,
    );
    await sleep(200);
    await tapText("はじめる");
    continue;
  }
  if (await tapText("あとで")) continue;
  if (await ev(`!!document.querySelector(".home-grid")`)) break;
  if (await tapText("ゲームスタート")) continue;
}

// 9×9 は Lv4 から開く(src/game/card-unlock.js)。掲載用には本編の 9×9 を
// 見せたいので、経験値を入れてから開き直す。遊べば誰でも届くところ
await ev(
  `(()=>{const k="tottery.account.v1";const a=JSON.parse(localStorage.getItem(k)||"{}");a.xp=4000;localStorage.setItem(k,JSON.stringify(a));return a.xp;})()`,
);

// ① タイトル。開き直すと出る
console.log("① タイトル");
await send("Page.navigate", { url: "http://localhost:4300/" });
await sleep(3000);
await shot("01-title");

// ② ホーム
console.log("② ホーム");
await waitTap("ゲームスタート");
await sleep(1800);
// ログインボーナスは受け取ると別の釦に変わるので、重なりが消えるまで繰り返す
for (let i = 0; i < 10; i++) {
  const clean = await ev(
    `!!document.querySelector(".home-grid") && !document.querySelector(".modal-overlay, .notice-sheet")`,
  );
  if (clean) break;
  await 重なりを閉じる();
  await sleep(700);
}
await sleep(600);
await shot("02-home");

// ③ チュートリアルの一覧
console.log("③ チュートリアル");
await ev(`[...document.querySelectorAll(".home-grid .home-tile")].find(b=>b.textContent.includes("チュートリアル"))?.click()`);
await sleep(1500);
await shot("03-tutorial");
await home();

// ④⑤ CPU と 9×9。手札の引き直し → 盤
console.log("④ 手札 ⑤ 盤");
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
  if (await tapText("手札を確認")) { await sleep(1200); continue; }
  if (await tapText("次へ")) { await sleep(900); continue; }
  await sleep(600);
}
await sleep(800);
await shot("04-hand");
// 布陣まで進めて盤を撮る
// 布陣に「おまかせ」の釦は無い。時間切れになると残りが自動で埋まり、
// 王選びも自動で決まって対局が始まる(src/ui/game.jsx)。待って通す
for (let i = 0; i < 70; i++) {
  let hit = false;
  for (const t of ["振り直す", "サイコロを振る", "手札を確認", "引き直さない", "引き直して確定", "この手札で進む", "おまかせ", "この布陣", "確定", "次へ", "はい", "OK", "とじる"]) {
    if (await tapText(t)) { hit = true; break; }
  }
  await sleep(1100);
  // 布陣も王選びも終わり、両軍の駒が並んで指し始めたところで撮る。
  // 空の盤や「王にするカードを決めてね」の途中は見せない
  const 駒 = await ev(`document.querySelectorAll(".board-grid .piece").length`);
  const 見出し = await ev(`document.querySelector("h2, .turn-banner")?.textContent || ""`);
  const 重なり = await ev(`!!document.querySelector(".modal-overlay")`);
  if (駒 >= 14 && !重なり && !/配置|王にする|決めて/.test(見出し)) break;
  if (!hit) await sleep(500);
}
await sleep(1500);
await shot("05-board");
await home();

// ⑥ 詰めトッタリー
console.log("⑥ 詰めトッタリー");
await ev(`[...document.querySelectorAll(".home-grid .home-tile")].find(b=>b.textContent.includes("詰め"))?.click()`);
await sleep(2000);
await shot("06-tsume");

console.log("\n撮り終わり:", fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort().join(", "));
ws.close();
