/** Local-only XP notice fixture. Profile data lives in this bundle's memory. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
import { XpGainToast } from './src/ui/xp-gain.jsx';
import XP_STYLES from './src/ui/xp-gain.css';
import STYLES from './src/styles.css';
import { addXp, recordGame, loadProfile } from './src/game/profile.js';
import { MAX_LEVEL, totalFor, progressOfXp } from './src/game/level.js';
import { getXpNotices, subscribeXpNotices, releaseXpNotice, dismissXpNotice } from './src/game/xp-notices.js';
import { resetXpProfile } from 'xp-fixture-memory';

const CASES = [
  {id:'normal', label:'通常 +50 XP', start:420, amount:50},
  {id:'level', label:'レベルアップ', start:80, amount:50},
  {id:'multi', label:'複数レベル', start:80, amount:1000},
  {id:'max', label:'最高レベル', start:totalFor(MAX_LEVEL), amount:50},
  {id:'rapid', label:'連続受取 +50 / +30 / +20', start:420, amount:50},
  {id:'gacha', label:'ガチャ +150（通知なし）', start:420, amount:150, source:'gacha'},
  {id:'tutorial-first', label:'チュートリアル初クリア +100', start:0, tutorial:true},
  {id:'tutorial-again', label:'チュートリアル再クリア +0', start:100, tutorial:true, cleared:[1]},
  {id:'deferred', label:'対戦保留 → 撃破札を確認', start:80, deferred:true},
];
resetXpProfile(CASES[0]);

function Fixture() {
  const [fixture, setFixture] = useState(CASES[0]);
  const [notices, setNotices] = useState(getXpNotices);
  const [profile, setProfile] = useState(loadProfile);
  const [received, setReceived] = useState(false);
  const [extra, setExtra] = useState(false);
  const [held, setHeld] = useState(null);
  const [message, setMessage] = useState('ケースを選び、経験値を獲得してください。');
  useEffect(() => {
    const update = () => { setNotices(getXpNotices()); setProfile(loadProfile()); };
    const unsubscribe = subscribeXpNotices(update);
    update();
    return unsubscribe;
  }, []);
  function choose(next) {
    for (const notice of getXpNotices()) dismissXpNotice(notice.id);
    resetXpProfile(next);
    setFixture(next); setProfile(loadProfile()); setNotices(getXpNotices());
    setReceived(false); setExtra(false); setHeld(null);
    setMessage('初期状態です。経験値を獲得してください。');
  }
  function gain() {
    if (received) return;
    try {
      const before = loadProfile().xp;
      let result;
      if (fixture.tutorial) result = recordGame(true, {xp:100, tutorial:true, tutorialId:1});
      else if (fixture.deferred) {
        result = recordGame(true, {deferXpNotice:true});
        setHeld(result.xpNoticeId || null);
      } else result = addXp(fixture.amount, {source:fixture.source || 'mission'});
      const after = loadProfile();
      setProfile(after); setNotices(getXpNotices()); setReceived(true);
      setMessage('獲得: +' + (after.xp - before) + ' XP' + (fixture.deferred ? ' / 撃破札の確認待ち' : ''));
    } catch (error) { setMessage(error.message); }
  }
  function gainAgain() {
    if (!received || extra) return;
    addXp(30, {source:'mission'});
    addXp(20, {source:'mission'});
    setProfile(loadProfile()); setNotices(getXpNotices()); setExtra(true);
    setMessage('表示中の +50 に続けて +30、+20 を受け取りました。');
  }
  function release() {
    if (!held) return;
    releaseXpNotice(held);
    setHeld(null); setNotices(getXpNotices()); setMessage('撃破札を確認し、保留した通知を解放しました。');
  }
  const progress = progressOfXp(profile.xp);
  return <>
    <style>{STYLES}</style>
    <style>{XP_STYLES}</style>
    <style>{'.xp-fixture{min-height:100vh;background:#091323;color:#f1e8d6;font-family:system-ui,sans-serif;padding:18px;padding-bottom:180px;box-sizing:border-box}.xp-fixture h1{font-size:18px;margin:0 0 12px}.xp-fixture nav{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.xp-fixture button{padding:9px 12px;border:1px solid #827960;border-radius:7px;background:#203351;color:#f3eee6;cursor:pointer}.xp-fixture button[aria-pressed="true"]{border-color:#edc77d;color:#ffe1a3}.xp-fixture button:disabled{opacity:.4;cursor:default}.xp-fixture p{font-size:13px;line-height:1.6;margin:8px 0}.xp-fixture output{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace;border:1px solid #334056;padding:12px;border-radius:8px}.xp-fixture .xp-fixture-note{max-width:720px;color:#abb7c9}'}</style>
    <main className="xp-fixture">
      <h1>ローカル確認：経験値獲得ゲージ</h1>
      <nav aria-label="経験値の確認ケース">
        {CASES.map(c => <button key={c.id} aria-pressed={fixture.id === c.id} onClick={() => choose(c)}>{c.label}</button>)}
      </nav>
      <nav aria-label="経験値の獲得操作">
        <button disabled={received} onClick={gain}>経験値を獲得</button>
        {fixture.id === 'rapid' && <button disabled={!received || extra} onClick={gainAgain}>続けて +30 / +20</button>}
        {fixture.deferred && <button disabled={!held} onClick={release}>撃破札を確認</button>}
        <button onClick={() => choose(fixture)}>現在のケースをリセット</button>
      </nav>
      <p role="status">{message}</p>
      <p>ケース: {fixture.label} / 開始: {fixture.start} XP / 現在: {profile.xp} XP / Lv.{progress.level}</p>
      <output data-xp-fixture-state>{JSON.stringify({xp:profile.xp,level:progress.level,cleared:profile.cleared,heldNoticeId:held,notices}, null, 2)}</output>
      <p className="xp-fixture-note">連続受取は最初の +50 が表示されている間に『続けて +30 / +20』を押してください。実表示時間は変更していません。</p>
      <p className="xp-fixture-note">実 profile の獲得処理と実通知コンポーネントを使います。プロフィールはこのページのメモリ内だけに保存されます。</p>
    </main>
    <XpGainToast/>
  </>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Fixture/></StrictMode>);
`,
  },
  plugins: [
    {
      name: "xp-local-fixture",
      setup(b) {
        b.onResolve({ filter: /^xp-fixture-memory$/ }, () => ({
          path: "memory",
          namespace: "xp-fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "xp-fixture" }, () => ({
          loader: "js",
          resolveDir: repo,
          contents: `
const saved = new Map();
export const xpFixtureStorage = {
  getItem:key => saved.get(key) ?? null,
  setItem:(key,value) => { saved.set(key,String(value)); },
  removeItem:key => { saved.delete(key); },
};
export function resetXpProfile(fixture) {
  saved.clear();
  saved.set('tottery.account.v1', JSON.stringify({
    id:'local-xp-fixture', name:'XP確認', xp:fixture.start, cleared:fixture.cleared || [],
  }));
}
`,
        }));
        b.onLoad({ filter: /src\/game\/profile\.js$/ }, () => {
          const source = fs.readFileSync(
            path.join(repo, "src/game/profile.js"),
            "utf8",
          );
          if (!source.includes("localStorage."))
            throw new Error("Profile memory fixture anchor missing");
          return {
            contents:
              'import {xpFixtureStorage} from "xp-fixture-memory";\n' +
              source.replaceAll("localStorage.", "xpFixtureStorage."),
            loader: "js",
            resolveDir: path.join(repo, "src/game"),
          };
        });
      },
    },
  ],
});
if (process.argv.includes("--build-only")) {
  console.log(
    `XP fixture bundle OK (${result.outputFiles[0].contents.length} bytes)`,
  );
  process.exit(0);
}
const html = Buffer.from(
  `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="connect-src 'none'; media-src 'self' blob:; img-src 'self' data: blob:"><title>経験値ゲージ確認</title><body style="margin:0"><div id="root"></div><script>${result.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script></body></html>`,
);
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname !== "/" && pathname !== "/index.html") {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": html.length,
      "Cache-Control": "no-store",
    });
    res.end(html);
  })
  .listen(4215, "127.0.0.1", () => console.log("http://127.0.0.1:4215"));
