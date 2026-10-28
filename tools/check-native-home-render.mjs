// macOS/Xcode verification of the production native engine, without a speaker.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tottery-native-home-"));
fs.mkdirSync("reports/native-home-bgm-20261028", { recursive: true });
try {
  const main = path.join(temp, "main.swift"), binary = path.join(temp, "check");
  fs.copyFileSync("tools/check-native-home-render.swift", main);
  for (const [command, args] of [
    ["xcrun", ["swiftc", "ios/App/App/NativeHomeMusicEngine.swift", main, "-o", binary]],
    [binary, [process.cwd()]],
  ]) {
    const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
    if (result.stdout) process.stdout.write(result.stdout);
  }
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
