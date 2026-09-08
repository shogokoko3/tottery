// Local-only migration fixture for the actual battle-pass and skin screens.
// No fixture entry or saved fixture data is included in the production build.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  bundle: true,
  jsx: "automatic",
  loader: { ".webp": "dataurl", ".png": "dataurl", ".css": "text" },
  define: { __AUDIO_FILES__: "{}" },
  write: false,
  stdin: {
    resolveDir: repo,
    loader: "jsx",
    contents: String.raw`
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BattlePassScreen } from './src/ui/battlepass.jsx';
import { SkinsScreen } from './src/ui/skins.jsx';
import { CELLS, centerId, REWARD_SKIN } from './src/game/battlepass.js';
import { PASS_KEY, usePass } from './src/game/battlepass-store.js';
import { COLLECTION_KEY, useCollection } from './src/skins/store.js';
import { armAudioUnlock } from './src/audio/index.js';
import styles from './src/styles.css';
import skinStyles from './src/skins/styles.css';

armAudioUnlock();
const allIds = CELLS.map(c => c.id);
const fullProgress = Object.fromEntries(CELLS.filter(c => !c.free).map(c => [c.id, c.goal]));
const full = { progress: fullProgress, cleared: allIds, flipped: allIds };
const fixtures = [
  {
    label: '最後の1枚・A未所持',
    pass: { version: 3, rewardId: REWARD_SKIN, ...full, flipped: allIds.filter(id => id !== centerId), assembled: false, claimed: false },
    collection: { owned: {}, equipped: {} },
  },
  {
    label: '12枚開放・途中',
    pass: { version: 3, rewardId: REWARD_SKIN, ...full, flipped: allIds.slice(0, 12), assembled: false, claimed: false },
    collection: { owned: {}, equipped: {} },
  },
  {
    label: '新規・A未所持',
    pass: { version: 1, progress: {}, cleared: [centerId], flipped: [], claimed: false },
    collection: { owned: {}, equipped: {} },
  },
  {
    label: '旧天使受取済み・全完成',
    pass: { version: 1, ...full, claimed: true },
    collection: { owned: { 'angel-k': 1 }, equipped: { K: 'angel-k' } },
  },
  {
    label: 'A所持・装備済み・全完成',
    pass: { version: 2, rewardId: REWARD_SKIN, ...full, claimed: false },
    collection: { owned: { [REWARD_SKIN]: 1 }, equipped: { A: REWARD_SKIN } },
  },
  {
    label: 'A報酬受取済み・v2',
    pass: { version: 2, rewardId: REWARD_SKIN, ...full, claimed: true },
    collection: { owned: { [REWARD_SKIN]: 1 }, equipped: { A: REWARD_SKIN } },
  },
];

function App() {
  const [view, setView] = useState('pass');
  const [fixtureLabel, setFixtureLabel] = useState('現在の保存状態（未変更）');
  const [screenKey, setScreenKey] = useState(0);
  const [error, setError] = useState('');
  const pass = usePass();
  const collection = useCollection();

  function applyFixture(fixture) {
    try {
      // Only an explicit fixture button changes these two local-origin keys.
      // Write the raw v1 object, so the real storage listener performs migration.
      localStorage.setItem(PASS_KEY, JSON.stringify(fixture.pass));
      localStorage.setItem(COLLECTION_KEY, JSON.stringify(fixture.collection));
      for (const key of [PASS_KEY, COLLECTION_KEY]) {
        window.dispatchEvent(new StorageEvent('storage', {
          key,
          newValue: localStorage.getItem(key),
          storageArea: localStorage,
        }));
      }
      setFixtureLabel(fixture.label);
      setView('pass');
      setScreenKey(k => k + 1);
      setError('');
    } catch (e) {
      setError(e.message || 'Fixtureの保存に失敗しました。');
    }
  }

  return <div className="tottery-root">
    <style>{styles + skinStyles + '.pass-fixture-header{padding:12px;background:#111c32;color:#f2eefb;border-bottom:1px solid #635480}.pass-fixture-header nav{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.pass-fixture-header button{padding:8px 10px;border:1px solid #847b9d;border-radius:6px;background:#243251;color:#fff;cursor:pointer}.pass-fixture-header button[aria-pressed="true"]{border-color:#ffd986;color:#ffd986}.pass-fixture-state{font-size:13px;line-height:1.7;overflow-wrap:anywhere}.pass-fixture-state p{margin:0}.pass-fixture-main{max-width:740px;width:100%;margin:0 auto;padding:0 10px;box-sizing:border-box}'}</style>
    <header className="pass-fixture-header">
      <strong>ローカル確認：バトルパス報酬の移行</strong>
      <nav aria-label="保存データの確認ケース">
        {fixtures.map(fixture => <button key={fixture.label} onClick={() => applyFixture(fixture)}>{fixture.label}</button>)}
      </nav>
      <nav aria-label="確認画面の切り替え">
        <button aria-pressed={view === 'pass'} onClick={() => setView('pass')}>バトルパス画面</button>
        <button aria-pressed={view === 'skins'} onClick={() => setView('skins')}>スキン画面</button>
        <button onClick={() => window.location.reload()}>再読み込み（保存を確認）</button>
      </nav>
      <div className="pass-fixture-state" role="status" aria-label="保存状態">
        <p>確認ケース: {fixtureLabel}</p>
        <p>A所持枚数: {collection.owned[REWARD_SKIN] || 0} / 旧天使所持枚数: {collection.owned['angel-k'] || 0}</p>
        <p>equipped.A: {collection.equipped.A || '未装備'} / equipped.K: {collection.equipped.K || '未装備'}</p>
        <p>pass.claimed: {String(pass.claimed)} / assembled: {String(pass.assembled)} / version: {pass.version} / rewardId: {pass.rewardId}</p>
        <p>クリア数: {pass.cleared.length} / めくり数: {pass.flipped.length}</p>
        <p>絵の配置: {pass.puzzleOrder?.join(', ')}</p>
      </div>
      {error && <p role="alert">{error}</p>}
    </header>
    <main className="pass-fixture-main" key={screenKey}>
      {view === 'pass'
        ? <BattlePassScreen onBack={() => setView('skins')} onSkins={() => setView('skins')} />
        : <SkinsScreen onBack={() => setView('pass')} onBattlePass={() => setView('pass')} />}
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
`,
  },
});

if (process.argv.includes("--build-only")) {
  console.log(
    `Pass fixture bundle OK (${result.outputFiles[0].contents.length} bytes)`,
  );
  process.exit(0);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-pass-check-"));
fs.writeFileSync(
  path.join(root, "index.html"),
  `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A報酬バトルパス・実機確認</title><body style="margin:0;background:#071120"><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`,
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
        const start = Number(match[1]);
        const end = match[2]
          ? Math.min(Number(match[2]), stat.size - 1)
          : stat.size - 1;
        if (start > end || start >= stat.size) {
          res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end();
          return;
        }
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
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
  .listen(4211, "127.0.0.1", () => console.log("http://127.0.0.1:4211"));
