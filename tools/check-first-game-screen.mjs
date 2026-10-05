/**
 * はじめの一局(FIRST_GAME。2026-10-01 本人の指示)の対局画面の検査。
 * 台本と盤の正しさは check-first-game が見る。ここは画面の部品と配線を見る。
 *   A. 案内の札(TutorialSheet): 行の配列を1行ずつ・picked と kingAlt の出し分け・待つ札の「つづき」・
 *      ヒントの行と 2・3・5 の動きの図(文は句ごと)・まちがいの一言の2行・飛ばす/中断を出さない・
 *      待ちの帯は台本の一行と「最短 N 手」
 *   B. 王を選ぶ画面(KingStep): 見出しを出さない・「配置に戻る」を出さない・相手の伏せ札5枚・先後の一行・取る確認
 *   C. 結果画面(GameView): ステージクリア・両者の王・あなたの王の一行(王5通り × 4♦/5♥)・結びの行・
 *      締めの一行・「門へ進む」・下の釦はストーリーの形・背の低い画面で詰める決まり
 *   D. 配線(game.jsx・screens.jsx): フェーズ・関門・相手の待ち・記録・中断・席の名前・待ちの帯・勝負のあとの
 *      上の「トッタリー」・ヒントのときの送り・降参を出さない
 *   (iPhone の大きさで描いて測るのは tools/check-intro-fit.mjs。頭なしの Chrome を使うので npm run check の外)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { reducer } from "../src/game/reducer.js";
import { getLegalMoves, kingRankOf } from "../src/game/board.js";
import { GAME_RULE_VERSION } from "../src/game/rule-version.js";
import { ALL_TUTORIALS, FIRST_GAME, TUTORIALS, foeAction, openingState, stepLines, textLines } from "../src/game/tutorial.js";
import { MOVE_TEXT } from "../src/game/constants.js";

let fail = 0;
function ok(label, cond, extra) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${cond || !extra ? "" : ` — ${extra}`}`);
  if (!cond) fail++;
}
const count = (html, re) => (html.match(re) || []).length;
// 字だけ(印を外した文)。句の塊(text-phrase)で折り返すようになったので、文はこれで見る(2026-10-06 見直し)
const text = (html) => html.replace(/<[^>]*>/g, "");
// 1行(tutorial-line-row)の中身(印つき)。行の中の span を数えて、行の閉じまでを切り出す
const rowInners = (html) => {
  const out = [];
  const open = '<span class="tutorial-line-row">';
  for (let at = html.indexOf(open); at >= 0; at = html.indexOf(open, at + 1)) {
    let depth = 1;
    let i = at + open.length;
    const re = /<span\b[^>]*>|<\/span>/g;
    re.lastIndex = i;
    for (let m; (m = re.exec(html)); ) {
      depth += m[0] === "</span>" ? -1 : 1;
      if (depth === 0) {
        out.push(html.slice(i, m.index));
        break;
      }
    }
  }
  return out;
};
// 1行の文
const rowsOf = (html) => rowInners(html).map(text);
// 行の中が句の塊だけか(塊の外に字を置かない。塊の中の <b> はよい)
const phrasedRows = (html) =>
  rowInners(html).every((inner) => /^(<span class="text-phrase">(?:[^<]|<b>[^<]*<\/b>)*<\/span>)+$/.test(inner));
const lineText = (line) => (Array.isArray(line) ? line.join("") : line);

const tut = FIRST_GAME;
const legal = (a, p) =>
  getLegalMoves(p, a.board, a.boardSize, a.players[p.owner].armyRankCounts, kingRankOf(a, p.owner));
const moveOf = (a, id, row, col) => {
  const hit = legal(a, a.pieces[id]).find((m) => m.row === row && m.col === col);
  assert.ok(hit, `${id} が (${row},${col}) へ動ける`);
  return { type: "MOVE_PIECE", pieceId: id, row, col, captures: hit.captures };
};
const settle = (a) => {
  for (let g = 0; g < 10 && a.interstitial; g++) a = reducer(a, { type: "DISMISS_INTERSTITIAL" });
  return a;
};
/** 王を選んで確定し、1手目まで(あなたの番) */
function started(king) {
  let s = openingState(tut, GAME_RULE_VERSION);
  s = reducer(s, { type: "SETUP_PICK_KING", player: 0, cardId: king });
  s = reducer(s, { type: "SETUP_CONFIRM", player: 0 });
  return settle(s);
}
/** 1手目のあと、相手の番(待つ札の場面) */
function held(king) {
  let s = started(king);
  s = settle(reducer(s, moveOf(s, "t0", 1, 2)));
  return settle(reducer(s, { type: "DISMISS_CAPTURE" }));
}
/** 討ち終えた局面(撃破の札は閉じたあと) */
function finished(king, finisher, miss = false) {
  let s = held(king);
  s = settle(reducer(s, foeAction(s, tut, 0, (p) => legal(s, p))));
  if (miss) {
    s = settle(reducer(s, moveOf(s, "t0", 1, 1)));
    s = reducer(s, { type: "DISMISS_CAPTURE" });
    s = settle(reducer(s, foeAction(s, tut, 1, (p) => legal(s, p))));
  }
  s = settle(reducer(s, moveOf(s, finisher, 2, 4)));
  return reducer(s, { type: "DISMISS_CAPTURE" });
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-first-game-"));
let R;
try {
  const outfile = path.join(dir, "view.cjs");
  await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "jsx",
      contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {GameView} from './src/ui/game.jsx';import {SeatsProvider} from './src/ui/names.jsx';
import {TutorialSheet} from './src/ui/tutorial.jsx';import {KingStep} from './src/ui/setup.jsx';import {CaptureConfirm} from './src/ui/overlays.jsx';
const seats={names:["あなた","二と三の王"],icons:[null,null],titles:[null,null],skins:[{},{}]};
const wrap=(el)=>renderToStaticMarkup(<SeatsProvider value={seats}>{el}</SeatsProvider>);
export const renderSheet=(props)=>wrap(<TutorialSheet index={1} total={6} onNext={()=>{}} {...props} />);
export const renderKing=(state, props)=>wrap(<KingStep state={state} player={state.players[0]} pIdx={0} size={5} dispatch={()=>{}} remainingMs={null} limitMs={1} {...props} />);
export const renderCapture=(props)=>wrap(<CaptureConfirm count={1} squares={["c4"]} onCancel={()=>{}} onConfirm={()=>{}} {...props} />);
export const renderView=(state, tutorial, extra)=>wrap(<GameView state={state} size={5} viewer={0} youAre={0} dispatch={()=>{}} onExit={()=>{}} onHome={()=>{}} tutorial={tutorial} nextTutorial={null} onNextTutorial={null} onTutorialList={()=>{}} rating={null} rematch={null} seasonResult={{active:false}} {...extra} />);`,
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    outfile,
    logLevel: "silent",
    define: { __FIELD_FILES__: "{}", __BUILD_VERSION__: '"check"' },
    loader: { ".css": "text", ".png": "dataurl", ".jpg": "dataurl", ".webp": "dataurl", ".mp4": "dataurl", ".mp3": "dataurl", ".svg": "dataurl" },
  });
  // 画面の部品は読み込み時にブラウザの窓を触る。描くだけなので、空の窓を置く(check-tutorial-opening と同じ)
  const noop = () => {};
  Object.assign(globalThis, {
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }),
    requestAnimationFrame: (f) => setTimeout(f, 0),
    cancelAnimationFrame: clearTimeout,
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 2,
    scrollTo: noop,
    location: { protocol: "http:", hostname: "localhost", host: "localhost", href: "http://localhost/", search: "", origin: "http://localhost", pathname: "/" },
    document: {
      addEventListener: noop,
      removeEventListener: noop,
      visibilityState: "visible",
      hidden: false,
      body: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, appendChild: noop, removeChild: noop },
      documentElement: { style: {}, classList: { add: noop, remove: noop, contains: () => false }, setAttribute: noop, getAttribute: () => null },
      createElement: () => ({ style: {}, setAttribute: noop, getAttribute: () => null, appendChild: noop, remove: noop, getContext: () => null, classList: { add: noop, remove: noop } }),
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      head: { appendChild: noop },
      fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
    },
  });
  globalThis.window = globalThis;
  if (typeof globalThis.Image === "undefined") globalThis.Image = class { set src(_) {} };
  if (typeof globalThis.Audio === "undefined") globalThis.Audio = class { play() {} pause() {} };
  R = createRequire(import.meta.url)(outfile);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
const { renderSheet, renderKing, renderView, renderCapture } = R;

/* =====================================================================
   A. 案内の札
   ===================================================================== */
console.log("A. 案内の札");
{
  const rows = rowsOf;
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  // 1枚目(王を選ぶ): 2行を1行ずつ。飛ばす・中断は出さない(onSkip・onInterrupt を渡さない)
  const pick = renderSheet({ step: tut.steps[0], lines: stepLines(tut.steps[0], openingState(tut, GAME_RULE_VERSION)), left: 2, plain: true });
  ok("行の配列は1行ずつ出す", same(rows(pick), textLines(tut.steps[0].text)), rows(pick).join(" / "));
  // 行の中は句の塊(2026-10-06 見直し。320 幅で「…二枚をね/らう。」と語の途中で割れた)
  ok("はじめの一局(plain)の行は句の塊だけで出す", phrasedRows(pick) && /class="tutorial-sheet[^"]*tutorial-sheet-plain/.test(pick));
  ok("外れても続けられるので「最短 2 手」", /最短 2 手/.test(pick));
  ok("飛ばす・中断を渡さなければ出さない", !/この話を飛ばす|中断してやめる/.test(pick));
  // 3枚目(4♠ で取る): 4♠ を選ぶ前と後で文が変わる
  const s1 = started("t2");
  const before = renderSheet({ step: tut.steps[2], lines: stepLines(tut.steps[2], s1) });
  ok("4♠ を選ぶ前は text", same(rows(before), textLines(tut.steps[2].text)));
  const sel = reducer(s1, { type: "SELECT_PIECE", id: "t0" });
  const after = renderSheet({ step: tut.steps[2], lines: stepLines(tut.steps[2], sel) });
  ok("4♠ を選んだあとは picked", same(rows(after), textLines(tut.steps[2].picked)), rows(after).join(" / "));
  // まちがいの一言(行の配列)は2行とも出る
  const wrong = tut.steps[4].need.choose.wrong;
  const nudged = renderSheet({ step: tut.steps[4], lines: textLines(tut.steps[4].text), nudge: wrong });
  ok("まちがいの一言を2行とも出す", wrong.every((l) => nudged.includes(l)) && /tutorial-wait-lines/.test(nudged));
  ok("一言は赤い帯(tutorial-nudge)", /tutorial-wait tutorial-nudge/.test(nudged));
  // 4枚目(待つ札): 「つづき」を光らせる。戻る釦は出さない(onBack を渡さない)
  for (const king of ["t2", "t0"]) {
    const s = held(king);
    const hold = renderSheet({ step: tut.steps[3], lines: stepLines(tut.steps[3], s), nextLabel: "つづき", lit: true, front: true });
    const want = textLines(king === "t0" ? tut.steps[3].kingAlt.text : tut.steps[3].text);
    ok(`待つ札の文(王=${king === "t0" ? "4♠" : "4♦"})`, same(rows(hold), want), rows(hold).join(" / "));
    ok(`待つ札の釦は「つづき」で、▼ で光る(王=${king})`, /class="btn btn-primary tutorial-next guide-target"[^>]*>つづき/.test(hold) && !/>次へ/.test(hold));
    ok(`待つ札に「戻る」を出さない(王=${king})`, !/前の説明に戻る/.test(hold));
    // 画面と同じ渡し方(plain・下寄せ)。ねらいの筋のある待つ札は下寄せ(game.jsx の low)
    const held2 = renderSheet({ step: tut.steps[3], lines: stepLines(tut.steps[3], s), nextLabel: "つづき", lit: true, front: true, low: true, plain: true });
    ok(`待つ札(plain)の文は句の塊で、つなぐと台本の行(王=${king})`, same(rows(held2), want) && phrasedRows(held2), rows(held2).join(" / "));
    if (king === "t0")
      ok("4♠ を王にした人の待つ札は「外れ。」「でも、」「あなたの王が二枚をねらう。」の句で折り返す", held2.includes('<span class="text-phrase">あなたの王が二枚をねらう。</span>'));
    ok(`待つ札は下寄せ(tutorial-sheet-low)(王=${king})`, /tutorial-sheet-front tutorial-sheet-low/.test(held2));
  }
  // 5枚目(自分で考える1手): ヒントは開く前は釦だけ、開くと2行と 2・3・5 の図
  const choose = tut.steps[4];
  const closed = renderSheet({ step: choose, lines: textLines(choose.text), onHint: () => {} });
  ok("ヒントを開く前は釦だけ", /ヒントを見る/.test(closed) && !/move-guide/.test(closed) && !/ヒント: /.test(closed));
  // 印は導入の言葉の調子で「あなたが読む、一手。」(2026-10-06 本人の指示)。句の塊で出す。第1〜13話は「自分で考える1手」のまま
  const badgeOf = (html) => (html.match(/<p class="tutorial-choose-badge">([\s\S]*?)<\/p>/) || [])[1];
  ok(
    "はじめの一局の印は「あなたが読む、一手。」(句の塊で。「自分で考える1手」は出さない)",
    badgeOf(closed) === '<span class="text-phrase">あなたが読む、</span><span class="text-phrase">一手。</span>' && !/自分で考える1手/.test(closed),
    badgeOf(closed),
  );
  const plainClosed = renderSheet({ step: choose, lines: textLines(choose.text), onHint: () => {}, plain: true });
  ok("画面と同じ渡し方(plain)でも印は「あなたが読む、一手。」", text(badgeOf(plainClosed) || "") === "あなたが読む、一手。");
  const epChoosers = ALL_TUTORIALS.flatMap((t) => t.steps).filter((x) => x.need && x.need.choose);
  ok(
    "第1〜13話の印は「自分で考える1手」のまま(台本に印を持たない)",
    epChoosers.length > 0 && epChoosers.every((x) => !x.need.choose.badge && badgeOf(renderSheet({ step: x })) === "自分で考える1手"),
    `${epChoosers.length} 枚`,
  );
  const open = renderSheet({ step: choose, lines: textLines(choose.text), hint: choose.need.choose.hint, hintGuide: choose.need.choose.hintGuide });
  ok("ヒントの1行目", open.includes(`ヒント: ${choose.need.choose.hint[0]}`));
  ok("ヒントの2行目", open.includes(choose.need.choose.hint[1]));
  ok("動きの図は 2・3・5 の3行", /move-guide/.test(open) && count(open, /class="move-hint-row ?"/g) === 3, `${count(open, /class="move-hint-row ?"/g)} 行`);
  ok("図に ✗○ を付けない(動きから分かるのは数字まで)", !/✗|○/.test(open));
  {
    // 図の文は句ごとの塊(2026-10-05 見直し)。列は 375 幅で 62px・10px の字なので、1つの句は全角6字ぶんまで
    // (iPhone の WebKit は auto-phrase を知らず、「縦横1マ/ス。」と割れた)
    const labels = [...open.matchAll(/<span class="move-hint-label"><b>([^<]*)<\/b><small>([\s\S]*?)<\/small><\/span>/g)].map((m) => ({
      rank: m[1],
      phrases: [...m[2].matchAll(/<span class="text-phrase">([^<]*)<\/span>/g)].map((x) => x[1]),
      rest: m[2].replace(/<span class="text-phrase">[^<]*<\/span>/g, ""),
    }));
    const em = (t) => [...t].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? 0.6 : 1), 0);
    ok("図の文は 2・3・5 の3つ", same(labels.map((l) => l.rank), ["2", "3", "5"]), JSON.stringify(labels));
    ok("図の文はどれも句の塊だけ(塊の外に字を置かない)", labels.every((l) => l.phrases.length >= 2 && l.rest === ""), JSON.stringify(labels));
    ok("句をつなぐとルールの文(MOVE_TEXT)", labels.every((l) => l.phrases.join("") === MOVE_TEXT[l.rank]));
    ok("1つの句は全角6字ぶんまで(列 62px・10px)", labels.every((l) => l.phrases.every((p) => em(p) <= 6)), JSON.stringify(labels.map((l) => l.phrases)));
    ok("「斜めに」と「2マスまで。」を分ける(語の途中で割らない)", same(labels[2].phrases, ["斜めに", "2マスまで。"]));
    // 第1〜13話の一覧(guide.phrased なし)はいままでどおり文を1つで
    const epGuide = TUTORIALS.flatMap((t) => t.steps).find((x) => x.moveGuide && !x.moveGuide.kings);
    const epGuideHtml = epGuide ? renderSheet({ step: epGuide }) : "";
    ok("第1〜13話の動きの一覧は句に分けない(いままでどおり)", !!epGuide && /move-guide/.test(epGuideHtml) && !/text-phrase/.test(epGuideHtml));
  }
  // 案内の出番でない相手の番の帯(game.jsx の tutHold)。台本の一行と「最短 N 手」(2026-10-05 見直し)
  const holdSheet = renderSheet({ step: { hold: true, text: tut.foeTurn }, index: 3, left: 1, plain: true });
  ok("待ちの帯は台本の一行(決まり文句でない)", text(holdSheet).includes(tut.foeTurn[0]) && !/少し待ってください|▼ の付いたボタン/.test(holdSheet));
  ok("待ちの帯も「最短 1 手」(ほかの札とそろえる)", /最短 1 手/.test(holdSheet) && !/あと 1 手/.test(holdSheet));
  // 第1〜13話の札(文字列)はいままでどおり1つの段落
  const ep = TUTORIALS[0].steps[0];
  const old = renderSheet({ step: ep });
  ok("第1〜13話の文字列はそのまま(行に割らない)", old.includes(`<p class="tutorial-line">${ep.text}</p>`));
  ok(
    "第1〜13話は画面が stepLines を渡しても同じ描き方",
    renderSheet({ step: ep, lines: stepLines(ep, openingState(TUTORIALS[0], GAME_RULE_VERSION)) }) === old,
  );
  ok("第1〜13話の「次へ」は光らせない", /class="btn btn-primary tutorial-next "/.test(old) && />次へ/.test(old));
  const epHint = TUTORIALS.find((t) => t.steps.some((x) => x.need && x.need.choose));
  const epChoose = epHint.steps.find((x) => x.need && x.need.choose);
  const epOpen = renderSheet({ step: epChoose, hint: epChoose.need.choose.hint });
  ok("第1〜13話のヒント(文字列)は1行のまま", epOpen.includes(`<p class="tutorial-hint-text">ヒント: ${epChoose.need.choose.hint}</p>`));
}

/* =====================================================================
   B. 王を選ぶ画面
   ===================================================================== */
console.log("\nB. 王を選ぶ画面");
{
  const s = openingState(tut, GAME_RULE_VERSION);
  const quiet = renderKing(s, { terse: true, quiet: true, lockPlacement: true, showFoe: true });
  ok("見出し「王にするカードを決めてね」を出さない", !/王にするカードを決めてね/.test(quiet));
  ok("「配置に戻る」を出さない", !/配置に戻る/.test(quiet));
  ok("「布陣を確定」はある", /布陣を確定/.test(quiet));
  ok("相手の並び(確定済み)を伏せ札5枚で描く", count(quiet, /mini-piece mini-piece-foe/g) === 5, `${count(quiet, /mini-piece mini-piece-foe/g)} 枚`);
  ok("帯(setup-head)と残り時間の場所は残す", /<div class="setup-head">/.test(quiet));
  const plain = renderKing(s, { terse: true });
  ok("ふつうの王選びは見出しと「配置に戻る」を出す", /王にするカードを決めてね/.test(plain) && /配置に戻る/.test(plain));
  ok("ふつうの王選びは相手の並びを描かない", !/mini-piece-foe/.test(plain));
  // 先後の一行(2026-10-05 見直し)。はじめの一局は導入の言葉の調子で(です・ます調の決まり文句を避ける)
  // 札「あなたは先攻」と横の文が同じことを二度言っていた。一行だけにする(2026-10-06 見直し)
  ok("はじめの一局の先後は「最初の一手は、あなた。」の一行だけ(札もサイコロも出さない)", /最初の一手は、あなた。/.test(text(quiet)) && !/あなたは先攻|先攻|先に動きます|サイコロ/.test(text(quiet)) && /setup-order setup-order-plain/.test(quiet));
  ok("先後の札は折り返さない(320 幅で「あなたは後/攻」と割れた)", /\.setup-order b \{\s*white-space: nowrap;\s*\}/.test(fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")));
  ok("ふつうの王選びの先後はいままでどおり(文は句ごとに折り返す)", /あなたは先攻/.test(text(plain)) && /サイコロの結果、先に動きます/.test(text(plain)) && /<span class="text-phrase">先に動きます<\/span>/.test(plain));
  // 取る確認(2026-10-05 見直し)。はじめの一局は短い一行、ほかの対局はいままでどおり
  const take = renderCapture({ plain: true });
  ok("はじめの一局の取る確認は「取れば、正体が分かる。」", /取れば、正体が分かる。/.test(take) && !/公開されます/.test(take));
  // 見出しも問いかけに(2026-10-06 見直し。「この駒を取ります」「対象のマス: c4」が残っていた)
  ok("はじめの一局の取る確認の見出しは「c4 の伏せ札を、取る?」(マスは見出しに。「対象のマス」を出さない)", /<h3>c4 の伏せ札を、取る\?<\/h3>/.test(take) && !/この駒を取ります|対象のマス|ます/.test(text(take)));
  ok("ほかの対局の取る確認はいままでどおり", /取った駒の正体は、取ったあとに公開されます。/.test(renderCapture({})) && /この駒を取ります/.test(renderCapture({})) && /対象のマス/.test(renderCapture({})));
}

/* =====================================================================
   C. 結果画面
   ===================================================================== */
console.log("\nC. 結果画面");
{
  const story = { axis: "23", phase: 1, size: 5, king: "3", title: "二と三の王", fresh: true, next: { axis: "45", title: "四と五の王" }, allCleared: false, ready: true };
  const endLines = textLines(tut.steps.find((x) => x.end).text);
  for (const king of ["t0", "t1", "t2", "t3", "t4"])
    for (const by of ["t2", "t1"]) {
      const s = finished(king, by);
      const label = `王=${king}・${by === "t2" ? "4♦" : "5♥"} で討つ`;
      const html = renderView(s, tut, { story, onGate: () => {} });
      const struck = king === by;
      const expected = struck ? tut.kingNote.struck : tut.kingNote.hidden;
      const other = struck ? tut.kingNote.hidden : tut.kingNote.struck;
      ok(
        `${label}: あなたの王の一行は「${struck ? "自ら討った" : "伏せたまま"}」`,
        expected.every((line) => rowsOf(html).includes(lineText(line))) && !text(html).includes(lineText(other[1])),
      );
      // 右のあなたの王と対句の2行(です・ます調の「…でした」を使わない。2026-10-06 見直し)
      ok(`${label}: 相手の王は「相手の王は、」「3♦ だった。」`, rowsOf(html).includes("相手の王は、") && rowsOf(html).includes("3♦ だった。") && !/でした/.test(text(html)));
    }
  const s = finished("t3", "t2");
  // 次のステージへの受け口(onNextStory)も渡したうえで、門へ進むが勝つことを見る
  const gate = renderView(s, tut, { story, onGate: () => {}, onNextStory: () => {} });
  ok("見出しは「ステージクリア!」", /ステージクリア!/.test(gate) && !/チュートリアルクリア/.test(gate));
  ok("両者の王を並べる(tutorial-reveal-pair)", /tutorial-reveal-pair/.test(gate) && count(gate, /class="tutorial-reveal[ "]/g) === 2);
  ok("本文は結びの札の行(行の中は句の塊)", endLines.every((l) => rowsOf(gate).includes(l)) && gate.includes('<span class="text-phrase">王だった。</span>'));
  ok("結果の行(結び・二人の王)はどれも句の塊だけで出す", phrasedRows(gate));
  ok("あなたの王の「最後まで伏せたまま。」は「最後まで」「伏せたまま。」の句", tut.kingNote.hidden[1].join("") === "最後まで伏せたまま。" && gate.includes('<span class="text-phrase">最後まで</span><span class="text-phrase">伏せたまま。</span>'));
  const tagParts = [...gate.matchAll(/<span class="tutorial-tagline-part">([^<]*)<\/span>/g)].map((m) => m[1]);
  ok("締めは台本の一行(「相手の王を討て。」ではない)", tagParts.join("") === tut.tagline && !/相手の王を討て。/.test(gate));
  ok("締めの一行は文ごとに折り返す(「一手に、読みを。」「一枚に、野望を。」)", tagParts.length === 2 && tagParts.every((x) => x.endsWith("。")), tagParts.join(" / "));
  ok("勝ち名乗りの飾りの札は出さない(両者の王と重なる。門へ進むまで1画面に)", !/king-card win-card/.test(gate));
  ok("ステージ名とチケット10枚(導入の言葉の調子で「手に入れた。」)", /二と三の王/.test(gate) && /ガチャチケット 10枚を、手に入れた。/.test(text(gate)) && !/受け取りました/.test(text(gate)));
  // 「後日談を読む」は出さない(2026-10-06 見直し。375×667 で上の端だけ空の帯のように覗き、開くと門から外れた)
  ok("門へ進む結果に「後日談を読む」を出さない", !/後日談/.test(text(gate)));
  ok("結果の文にです・ます調の決まり文句を使わない(締め・結び・二人の王・褒美)", !/です|ます|でした|ください/.test(text(gate.slice(gate.indexOf("ステージクリア"), gate.indexOf('class="gameover-grid')))));
  ok("光る「門へ進む」を1つだけ", count(gate, /門へ進む/g) === 1 && /result-gate/.test(gate));
  ok(
    "「門へ進む」は送る中身の外(2×2 の釦の上に、いつも見える)",
    gate.indexOf('class="gameover-body"') < gate.indexOf('class="gameover-gate"') &&
      gate.indexOf('class="gameover-gate"') < gate.indexOf('class="gameover-grid') &&
      gate.indexOf("門へ進む") > gate.indexOf('class="gameover-gate"'),
  );
  ok("門へ進むときは「次のステージへ」を出さない", !/次のステージへ/.test(gate) && !/次は「四と五の王」/.test(gate));
  ok("チュートリアルの塊(一覧へ・次は第N話)を出さない", !/チュートリアル一覧へ/.test(gate) && !/約\d分/.test(gate));
  ok("門へ進むときは振り返りだけを添える", /go-review/.test(gate) && !/go-match|go-home/.test(gate));
  ok("台本の一局に「もう一度遊ぶ」(NEW_GAME)を出さない", !/もう一度遊ぶ/.test(gate));
  ok("左下に「タイトルに戻る」を出さない", !/タイトルに戻る/.test(gate));
  const noGate = renderView(s, tut, { story, onNextStory: () => {} });
  ok("門が済んでいれば(onGate なし)「次のステージへ」", /次のステージへ/.test(noGate) && !/門へ進む/.test(noGate));
  const recovered = renderView(finished("t3", "t2", true), tut, { story, onGate: () => {} });
  ok("外れから勝った結果は、読み直したことを伝える", text(recovered).includes("外れた一枚から、候補を絞った。") && text(recovered).includes("読み直して、王に届いた。") && !text(recovered).includes("相手が逃がした一枚は、王だった。"));
  const lost = renderView(s, null, { story, youAre: 1, onRetryStory: () => {} });
  ok("通常ストーリーの敗北は撃破の一手と再挑戦を示す", lost.includes('class="story-loss-note"') && lost.includes("4♦ の e1 → e3 が、王に届いた。") && lost.includes('class="btn btn-primary go-again"'));
  const waiting = renderView(s, tut, { story: { ...story, ready: false }, onGate: () => {} });
  ok("記録が済むまでは「門へ進む」を出さない(ready)", !/門へ進む/.test(waiting));
  {
    // 背の低い画面(375×667)では、はじめの一局の結果だけを詰めて、締めの一行まで送らずに見せる(2026-10-05 見直し)。
    // 描いて測るのは tools/check-intro-fit.mjs
    const css = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const short = (css.match(/@media \(max-height: 700px\) \{\s*\.gameover-panel:has\(\.gameover-gate\)[\s\S]*?\n\}/) || [""])[0];
    ok("背の低い画面: はじめの一局の結果(門のある結果)だけを詰める", !!short && !/\.gameover-panel \{/.test(short));
    const squeezed = [
      /svg:first-child \{\s*display: none;/,
      /h2 \{\s*margin: 2px 0;/,
      /\.gameover-sub \{\s*margin: 2px 0 6px;/,
      /\.tutorial-end-lines \{\s*margin-top: 6px;\s*line-height: 1\.5;/,
      /\.tutorial-tagline \{\s*margin: 4px 0 0;/,
    ];
    ok("背の低い画面: 飾りの冠を外し、見出し・ステージの名・結びの行・締めの余白を詰める", squeezed.every((re) => re.test(short)), short);
    // もっと背の低い画面(320×568)では、二人の王の札の絵とステージの名を外す(2026-10-06 見直し)
    const shorter = (css.match(/@media \(max-height: 600px\) \{\s*\.gameover-panel:has\(\.gameover-gate\)[\s\S]*?\n\}/) || [""])[0];
    ok(
      "320×568: はじめの一局の結果だけ、二人の王の札の絵とステージの名を外す",
      /\.gameover-panel:has\(\.gameover-gate\) \.tutorial-reveal-pair \.card-face,\s*\.gameover-panel:has\(\.gameover-gate\) \.gameover-sub \{\s*display: none;/.test(shorter) && !/\.gameover-panel \{/.test(shorter),
      shorter,
    );
    ok("「対戦の振り返り」は1行(門へ進む結果の1つだけの釦)", /\.gameover-grid-single \.go-review \{\s*white-space: nowrap;/.test(css));
  }
  // 第1話はいままでどおり
  const ep1 = TUTORIALS[0];
  let e = openingState(ep1, GAME_RULE_VERSION);
  e = reducer(e, moveOf(e, "t3", 1, 0));
  e = settle(reducer(e, { type: "DISMISS_CAPTURE" }));
  e = settle(reducer(e, foeAction(e, ep1, 0, (p) => legal(e, p))));
  e = reducer(e, moveOf(e, "t2", 3, 2));
  e = reducer(e, { type: "DISMISS_CAPTURE" });
  const lesson = renderView(e, ep1, {});
  ok("第1話: チュートリアルクリア・「相手の王を討て。」・相手の王だけ", /チュートリアルクリア/.test(lesson) && /相手の王を討て。/.test(lesson) && !/tutorial-reveal-pair/.test(lesson));
  ok("第1話: 勝ち名乗りの飾りの札は残す", /king-card win-card tutorial-king-card/.test(lesson));
  ok("第1話: 左下はタイトルへ戻る・右下はホームへ", /go-home"[^>]*>タイトルに戻る/.test(lesson) && /go-again"[^>]*>[\s\S]*?ホームへ/.test(lesson));
}

/* =====================================================================
   D. 配線
   ===================================================================== */
console.log("\nD. 配線");
{
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  const screens = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  ok("フェーズは台本のもの(2か所とも ?? PHASE_MAX)", count(game, /tutorial \? \(tutorial\.phase \?\? PHASE_MAX\)/g) === 2);
  ok("関門は tutorialGate(検査と同じ決まり)", /const gate = tutorialGate\(tutorial, tutIdx, a, E\);\s*if \(gate\) \{[\s\S]{0,300}?setPendingCapture\(null\);\s*setTutNudge\(gate\.nudge\);\s*return;/.test(game));
  ok("台本の相手は holdFoe の札のあいだ指さない", /if \(!tutorial \|\| network \|\| fxBusy\) return;[\s\S]{0,300}?if \(foeHeld\(tutorial, tutIdx, a\)\) return;/.test(game));
  ok("「つづき」で走り直す(依存に tutIdx)", /\}, \[a, tutorial, network, fxBusy, tutIdx\]\);/.test(game));
  ok("札の行は stepLines(picked・kingAlt)", /lines=\{stepLines\(tutActive, a\)\}/.test(game));
  ok("ヒントの動きの図を渡す", /hintGuide=\{tutChoose && tutHint \? tutChoose\.choose\.hintGuide \|\| null : null\}/.test(game));
  ok("待つ札は「つづき」を光らせる", /nextLabel=\{tutActive\.nextLabel \|\| null\}/.test(game) && /lit=\{!!tutActive\.holdFoe\}/.test(game));
  ok("「前の説明へ」は canStepBack のときだけ", /onBack=\{canStepBack\(tutorial, tutIdx, a\) \? \(\) => setTutStep\(tutIdx - 1\) : null\}/.test(game));
  ok("待つ札の ▼ の代わりに光の筋", /tutThreat = \(\(\) => \{/.test(game) && /className="tutorial-threat"/.test(game));
  ok("ストーリーの台本は札の「この話を飛ばす」「中断」を出さない", /onSkip=\{\s*tutorial\.storyAxis\s*\? null/.test(game) && /onInterrupt=\{tutorial\.storyAxis \? null : onHome \? goHome : onExit\}/.test(game));
  ok("上のバーは「飛ばす」でなくストーリーの「中断」", /const skipMenu = tutorial && !tutorial\.storyAxis \? \(/.test(game));
  ok("王を選ぶ画面に quiet・lockPlacement・showFoe", /quiet=\{!!tutorial\?\.opening\?\.stopAt\}/.test(game) && (game.match(/lockPlacement=\{!!tutorial\?\.opening\?\.lockPlacement\}/g) || []).length === 2 && /showFoe=\{!!tutorial\?\.opening\?\.stopAt\}/.test(game));
  ok("story も受けたら story として記録(チュートリアルの xp・クリア・チケットなし)", /const asLesson = !!tutorial && !story;\s*const freshTutorial =\s*asLesson && won/.test(game) && /\.\.\.\(asLesson\s*\? \{\s*xp: won \? tutorial\.xp : 0,\s*tutorial: !0,/.test(game));
  ok("結果の「門へ進む」は呼ぶ側の onGate", /onGate=\{onGate\}/.test(game) && /onClick=\{onGate\}/.test(game));
  ok("席の名前: 相手は story.title を先に・自分は名前が無ければ「あなた」", /me \|\| \(story \? "あなた" : null\),/.test(screens) && /story\s*\? story\.title\s*: tut\s*\? null/.test(screens));
  // 待ちの帯(2026-10-05 見直し)。はじめの一局は、撃破の札・取る確認のあいだは出さず、相手の番は台本の一行
  ok(
    "待ちの帯: はじめの一局は撃破の札・取る確認のあいだ出さず、相手の番は台本の一行(決まり文句を出さない)",
    /tutHold =\s*tutorial && !tutActive && tutIdx < tutorial\.steps\.length\s*\? tutorial\.storyAxis\s*\? (\/\/[^\n]*\n\s*)*a\.captureReveal \|\| pendingCapture\s*\? null\s*: a\.phase === "play" && a\.currentTurn === 1 && tutorial\.foeTurn\s*\? \{ hold: !0, text: tutorial\.foeTurn \}\s*: null\s*: \{/.test(game),
  );
  ok("待ちの帯: 第1〜13話の文はいままでどおり", /"相手の番です。少し待ってください。"\s*: "▼ の付いたボタンを押して進めてください。"/.test(game));
  ok("待ちの帯も plain(「最短 N 手」)", /step=\{tutHold\}[\s\S]{0,200}?plain=\{!!tutorial\.storyAxis\}/.test(game));
  ok("取る確認: はじめの一局は plain", /<CaptureConfirm\s+(\/\/[^\n]*\n\s*)*plain=\{!!tutorial\?\.storyAxis\}/.test(game));
  // 勝負がついたあとの上の「トッタリー」(2026-10-05 見直し)。「対局をやめますか?」「クリアにも負けにもなりません」を出さない
  ok(
    "勝負のあとの上の「トッタリー」は確認を出さず、門があれば門へ・無ければ結果の「戻る」と同じ",
    /onBack=\{\(\) => \{\s*if \(fxBusy\) return;\s*(\/\/[^\n]*\n\s*)*if \(a\.phase === "gameover"\) \{\s*if \(onGate\) onGate\(\);\s*else leaveGame\(\);\s*return;\s*\}\s*r\(!0\);\s*\}\}\s*>\s*<div className=\{`play-wrap/.test(game),
  );
  // ヒントを開いたとき・一言が出たときに盤の ▼ を帯の上へ送る(G。2026-10-01 の見直しの直しを見張る)
  ok("ヒント・一言のたびに ▼ の駒を帯の上へ送る", /if \(!tutorial \|\| !tutHint\) return;[\s\S]{0,1200}?window\.scrollBy\(\{[\s\S]{0,200}?\}, \[tutHint, tutNudge, tutorial\]\);/.test(game));
  ok("ヒントの動きの図は横一列(3列)", /\.tutorial-hint-guide \.move-hint-rows \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/.test(fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8")));
  // ストーリーとして遊ぶ台本には「降参する」を出さない(O。2026-10-01 本人の指示の直しを見張る)
  ok("はじめの一局に「降参する」を出さない(ほかの対局は出す)", /\{!\(tutorial && tutorial\.storyAxis\) && \(\s*<div className="resign-row">/.test(game) && count(game, /className="resign-row"/g) === 1);
  // 2026-10-06 見直し
  ok("はじめの一局に「この駒の行動ログを見る」を出さない(ほかの対局は出す)", /\{!Pl && x && a\.selectedId && !\(tutorial && tutorial\.storyAxis\) && \(\s*<div className="action-bar">/.test(game) && count(game, /この駒の行動ログを見る/g) === 1);
  ok("ねらいの筋のある待つ札は下寄せ(盤の真ん中に置くと4段目を隠す)", /low=\{tutHasTarget \|\| !!tutActive\.threat\}/.test(game));
  ok(
    "はじめの一局の盤の上では、盤をまるごと上のバーと帯のあいだへ送る(▼ を真ん中へ送る決まりは使わない)",
    /const fitPlain = !!\(tutorial && tutorial\.storyAxis && a\.phase === "play"\);/.test(game) &&
      /if \(!tutorial \|\| fitPlain\) return;/.test(game) &&
      /if \(!tutorial \|\| !tutHint\) return;\s*if \(fitPlain\) return;/.test(game) &&
      /if \(!fitPlain\) return;[\s\S]{0,1800}?let want = span\(\[grid\]\);[\s\S]{0,600}?window\.scrollBy\(\{ top: by,[\s\S]{0,120}?\}, \[fitPlain, tutIdx, tutHint, tutNudge, a\.selectedId, !!a\.captureReveal\]\);/.test(game),
  );
  const css = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  ok(
    "320×568: はじめの一局の帯(plain)を詰め、ヒントの図は小さな盤を外す",
    /@media \(max-height: 600px\) \{\s*\.tutorial-sheet-plain:not\(\.tutorial-sheet-front\) \.tutorial-sheet-inner \{[\s\S]*?\.tutorial-sheet-plain \.tutorial-hint-guide \.move-hint-row \.move-diagram \{\s*display: none;/.test(css),
  );
  // 経験値の知らせ(2026-10-06 見直し)。門へ進む結果では上に出す(下に出すと「門へ進む」を覆った)
  ok(
    "門へ進む結果では経験値の知らせを上の帯の下に出す(根の data-xp-at)",
    /const gateResult = !!onGate && won;[\s\S]{0,300}?root\.setAttribute\("data-xp-at", "top"\);\s*return \(\) => root\.removeAttribute\("data-xp-at"\);\s*\}, \[gateResult\]\);/.test(game) &&
      /:root\[data-xp-at="top"\] \.xp-gain \{\s*top: calc\(var\(--top-bar-h, 0px\) \+ 8px\);\s*bottom: auto;/.test(fs.readFileSync(new URL("../src/ui/xp-gain.css", import.meta.url), "utf8")),
  );
  ok("門へ進む結果に後日談を出さない(配線)", !/story && won && story\.ready && onGate && <StoryAfterword/.test(game) && /story && won && story\.ready && !onGate && \(/.test(game));
}

console.log(fail ? `\n${fail} 件の失敗` : "\nはじめの一局の画面: すべて通りました");
process.exit(fail ? 1 : 0);
