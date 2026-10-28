// Production Swift rendering/lifecycle test. Requires macOS/Xcode.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { TRACKS } from "../src/audio/tracks.js";
import { SOUNDS } from "../src/audio/sounds.js";
import { TONAL_ASSETS } from "../src/audio/tonal-cues.js";
import { AUXILIARY_SOUNDS } from "../src/audio/auxiliary-sounds.js";
const temp=fs.mkdtempSync(path.join(os.tmpdir(),"tottery-native-game-"));
fs.mkdirSync("reports/native-game-audio-20261028",{recursive:true});
try {
 fs.writeFileSync(path.join(temp,"assets.json"),JSON.stringify({tracks:Object.values(TRACKS),effects:[...new Set([...Object.values(SOUNDS),...TONAL_ASSETS,...Object.values(AUXILIARY_SOUNDS)].map(x=>x.file))]}));
 fs.copyFileSync("tools/check-native-game-audio.swift",path.join(temp,"main.swift"));
 for(const [command,args] of [["xcrun",["swiftc","ios/App/App/NativeHomeMusicEngine.swift","ios/App/App/NativeGameAudio.swift",path.join(temp,"main.swift"),"-o",path.join(temp,"check")]],[path.join(temp,"check"),[process.cwd(),path.join(temp,"assets.json")]]]) {
  const r=spawnSync(command,args,{encoding:"utf8",maxBuffer:1024*1024*4});
  assert.equal(r.status,0,r.stderr||r.stdout||r.error?.message);if(r.stdout)process.stdout.write(r.stdout);
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}
