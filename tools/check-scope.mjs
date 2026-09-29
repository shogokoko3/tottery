/**
 * 束縛のない識別子を探す(2026-09-30)。
 *
 * 09-28 に、別の場所へ入れるはずの行がパッチで違う関数の中に落ち、
 * `row is not defined` で対局が開けない版が TestFlight と Web に出た(ce1e8e3 で修正)。
 * ビルド(esbuild)は構文しか見ないので通り、検査も文字列の有無しか見ていなかった。
 *
 * ここでは src/ の JS/JSX を @babel/parser で読み、**どのスコープにも束縛が無い
 * 参照**を数える。row / col / after のような「別の関数の引数」を持ち出した行は
 * ここで止まる。グローバル(window・document・JSON …)は決め打ちの表で除く。
 *
 * 見つけたら、その名前が本当に外側に無いかを人が見る。誤検出なら GLOBALS に足す。
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default || traverseModule;
const ROOT = new URL("../src/", import.meta.url);

/** ブラウザ・Node・言語の標準。ここに無い名前は、ファイルの中で束縛されていなければ NG */
const GLOBALS = new Set(
  `globalThis window document navigator location history screen console performance
   setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame
   queueMicrotask structuredClone fetch Request Response Headers URL URLSearchParams AbortController
   Blob File FileReader FormData TextEncoder TextDecoder Image Audio AudioContext webkitAudioContext
   HTMLElement HTMLInputElement HTMLCanvasElement Element Node Event CustomEvent KeyboardEvent
   PointerEvent MouseEvent TouchEvent StorageEvent MessageEvent ErrorEvent PromiseRejectionEvent
   localStorage sessionStorage indexedDB crypto atob btoa alert confirm prompt
   IntersectionObserver ResizeObserver MutationObserver matchMedia getComputedStyle devicePixelRatio
   innerWidth innerHeight WebSocket Worker DOMParser XMLSerializer Notification
   Object Array Function String Number Boolean Symbol BigInt Math JSON Date RegExp Error TypeError
   RangeError SyntaxError ReferenceError Promise Map Set WeakMap WeakSet WeakRef Proxy Reflect
   Intl parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI
   escape unescape Infinity NaN undefined arguments Uint8Array Uint16Array Uint32Array Int8Array
   Int16Array Int32Array Float32Array Float64Array ArrayBuffer DataView Iterator AsyncIterator
   process Buffer require module exports __dirname __filename import
   AbortSignal Path2D OffscreenCanvas ImageData DOMRect DOMMatrix
   React`.split(/\s+/).filter(Boolean),
);

/** 検査するファイル。サーバーとテスト用の道具は別の環境なので、ここでは src/ だけ */
function* walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(js|jsx|mjs)$/.test(name)) yield full;
  }
}

export function unboundIn(code, file = "<memory>") {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "importAttributes", "topLevelAwait"],
    errorRecovery: false,
  });
  const hits = [];
  traverse(ast, {
    Identifier(p) {
      if (!p.isReferencedIdentifier()) return;
      const name = p.node.name;
      if (GLOBALS.has(name)) return;
      // build.mjs の define(__APP_BUILD__ など)。束ねるときに文字どおり置き換わる
      if (/^__[A-Z0-9_]+__$/.test(name)) return;
      if (p.scope.hasBinding(name)) return;
      // JSX の <div> のような小文字のタグ名は識別子扱いにならないが念のため
      if (p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement()) return;
      hits.push({ file, name, line: p.node.loc?.start.line });
    },
  });
  return hits;
}

const srcDir = decodeURIComponent(ROOT.pathname);
let files = 0;
const all = [];
for (const f of walk(srcDir)) {
  files++;
  try {
    all.push(...unboundIn(fs.readFileSync(f, "utf8"), path.relative(path.dirname(srcDir), f)));
  } catch (e) {
    all.push({ file: path.relative(path.dirname(srcDir), f), name: "(構文エラー)", line: e.loc?.line, detail: e.message });
  }
}
console.log(`束縛のない識別子: ${files} ファイルを読んで ${all.length} 件`);
for (const h of all) console.log(`  NG   ${h.file}:${h.line}  ${h.name}${h.detail ? "  " + h.detail : ""}`);
if (all.length) {
  console.error("NG: 束縛のない識別子があります。別の関数の変数を持ち出していないか確かめてください");
  process.exit(1);
}
console.log("  ok   どのファイルにも、束縛のない参照はない");
