/**
 * 記録を消したら、**端末に残ったものが全部消える**ことを確かめる
 * (2026-09-28 本人の報告「アカウントを消しても、以前に引いたガチャ結果が残ったまま」)。
 *
 * いちばん大事なのは「鍵を数え上げない」こと。保存する場所が増えるたびに
 * 消し忘れるので、`tottery.` で始まる鍵を全部消す形になっているかを見る。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function memStore(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}
const put = (name, v) =>
  Object.defineProperty(globalThis, name, { value: v, configurable: true, writable: true });

let ok = 0;
const fail = [];
const is = (label, got, want) => {
  try {
    assert.deepEqual(got, want);
    ok++;
    console.log(`  ok   ${label}`);
  } catch {
    fail.push(label);
    console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
  }
};

// 本物の鍵を、ソースから集める(数え上げないための裏付け)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (/ \d+(\.[^.]+)?$/.test(e.name)) continue;
    const at = path.join(dir, e.name);
    if (e.isDirectory()) walk(at, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(at);
  }
  return out;
}
const KEYS = [
  ...new Set(
    walk(path.join(root, "src"))
      .flatMap((f) => fs.readFileSync(f, "utf8").match(/"tottery\.[\w.-]+"/g) || [])
      .map((s) => s.slice(1, -1)),
  ),
].sort();

console.log(`ソースから集めた鍵 ${KEYS.length} 個`);
assert.ok(KEYS.length >= 20, `十分な数が見つかる(${KEYS.length})`);
assert.ok(KEYS.includes("tottery.skins.v1"), "スキンの所持が入っている");
assert.ok(KEYS.includes("tottery.account.v1"), "名前と戦績が入っている");

const local = memStore(Object.fromEntries(KEYS.map((k) => [k, "x"])));
const session = memStore({ "tottery.match-ratings.v2": "x" });
put("localStorage", local);
put("sessionStorage", session);
// 関係ない鍵は触らない
local.setItem("よそのアプリ", "のこす");
session.setItem("other.app", "のこす");

const { forgetEverything, leftovers, STORAGE_PREFIX } = await import("../src/game/forget.js");

console.log("\n全部消す");
is("印は tottery.", STORAGE_PREFIX, "tottery.");
const removed = forgetEverything();
is("ソースにある鍵を全部消す", KEYS.every((k) => !KEYS.filter((x) => local.getItem(x) !== null).length), true);
is("消し残りは無い", leftovers(), []);
is("消した数", removed.length >= KEYS.length, true);
is("sessionStorage も消す", session.getItem("tottery.match-ratings.v2"), null);
is("よそのアプリの鍵は残す", local.getItem("よそのアプリ"), "のこす");
is("よそのアプリの鍵は残す(session)", session.getItem("other.app"), "のこす");

console.log("\n触れない端末でも落ちない");
{
  put("localStorage", {
    get length() {
      throw new Error("読めない");
    },
    removeItem: () => {},
  });
  put("sessionStorage", undefined);
  is("例外を投げない", Array.isArray(forgetEverything()), true);
}
put("localStorage", memStore());
put("sessionStorage", memStore());

console.log("\n配線");
{
  const ui = fs.readFileSync(path.join(root, "src/ui/overlays.jsx"), "utf8");
  is("記録を消すときに呼ぶ", /forgetMe\(\);\s*(\/\/[^\n]*\n\s*)*forgetEverything\(\);/.test(ui), true);
  is(
    "消えるものを画面に並べる(スキンと財布も)",
    /delete-me-list/.test(ui) && /引いたスキン・ガチャチケット・ジェム/.test(ui),
    true,
  );
  is("消したら開き直す", /onDeleted=\{\(\) => location\.reload\(\)\}/.test(ui), true);
  const title = fs.readFileSync(path.join(root, "src/ui/title-data.jsx"), "utf8");
  is("タイトルの「データ管理」からも同じ", /onDeleted=\{\(\) => location\.reload\(\)\}/.test(title), true);
}

console.log("\n相手が見つかったときの手ごたえ(2026-09-28 本人の指示)");
{
  const { PATTERNS } = await import("../src/game/haptics.js");
  is("専用の型がある", !!PATTERNS.matchFound, true);
  is("知らせの型(対局中の取りの震えと混ざらない)", PATTERNS.matchFound.kind, "notification");
  is(
    "取りの型とは違う",
    PATTERNS.matchFound.type !== PATTERNS.king.type &&
      PATTERNS.matchFound.type !== PATTERNS.kingLost.type,
    true,
  );
  const screens = fs.readFileSync(path.join(root, "src/ui/screens.jsx"), "utf8");
  is("人と組めたときに震える", /vibrateMatchFound\(\);\s*return roomReady/.test(screens), true);
  is("練習相手でも震える", /vibrateMatchFound\(\);\s*return botReady/.test(screens), true);
  is(
    "Bot を出すかの判定は元の prop で決める(包んだ側ではない)",
    /useRef\(botReady \? botPlan\(myRating\(\)\) : "none"\)/.test(screens),
    true,
  );
}

console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
