// 「押せない釦」を探す。ヘッドレスの Chrome で台本(チュートリアル)を最後まで指し、
// そのあいだ **画面に見えている釦の真ん中に、その釦自身があるか**(別のものに覆われて
// いないか)を毎回見る。覆われていれば、指で押しても届かない。
//
// 2026-09-17、本人の報告「予備札の配置で下の説明欄が邪魔で確定ボタンが押せない」から作った。
// 同じ作り(下に固定した帯と、重ねた画面)は他の場面にもあるので、まとめて見張る。
//
// 使い方:
//   PORT=4300 node tools/serve.mjs &
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//     --remote-debugging-port=9333 --user-data-dir=/tmp/tottery-chrome --no-first-run --mute-audio about:blank &
//   node tools/headless-tap-check.mjs [話の番号...]     (既定: 1 4 8 12)
// 見ないもの(不具合ではない): 読ませるための幕(.tutorial-sheet-front)・重ねた画面の幕(.modal-overlay)・
//   画面を送れば避けられる帯(重ねた画面の外の釦にかかっているだけのとき)
// 出力: 覆われていた釦の一覧。1つでもあれば exit 1
import fs from "node:fs";

const PORT = process.env.CDP_PORT || 9333;
const APP = process.env.APP_URL || "http://localhost:4300/?test=1";
const episodes = process.argv.slice(2).map(Number).filter(Number.isInteger);
const EPISODES = episodes.length ? episodes : [1, 4, 8, 12];
const OUT = process.env.SHOT_DIR || null;

