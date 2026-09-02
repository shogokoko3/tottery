/**
 * コンパイル済みの jsx ランタイム呼び出しを、本来の JSX 記法へ戻す。
 *
 *   (0, c.jsx)("div", { className: "x", children: y })  →  <div className="x">{y}</div>
 *
 * 手で 3000 行以上を書き換えると必ず取りこぼすので、ここだけは機械にやらせる。
 */
import fs from "node:fs";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";

const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("使い方: node tools/dejsx.mjs <入力.js> <出力.jsx>");
  process.exit(1);
}

const code = fs.readFileSync(inPath, "utf8");
const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });

/** (0, c.jsx) / c.jsx / c.jsxs の呼び出しかどうか */
function jsxCallKind(node) {
  let callee = node.callee;
  if (t.isSequenceExpression(callee) && callee.expressions.length === 2) callee = callee.expressions[1];
  if (!t.isMemberExpression(callee) || callee.computed) return null;
  const name = callee.property.name;
  if (name === "jsx" || name === "jsxs" || name === "jsxDEV") return { name, obj: callee.object };
  return null;
}

function isFragment(node, runtimeObj) {
  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    node.property.name === "Fragment" &&
    t.isIdentifier(node.object) &&
    t.isIdentifier(runtimeObj) &&
    node.object.name === runtimeObj.name
  );
}

/** 要素名。小文字始まりの文字列リテラルはそのままタグ、識別子はコンポーネント */
function toElementName(node) {
  if (t.isStringLiteral(node)) return t.jsxIdentifier(node.value);
  if (t.isIdentifier(node)) return t.jsxIdentifier(node.name);
  if (t.isMemberExpression(node) && !node.computed) {
    const obj = toElementName(node.object);
    if (!obj) return null;
    return t.jsxMemberExpression(obj, t.jsxIdentifier(node.property.name));
  }
  return null;
}

/** 属性値を JSX の形に。文字列はそのまま、それ以外は {} で包む */
function toAttrValue(node) {
  if (t.isStringLiteral(node) && !node.value.includes("\n")) return t.stringLiteral(node.value);
  return t.jsxExpressionContainer(node);
}

/** children を JSX の子要素列に */
function toChildren(node) {
  const list = t.isArrayExpression(node) ? node.elements : [node];
  const out = [];
  for (const child of list) {
    if (child == null) continue;
    if (t.isStringLiteral(child) && !/[{}<>]/.test(child.value)) {
      out.push(t.jsxText(child.value));
    } else if (t.isJSXElement(child) || t.isJSXFragment(child)) {
      out.push(child);
    } else if (t.isSpreadElement(child)) {
      out.push(t.jsxExpressionContainer(t.arrayExpression([child])));
    } else {
      out.push(t.jsxExpressionContainer(child));
    }
  }
  return out;
}

let converted = 0;
let skipped = 0;

traverse(ast, {
  CallExpression: {
    exit(path) {
      const kind = jsxCallKind(path.node);
      if (!kind) return;
      const args = path.node.arguments;
      if (args.length < 2 || !t.isObjectExpression(args[1])) { skipped++; return; }

      const [typeArg, propsArg] = args;
      const frag = isFragment(typeArg, kind.obj);
      const name = frag ? null : toElementName(typeArg);
      if (!frag && !name) { skipped++; return; }

      const attrs = [];
      let children = null;
      let bail = false;

      for (const prop of propsArg.properties) {
        if (t.isSpreadElement(prop)) {
          attrs.push(t.jsxSpreadAttribute(prop.argument));
          continue;
        }
        if (!t.isObjectProperty(prop) || prop.computed) { bail = true; break; }
        const key = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : null;
        if (key == null) { bail = true; break; }
        if (key === "children") { children = prop.value; continue; }
        if (!/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key)) { bail = true; break; }
        attrs.push(t.jsxAttribute(t.jsxIdentifier(key), toAttrValue(prop.value)));
      }
      if (bail) { skipped++; return; }

      // key は第3引数で渡ってくる
      if (args[2] && !t.isNullLiteral(args[2]) && !(t.isIdentifier(args[2]) && args[2].name === "undefined")) {
        attrs.push(t.jsxAttribute(t.jsxIdentifier("key"), toAttrValue(args[2])));
      }

      const kids = children == null ? [] : toChildren(children);

      let el;
      if (frag) {
        el = t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), kids);
      } else {
        const selfClosing = kids.length === 0;
        el = t.jsxElement(
          t.jsxOpeningElement(name, attrs, selfClosing),
          selfClosing ? null : t.jsxClosingElement(name),
          kids,
          selfClosing,
        );
      }
      path.replaceWith(el);
      converted++;
    },
  },
});

const out = generate(ast, { retainLines: false, jsescOption: { minimal: true } }, code).code;
fs.writeFileSync(outPath, out);
console.log(`JSXに戻した呼び出し: ${converted} 件 / 変換できず残した呼び出し: ${skipped} 件`);
console.log(`出力: ${outPath} (${out.split("\n").length} 行)`);
