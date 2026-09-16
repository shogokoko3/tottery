/**
 * 課金の口を「iOS ネイティブのふり」で通す検査。
 * Capacitor のプラグインは Proxy で、then までメソッドとして返す。async 関数からそのまま
 * 返すと thenable 扱いで永遠に戻らない(2026-09-15、店が「読み込んでいます…」から進まなかった原因)。
 * ここでは iap.js を esbuild で束ね、@capacitor/core を偽物に差し替えて、
 *  - 商品の問い合わせが実際にプラグインまで届く(then で止まらない)
 *  - 失敗はそのまま呼ぶ側へ返る(1秒以内)
 * を確かめる。
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stubs = path.join(root, "tools", "stubs");
const entry = `
import { loadProducts, currentLoadStage, storeDiagnostics } from "./src/net/iap.js";
globalThis.__iap = { loadProducts, currentLoadStage, storeDiagnostics };
`;
const r = await esbuild.build({
  stdin: { contents: entry, resolveDir: root, loader: "js" },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"', __APP_BUILD__: "7" },
  loader: { ".webp": "dataurl", ".png": "dataurl", ".m4a": "dataurl", ".svg": "dataurl", ".css": "text" },
  logLevel: "silent",
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: path.join(stubs, "capacitor-core-native.js") }));
        b.onResolve({ filter: /\/net\/auth\.js$/ }, () => ({ path: "auth", namespace: "stub" }));
        b.onResolve({ filter: /\/net\/season\.js$/ }, () => ({ path: "season", namespace: "stub" }));
        b.onResolve({ filter: /\/skins\/store\.js$/ }, () => ({ path: "store", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
          contents:
            a.path === "auth"
              ? "export async function ensureAuth(){return null}"
              : a.path === "season"
                ? "export function seasonApiBase(){return ''}"
                : "export async function updateCollection(){}",
          loader: "js",
        }));
      },
    },
  ],
});
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis;
new Function(r.outputFiles[0].text)();
const iap = globalThis.__iap;

const within = (p, ms) =>
  Promise.race([p, new Promise((_r, rej) => setTimeout(() => rej(new Error(`${ms}ms 待っても戻らない`)), ms))]);

// 1) 失敗はそのまま返る(then で止まらない)
globalThis.__pluginCalls = [];
globalThis.__pluginImpl = { getProducts: async () => { throw new Error("stub: 商品なし"); } };
await assert.rejects(within(iap.loadProducts(), 1000), /stub: 商品なし/, "失敗が1秒以内に呼ぶ側へ返る");
assert.ok(globalThis.__pluginCalls.includes("NativePurchases.getProducts"), "問い合わせがプラグインまで届く");
assert.ok(!globalThis.__pluginCalls.some((c) => c.endsWith(".then")), "プラグインの then を呼んでいない(呼ぶと永遠に待つ)");
assert.equal(iap.currentLoadStage(), "問い合わせに失敗");

// 2) 応答があれば商品になる(表示価格は StoreKit のもの)
globalThis.__pluginImpl = {
  getProducts: async () => ({ products: [{ identifier: "com.shogokoko.tottery.gems.150", priceString: "¥150", title: "150ジェム" }] }),
  getStorefront: async () => ({ countryCode: "JPN" }),
};
const got = await within(iap.loadProducts(), 1000);
assert.equal(got.length, 1);
assert.equal(got[0].price, "¥150");
assert.match(iap.currentLoadStage(), /応答あり\(1件\)/);
const d = await within(iap.storeDiagnostics(123), 1000);
assert.deepEqual(d, { build: 7, storefront: "JPN", elapsedMs: 123 });

console.log("課金の口(ネイティブのふり): プラグインの then で止まらない・失敗は1秒で返る・商品と診断 OK");
