// Local-only GameCore fixture. The runtime props/callback are injected into the
// temporary bundle; src/ and the production build contain no fixture entry.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameCore } from './src/ui/game.jsx';
import { SeatsProvider } from './src/ui/names.jsx';
import { updateCollection } from './src/skins/store.js';
import { armAudioUnlock } from './src/audio/index.js';
import { CAPTURE_CASES, CAPTURE_LOADOUTS } from './tools/fixtures/capture-position.mjs';
armAudioUnlock();
function App() {
  const [fixture, setFixture] = useState(CAPTURE_CASES[0]);
  const [motion, setMotion] = useState('off');
  const [ready, setReady] = useState(false);
  const [played, setPlayed] = useState(false);
  const [key, setKey] = useState(0);
  const [message, setMessage] = useState('');
  const control = useRef(null);
  useEffect(() => {
    let active = true;
    updateCollection(s => ({...s, motion:'off'}))
      .then(() => { if (active) setReady(true); })
      .catch(e => { if (active) setMessage(e.message); });
    return () => { active = false; };
  }, []);
  async function choose(nextFixture, nextMotion = motion) {
    setReady(false); setPlayed(false); control.current = null; setMessage('');
    try {
      await updateCollection(s => ({...s, motion:nextMotion}));
      setFixture(nextFixture); setMotion(nextMotion); setKey(k => k + 1); setReady(true);
    } catch(e) { setMessage(e.message); }
  }
  function play() {
    if (!control.current || played) return;
    try {
      if (control.current()) { setPlayed(true); setMessage('取る動きを再生しました。'); }
    } catch(e) { setMessage(e.message); }
  }
  return <>
    <style>{'.capture-fixture-header{padding:12px;background:#111c32;color:#f2ead9;border-bottom:1px solid #8a7955;font-family:system-ui,sans-serif}.capture-fixture-header nav{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.capture-fixture-header button{padding:8px 11px;background:#203351;color:#fff;border:1px solid #7b7c8c;border-radius:6px;cursor:pointer}.capture-fixture-header button[aria-pressed="true"]{color:#ffe1a3;border-color:#edc77d}.capture-fixture-header button:disabled{opacity:.5;cursor:default}.capture-fixture-header p{margin:5px 0;font-size:12px;line-height:1.5}'}</style>
    <header className="capture-fixture-header">
      <strong>ローカル実機確認：撃破時の公開タイミング</strong>
      <nav aria-label="撃破の確認ケース">
        {CAPTURE_CASES.map(c => <button key={c.id} aria-pressed={fixture.id === c.id} onClick={() => choose(c)}>{c.label}</button>)}
      </nav>
      <nav aria-label="動画設定と再生操作">
        <button aria-pressed={motion === 'off'} onClick={() => choose(fixture, 'off')}>動画なし（off）</button>
        <button aria-pressed={motion === 'full'} onClick={() => choose(fixture, 'full')}>動画あり（full）</button>
        <button disabled={!ready || played} onClick={play}>取る動きを再生</button>
        <button onClick={() => choose(fixture)}>初期配置に戻す</button>
      </nav>
      <p>ケース: {fixture.label} / 視点: {fixture.viewer} / motion: {motion}</p>
      <p role="status">{message || (ready ? '再生待ち' : '準備中')}</p>
    </header>
    {ready && <SeatsProvider value={{skins:CAPTURE_LOADOUTS}}>
      <GameCore key={key} fixture={fixture} fixtureControl={control} onExit={() => choose(fixture)}/>
    </SeatsProvider>}
  </>;
}
createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);
`,
  },
  plugins: [
    {
      name: "capture-fixture",
      setup(b) {
        b.onLoad({ filter: /src\/ui\/game\.jsx$/ }, () => {
          let source = fs.readFileSync(
            path.join(repo, "src/ui/game.jsx"),
            "utf8",
          );
          source = replaceRequired(
            source,
            "export function GameCore({ onExit, network, boardSize, cpu, tutorial })",
            "export function GameCore({ onExit, network, boardSize, cpu, tutorial, fixture, fixtureControl })",
          );
          source = replaceRequired(
            source,
            "(0, useState)(initialState)",
            "(0, useState)(() => capturePosition(fixture))",
          );
          source = replaceRequired(
            source,
            "  const boardRef = useRef(null);",
            `
  (0, useEffect)(() => {
    fixtureControl.current = () => {
      if (fxBusy) return false;
      y(captureMove(a, fixture));
      return true;
    };
    return () => { fixtureControl.current = null; };
  });
  const boardRef = useRef(null);`,
          );
          source = source.replaceAll(
            "network ? p : cpu ? 0 : null",
            "fixture.viewer",
          );
          source = replaceRequired(
            source,
            "P = network ? p : cpu ? 0 : (aceMagic.viewer ?? displayed.currentTurn)",
            "P = fixture.viewer",
          );
          source +=
            '\nimport {capturePosition,captureMove} from "../../tools/fixtures/capture-position.mjs";';
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
    `Capture fixture bundle OK (${result.outputFiles[0].contents.length} bytes)`,
  );
  process.exit(0);
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-capture-check-"));
fs.writeFileSync(
  path.join(root, "index.html"),
  `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>撃破・公開タイミング確認</title><body style="margin:0;background:#071120"><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`,
);
fs.symlinkSync(path.join(repo, "assets/skins"), path.join(root, "skins"));
fs.symlinkSync(path.join(repo, "assets/audio"), path.join(root, "audio"));
const mime = {
  ".html": "text/html; charset=utf-8",
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
      res.setHeader("Accept-Ranges", "bytes");
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
      if (match) {
        const start = Number(match[1]),
          end = match[2]
            ? Math.min(Number(match[2]), stat.size - 1)
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
  .listen(4213, "127.0.0.1", () => console.log("http://127.0.0.1:4213"));
