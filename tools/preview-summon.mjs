import { build } from "esbuild";
import fs from "node:fs";
const out = process.argv[2] || "/tmp/tottery-summon-preview";
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(`${out}/skins/summon`, { recursive: true });
fs.cpSync("assets/skins/summon", `${out}/skins/summon`, { recursive: true });
const r = await build({
  entryPoints: ["tools/preview-summon-entry.js"],
  bundle: true,
  write: false,
  format: "iife",
  target: ["es2020"],
  minify: false,
});
fs.writeFileSync(`${out}/app.js`, r.outputFiles[0].text);
const flow = await build({
  entryPoints: ["tools/preview-summon-flow.jsx"],
  bundle: true,
  write: false,
  format: "iife",
  target: ["es2020"],
  minify: false,
  jsx: "automatic",
  loader: { ".css": "text", ".png": "dataurl", ".webp": "dataurl" },
  define: {
    __AUDIO_FILES__: "{}",
    __FIELD_FILES__: "{}",
    __HONOR_VERSION__: '"preview"',
    __APP_BUILD__: "0",
    __ADMOB_TESTING__: "true",
    __ADMOB_REWARDED_ID__: '"preview"',
  },
  plugins: [
    {
      name: "export-preview-reveal",
      setup(b) {
        b.onLoad({ filter: /src\/ui\/skins\.jsx$/ }, (args) => ({
          contents:
            fs.readFileSync(args.path, "utf8") + "\nexport { SummonReveal };",
          loader: "jsx",
        }));
        b.onLoad({ filter: /src\/skins\/summon-scene\.js$/ }, (args) => ({
          contents: fs
            .readFileSync(args.path, "utf8")
            .replace(
              "export function createSummonScene(canvas, plan) {",
              'export function createSummonScene(canvas, plan) { if (new URLSearchParams(location.search).get("no-gl") === "1") throw new Error("preview: WebGL unavailable");',
            ),
          loader: "js",
        }));
      },
    },
  ],
});
fs.writeFileSync(`${out}/flow.js`, flow.outputFiles[0].text);
fs.writeFileSync(
  `${out}/flow.html`,
  '<!doctype html><html lang="ja"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>召喚 → 結果カード · プレビュー</title><div id="root"></div><script src="flow.js"></script></html>',
);
for (const dir of ["cards", "foils"])
  fs.cpSync(`assets/skins/${dir}`, `${out}/skins/${dir}`, { recursive: true });
fs.writeFileSync(
  `${out}/index.html`,
  `<!doctype html><html lang="ja"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>召喚の門 · プレビュー</title><style>html,body{margin:0;background:#050b12;color:#f4e7cb;font-family:serif}canvas{display:block;width:100vw;height:100dvh}nav{position:fixed;left:12px;right:12px;bottom:12px;padding:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#07131cdd;border:1px solid #aa875655;border-radius:12px}button,select{background:#172935;color:#ffe9c7;border:1px solid #9a794e;border-radius:6px;padding:8px}input{flex:1;min-width:100px}output{font-size:12px;min-width:50px}h1{position:fixed;left:0;right:0;top:16px;font-size:16px;text-align:center;font-weight:normal;letter-spacing:.22em;text-shadow:0 2px 8px #000;pointer-events:none}</style><canvas id="scene"></canvas><h1 id="name"></h1><nav><select id="world"></select><button id="metal">銅の門</button><button id="play">再生</button><input aria-label="時間" id="time" type="range" min="0" max="9000" value="3000" step="10"><output id="clock"></output></nav><script src="app.js"></script></html>`,
);
console.log(out);