const targets = await (await fetch(`http://localhost:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("Chrome の頁が見つかりません(--remote-debugging-port で起動してください)");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = {};
const send = (m, p = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending[i] = { res, rej };
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
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
const ev = async (x) => {
  const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => {
  if (!OUT) return;
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64"));
};
const clickText = async (t) =>
  ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length>0&&!b.disabled)
    .find(b=>(b.textContent+" "+(b.getAttribute("aria-label")||"")).includes(${JSON.stringify(t)}));
    if(!b) return false; b.click(); return true;})()`);
const tapAt = async (at) => {
  for (const type of ["mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", { type, x: at.x, y: at.y, button: "left", clickCount: 1 });
};
const tapSel = async (sel) => {
  const at = await ev(`(()=>{const c=document.querySelector(${JSON.stringify(sel)}); if(!c) return null;
    const b=c.getBoundingClientRect(); if(!b.width) return null; return {x:b.left+b.width/2,y:b.top+b.height/2};})()`);
  if (!at) return false;
  await tapAt(at);
  return true;
};

/** いま見えている釦のうち、真ん中が別のものに覆われているもの */
const coveredButtons = () =>
  ev(`(()=>{
    const out=[];
    for (const b of document.querySelectorAll("button")) {
      if (b.disabled) continue;
      const r=b.getBoundingClientRect();
      // 画面の外・大きさが無いものは触れないので見ない
      if (r.width<8||r.height<8||r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth) continue;
      // 半分以上が画面の外にあるものも、利用者は送ってから押すので見ない
      if (r.top < 0 || r.bottom > innerHeight) continue;
      const x=Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)), y=Math.min(innerHeight-1,Math.max(0,r.top+r.height/2));
      const el=document.elementFromPoint(x,y);
      if (!el || el===b || b.contains(el)) continue;
      // わざと後ろを触らせない幕(前面の案内・重ねた画面)は不具合ではない
      if (el.closest && el.closest(".tutorial-sheet-front")) continue;
      if (el.closest && el.closest(".modal-overlay") && !b.closest(".modal-overlay")) continue;
      // 画面に固定した帯が、送れば避けられる釦にかかっているだけのときは数えない。
      // 重ねた画面の中の釦(送って避けられない)にかかっていたら不具合
      const fixedCover = el.closest && el.closest(".tutorial-sheet");
      if (fixedCover && !b.closest(".modal-overlay")) continue;
      out.push({
        label:(b.textContent||b.getAttribute("aria-label")||"").trim().slice(0,20),
        by: el.tagName+"."+String(el.className||"").split(" ").slice(0,2).join("."),
      });
    }
    return JSON.stringify(out);})()`);

const problems = [];
const seen = new Set();
async function sweep(where) {
  const found = JSON.parse(await coveredButtons());
  for (const f of found) {
    const key = `${where}|${f.label}|${f.by}`;
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push({ where, ...f });
    console.log(`  × ${where}: 「${f.label}」が ${f.by} に覆われています`);
  }
}

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Page.navigate", { url: APP });
await sleep(3000);
if (await ev(`!!document.querySelector("input.name-input")`)) {
  await ev(`(()=>{const inp=document.querySelector("input.name-input");
    const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;
    set.call(inp,"tester");inp.dispatchEvent(new Event("input",{bubbles:true}));})()`);
  await sleep(200);
  await clickText("はじめる");
  await sleep(2000);
}
for (let i = 0; i < 20; i++) {
  await sleep(800);
  if (await clickText("ゲームスタート")) continue;
  if (await clickText("あとで")) continue;
  if (await ev(`!!document.querySelector(".bonus-panel button")`)) {
    await ev(`document.querySelector(".bonus-panel button").click()`);
    continue;
  }
  if (await ev(`!!document.querySelector(".home-grid")`)) break;
}
await sweep("ホーム");
// 全部の話を開けるようにする(飛ばす=終えた扱い)
await ev(`[...document.querySelectorAll(".home-grid .home-tile")].find(b=>b.textContent.includes("チュートリアル"))?.click()`);
await sleep(900);
if (await clickText("飛ばす")) {
  await sleep(500);
  await ev(`[...document.querySelectorAll(".modal-panel button")].find(b=>b.textContent.trim()==="飛ばす")?.click()`);
  await sleep(1500);
}
for (let i = 0; i < 8; i++) {
  await sleep(700);
  if (await ev(`!!document.querySelector(".modal-overlay")`)) {
    await ev(`[...document.querySelectorAll(".modal-overlay button")].filter(b=>b.getClientRects().length>0).pop()?.click()`);
    continue;
  }
  break;
}
await sweep("チュートリアル一覧");

for (const ep of EPISODES) {
  const opened = await ev(`(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.includes("第${ep}話"));
    if(!b) return false; b.click(); return true;})()`);
  if (!opened) {
    console.log(`第${ep}話: 開けませんでした(一覧に無い)`);
    continue;
  }
  await sleep(2500);
  let turn = 0;
  let ended = false;
  for (let i = 0; i < 160; i++) {
    await sweep(`第${ep}話`);
    const st = JSON.parse(
      await ev(`JSON.stringify({
        done: !!document.querySelector(".gameover-panel") || [...document.querySelectorAll("button")].some(b=>b.getClientRects().length>0 && /次のステージへ|チュートリアル一覧へ/.test(b.textContent)),
        next: !!document.querySelector("button.tutorial-next"),
        guide: document.querySelectorAll(".guide-target").length,
        focusBtn: !!document.querySelector(".focus-button") && [...document.querySelectorAll(".btn-primary:not(.tutorial-next):not(:disabled), .btn-danger:not(:disabled)")].filter(b=>b.getClientRects().length>0).length,
        modalBtns: [...document.querySelectorAll(".modal-overlay button")].filter(b=>b.getClientRects().length>0&&!b.disabled).length,
      })`),
    );
    if (st.done) {
      ended = true;
      break;
    }
    if (st.next) {
      await tapSel("button.tutorial-next");
      await sleep(500);
      continue;
    }
    if (st.guide) {
      const at = await ev(`(()=>{
        const vis=(e)=>{const r=e.getBoundingClientRect(); return r.width>2&&r.height>2&&r.top>=0&&r.bottom<=innerHeight;};
        const all=[...document.querySelectorAll(".guide-target")].filter(vis);
        if(!all.length) return null;
        const el=all[${turn} % all.length];
        const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
      turn++;
      if (at) {
        await tapAt(at);
        await sleep(650);
        continue;
      }
    }
    if (st.focusBtn) {
      const at = await ev(`(()=>{const el=[...document.querySelectorAll(".btn-primary:not(.tutorial-next):not(:disabled), .btn-danger:not(:disabled)")]
        .map(e=>[e,e.getBoundingClientRect()]).find(([,r])=>r.width>2&&r.top>=0&&r.bottom<=innerHeight);
        if(!el) return null; const r=el[1]; return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
      if (at) {
        await tapAt(at);
        await sleep(700);
        continue;
      }
    }
    if (st.modalBtns) {
      await ev(`[...document.querySelectorAll(".modal-overlay button")].filter(b=>b.getClientRects().length>0&&!b.disabled).pop().click()`);
      await sleep(700);
      continue;
    }
    await sleep(600);
  }
  await shot(`tap-ep${ep}`);
  console.log(`第${ep}話: ${ended ? "最後まで進めた" : "途中で止まった(それまでの画面は見た)"}`);
  // 一覧へ戻る
  for (let i = 0; i < 12; i++) {
    if (await clickText("チュートリアル一覧へ")) { await sleep(1200); break; }
    if (await clickText("次のステージへ")) { await sleep(1200); continue; }
    if (await clickText("タイトルに戻る")) { await sleep(1200); break; }
    if (await ev(`!!document.querySelector(".modal-overlay button")`)) {
      await ev(`[...document.querySelectorAll(".modal-overlay button")].filter(b=>b.getClientRects().length>0&&!b.disabled).pop()?.click()`);
      await sleep(700);
      continue;
    }
    break;
  }
  if (!(await ev(`[...document.querySelectorAll("button")].some(b=>b.textContent.includes("第1話"))`))) {
    // タイトルへ戻ってしまったら、ホーム→チュートリアル一覧まで戻す
    for (let i = 0; i < 10; i++) {
      await sleep(700);
      if (await clickText("ゲームスタート")) continue;
      if (await ev(`!!document.querySelector(".home-grid")`)) {
        await ev(`[...document.querySelectorAll(".home-grid .home-tile")].find(b=>b.textContent.includes("チュートリアル"))?.click()`);
        await sleep(900);
        break;
      }
      if (await ev(`[...document.querySelectorAll("button")].some(b=>b.textContent.includes("第1話"))`)) break;
    }
  }
}
ws.close();
console.log(problems.length ? `\n押せない釦 ${problems.length} 件` : "\n押せない釦は見つかりませんでした");
process.exit(problems.length ? 1 : 0);
