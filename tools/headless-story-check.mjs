// ストーリーの通し検査(ヘッドレスの Chrome で本物の画面を操作する)。
//   題名 → ホーム(タイルは「ストーリー」)→ 一覧 → 相手の王の説明 → 5×5 の対局(CPU の王が軸の数字、
//   フェーズ1は王の力なし)→ 勝ち(CPU の降参を状態に直接書く)→ 「ステージクリア!」と褒美 → 次のステージの説明 →
//   負け(褒美なし)→ 一覧のクリアの印 → 同じステージの2度目のクリアには褒美が出ない → 例外なし
// 公開前の端末が保存した phase:3(世代なし)が読み直しで 1 に戻ることも見る。
//
// 使い方(tools/headless-tap-check.mjs と同じ):
//   npm run build && PORT=4300 node tools/serve.mjs &
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9333 \
//     --user-data-dir=/tmp/tottery-chrome --no-first-run --mute-audio --use-gl=swiftshader --enable-unsafe-swiftshader about:blank &
//   SHOT_DIR=/tmp/shots node tools/headless-story-check.mjs
// 対局の状態は React の fiber から読む(useState の値)。検査だけの手段で、製品のコードには手を入れない。
// ストーリーの通し(ヘッドレス Chrome)。題名 → ホーム → ストーリー → 説明 → 対局(5×5、CPU の王が軸)→ 勝ち → 褒美 → 次のステージ
import fs from "node:fs";
const PORT = Number(process.env.CDP_PORT || 9333), APP = process.env.APP_URL || "http://localhost:4300/?test=1", OUT = process.env.SHOT_DIR;
const targets = await (await fetch(`http://localhost:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = {};
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const consoleErrors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) { m.error ? pending[m.id].rej(new Error(JSON.stringify(m.error))) : pending[m.id].res(m.result); delete pending[m.id]; }
  if (m.method === "Runtime.exceptionThrown") consoleErrors.push("exception: " + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consoleErrors.push("console.error: " + (m.params.args || []).map((a) => a.value || a.description || "").join(" ").slice(0, 300)); };
await new Promise((r) => (ws.onopen = r));
await send("Page.enable"); await send("Runtime.enable");
const ev = async (x) => { const r = await send("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => { if (!OUT) return; const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64")); };
const buttons = () => ev(`[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length>0&&!b.disabled).map(b=>(b.textContent.trim()||b.getAttribute("aria-label")||"").slice(0,24))`);
const clickText = (t) => ev(`(()=>{const b=[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length>0&&!b.disabled).find(b=>(b.textContent+" "+(b.getAttribute("aria-label")||"")).includes(${JSON.stringify(t)})); if(!b) return false; b.click(); return true;})()`);
const clickSel = (sel) => ev(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(b=>b.getClientRects().length>0&&!b.disabled)[0]; if(!b) return false; b.click(); return true;})()`);
const text = () => ev(`document.body.innerText`);
const SEL = `".board, .game-shell, .setup-wrap, .dice-wrap, .mulligan-wrap"`;
const STATE = `(()=>{
  const el=document.querySelector(${SEL}) || document.querySelector("main") || document.body;
  let f=null; for (const k of Object.keys(el)) if (k.startsWith("__reactFiber$")) f=el[k];
  while (f) { let h=f.memoizedState; let n=0; while (h && n<80) { const v=h.memoizedState; if (v && typeof v==="object" && v.pieces && v.boardSize && v.phase) return { v, ok:true }; h=h.next; n++; } f=f.return; }
  return { ok:false };
})()`;
const state = async () => ev(`(()=>{const s=${STATE}; if(!s.ok) return null; const v=s.v; const pcs=Object.values(v.pieces||{}); return { phase:v.phase, boardSize:v.boardSize, kingPowers:v.kingPowers, mulliganIdx:v.mulliganIdx, setupDone:v.setupDone, currentTurn:v.currentTurn, winner:v.winner, cpuKing:pcs.filter(q=>q.owner===1&&q.isKing).map(q=>q.rank), myKing:pcs.filter(q=>q.owner===0&&q.isKing).map(q=>q.rank), powers:[...new Set(pcs.map(q=>String(q.powers)))], cpuHand:(v.players&&v.players[1]&&v.players[1].hand||[]).map(c=>c.rank), setupEffects:!!v.setupEffects, interstitial:!!v.interstitial, captureReveal:!!v.captureReveal };})()`);
const setWinner = (winner) => ev(`(()=>{
  const el=document.querySelector(${SEL}) || document.querySelector("main") || document.body;
  let f=null; for (const k of Object.keys(el)) if (k.startsWith("__reactFiber$")) f=el[k];
  while (f) { let h=f.memoizedState; let n=0; while (h && n<80) { const v=h.memoizedState; if (v && typeof v==="object" && v.pieces && v.boardSize && v.phase) { if (!h.queue || !h.queue.dispatch) return "no-dispatch"; h.queue.dispatch((prev)=>({ ...prev, phase:"gameover", winner:${winner}, resignedBy:${1 - winner}, selectedId:null, shuffleMode:null, extraMoveFor:null })); return true; } h=h.next; n++; } f=f.return; } return "no-state"; })()`);
const fails = []; let okN = 0;
const is = (label, cond, extra = "") => { if (cond) { okN++; console.log("  ok   " + label); } else { fails.push(label); console.log("  NG   " + label + "  " + extra); } };

// 画面の大きさ(VIEW_W / VIEW_H。既定は 390×844)。背の低い 375×667 や狭い 320×568 でも回せる
await send("Emulation.setDeviceMetricsOverride", { width: Number(process.env.VIEW_W || 390), height: Number(process.env.VIEW_H || 844), deviceScaleFactor: 1, mobile: true });
await send("Page.navigate", { url: APP }); await sleep(2500);
// 前回の実行の保存(profile・財布)を引きずらない。まっさらな端末として始める
await ev(`(()=>{ try { localStorage.clear(); sessionStorage.clear(); } catch {} return 1; })()`);
await send("Page.navigate", { url: APP }); await sleep(3000);
async function toHome(tag) {
  for (let i = 0; i < 40; i++) {
    if (await ev(`!!document.querySelector(".home-grid")`)) return true;
    if (await ev(`!!document.querySelector("input.name-input")`)) {
      await ev(`(()=>{const inp=document.querySelector("input.name-input"); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set; set.call(inp,"tester"); inp.dispatchEvent(new Event("input",{bubbles:true}));})()`);
      await sleep(200); await clickText("はじめる"); await sleep(1500); continue;
    }
    let did = false;
    for (const t of ["ゲームスタート", "あとで", "スキップ", "飛ばす", "とばす", "受け取る", "ホームへ", "ホームに戻る", "とじる", "閉じる", "つぎへ", "次へ", "OK"]) if (await clickText(t)) { did = true; break; }
    if (!did && (await ev(`!!document.querySelector(".bonus-panel button")`))) { await ev(`document.querySelector(".bonus-panel button").click()`); did = true; }
    if (!did) { const bs = await buttons(); console.log(`  (${tag} ${i}) 見えている釦: ${JSON.stringify(bs)}`); await shot(`${tag}-${i}`); if (bs.length) await ev(`[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length>0&&!b.disabled).pop().click()`); }
    await sleep(1000);
  }
  return false;
}
is("ホームに着く", await toHome("home"));
// 既定のフェーズ(公開後は 1)。保存済みの profile を読んで確かめる
const prof0 = await ev(`JSON.parse(localStorage.getItem("tottery.account.v1")||"{}")`);
is("新しい profile はフェーズ 1(既定)", prof0.phase === 1, String(prof0.phase));
// 公開前の端末が保存した phase:3(世代なし)を入れて読み直す → 1 に戻る
await ev(`(()=>{const k="tottery.account.v1"; const p=JSON.parse(localStorage.getItem(k)||"{}"); p.phase=3; delete p.phaseEpoch; localStorage.setItem(k, JSON.stringify(p)); return p.name;})()`);
await send("Page.navigate", { url: APP }); await sleep(2500);
is("読み直してホームに着く", await toHome("home2"));
await shot("01-home");
const tile = await ev(`(()=>{const b=[...document.querySelectorAll(".home-grid .home-tile")].find(b=>b.textContent.includes("ストーリー")); return b ? b.textContent : null;})()`);
is("ホームのタイルは「ストーリー」(チュートリアルの場所)", !!tile && (await ev(`[...document.querySelectorAll(".home-grid .home-tile")][0].textContent.includes("ストーリー")`)), tile);
is("公開前の phase:3 はフェーズ 1 に戻る(タイルの一言: フェーズ 1・次は二と三の王)", /フェーズ 1/.test(tile || "") && /二と三の王/.test(tile || ""), tile);
is("チュートリアルのタイルは無い", !(await ev(`[...document.querySelectorAll(".home-grid .home-tile")].some(b=>b.textContent.includes("チュートリアル"))`)));
await ev(`[...document.querySelectorAll(".home-grid .home-tile")].find(b=>b.textContent.includes("ストーリー")).click()`); await sleep(800);
// はじめて開くと導入(どんなゲームか・勝ち方。寿司将棋のように)が出る。読み終えると 2・3 の説明へ
is("はじめて開くと導入が出る", await ev(`!!document.querySelector(".primer")`));
const firstTitle = await ev(`document.querySelector(".primer h3") ? document.querySelector(".primer h3").innerText : ""`);
is("導入の1枚目は「トッタリーへようこそ」", firstTitle === "トッタリーへようこそ", firstTitle);
const seen = [firstTitle];
for (let i = 0; i < 8; i++) {
  if (!(await clickText("つづき"))) break;
  await sleep(250);
  seen.push(await ev(`document.querySelector(".primer h3").innerText`));
}
await shot("02a-primer-last");
is("導入の並び(どんなゲームか → 1手ずつ → 勝ち方 → 討てなくなったら → 伏せた王 → 陣 → ストーリーへ)", JSON.stringify(seen) === JSON.stringify(["トッタリーへようこそ", "1手ずつ", "勝ち方", "討てなくなったら", "王は名乗らない", "陣を組む", "あとはストーリーで"]), JSON.stringify(seen));
is("導入の最後の文は「まずは 2 と 3 から。」", /まずは 2 と 3 から/.test(await ev(`document.querySelector(".primer").innerText`)));
is("導入の最後の釦は「ステージへ」", await clickText("ステージへ")); await sleep(700);
await shot("02b-first-intro");
const firstIntro = await ev(`document.querySelector(".story-intro") ? document.querySelector(".story-intro").innerText : ""`);
is("読み終えると 2・3 のステージの説明", /相手の王は 2 か 3/.test(firstIntro), firstIntro.slice(0, 60));
is("フェーズ1 の説明は駒ごとに盤の図(2 と 3 で2つ)", (await ev(`document.querySelectorAll(".story-intro .move-diagram").length`)) === 2);
{
  const r = await ev(`(()=>{const p=document.querySelector(".story-intro"); const b=p.querySelector(".btn-primary").getBoundingClientRect(); return { bottom: Math.round(b.bottom), h: innerHeight };})()`);
  is(`説明の「はじめる」が画面に収まる(${r.bottom} / ${r.h})`, r.bottom <= r.h, JSON.stringify(r));
}
await clickSel(".story-intro .btn-ghost"); await sleep(400);
is("説明の「戻る」で一覧に戻る", !(await ev(`!!document.querySelector(".story-intro")`)) && (await ev(`document.querySelectorAll(".story-stage").length`)) === 7);
is("ストーリー画面に「遊び方」", await ev(`[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="遊び方")`));
// 「遊び方」から開いて、Escape で閉じる → 一覧のまま(説明は開かない)
await clickText("遊び方"); await sleep(500);
is("「遊び方」で導入が開く", await ev(`!!document.querySelector(".primer")`));
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(400);
is("導入は Escape で閉じ、一覧のまま", !(await ev(`!!document.querySelector(".primer")`)) && !(await ev(`!!document.querySelector(".story-intro")`)));
await shot("02-story");
is("ストーリーの画面: 7ステージ", (await ev(`document.querySelectorAll(".story-stage").length`)) === 7);
is("最初は 2・3 が次", await ev(`!!document.querySelector(".story-stage.is-next") && document.querySelector(".story-stage.is-next").textContent.includes("二と三")`));
await clickSel(".story-stage"); await sleep(600);
// Escape で閉じる(「はじめる」に最初から focus があっても効く)
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(400);
is("説明は Escape で閉じる", !(await ev(`!!document.querySelector(".story-intro")`)));
await clickSel(".story-stage"); await sleep(600);
await shot("03-intro");
const intro = await ev(`document.querySelector(".story-intro") ? document.querySelector(".story-intro").innerText : ""`);
is("ステージの前に相手の王の説明", /相手の王は 2 か 3/.test(intro), intro.slice(0, 80));
is("フェーズ1は駒の動き方だけ(王の力の文は無い)", /マス/.test(intro) && !/伸びる/.test(intro), intro.slice(0, 200));
is("フェーズ1・駒の動きだけ の見出し", /フェーズ 1/.test(intro) && /駒の動きだけ/.test(intro), intro.slice(0, 80));
await clickText("はじめる"); await sleep(1500);
// ステージの中断(2026-10-01): 上のバーの「中断」→ 確認 →「対局を続ける」で戻れる →「中断してストーリーへ」で一覧、記録は残らない
is("対局の上のバーに「中断」", await ev(`[...document.querySelectorAll(".top-right button")].some(b=>b.textContent.trim()==="中断")`));
await ev(`[...document.querySelectorAll(".top-right button")].find(b=>b.textContent.trim()==="中断").click()`); await sleep(400);
await shot("03a-interrupt");
is("中断の確認が出る", /ステージを中断しますか/.test(await ev(`document.body.innerText`)));
await clickText("対局を続ける"); await sleep(300);
is("「対局を続ける」で対局に戻る", !(await ev(`!!document.querySelector(".story-interrupt")`)) && (await state()) !== null);
await ev(`[...document.querySelectorAll(".top-right button")].find(b=>b.textContent.trim()==="中断").click()`); await sleep(400);
await clickText("中断してストーリーへ"); await sleep(800);
is("中断するとストーリーの一覧に戻る", (await ev(`document.querySelectorAll(".story-stage").length`)) === 7 && (await state()) === null);
{
  const pr = await ev(`JSON.parse(localStorage.getItem("tottery.account.v1")||"{}")`);
  is("中断はクリアにも負けにもならない(記録なし)", (pr.story?.[1] || []).length === 0 && (pr.battles || 0) === (prof0.battles || 0), JSON.stringify({ story: pr.story, battles: pr.battles }));
}
await clickSel(".story-stage"); await sleep(600);
await clickText("はじめる"); await sleep(1500);

async function prep(tag) {
  for (let i = 0; i < 90; i++) {
    const st = await state();
    if (st && (st.phase === "play" || st.phase === "gameover")) return st;
    let did = false;
    if (await ev(`!!document.querySelector(".modal-overlay")`)) {
      for (const t of ["とじる", "閉じる", "OK", "つぎへ", "次へ", "はじめる", "確定", "決定"]) if (await clickText(t)) { did = true; break; }
      if (!did) did = await ev(`(()=>{const b=[...document.querySelectorAll(".modal-overlay button")].filter(b=>b.getClientRects().length>0&&!b.disabled).pop(); if(!b) return false; b.click(); return true;})()`);
    } else if (st && st.phase === "dice") {
      for (const t of ["振る", "サイコロ"]) if (await clickText(t)) { did = true; break; }
    } else if (st && st.phase === "mulligan") {
      for (const t of ["引き直さない", "このまま", "確定", "引き直す", "決定"]) if (await clickText(t)) { did = true; break; }
    } else if (st && st.phase === "setup") {
      // 自動配置 → 王を選ぶ → 盤の駒を1つ押す → 確定
      if (await ev(`!!document.querySelector(".mini-piece:not(.mini-piece-disabled)") && !document.querySelector(".mini-piece.piece-selected")`) && !(await ev(`[...document.querySelectorAll("button")].some(b=>b.getClientRects().length>0&&!b.disabled&&b.textContent.includes("王を選ぶ"))`))) {
        did = await ev(`(()=>{const c=document.querySelector(".mini-piece:not(.mini-piece-disabled)"); if(!c) return false; c.parentElement.click(); return true;})()`);
      }
      if (!did) for (const t of ["王を選ぶ", "確定", "決定", "自動配置"]) if (await clickText(t)) { did = true; break; }
    } else {
      for (const t of ["とじる", "閉じる", "OK", "つぎへ", "次へ", "確定"]) if (await clickText(t)) { did = true; break; }
    }
    if (!did) { if (i % 5 === 0) { console.log(`  (${tag} ${i}) phase=${st ? st.phase : "?"} 釦: ${JSON.stringify(await buttons())}`); await shot(`${tag}-${i}`); } await sleep(1200); } else await sleep(900);
  }
  return await state();
}
let st = await prep("prep1");
await shot("04-play");
console.log("  対局の状態:", JSON.stringify(st));
is("対局が始まる(play)", st && st.phase === "play", st && st.phase);
is("盤は 5×5", st && st.boardSize === 5, st && st.boardSize);
is("フェーズ1: 王の力なし(kingPowers:false)", st && st.kingPowers === false, st && String(st.kingPowers));
is("置いた駒は powers:false", st && st.powers.length === 1 && st.powers[0] === "false", st && JSON.stringify(st.powers));
is("CPU の王は 2 か 3", st && st.cpuKing.length === 1 && ["2", "3"].includes(st.cpuKing[0]), st && JSON.stringify(st.cpuKing));
is("相手の席の名前は「二と三の王」", /二と三の王/.test(await text()));
{ const r = await setWinner(0); is("勝ちにする(CPU の降参)", r === true, String(r)); } await sleep(2500);
await shot("05-win");
let body = await text();
is("見出しは「ステージクリア!」", /ステージクリア!/.test(body), body.slice(0, 120));
is("褒美: ガチャチケット 10枚", /ガチャチケット 10枚を受け取りました/.test(body));
is("次は「四と五の王」", /次は「四と五の王」/.test(body));
const prof = await ev(`JSON.parse(localStorage.getItem("tottery.account.v1")||"{}")`);
is("profile.story[1] に 23 が入る", Array.isArray(prof.story && prof.story[1]) && prof.story[1].includes("23"), JSON.stringify(prof.story));
is("フェーズは 1 のまま、世代が保存される", prof.phase === 1 && prof.phaseEpoch === 1, `${prof.phase}/${prof.phaseEpoch}`);
await clickText("次のステージへ"); await sleep(900);
await shot("06-next-intro");
const intro2 = await ev(`document.querySelector(".story-intro") ? document.querySelector(".story-intro").innerText : ""`);
is("次のステージの前にも説明(相手の王は 4 か 5)", /相手の王は 4 か 5/.test(intro2), intro2.slice(0, 80));
is("一覧では 2・3 がクリア済み", (await ev(`document.querySelectorAll(".story-stage.is-cleared").length`)) === 1);
await clickText("はじめる"); await sleep(1500);
st = await prep("prep2");
console.log("  対局の状態:", JSON.stringify(st));
is("2局目も play に着く", st && st.phase === "play");
is("CPU の王は 4 か 5", st && st.cpuKing.length === 1 && ["4", "5"].includes(st.cpuKing[0]), st && JSON.stringify(st.cpuKing));
{ const r = await setWinner(1); is("負けにする", r === true, String(r)); } await sleep(2500);
await shot("07-lose");
body = await text();
is("負けは「敗北」で、褒美の文は出ない", /敗北/.test(body) && !/受け取りました/.test(body));
const prof2 = await ev(`JSON.parse(localStorage.getItem("tottery.account.v1")||"{}")`);
is("負けたら 45 はクリアにならない", !(prof2.story[1] || []).includes("45"), JSON.stringify(prof2.story));
is("右上の釦は「ストーリーへ」", await ev(`!!document.querySelector(".gameover-grid .go-match") && document.querySelector(".gameover-grid .go-match").textContent.includes("ストーリーへ")`));
await clickSel(".gameover-grid .go-match"); await sleep(800);
await shot("08-story-again");
is("ストーリーの画面に戻る(2・3 クリア済み、次は 4・5)", (await ev(`document.querySelectorAll(".story-stage.is-cleared").length`)) === 1 && (await ev(`document.querySelector(".story-stage.is-next").textContent.includes("四と五")`)));
await clickSel(".story-stage"); await sleep(500); await clickText("はじめる"); await sleep(1500);
st = await prep("prep3");
is("3局目(2・3 をもう一度)も play", st && st.phase === "play");
{ const r = await setWinner(0); is("勝ちにする", r === true, String(r)); } await sleep(2500);
body = await text();
is("2度目のクリアには褒美の文が出ない", /ステージクリア!/.test(body) && !/受け取りました/.test(body), body.slice(0, 160));
await shot("09-win-again");
// フェーズ2(9×9・王の力あり)のステージ。昇格した体で profile を書き換えて読み直す
await ev(`(()=>{const k="tottery.account.v1"; const p=JSON.parse(localStorage.getItem(k)||"{}"); p.phase=2; localStorage.setItem(k, JSON.stringify(p)); return 1;})()`);
await send("Page.navigate", { url: APP }); await sleep(2500);
is("フェーズ2でホームに着く", await toHome("home3"));
await ev(`[...document.querySelectorAll(".home-grid .home-tile")].find(b=>b.textContent.includes("ストーリー")).click()`); await sleep(800);
is("2回目からは導入が出ない", !(await ev(`!!document.querySelector(".primer")`)));
is("フェーズ2の一覧は 9×9", /フェーズ 2/.test(await ev(`document.querySelector(".story-phase").innerText`)) && /9×9/.test(await ev(`document.querySelector(".story-phase").innerText`)));
await clickSel(".story-stage"); await sleep(600);
const intro3 = await ev(`document.querySelector(".story-intro") ? document.querySelector(".story-intro").innerText : ""`);
is("フェーズ2の説明は王の力(9×9)", /9×9/.test(intro3) && /伸びる/.test(intro3), intro3.slice(0, 120));
await clickText("はじめる"); await sleep(1500);
st = await prep("prep4");
await shot("10-phase2-play");
console.log("  対局の状態:", JSON.stringify(st));
is("フェーズ2のステージは 9×9", st && st.boardSize === 9, st && st.boardSize);
is("フェーズ2は王の力あり", st && st.kingPowers !== false, st && String(st.kingPowers));
is("フェーズ2でも CPU の王は 2 か 3", st && st.cpuKing.length === 1 && ["2", "3"].includes(st.cpuKing[0]), st && JSON.stringify(st.cpuKing));
is("ページに例外や console.error が無い", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
console.log(`\n${okN} ok / ${fails.length} NG`);
if (fails.length) console.log("NG: " + fails.join(", "));
ws.close(); process.exit(fails.length ? 1 : 0);
