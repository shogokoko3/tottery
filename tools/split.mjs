/**
 * 復元した1枚岩の app.named.jsx を、計画に沿って src/ 以下へ分割する。
 * 参照している名前を数えて import を自動生成するので、書き忘れが起きない。
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";

const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

const GLOBALS = new Set([
  "Array", "Object", "Math", "Date", "Promise", "Set", "Map", "String", "Number", "Boolean",
  "JSON", "Error", "RegExp", "Symbol", "console", "window", "document", "navigator", "fetch",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask", "requestAnimationFrame",
  "localStorage", "sessionStorage", "URL", "Infinity", "NaN", "undefined", "globalThis",
]);
const ICONS = new Set(["ArrowLeft", "ArrowRight", "Check", "Close", "Crown", "Dice", "DoorIn", "DoorOut", "Flag", "Globe", "Grid", "IconBase", "Info", "Play", "RotateCcw", "Settings", "Shuffle", "Sparkle", "Users"]);
const ASSETS = new Set(["CAPTAIN_CARD_ART", "NORMAL_CARD_ART", "cardBackImg", "dieImg", "titleBgImg", "winKingCardImg"]);

const cfg = JSON.parse(fs.readFileSync("tools/split-plan.json", "utf8"));
const code = fs.readFileSync("reference/app.named.jsx", "utf8");
const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });

/* --- IIFE 直下の宣言を集める --- */
const decls = new Map(); // name -> node
let topBody = null;
traverse(ast, {
  Program(p) {
    for (const s of p.node.body) {
      if (s.type === "ExpressionStatement" && s.expression.type === "CallExpression") {
        const c = s.expression.callee;
        if (c.type === "ArrowFunctionExpression" && c.body.type === "BlockStatement") topBody = c.body.body;
      }
    }
    p.stop();
  },
});
if (!topBody) throw new Error("IIFE が見つかりません");

for (const s of topBody) {
  if (s.type === "FunctionDeclaration") decls.set(s.id.name, s);
  else if (s.type === "VariableDeclaration")
    for (const d of s.declarations)
      if (d.id.type === "Identifier")
        decls.set(d.id.name, t.variableDeclaration("const", [d]));
}

/* --- 各名前がどのモジュールに行くか --- */
const owner = new Map();
for (const [file, names] of Object.entries(cfg.plan)) for (const n of names) owner.set(n, file);

const REACT_HOOKS = new Set(["useState", "useEffect", "useRef", "useMemo", "useCallback", "useReducer"]);

function relSpecifier(fromFile, toFile) {
  const rel = path.relative(path.dirname(fromFile), toFile).replace(/\\/g, "/");
  return rel.startsWith(".") ? rel : "./" + rel;
}

let filesWritten = 0;
for (const [file, names] of Object.entries(cfg.plan)) {
  const nodes = names.map((n) => {
    if (!decls.has(n)) throw new Error(`宣言が見つかりません: ${n}`);
    return decls.get(n);
  });

  // このファイルだけを持つプログラムを作り、参照を解析する
  const program = t.file(t.program(nodes.map((n) => t.exportNamedDeclaration(n, []))));
  const hooks = new Set();
  const needed = new Set();
  const defined = new Set(names);

  traverse(program, {
    // C.useState → useState に直す
    MemberExpression(p) {
      const { object, property } = p.node;
      if (t.isIdentifier(object, { name: "C" }) && t.isIdentifier(property) && REACT_HOOKS.has(property.name)) {
        hooks.add(property.name);
        p.replaceWith(t.identifier(property.name));
      }
    },
  });
  traverse(program, {
    Identifier(p) {
      if (!p.isReferencedIdentifier()) return;
      const name = p.node.name;
      if (defined.has(name) || p.scope.hasBinding(name, true) || GLOBALS.has(name)) return;
      needed.add(name);
    },
    JSXIdentifier(p) {
      if (p.parent.type === "JSXAttribute" || p.parent.type === "JSXClosingElement") return;
      const name = p.node.name;
      if (/^[a-z]/.test(name)) return; // 素のHTMLタグ
      if (defined.has(name)) return;
      needed.add(name);
    },
  });

  // import をまとめる
  const byModule = new Map();
  const unknown = [];
  for (const name of [...needed].sort()) {
    if (REACT_HOOKS.has(name)) { hooks.add(name); continue; }
    let spec = null;
    if (cfg.external[name]) spec = cfg.moduleSpecifiers[cfg.external[name]];
    else if (owner.has(name)) spec = relSpecifier(file, owner.get(name));
    else if (ICONS.has(name)) spec = relSpecifier(file, "src/icons.jsx");
    else if (ASSETS.has(name)) spec = relSpecifier(file, "src/assets.js");
    if (!spec) { unknown.push(name); continue; }
    if (!byModule.has(spec)) byModule.set(spec, new Set());
    byModule.get(spec).add(name);
  }

  const lines = [];
  const styleSpec = byModule.has(cfg.moduleSpecifiers.styles) ? cfg.moduleSpecifiers.styles : null;
  if (styleSpec) byModule.delete(styleSpec);
  if (hooks.size) lines.push(`import { ${[...hooks].sort().join(", ")} } from "react";`);
  for (const [spec, set] of [...byModule].sort())
    lines.push(`import { ${[...set].sort().join(", ")} } from "${spec}";`);
  if (styleSpec) lines.push(`import STYLES from "${styleSpec}";`);
  if (unknown.length) lines.push(`// TODO 未解決の参照: ${unknown.join(", ")}`);
  lines.push("");
  lines.push(generate(program.program, { jsescOption: { minimal: true } }, code).code);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join("\n") + "\n");
  console.log(`${file.padEnd(24)} ${names.length}個の宣言, import ${byModule.size}件` + (unknown.length ? `  ⚠ 未解決 ${unknown.length}` : ""));
  filesWritten++;
}
console.log(`\n${filesWritten} ファイルを書き出しました`);
