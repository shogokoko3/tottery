import fs from "node:fs";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
const traverse = _traverse.default || _traverse;
const code = fs.readFileSync(process.argv[2], "utf8");
const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
const lines = code.split("\n");
traverse(ast, {
  FunctionDeclaration(path) {
    const n = path.node;
    const p = n.params[0];
    let props = "";
    if (p && p.type === "ObjectPattern")
      props = p.properties.map((q) => (q.type === "RestElement" ? "..." : q.key.name || q.key.value)).join(", ");
    else props = n.params.map(() => "_").join(", ");
    const start = n.loc.start.line;
    const seg = lines.slice(start - 1, n.loc.end.line).join(" ");
    const cls = (seg.match(/className="([^"]{3,40})"/) || [])[1] || "";
    const jp = (seg.match(/"([ぁ-んァ-ヶ一-龠][^"]{2,24})"/) || [])[1] || "";
    console.log(`${String(start).padStart(5)}  ${n.id.name.padEnd(4)} (${props})`.padEnd(62) + `${cls}  ${jp}`);
  },
});
