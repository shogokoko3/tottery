/** ランダムマッチの入口の条件(ストーリーのフェーズ1をクリアで開く。2026-09-30 本人の指示)を検査する */
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const { ONLINE_GATE_PHASE, NAME_SCREENS, nameWallReason, needsName, onlineGate, onlineGateLabel } = await import("../src/game/online-gate.js");
const { STORY_AXES } = await import("../src/game/phase.js");
const { loadProfile } = await import("../src/game/profile.js");
let ok = 0; const fails = [];
const is = (label, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) { ok++; console.log(`  ok   ${label}`); } else { fails.push(label); console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`); } };
const fresh = loadProfile();
const withStory = (p1, extra = {}) => ({ ...fresh, phase: 1, story: { 1: p1, 2: [], 3: [] }, ...extra });
is("条件はフェーズ1のストーリー", ONLINE_GATE_PHASE, 1);
is("新しい人はフェーズ1で閉じている", [fresh.phase, onlineGate(fresh).ok], [1, false]);
is("残りは7ステージ", onlineGate(fresh).remaining, 7);
is("次は 2・3", onlineGate(fresh).next, "23");
is("一言", onlineGateLabel(onlineGate(fresh)), "ストーリー フェーズ1のクリアで開きます（あと7ステージ）");
const six = withStory(STORY_AXES.slice(0, 6));
is("6ステージでは閉じている(あと1)", [onlineGate(six).ok, onlineGate(six).remaining], [false, 1]);
is("次は K", onlineGate(six).next, "k");
const gaps = withStory(["23", "45", "89", "10", "jq", "k"]);
is("順不同でも7ステージ全部が要る(6・7 が無ければ閉じる)", [onlineGate(gaps).ok, onlineGate(gaps).next], [false, "67"]);
const all = withStory([...STORY_AXES]);
is("7ステージで開く(昇格の前でも)", onlineGate(all).ok, true);
is("開いたら一言は無い", onlineGateLabel(onlineGate(all)), null);
is("フェーズ2 以上は開いている", [onlineGate({ ...fresh, phase: 2 }).ok, onlineGate({ ...fresh, phase: 3 }).ok], [true, true]);
is("フェーズ2・3 のクリアは条件にしない", onlineGate(withStory([], { story: { 1: [], 2: [...STORY_AXES], 3: [...STORY_AXES] } })).ok, false);
is("チュートリアルを全部終えても開かない(ストーリーで開く)", onlineGate({ ...fresh, cleared: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }).ok, false);
is("壊れた記録でも落ちない", onlineGate({ phase: 1, story: { 1: ["zz", 3] } }).ok, false);
// 名前の壁(2026-10-01 本人の指示)。名前を聞くのは、はじめの一局に勝ったあと。それまでに人と関わる場所へ
// 行こうとしたら、先に名前を聞く。ランキング(シーズンも中)・ランダム・合言葉の部屋・近くの端末・フレンド・観戦
is("名前が要る画面", [...NAME_SCREENS], ["ranking", "online", "room", "nearby", "friends", "spectate"]);
is("ランキング・ランダム・合言葉の部屋・近くの端末・フレンド・観戦は名前が要る", ["ranking", "online", "room", "nearby", "friends", "spectate"].map((s) => needsName(s)), [true, true, true, true, true, true]);
is("人との対局のルール選びは名前が要る(先に聞く。選んだあとで止めない)", ["online", "room", "nearby"].map((m) => needsName("rules", m)), [true, true, true]);
is("CPU戦・同じ端末のルール選びは要らない", [needsName("rules", "game"), needsName("rules", null)], [false, false]);
is(
  "ひとりで遊ぶ場所は要らない(タイトル・ホーム・ストーリー・対局・CPU・詰め・ガチャ・ショップ・ミッション・お知らせ)",
  ["home", "menu", "story", "game", "matching", "tutorial", "tsume", "skins", "shop", "missions", "battlepass", "cards", "letters", "profile"].some((s) => needsName(s)),
  false,
);
is("壁の一行(わけ)", [nameWallReason("ranking"), nameWallReason("friends"), nameWallReason("spectate"), nameWallReason("online"), nameWallReason("room"), nameWallReason("rules")], [
  "ランキングを見る前に、名前を決めよう。",
  "フレンドと遊ぶ前に、名前を決めよう。",
  "フレンドと遊ぶ前に、名前を決めよう。",
  "人と対戦する前に、名前を決めよう。",
  "人と対戦する前に、名前を決めよう。",
  "人と対戦する前に、名前を決めよう。",
]);
{
  const fs = await import("node:fs");
  const screens = fs.readFileSync(new URL("../src/ui/screens.jsx", import.meta.url), "utf8");
  is(
    "画面: 名前の無いあいだ、名前が要る画面では先に名前を聞く(わけを添え、戻れる)",
    /if \(!named && needsName\(e, o\)\)\s*return \(\s*<GameShell[^>]*>\s*<NameSetupScreen\s+reason=\{nameWallReason\(e\)\}\s+onDone=\{\(\) => setNamed\(!0\)\}\s+onCancel=\{/.test(screens),
    true,
  );
  is("画面: 壁は対局より先・画面の切り替えより先に見る", screens.indexOf("if (!named && needsName(e, o))") > 0 && screens.indexOf("if (!named && needsName(e, o))") < screens.indexOf('if (e === "game") {'), true);
  is("画面: 設定で名前を決めても壁を下ろす(記録が変わった合図で読み直す)", /window\.addEventListener\(PROFILE_CHANGED, onChange\);/.test(screens) && /const onChange = \(\) => setNamed\(hasName\(\)\);/.test(screens), true);
  is("画面: オンラインの印は名前のある人だけ(前のまま)", /useEffect\(\(\) => \{\s*if \(!named\) return;\s*let gone = false;\s*const beat = \(\) => \{/.test(screens), true);
  is("画面: 台帳・シーズンへの送り直しは名前のある人だけ(前のまま)", /if \(!now\.id \|\| !now\.name\) return;\s*retrySeasonMatches\(\)/.test(screens), true);
  const record = fs.readFileSync(new URL("../src/net/profile-record.js", import.meta.url), "utf8");
  is("台帳への公開は名前が無ければ作らない(前のまま)", /if \(!profile\?\.id \|\| !profile\.name/.test(record), true);
}
console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) process.exit(1);
