// Capacitor can print a copy failure without returning a failing exit code.
// Never archive stale web code or a partially copied asset directory.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const source = "dist", target = process.argv[2] || "ios/App/App/public";
const digest = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const before = JSON.parse(fs.readFileSync(`${source}/build-info.json`, "utf8"));
const after = JSON.parse(fs.readFileSync(`${target}/build-info.json`, "utf8"));
assert.deepEqual(after, before, "iOS web build metadata differs from dist");
assert.equal(digest(`${target}/index.html`), digest(`${source}/index.html`), "iOS index.html differs from dist");
const excluded = new Set(["admin.html", "_headers", "_redirects"]);
let files = 0;
function check(dir = "") {
  for (const entry of fs.readdirSync(path.join(source, dir), { withFileTypes: true })) {
    if (/ \d+(\.[^.]+)?$/.test(entry.name)) continue;
    const relative = path.join(dir, entry.name);
    if (excluded.has(relative)) continue;
    if (entry.isDirectory()) check(relative);
    else {
      assert.ok(fs.existsSync(path.join(target, relative)), `Missing iOS asset: ${relative}`);
      assert.equal(fs.statSync(path.join(target, relative)).size, fs.statSync(path.join(source, relative)).size, `Incomplete iOS asset: ${relative}`);
      files++;
    }
  }
}
check();
console.log(`iOS web sync verified: build ${after.build}, code ${after.codeHash}, ${files} files`);
