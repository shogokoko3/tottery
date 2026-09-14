// ヘッドレスの Chrome を CDP で動かして、第1話を「動きの一覧」の札まで進め、電話と広い画面の2通りで撮る。
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
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${S}/${name}.png`, Buffer.from(r.data, "base64")); console.log("shot", name); };
const buttons = () => ev(`[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length>0).map(b=>b.textContent.trim().slice(0,20))`);
const clickText = async (t) => ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length>0).find(b=>b.textContent.includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true;})()`);
const tap = async (sel, i) => { const r = await ev(`(()=>{const c=document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if(!c) return null; const b=c.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2};})()`); if (!r) return false; for (const type of ["mousePressed","mouseReleased"]) await send("Input.dispatchMouseEvent",{type,x:r.x,y:r.y,button:"left",clickCount:1}); return true; };
const clickCell = (i) => tap(".board-grid .cell", i);
async function run(w, h, mobile, label) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  await send("Page.navigate", { url: "http://localhost:4300/?test=1" }); await sleep(2500);
  if (await clickText("ゲームスタート")) { console.log("title"); await sleep(1200); }
  if (await ev(`!!document.querySelector("input.name-input")`)) {
    await ev(`(()=>{const inp=document.querySelector("input.name-input");const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;set.call(inp,"tester");inp.dispatchEvent(new Event("input",{bubbles:true}));})()`);
    await sleep(200); console.log("name:", await clickText("はじめる")); await sleep(1500);
  }
  console.log("buttons:", await buttons());
  if (!(await clickText("第1話を始める"))) {
    await ev(`(()=>{const b=[...document.querySelectorAll("button.home-wide")][0]; b&&b.click();})()`); await sleep(800);
    console.log("list:", (await buttons()).slice(0, 4));
    console.log("ep1:", await clickText("第1話"));
  }
  await sleep(2500);
  // 読む札を「次へ」で進めながら1枚ずつ撮る(操作の札まで)
  for (let n = 1; n <= 6; n++) {
    await shot(`${label}-card${n}`);
    if (!(await clickText("次へ"))) break;
    await sleep(600);
  }
  console.log("c2:", await clickCell(17)); await sleep(500);
  console.log("a4:", await clickCell(5)); await sleep(800);
  for (let i = 0; i < 12; i++) {
    if (await ev(`!!document.querySelector(".tutorial-sheet-front") && !document.querySelector(".modal-overlay")`)) break;
    const bs = await buttons(); console.log("wait", i, bs);
    let hit = false;
    for (const t of ["取る", "確認した", "討つ", "確定", "とじる", "閉じる", "OK"]) { if (await clickText(t)) { hit = true; break; } }
    await sleep(hit ? 1200 : 1500);
  }
  await sleep(800);
  await shot(`${label}-see`);
  console.log("see→hint:", await clickText("次へ")); await sleep(700);
  await shot(`${label}-hint`);
  console.log("measure:", await ev(`JSON.stringify({sheet:document.querySelector(".tutorial-sheet-inner")?.getBoundingClientRect(),board:document.querySelector(".board-frame")?.getBoundingClientRect(),cls:document.querySelector(".tutorial-sheet")?.className,hint:!!document.querySelector(".move-hint")})`));
}
const which = process.argv[3] || "both";
if (which !== "desk") await run(390, 844, true, "phone");
if (which !== "phone") await run(1600, 1000, false, "desk");
ws.close();
