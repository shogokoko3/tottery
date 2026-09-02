import fs from "node:fs";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default || _traverse;
const code = fs.readFileSync(process.argv[2], "utf8");
const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
const lines = code.split("\n");
traverse(ast, {
  Program(path) {
    // IIFE の中身をトップレベルとみなす
    const body = path.node.body;
    const walk = (stmts) => {
      for (const s of stmts) {
        if (s.type === "FunctionDeclaration") {
          const ln = s.loc.start.line;
          const hint = (lines.slice(ln - 1, ln + 6).join(" ").match(/className="([a-z0-9 -]+)"|"([^"]{4,40})"/) || [])[0] || "";
          console.log(`${String(ln).padStart(5)}  fn   ${s.id.name.padEnd(6)} (${s.params.length}引数)  ${hint.slice(0, 60)}`);
        } else if (s.type === "VariableDeclaration") {
          for (const d of s.declarations) {
            if (d.id.type === "Identifier")
              console.log(`${String(s.loc.start.line).padStart(5)}  var  ${d.id.name}`);
          }
        } else if (s.type === "ExpressionStatement" && s.expression.type === "CallExpression") {
          const c = s.expression.callee;
          if (c.type === "ArrowFunctionExpression" && c.body.type === "BlockStatement") walk(c.body.body);
        }
      }
    };
    walk(body);
    path.stop();
  },
});
