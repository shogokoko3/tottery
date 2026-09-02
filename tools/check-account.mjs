/**
 * プレイヤーのアカウントを検査する。
 *
 * 名前は対戦相手にも渡すので、変な値が入らないようにしておく。
 * また、名前を持たなかった頃の保存を引き継げるかも見る。
 */
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

const {
  MAX_NAME_LEN,
  hasName,
  levelOf,
  loadProfile,
  nameError,
  normalizeName,
  recordGame,
  saveName,
} = await import("../src/game/profile.js");
const { nameOf, playerLabel, shortPlayerLabel } =
  await import("../src/game/constants.js");

let ok = 0;
const fails = [];
function is(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    ok++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(label);
    console.log(
      `  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`,
    );
  }
}

console.log("名前の整え方");
is("前後の空白を落とす", normalizeName("  しょうご  "), "しょうご");
is("途中の空白は1つにまとめる", normalizeName("しょう　　ご"), "しょう ご");
is("改行は空白として扱う", normalizeName("しょう\nご"), "しょう ご");
is(
  "長すぎる分は切る",
  normalizeName("あいうえおかきくけこさしす").length,
  MAX_NAME_LEN,
);
is("空は空のまま", normalizeName("   "), "");
is("null でも落ちない", normalizeName(null), "");

console.log("名前として使えるか");
is("空は断る", !!nameError("  "), true);
is("長すぎは断る", !!nameError("あいうえおかきくけこさ"), true);
is("ちょうどは通す", nameError("あいうえおかきくけこ"), null);
is("普通の名前は通す", nameError("しょうご"), null);

console.log("保存と引き継ぎ");
{
  is("はじめは名前が無い", hasName(), false);
  is("名前が無いうちは id も作らない", loadProfile().id, null);
  const a = saveName(" しょうご ");
  is("整えて保存する", a.name, "しょうご");
  is("id ができる", typeof a.id === "string" && a.id.length > 3, true);
  is("名前があると分かる", hasName(), true);
  const id = a.id;
  const b = saveName("たろう");
  is("名前を変えても id は変わらない", b.id, id);
  const c = recordGame(true);
  is("1局ぶん数える", [c.plays, c.wins], [1, 1]);
  is("名前は消えない", c.name, "たろう");
  is("空の名前では上書きしない", saveName("   ").name, "たろう");
}
{
  // 名前を持たなかった頃の保存だけがある状態
  delete store["tottery.account.v1"];
  store["tottery.profile.v1"] = JSON.stringify({ plays: 7, wins: 3 });
  const old = loadProfile();
  is("古い戦績を引き継ぐ", [old.plays, old.wins], [7, 3]);
  is("名前はまだ無い", old.name, "");
  is("レベルも引き継いだ戦績から出る", levelOf(old) >= 1, true);
}

console.log("画面に出す呼び名");
is("名前が無ければ色名", nameOf(0, null), "赤");
is("名前があれば名前", nameOf(1, [null, "たろう"]), "たろう");
is(
  "名前つきの自分は名前だけ",
  playerLabel(0, 0, ["しょうご", "たろう"]),
  "しょうご",
);
is("名前つきの相手", playerLabel(1, 0, ["しょうご", "たろう"]), "たろう");
is("名前が無ければ今までどおり", playerLabel(0, 0, null), "あなた(赤)");
is(
  "短い呼び名も名前を使う",
  shortPlayerLabel(1, 0, [null, "たろう"]),
  "たろう",
);
is("名前が無ければ相手", shortPlayerLabel(1, 0, null), "相手");

console.log(`\n${ok} ok / ${fails.length} fail`);
if (fails.length) process.exit(1);
