/** Local-only tutorial completion fixture; no production source is changed. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { reducer } from "../src/game/reducer.js";
import { getLegalMoves, kingRankOf } from "../src/game/board.js";
import {
  TUTORIALS,
  currentStepIndex,
  foeAction,
} from "../src/game/tutorial.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cases = [
  { id: "win-1", label: "1話クリア", tutorialId: 1, winner: 0 },
  { id: "win-11", label: "11話クリア", tutorialId: 11, winner: 0 },
  { id: "win-12", label: "最終12話クリア", tutorialId: 12, winner: 0 },
  { id: "lose-1", label: "1話で敗北", tutorialId: 1, winner: 1 },
];

// Follow the same reducer/need/flow/foe sequence as check-tutorial.mjs.
// Build the actual completed board once, without speeding up any browser timers.
function completeTutorial(tutorial) {
  let state = reducer(
    { phase: "intro" },
    {
      type: "START_SETUP",
      size: tutorial.boardSize,
      setupMode: "simultaneous",
      deck: tutorial.deck.map((c) => ({ ...c })),
      pool: tutorial.pool,
      handSize: tutorial.handSize,
      scripted: !tutorial.bonus,
    },
  );
  let watermark = 0,
    foeIndex = 0;
  const legalOf = (piece) =>
    getLegalMoves(
      piece,
      state.board,
      state.boardSize,
      state.players[piece.owner].armyRankCounts,
      kingRankOf(state, piece.owner),
    );
  for (let guard = 0; guard < 400; guard++) {
    if (state.phase === "gameover") {
      if (state.captureReveal)
        state = reducer(state, { type: "DISMISS_CAPTURE" });
      if (state.winner !== 0)
        throw new Error(`Tutorial ${tutorial.id} did not finish with a win`);
      return state;
    }
    const index = currentStepIndex(tutorial, state, watermark);
    const step = tutorial.steps[index];
    let action = null;
    if (step && (!step.at || step.at(state))) {
      if (!step.need) {
        watermark = index + 1;
        continue;
      }
      action = { ...step.need };
      if (action.type === "ROLL_DICE_SINGLE" && action.value == null)
        action.value = tutorial.dice[state.diceIdx] || 1;
      if (action.type === "CONFIRM_MULLIGAN" && !action.reserveOrder)
        action.reserveOrder = [...tutorial.reserveOrder];
      if (
        action.type === "CONFIRM_SHUFFLE" &&
        !action.order &&
        tutorial.shuffleOrder
      )
        action.order = [...tutorial.shuffleOrder];
      if (action.type === "TOGGLE_SHUFFLE_PICK" && !state.shuffleMode) {
        const ace = Object.values(state.pieces).find(
          (p) => p.owner === 0 && p.alive && p.rank === "A",
        );
        action = ace ? { type: "SELECT_PIECE", id: ace.id } : null;
      }
      if (action?.type === "MOVE_PIECE") {
        const actor = state.pieces[action.pieceId];
        const move =
          actor &&
          legalOf(actor).find(
            (m) => m.row === action.row && m.col === action.col,
          );
        if (!move)
          throw new Error(
            `Tutorial ${tutorial.id} has an illegal scripted move`,
          );
        action.captures = move.captures;
      }
      if (
        [
          "SETUP_PLACE_CARD",
          "SETUP_GOTO_KING_STEP",
          "SETUP_PICK_KING",
          "SETUP_CONFIRM",
        ].includes(action?.type)
      )
        action.player = 0;
      watermark = Math.max(watermark, index);
    } else if (state.captureReveal) action = { type: "DISMISS_CAPTURE" };
    else if (state.interstitial) action = { type: "DISMISS_INTERSTITIAL" };
    else if (state.pendingKingChoice?.owner === 0)
      action = state.pendingKingChoice.acknowledged
        ? { type: "CHOOSE_HEIR", id: state.pendingKingChoice.candidateIds[0] }
        : { type: "ACK_KING_CHOICE" };
    else if (
      state.phase === "dice" &&
      state.diceIdx === 0 &&
      state.dice[0] !== null
    )
      action = { type: "NEXT_DICE_STEP" };
    else if (state.phase === "dice" && state.diceIdx === 2)
      action = { type: "GOTO_MULLIGAN" };
    else if (state.phase === "dice" && state.diceIdx === 3)
      action = { type: "REROLL_DICE" };
    else if (state.phase === "play" && state.kPlacement?.owner === 0) {
      for (let row = 0; row < state.boardSize && !action; row++)
        for (let col = 0; col < state.boardSize && !action; col++)
          if (!state.board[row][col])
            action = { type: "PLACE_RESERVE_CARD", row, col };
      action ||= { type: "SKIP_RESERVE_PLACEMENT" };
    }
    if (!action) {
      action = foeAction(state, tutorial, foeIndex, legalOf);
      if (action?.type === "MOVE_PIECE") foeIndex++;
    }
    if (!action)
      throw new Error(`Tutorial ${tutorial.id} stalled at step ${index + 1}`);
    const next = reducer(state, action);
    if (next === state)
      throw new Error(`Tutorial ${tutorial.id} rejected ${action.type}`);
    state = next;
  }
  throw new Error(`Tutorial ${tutorial.id} exceeded the script guard`);
}
const completed = Object.fromEntries(
  [1, 11, 12].map((id) => [
    id,
    completeTutorial(TUTORIALS.find((t) => t.id === id)),
  ]),
);
function replaceRequired(source, from, to) {
  if (!source.includes(from))
    throw new Error(`Tutorial fixture anchor missing: ${from}`);
  return source.replace(from, to);
}

const runtime = `
import { useEffect, useRef } from 'react';
import { TUTORIALS } from './src/game/tutorial.js';
export const CASES = ${JSON.stringify(cases)};
const completed = ${JSON.stringify(completed)};
const saved = new Map();
export const tutorialFixtureStorage = {
  getItem: key => saved.get(key) ?? null,
  setItem: (key, value) => { saved.set(key, String(value)); },
  removeItem: key => { saved.delete(key); },
};
let fixture = CASES[0];
let pending = true;
let snapshot = null;
let networkCalls = 0;
const listeners = new Set();
const emit = () => { for (const listener of listeners) listener(); };
export function fixtureTutorial() { return TUTORIALS.find(t => t.id === fixture.tutorialId); }
export function chooseFixture(next) {
  fixture = next; pending = true; snapshot = null; networkCalls = 0;
  saved.clear();
  saved.set('tottery.account.v1', JSON.stringify({
    id:'local-tutorial-fixture', name:'接続確認', xp:0,
    cleared:TUTORIALS.filter(t => t.id < next.tutorialId).map(t => t.id),
  }));
  emit();
}
chooseFixture(CASES[0]);
export function useTutorialFixtureInitial(tutorial, fallback) {
  const first = useRef(null);
  if (!first.current) {
    const inject = pending && tutorial?.id === fixture.tutorialId;
    const state = inject ? JSON.parse(JSON.stringify(completed[fixture.tutorialId])) : fallback();
    if (inject && fixture.winner === 1) {
      state.winner = 1;
      state.reason = '確認用の敗北';
    }
    first.current = { state, inject };
  }
  // Consume after commit, so StrictMode's repeated initializer is harmless.
  useEffect(() => { if (first.current.inject) pending = false; }, []);
  return first.current.state;
}
export function observeTutorial(state) { snapshot = state; emit(); }
export function readFixtureSnapshot() { return { ...snapshot, networkCalls }; }
export function subscribeFixture(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export async function mockRemoteRequest() {
  networkCalls++; emit();
  return new Response('null', { status:200, headers:{'Content-Type':'application/json'} });
}
`;

const result = await build({
  bundle: true,
  jsx: "automatic",
  write: false,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  stdin: {
    resolveDir: repo,
    loader: "jsx",
    contents: `
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TotteryApp } from './src/ui/screens.jsx';
import { loadProfile } from './src/game/profile.js';
import { CASES, chooseFixture, subscribeFixture, readFixtureSnapshot } from 'tutorial-fixture-runtime';
function Fixture() {
  const [fixture, setFixture] = useState(CASES[0]);
  const [key, setKey] = useState(0);
  const [snapshot, setSnapshot] = useState(readFixtureSnapshot);
  useEffect(() => {
    const update = () => setSnapshot(readFixtureSnapshot());
    const unsubscribe = subscribeFixture(update);
    update();
    return unsubscribe;
  }, []);
  function choose(next) {
    chooseFixture(next); setFixture(next); setKey(k => k + 1);
  }
  const profile = loadProfile();
  return <>
    <style>{'.tutorial-fixture-header{position:relative;z-index:10000;padding:12px;background:#111c32;color:#f2ead9;border-bottom:1px solid #8a7955;font-family:system-ui,sans-serif}.tutorial-fixture-header nav{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.tutorial-fixture-header button{padding:8px 11px;background:#203351;color:#fff;border:1px solid #7b7c8c;border-radius:6px;cursor:pointer}.tutorial-fixture-header button[aria-pressed="true"]{color:#ffe1a3;border-color:#edc77d}.tutorial-fixture-header p{margin:5px 0;font-size:12px;line-height:1.5}.tutorial-fixture-header output{display:block;font:11px/1.5 monospace;overflow-wrap:anywhere}'}</style>
    <header className="tutorial-fixture-header">
      <strong>ローカル確認：チュートリアルの次話接続</strong>
      <nav aria-label="チュートリアルの確認ケース">
        {CASES.map(c => <button key={c.id} aria-pressed={fixture.id === c.id} onClick={() => choose(c)}>{c.label}</button>)}
        <button onClick={() => choose(fixture)}>現在のケースをリセット</button>
      </nav>
      <p>実Appの完了ボタンから進めます。初回のみ終局を注入し、次話・再挑戦は通常の初期化を使います。</p>
      <output data-fixture-state>{JSON.stringify({tutorialId:snapshot.tutorialId,phase:snapshot.phase,hand:snapshot.hand,stepIndex:snapshot.stepIndex,cleared:profile.cleared,remoteCallsStubbed:snapshot.networkCalls})}</output>
      <p data-fixture-guide>{snapshot.stepText || ''}</p>
      <p>プロフィールはメモリ保存・公開通信はローカル応答です。</p>
    </header>
    <TotteryApp key={key}/>
  </>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Fixture/></StrictMode>);
`,
  },
  plugins: [
    {
      name: "tutorial-local-fixture",
      setup(b) {
        b.onResolve({ filter: /^tutorial-fixture-runtime$/ }, () => ({
          path: "runtime",
          namespace: "tutorial-fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "tutorial-fixture" }, () => ({
          contents: runtime,
          loader: "js",
          resolveDir: repo,
        }));
        b.onLoad({ filter: /src\/ui\/screens\.jsx$/ }, () => {
          let source = fs.readFileSync(
            path.join(repo, "src/ui/screens.jsx"),
            "utf8",
          );
          source = replaceRequired(
            source,
            "[named, setNamed] = (0, useState)(() => hasName())",
            "[named, setNamed] = (0, useState)(true)",
          );
          source = replaceRequired(
            source,
            '[e, t] = (0, useState)("home")',
            '[e, t] = (0, useState)("game")',
          );
          source = replaceRequired(
            source,
            "[d, m] = (0, useState)(!1)",
            "[d, m] = (0, useState)(true)",
          );
          source = replaceRequired(
            source,
            "[tut, setTut] = (0, useState)(null)",
            "[tut, setTut] = (0, useState)(fixtureTutorial)",
          );
          source +=
            '\nimport {fixtureTutorial} from "tutorial-fixture-runtime";';
          return {
            contents: source,
            loader: "jsx",
            resolveDir: path.join(repo, "src/ui"),
          };
        });
        b.onLoad({ filter: /src\/ui\/game\.jsx$/ }, () => {
          let source = fs.readFileSync(
            path.join(repo, "src/ui/game.jsx"),
            "utf8",
          );
          source = replaceRequired(
            source,
            "  let [a, u] = (0, useState)(initialState)",
            "  const fixtureInitial = useTutorialFixtureInitial(tutorial, initialState);\n  let [a, u] = (0, useState)(() => fixtureInitial)",
          );
          source = replaceRequired(
            source,
            "  let tutIdx = tutorial ? currentStepIndex(tutorial, a, tutStep) : -1;",
            `
  let tutIdx = tutorial ? currentStepIndex(tutorial, a, tutStep) : -1;
  (0, useEffect)(() => {
    observeTutorial({
      tutorialId:tutorial?.id, phase:a.phase,
      hand:(a.players?.[0]?.hand || []).map(card => card.rank + ':' + card.suit),
      stepIndex:tutIdx, stepText:tutorial?.steps[tutIdx]?.text || '',
    });
  }, [a, tutorial, tutIdx]);`,
          );
          source +=
            '\nimport {useTutorialFixtureInitial,observeTutorial} from "tutorial-fixture-runtime";';
          return {
            contents: source,
            loader: "jsx",
            resolveDir: path.join(repo, "src/ui"),
          };
        });
        b.onLoad({ filter: /src\/game\/profile\.js$/ }, () => {
          const source = fs.readFileSync(
            path.join(repo, "src/game/profile.js"),
            "utf8",
          );
          if (!source.includes("localStorage."))
            throw new Error("Profile storage fixture anchor missing");
          return {
            contents:
              'import {tutorialFixtureStorage} from "tutorial-fixture-runtime";\n' +
              source.replaceAll("localStorage.", "tutorialFixtureStorage."),
            loader: "js",
            resolveDir: path.join(repo, "src/game"),
          };
        });
        b.onLoad({ filter: /src\/net\/auth\.js$/ }, () => ({
          loader: "js",
          resolveDir: repo,
          contents: `
import { mockRemoteRequest } from 'tutorial-fixture-runtime';
export const API_KEY = '';
export const ensureAuth = async () => null;
export const signInAsOperator = async () => { throw new Error('Local fixture'); };
export const signOut = () => {};
export const myUid = () => null;
export const authed = async () => { throw new Error('Local fixture'); };
export const authedFetch = mockRemoteRequest;
`,
        }));
      },
    },
  ],
});
if (process.argv.includes("--build-only")) {
  console.log(
    `Tutorial fixture bundle OK (${result.outputFiles[0].contents.length} bytes; scripts 1, 11, 12 completed)`,
  );
  process.exit(0);
}
const html = Buffer.from(
  `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="connect-src 'self'; media-src 'self' blob:; img-src 'self' data: blob:"><title>チュートリアル接続確認</title><body style="margin:0;background:#071120"><div id="root"></div><script>${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`,
);
const assetRoot = path.join(repo, "assets");
const mime = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
};
http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": html.length,
      });
      res.end(html);
      return;
    }
    const file = path.resolve(assetRoot, "." + pathname);
    if (!file.startsWith(assetRoot + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile()) throw new Error();
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] || "application/octet-stream",
      );
      res.setHeader("Accept-Ranges", "bytes");
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
      if (range) {
        const start = Number(range[1]),
          end = range[2]
            ? Math.min(Number(range[2]), stat.size - 1)
            : stat.size - 1;
        if (start > end || start >= stat.size) {
          res.writeHead(416, { "Content-Range": "bytes */" + stat.size }).end();
          return;
        }
        res.writeHead(206, {
          "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
          "Content-Length": end - start + 1,
        });
        fs.createReadStream(file, { start, end }).pipe(res);
      } else {
        res.setHeader("Content-Length", stat.size);
        fs.createReadStream(file).pipe(res);
      }
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(4214, "127.0.0.1", () => console.log("http://127.0.0.1:4214"));
