import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transform } from "esbuild";
import { SUMMON_ARCHITECTURE } from "../src/skins/summon-architecture.js";

const code = (await transform(fs.readFileSync("src/skins/summon-preload.js", "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace('import("./summon-scene.js")', "loadScene()")
  .replace('import("./summon-sound.js")', "loadSound()") +
  "\nglobalThis.api = {warmSummonIntro, loadSummonImage, summonAssetUrls};",
  { format: "cjs" })).code;
const calls = [], released = [], idle = new Map();
let seq = 0, decodes = 0, sceneLoads = 0, soundPreparations = 0;
const sandbox = {
  module: { exports: {} }, SUMMON_ARCHITECTURE,
  window: {
    requestIdleCallback(fn) { idle.set(++seq, fn); return seq; },
    cancelIdleCallback(id) { idle.delete(id); },
  },
  fetch(url, options) {
    const entry = { url, options };
    calls.push(entry);
    return new Promise((resolve, reject) => Object.assign(entry, {
      resolve: () => resolve({ ok: true, blob: async () => ({ url }) }), reject,
    }));
  },
  Image: class { async decode() { decodes++; } },
  URL: { createObjectURL: ({ url }) => url, revokeObjectURL: url => released.push(url) },
  loadScene: async () => { sceneLoads++; return { warmSummonRenderer() { return () => {}; } }; },
  loadSound: async () => ({ prepareSummonSound() { soundPreparations++; } }),
};
vm.runInNewContext(code, sandbox);
const { warmSummonIntro, loadSummonImage, summonAssetUrls } = sandbox.api;
const flush = () => new Promise(resolve => setImmediate(resolve));
const cancelBefore = warmSummonIntro();
cancelBefore();
assert.equal(idle.size, 0);
assert.equal(calls.length, 0, "閉じた画面から先読みを始めない");
const cancel = warmSummonIntro();
[...idle.values()][0]();
await flush();
assert.equal(calls.length, 2, "バックグラウンド転送は2本まで");
assert.equal(sceneLoads, 1);
assert.equal(soundPreparations, 1);
const url = calls[0].url;
const image = loadSummonImage(url);
assert.equal(loadSummonImage(url), image, "先読みと本番で同じ画像を重複要求しない");
assert.equal(calls.length, 2);
cancel();
for (const call of calls) call.resolve();
await image;
await flush();
assert.equal(calls.length, 2, "画面を離れたら残りの先読みは始めない");
assert.equal(decodes, 1);
assert.equal(released.length, 1, "object URLを解放する");
await loadSummonImage(url);
assert.equal(decodes, 1, "続けて引いた門の画像は再デコードしない");
const failedUrl = summonAssetUrls("earth")[0];
const failed = loadSummonImage(failedUrl);
calls.at(-1).reject(new Error("offline"));
await assert.rejects(failed, /offline/);
const retry = loadSummonImage(failedUrl);
assert.equal(calls.filter(c => c.url === failedUrl).length, 2, "失敗は次の召喚で再試行できる");
calls.at(-1).resolve();
await retry;
for (const world of ["sea", "forest", "ice"]) {
  const image = loadSummonImage(summonAssetUrls(world)[0]);
  calls.at(-1).resolve();
  await image;
}
const before = calls.length;
await loadSummonImage(url);
assert.equal(calls.length, before, "デコードの上限を越えても圧縮素材は再利用する");
assert.equal(decodes, 6, "4画像を超えた古いデコードだけを解放する");
console.log("召喚の先読み: 2並列・中止・要求/デコード共有・失敗再試行・メモリ上限: OK");
