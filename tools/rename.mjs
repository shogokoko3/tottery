/**
 * 圧縮された識別子を、読める名前へ戻す。
 *
 *  1. name-map.json のトップレベル名を、スコープを見ながら置換する
 *  2. 分割代入した props は、キー名がそのまま良い変数名なので自動で合わせる
 *     ({ rank: e, suit: t }) → ({ rank, suit })
 */
import fs from "node:fs";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

const [, , inPath, outPath, mapPath] = process.argv;
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const code = fs.readFileSync(inPath, "utf8");
const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });

let renamedTop = 0;
let renamedProps = 0;
const unresolved = [];

// --- 0. 束縛のない自由識別子（別ファイル由来の名前）---
// アイコンや画像マップは元バンドルの別セクションで宣言されているため
// スコープを持たない。名前で直接置き換える。
let renamedFree = 0;
const freeSeen = new Set();
traverse(ast, {
  Identifier(path) {
    const to = map[path.node.name];
    if (!to || !path.isReferencedIdentifier()) return;
    if (path.scope.getBinding(path.node.name)) return;
    freeSeen.add(path.node.name);
    path.node.name = to;
    renamedFree++;
  },
  JSXIdentifier(path) {
    const to = map[path.node.name];
    if (!to) return;
    if (path.parent.type === "JSXAttribute") return;
    if (path.scope.getBinding(path.node.name)) return;
    freeSeen.add(path.node.name);
    path.node.name = to;
    renamedFree++;
  },
});

// --- 1. トップレベル名 ---
traverse(ast, {
  Scopable(path) {
    for (const [oldName, newName] of Object.entries(map)) {
      const binding = path.scope.getOwnBinding ? path.scope.getOwnBinding(oldName) : null;
      if (!binding) continue;
      if (path.scope.hasBinding(newName, true)) continue;
      path.scope.rename(oldName, newName);
      renamedTop++;
    }
  },
});

// --- 2. 分割代入した props ---
traverse(ast, {
  ObjectPattern(path) {
    for (const prop of path.node.properties) {
      if (prop.type !== "ObjectProperty" || prop.computed) continue;
      const key = prop.key.name || prop.key.value;
      if (!key || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) continue;
      let valueNode = prop.value;
      if (valueNode.type === "AssignmentPattern") valueNode = valueNode.left;
      if (valueNode.type !== "Identifier") continue;
      const cur = valueNode.name;
      if (cur === key) continue;
      // 短い圧縮名だけを対象にする（意味のある名前は触らない）
      if (cur.length > 2) continue;
      const scope = path.scope;
      if (scope.hasBinding(key, true)) { unresolved.push(`${cur} → ${key}`); continue; }
      scope.rename(cur, key);
      renamedProps++;
    }
  },
});

// --- 3. { rank: rank } を { rank } に畳む ---
traverse(ast, {
  ObjectProperty(path) {
    const { key, value } = path.node;
    if (path.node.computed) return;
    const k = key.name || key.value;
    if (value.type === "Identifier" && value.name === k) path.node.shorthand = true;
    else if (value.type === "AssignmentPattern" && value.left.type === "Identifier" && value.left.name === k)
      path.node.shorthand = true;
  },
});

const out = generate(ast, { retainLines: false, jsescOption: { minimal: true } }, code).code;
fs.writeFileSync(outPath, out);
if (renamedFree) console.log(`外部由来の名前: ${renamedFree} 箇所 (${[...freeSeen].length} 種)`);
console.log(`トップレベル名: ${renamedTop} 件`);
console.log(`props 由来の変数名: ${renamedProps} 件`);
if (unresolved.length) console.log(`名前が衝突して見送り: ${unresolved.length} 件 (${unresolved.slice(0, 8).join(", ")})`);
console.log(`出力: ${outPath}`);
