// Exercise the production Swift state with WebKit's counted suspensions.
// macOS/Xcode only; the portable JS audio checks remain in npm run check.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const source=fs.readFileSync('ios/App/App/SceneDelegate.swift','utf8');
const begin=source.indexOf('struct GameMediaLifecycle {');
const end=source.indexOf('\nclass SceneDelegate:');
assert.ok(begin>=0 && end>begin);
const production=source.slice(begin,end);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tottery-audio-lifecycle-'));
try {
 const test=`
func require(_ value: Bool, _ message: String) {
    if !value { fatalError(message) }
}
var lifecycle = GameMediaLifecycle()
var webKitSuspensionCount = 0
func inactive() {
    if lifecycle.suspend() { webKitSuspensionCount += 1 }
}
func active() -> Int? {
    let revision = lifecycle.resume()
    if revision != nil { webKitSuspensionCount -= 1 }
    return revision
}
require(active() == nil, "Initial foreground must not release an unowned suspension")
require(webKitSuspensionCount == 0, "Initial suspension balance")
for _ in 0..<50 {
    inactive() // sceneWillResignActive
    inactive() // sceneDidEnterBackground
    require(webKitSuspensionCount == 1, "Duplicate pause must not nest native suspension")
    let revision = active()!
    require(webKitSuspensionCount == 0, "One foreground event must restore playback")
    require(lifecycle.acceptsResume(revision), "Current completion may resume JS music")
}
inactive()
let outdated = active()!
inactive() // Background again before the first completion is delivered.
require(!lifecycle.acceptsResume(outdated), "Old resume must not play in background")
inactive()
let current = active()!
require(!lifecycle.acceptsResume(outdated), "Outdated completion remains ignored")
require(lifecycle.acceptsResume(current), "Latest foreground may resume")
require(webKitSuspensionCount == 0, "Rapid switches must balance native suspensions")
require(active() == nil, "Duplicate active must not release another subsystem's suspension")
require(webKitSuspensionCount == 0, "No extra native resume")
print("iOS media lifecycle: duplicate background, paired suspension, 50 resumes, rapid switches and stale completion PASS")
`;
 const main=path.join(temp,'main.swift'),binary=path.join(temp,'check');
 fs.writeFileSync(main,production+test);
 for(const [command,args] of [['xcrun',['swiftc',main,'-o',binary]],[binary,[]]]) {
  const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:1024*1024});
  assert.equal(r.status,0,r.stderr || r.stdout || r.error?.message);
  if(r.stdout)process.stdout.write(r.stdout);
 }
} finally {fs.rmSync(temp,{recursive:true,force:true});}
