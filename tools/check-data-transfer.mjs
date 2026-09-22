// データ管理・データ引き継ぎ(2026-09-17)の検査。
//   1. 控えの作り: 端末の記録を1本にまとめ、戻すと元どおり。版が違う控えは読まない
//   2. 大きさの上限が、端末側とサーバー側で同じ
//   3. サーバーの預かり: uid ごとに最新の1件、大きすぎるものは断る、記録を消すと一緒に消える
//   4. 画面の配線: タイトルに2つの入り口、引き継ぎは Apple、消すのは既存の DeleteMeModal
import assert from "node:assert/strict";
import fs from "node:fs";

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};

const { BACKUP_MAX, BACKUP_VERSION, exportLocalData, importLocalData } = await import("../src/net/backup.js");
const { BACKUP_MAX: SERVER_MAX, Wallet } = await import("../src/server/wallet.js");
const { BACKUP_BODY_MAX } = await import("../src/server/worker.js");
const { loadProfile, saveName, recordGame } = await import("../src/game/profile.js");
const { getCollection, updateCollection } = await import("../src/skins/store.js");

// 2. 上限
assert.equal(BACKUP_MAX, SERVER_MAX, "控えの上限は端末とサーバーで同じ");
assert.ok(BACKUP_BODY_MAX > BACKUP_MAX, "本文の上限は控えより広い(JSON の外枠のぶん)");

// 1. 控えの作り
{
  saveName("ひきつぎ");
  recordGame(true, { foeRating: 1500, kingRank: "2" });
  await updateCollection((s) => ({ ...s, tickets: 7, ether: 30 }));
  const before = loadProfile();
  const blob = exportLocalData();
  assert.ok(blob && blob.length < BACKUP_MAX, `控えが作れる(${blob.length}字)`);
  const parsed = JSON.parse(blob);
  assert.equal(parsed.v, BACKUP_VERSION);
  assert.equal(parsed.profile.name, "ひきつぎ");
  assert.equal(parsed.collection.tickets, 7);
  // 別の端末のつもりで、まっさらにしてから戻す
  for (const k of Object.keys(store)) delete store[k];
  assert.ok(!loadProfile().name, "まっさら");
  assert.equal(await importLocalData(blob, "uid-new"), true);
  const after = loadProfile();
  assert.equal(after.name, "ひきつぎ");
  assert.equal(after.xp, before.xp, "経験値(レベル)も戻る");
  assert.equal(after.rating, before.rating, "持ち点も戻る");
  assert.equal(after.plays, before.plays);
  assert.equal(after.id, "uid-new", "口座の id はいまのものにそろえる");
  assert.equal(getCollection().tickets, 7, "持ち物も戻る");
  // 壊れた控え・知らない版は読まない
  assert.equal(await importLocalData("{", "u"), false);
  assert.equal(await importLocalData(JSON.stringify({ v: 999, profile: {} }), "u"), false);
  assert.equal(await importLocalData(JSON.stringify({ v: BACKUP_VERSION }), "u"), false);
}

// 3. サーバーの預かり
{
  const rows = { profile_backups: new Map() };
  // 本物の Wallet は SQL を使う。ここでは預かりの3つの命令だけを見る小さな模型で代える
  const sql = (q, ...a) => {
    if (/CREATE|INDEX/i.test(q)) return [];
    if (/INSERT OR REPLACE INTO profile_backups/.test(q)) {
      rows.profile_backups.set(a[0], { blob: a[1], at: a[2] });
      return [];
    }
    if (/SELECT blob, at FROM profile_backups/.test(q)) {
      const r = rows.profile_backups.get(a[0]);
      return r ? [r] : [];
    }
    if (/DELETE FROM profile_backups/.test(q)) {
      rows.profile_backups.delete(a[0]);
      return [];
    }
    return [];
  };
  const w = new Wallet(sql);
  assert.deepEqual(w.loadBackup("u1"), { blob: null, at: null }, "まだ預けていない");
  assert.deepEqual(w.saveBackup("u1", "aaa", 100), { ok: true, at: 100 });
  assert.deepEqual(w.loadBackup("u1"), { blob: "aaa", at: 100 });
  w.saveBackup("u1", "bbb", 200);
  assert.equal(w.loadBackup("u1").blob, "bbb", "最新の1件だけ");
  assert.equal(w.saveBackup("u1", "x".repeat(BACKUP_MAX + 1), 300).ok, false, "大きすぎる控えは断る");
  assert.equal(w.saveBackup("u1", "", 300).ok, false);
  assert.equal(w.saveBackup("u1", 5, 300).ok, false);
  assert.equal(w.loadBackup("u1").blob, "bbb", "断っても前の控えは残る");
  w.forget("u1");
  assert.equal(w.loadBackup("u1").blob, null, "記録を消すと控えも消える");
}

// 4. 画面の配線
{
  const screens = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  assert.ok(/<TitleDataBar \/>/.test(screens), "タイトルに入り口を出す");
  const head = screens.slice(screens.indexOf("export function HomeScreen"), screens.indexOf("export function HomeScreen") + 900);
  assert.ok(head.includes("<TitleDataBar />"), "出すのはタイトル(HomeScreen)");
  const ui = fs.readFileSync(new URL("../src/ui/title-data.jsx", import.meta.url), "utf8");
  for (const label of ["データ管理", "データ引き継ぎ", "プレイヤーID", "アカウント削除"])
    assert.ok(ui.includes(label), `「${label}」がある`);
  assert.ok(/signInWithApple/.test(ui), "引き継ぎは Apple ID");
  assert.ok(/restoreFromServer/.test(ui), "預けた控えから戻す");
  assert.ok(/DeleteMeModal/.test(ui), "消すのは既存の画面を使う(道を2つ作らない)");
  assert.ok(/backupIfDue\(\)\.catch/.test(screens), "起動のたびに控えを預け直す");
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  // 台帳へ載せる直後に預け直す。渡す変数の名前は変わりうるので名前で縛らない
  // (熟練度を足したとき publishPlayer(after) → publishPlayer(withMastery) になった)
  assert.ok(/publishPlayer\([A-Za-z_$][\w$]*\);[\s\S]{0,200}backupIfDue\(\)\.catch/.test(game), "1局終えるたびにも預け直す");
  const worker = fs.readFileSync(new URL("../src/server/worker.js", import.meta.url), "utf8");
  assert.ok(/wop === "backup-save"/.test(worker) && /wop === "backup-load"/.test(worker), "Worker に預かりの口");
  assert.ok(/backup-save"\s*\n?\s*\? BACKUP_BODY_MAX/.test(worker.replace(/\s+/g, (m) => (m.includes("\n") ? "\n" : " "))) || /BACKUP_BODY_MAX/.test(worker), "控えの本文の上限を広げる");
}
console.log("データ管理・引き継ぎ: 控えの作り・上限・サーバーの預かり・配線 OK");
