/** Local-only adjudication UI fixture. Production sources are never changed. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { initialState, reducer } from "../src/game/reducer.js";
import { emptyBoard, getLegalMoves, kingRankOf } from "../src/game/board.js";
import {
  ADJUDICATION_RULE_VERSION,
  withInitialArmies,
} from "../src/game/adjudication.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Seed an earlier army, retain its initial totals, then leave two living kings.
// Each final position below is produced by a legal MOVE_PIECE through reducer.
function position(ranks, size = 5, noAction = false) {
  let state = initialState();
  state.phase = "play";
  state.ruleVersion = ADJUDICATION_RULE_VERSION;
  state.setupMode = "simultaneous";
  state.boardSize = size;
  state.board = emptyBoard(size);
  state.currentTurn = noAction ? 1 : 0;
  const kings = [
    [size - 1, 0],
    [0, noAction ? 1 : size - 2],
  ];
  const reserved = new Set(kings.map(([row, col]) => row * size + col));
  let nextCell = 0;
  for (let owner = 0; owner < 2; owner++) {
    for (let n = 0; n < ranks[owner].length; n++) {
      let row, col;
      if (n === 0) [row, col] = kings[owner];
      else {
        while (reserved.has(nextCell)) nextCell++;
        row = Math.floor(nextCell / size);
        col = nextCell % size;
        reserved.add(nextCell++);
      }
      const piece = {
        id: `p${owner}-${n}`,
        rank: ranks[owner][n],
        owner,
        row,
        col,
        suit: owner === 0 ? "heart" : "spade",
        alive: true,
        isKing: n === 0,
        revealed: false,
        history: ["初期布陣で採用"],
      };
      state.pieces[piece.id] = piece;
      state.board[row][col] = piece;
      if (piece.isKing) state.players[owner].kingId = piece.id;
      state.players[owner].armyRankCounts[piece.rank] =
        (state.players[owner].armyRankCounts[piece.rank] || 0) + 1;
    }
  }
  state = withInitialArmies(state);
  for (const [id, piece] of Object.entries(state.pieces)) {
    if (piece.isKing) continue;
    state.board[piece.row][piece.col] = null;
    state.pieces[id] = { ...piece, alive: false };
    state.players[piece.owner].capturedOwn.push(state.pieces[id]);
  }
  state.log = ["ここまでの対局で王以外の採用札が倒れています。"];
  const actor = state.pieces[`p${state.currentTurn}-0`];
  const target = noAction ? [1, 1] : [size - 2, 1];
  const move = getLegalMoves(
    actor,
    state.board,
    size,
    state.players[actor.owner].armyRankCounts,
    kingRankOf(state, actor.owner),
  ).find((m) => m.row === target[0] && m.col === target[1]);
  assert.ok(move && !move.capture, "fixture uses a legal non-capture move");
  const action = {
    type: "MOVE_PIECE",
    pieceId: actor.id,
    ...move,
    elapsedMs: 0,
  };
  const after = reducer(state, action);
  assert.equal(after.phase, "gameover");
  assert.equal(
    after.adjudication?.reason,
    noAction ? "no-legal-action" : "dead-position",
  );
  return { before: state, after, action, size };
}

const win = position([
  ["3", "4", "5", "6", "7"],
  ["3", "5", "6", "7", "8"],
]);
const draw = position([
  ["3", "4", "5", "6", "7"],
  ["3", "4", "5", "6", "7"],
]);
const wide = position(
  [
    ["3", "4", "5", "6", "7", "8", "9", "10", "Q"],
    ["3", "4", "5", "6", "7", "8", "9", "J", "Q"],
  ],
  9,
);
const blocked = position(
  [
    ["6", "2", "3", "4", "5"],
    ["K", "2", "3", "4", "5"],
  ],
  5,
  true,
);
assert.equal(win.after.winner, 0);
assert.equal(draw.after.winner, null);
const cases = [
  { id: "win", label: "判定勝ち・5×5", viewer: 0, ...win },
  { id: "lose", label: "判定負け・5×5", viewer: 1, ...win },
  { id: "draw", label: "同点引き分け", viewer: 0, ...draw },
  { id: "wide", label: "9×9の採用内訳", viewer: 0, ...wide },
  { id: "blocked", label: "合法な行動なし", viewer: 1, ...blocked },
];

function replaceRequired(source, from, to) {
  if (!source.includes(from))
    throw new Error(`GameCore fixture anchor missing: ${from}`);
  return source.replace(from, to);
}

const result = await build({
  bundle: true,
  jsx: "automatic",
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  write: false,
  stdin: {
    resolveDir: repo,
    loader: "jsx",
    contents: `
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameCore, GameView } from './src/ui/game.jsx';
import { SeatsProvider } from './src/ui/names.jsx';
import { LogViewer } from './src/ui/overlays.jsx';
import { reducer } from './src/game/reducer.js';
import { loadProfile } from './src/game/profile.js';
import styles from './src/styles.css';
import skinStyles from './src/skins/styles.css';
const CASES = ${JSON.stringify(cases)};
function App() {
  const [fixture, setFixture] = useState(CASES[0]);
  const [mode, setMode] = useState('view');
  const [view, setView] = useState(CASES[0].after);
  const [observed, setObserved] = useState(null);
  const [key, setKey] = useState(0);
  const [message, setMessage] = useState('');
  const header = useRef(null);
  const control = useRef(null);
  const observe = useCallback(state => setObserved(state), []);
  useEffect(() => {
    const resize = () => document.documentElement.style.setProperty('--fixture-offset', header.current.getBoundingClientRect().height + 'px');
    const observer = new ResizeObserver(resize);
    observer.observe(header.current); resize();
    return () => observer.disconnect();
  }, []);
  function choose(next, nextMode = mode) {
    control.current = null;
    setFixture(next); setMode(nextMode); setView(next.after); setObserved(null);
    setKey(n => n + 1); setMessage('');
  }
  function play() {
    if (control.current?.()) setMessage('実GameCoreから判定手を実行しました。');
  }
  const current = mode === 'core' ? observed || fixture.before : view;
  const profile = loadProfile();
  return <div className="tottery-root adjudication-fixture">
    <style>{styles + skinStyles}</style>
    <style>{'.adjudication-fixture-header{position:relative;z-index:5000;padding:10px 12px;background:#111b2b;border-bottom:1px solid #817357;color:#eee;font:12px/1.4 system-ui}.adjudication-fixture-header summary{cursor:pointer;font-weight:700}.adjudication-fixture-header nav{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}.adjudication-fixture-header button{border:1px solid #748197;border-radius:5px;background:#1e324e;color:#fff;padding:6px 8px;cursor:pointer}.adjudication-fixture-header button[aria-pressed="true"]{border-color:#f5d18a;color:#f5d18a}.adjudication-fixture-header button:disabled{opacity:.45;cursor:default}.adjudication-fixture-header output{display:block;font-size:11px;overflow-wrap:anywhere}.adjudication-fixture .modal-overlay{top:var(--fixture-offset,170px);height:calc(100dvh - var(--fixture-offset,170px))}.adjudication-fixture .modal-panel{max-height:calc(100dvh - var(--fixture-offset,170px) - 28px)}'}</style>
    <header className="adjudication-fixture-header" ref={header}>
      <details open><summary>ローカル確認：布陣判定（狭幅確認時はここを閉じられます）</summary>
        <nav aria-label="判定の確認ケース">{CASES.map(c => <button key={c.id} aria-pressed={fixture.id===c.id} onClick={() => choose(c)}>{c.label}</button>)}</nav>
        <nav aria-label="表示と実戦接続">
          <button aria-pressed={mode==='view'} onClick={() => choose(fixture,'view')}>実GameViewを表示</button>
          <button aria-pressed={mode==='core'} onClick={() => choose(fixture,'core')}>実GameCore接続</button>
          <button disabled={mode!=='core' || current.phase==='gameover'} onClick={play}>判定手を指す</button>
          <button onClick={() => choose(fixture)}>このケースをやり直す</button>
        </nav>
      </details>
      <output data-testid="fixture-state">mode={mode} / case={fixture.id} / phase={current.phase} / winner={String(current.winner)} / reason={current.adjudication?.reason || '—'} / totals={current.initialArmyTotals?.join(',')} / plays={profile.plays} wins={profile.wins} draws={profile.draws || 0}</output>
      {message && <p role="status">{message}</p>}
    </header>
    <SeatsProvider value={{names:['赤のプレイヤー','青のプレイヤー'],skins:[{},{}]}}>
      {mode === 'core' ? <GameCore key={key} fixture={fixture} fixtureControl={control} onFixtureState={observe} onExit={() => choose(fixture)} /> : <>
        <GameView key={key} state={view} size={fixture.size} viewer={fixture.viewer} myIdx={fixture.viewer} youAre={fixture.viewer} network={{myPlayerIndex:fixture.viewer}} dispatch={action => {if(action.type === 'NEW_GAME') choose(fixture); else setView(s => reducer(s,action));}} onExit={() => choose(fixture)} />
        {view.logViewerId && <LogViewer piece={view.pieces[view.logViewerId]} viewer={fixture.viewer} revealAll onClose={() => setView(s => reducer(s,{type:'CLOSE_LOG'}))} />}
      </>}
    </SeatsProvider>
  </div>;
}
createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);
`,
  },
  plugins: [
    {
      name: "adjudication-fixture",
      setup(b) {
        b.onLoad({ filter: /src\/ui\/game\.jsx$/ }, () => {
          let source = fs.readFileSync(
            path.join(repo, "src/ui/game.jsx"),
            "utf8",
          );
          source = replaceRequired(
            source,
            "export function GameCore({",
            "export function GameCore({fixture, fixtureControl, onFixtureState,",
          );
          source = replaceRequired(
            source,
            "(0, useState)(initialState)",
            "(0, useState)(() => fixture.before)",
          );
          source = replaceRequired(
            source,
            "  const pauseClock = fxBusy || !!a.captureReveal;",
            `
  (0, useEffect)(() => {
    onFixtureState(a);
    fixtureControl.current = () => {
      if (fxBusy || a.phase !== 'play') return false;
      y(fixture.action);
      return true;
    };
    return () => { fixtureControl.current = null; };
  }, [a, fxBusy, fixture, onFixtureState]);
  const pauseClock = fxBusy || !!a.captureReveal;`,
          );
          return {
            loader: "jsx",
            resolveDir: path.join(repo, "src/ui"),
            contents: source,
          };
        });
      },
    },
  ],
});

if (process.argv.includes("--build-only")) {
  console.log(
    `Adjudication fixture OK: 4 real-reducer positions / 5 views (${result.outputFiles[0].contents.length} bytes)`,
  );
  process.exit(0);
}
const root = fs.mkdtempSync(
  path.join(os.tmpdir(), "tottery-adjudication-check-"),
);
// Replace storage before modules run. All remote requests receive local replies.
const bootstrap = `
const memory = new Map();
Object.defineProperty(window,'localStorage',{value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),clear:()=>memory.clear()}});
localStorage.setItem('tottery.skins.v1',JSON.stringify({motion:'off'}));
localStorage.setItem('tottery.audio.v1',JSON.stringify({muted:true}));
const localFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);return url.origin===location.origin?localFetch(input,init):Promise.resolve(new Response(JSON.stringify({}),{status:200,headers:{'Content-Type':'application/json'}}));};
history.replaceState(null,'',location.pathname+'?test=1');
`;
fs.writeFileSync(
  path.join(root, "index.html"),
  `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>布陣判定・引き分け確認</title><body style="margin:0;background:#071120"><div id="root"></div><script>${bootstrap}</script><script>${result.outputFiles[0].text}</script></body></html>`,
);
fs.symlinkSync(path.join(repo, "assets/skins"), path.join(root, "skins"));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".mp4": "video/mp4",
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
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root + path.sep)) {
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
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Length", stat.size);
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(4216, "127.0.0.1", () => console.log("http://127.0.0.1:4216"));
