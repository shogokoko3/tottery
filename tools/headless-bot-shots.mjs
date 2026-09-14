// ヘッドレスの Chrome を CDP で動かして、チュートリアルを飛ばし、ランダムマッチで Bot と当たるところまで進めて撮る。
// ブラウザ用の道具(preview_start / Claude in Chrome)が使えないときの確かめ方(2026-09-14)。
// 使い方:
//   PORT=4300 node tools/serve.mjs &
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/tottery-chrome --no-first-run --mute-audio about:blank &
//   node tools/headless-tutorial-shots.mjs <出力先の dir> [phone|desk|both]
// 出力: <dir>/phone-*.png, desk-*.png と、札と盤の位置(measure)
import fs from "node:fs";
const S = process.argv[2];
const targets = await (await fetch("http://localhost:9333/json")).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = {};
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) { m.error ? pending[m.id].rej(new Error(JSON.stringify(m.error))) : pending[m.id].res(m.result); delete pending[m.id]; } };
await new Promise((r) => (ws.onopen = r));
await send("Page.enable"); await send("Runtime.enable");
// Firebase(掲示・認証)には行かせない。本物の待機中の人と組んでしまわないため。
// 人が見つからない → BOT_WAIT_MS で Bot に切り替わる道を見る
await send("Network.enable");
await send("Network.setBlockedURLs", { urls: ["*firebaseio.com*", "*googleapis.com*", "*firebase*"] });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${S}/${name}.png`, Buffer.from(r.data, "base64")); console.log("shot", name); };
const buttons = () => ev(`[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length>0).map(b=>b.textContent.trim().slice(0,20))`);
const clickText = async (t) => ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length>0).find(b=>b.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true;})()`);
const tap = async (sel, i) => { const r = await ev(`(()=>{const c=document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if(!c) return null; const b=c.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2};})()`); if (!r) return false; for (const type of ["mousePressed","mouseReleased"]) await send("Input.dispatchMouseEvent",{type,x:r.x,y:r.y,button:"left",clickCount:1}); return true; };
const clickCell = (i) => tap(".board-grid .cell", i);
// 文字でボタンを探して、マウスイベントで押す(.click() が効かない釦がある)
const tapText = async (t) => {
  const r = await ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length>0 && !b.disabled).find(b=>b.textContent.includes(${JSON.stringify(t)})); if(!b) return null; const q=b.getBoundingClientRect(); return {x:q.left+q.width/2,y:q.top+q.height/2};})()`);
  if (!r) return false;
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: r.x, y: r.y, button: "left", clickCount: 1 });
  return true;
};
// その文字のボタンが出るまで待って押す(最長 15 秒)
const waitClick = async (t, ms = 15000) => {
  for (let i = 0; i < ms / 250; i++) {
    if (await clickText(t)) return true;
    await sleep(250);
  }
  return false;
};
async function run(w, h, mobile, label) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  await send("Page.navigate", { url: "http://localhost:4300/?test=1" }); await sleep(2500);
  // 初回は 名前 → タイトル → ホーム(初回の案内)。出ている画面に合わせて進める
  for (let i = 0; i < 6; i++) {
    await sleep(1200);
    if (await ev(`!!document.querySelector("input.name-input")`)) {
      await ev(`(()=>{const inp=document.querySelector("input.name-input");const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;set.call(inp,"tester");inp.dispatchEvent(new Event("input",{bubbles:true}));})()`);
      await sleep(200); console.log("name:", await clickText("はじめる")); continue;
    }
    if (await clickText("ゲームスタート")) { console.log("title"); continue; }
    if (await clickText("あとで")) { console.log("offer closed"); continue; }
    if (await ev(`!!document.querySelector("button.home-wide")`)) break;
  }
  // チュートリアルを飛ばす(ランダムマッチの入口が開く)
  await ev(`(()=>{const b=[...document.querySelectorAll("button.home-wide")][0]; b&&b.click();})()`); await sleep(800);
  console.log("skip:", await waitClick("飛ばす")); await sleep(500);
  await shot(`${label}-skip-confirm`);
  console.log("confirm:", await ev(`(()=>{const b=[...document.querySelectorAll(".modal-panel button")].find(b=>b.textContent.trim()==="飛ばす"); if(!b) return false; b.click(); return true;})()`)); await sleep(800);
  await shot(`${label}-skipped`);
  await clickText("ホームに戻る"); await sleep(600);
  console.log("play:", await waitClick("対戦する")); await sleep(600);
  console.log("online:", await waitClick("オンラインでマッチする")); await sleep(600);
  console.log("9x9:", await tap(".board-choice", 1)); await sleep(300);
  console.log("start:", await waitClick("ゲームを始める")); await sleep(800);
  await shot(`${label}-searching`);
  console.log("searching text:", await ev(`document.querySelector(".center-stage h2")?.textContent`));
  await sleep(4000);
  console.log("after 4s:", await ev(`document.querySelector(".center-stage h2")?.textContent`));
  await sleep(7000);
  await shot(`${label}-bot-game`);
  // サイコロ→引き直し→布陣まで、出ている釦を押して進め、相手の名前が画面に出るのを見る
  let misses = 0;
  for (let i = 0; i < 40; i++) {
    let hit = false;
    for (const t of ["サイコロを振る", "次へ", "引き直しへ", "引き直さない", "この手札で進む", "確定", "はい", "OK", "とじる", "閉じる"]) {
      if (await tapText(t)) { hit = t; console.log("tap", t); break; }
    }
    await sleep(1400);
    // 釦がまだ押せない(サイコロの演出中など)ことがある。しばらく何も無ければ終える
    if (!hit) { if (++misses >= 6) break; } else misses = 0;
  }
  await shot(`${label}-bot-board`);
  const text = await ev(`document.body.innerText.replace(/\s+/g," ")`);
  const { BOT_NAMES } = await import("../src/game/bot-match.js");
  const found = BOT_NAMES.filter((n) => text.includes(n));
  console.log("bot name on screen:", found, "| CPU の文字:", /CPU/.test(text));
  console.log("page text:", text.slice(0, 400));
}
await run(390, 844, true, "bot");
ws.close();
