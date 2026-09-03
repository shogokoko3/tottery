/**
 * 称号を検査する。
 *
 * 対局数などから自動で決まるもの、あとから配るもの、選び方、
 * 相手から受け取った知らない id の扱い、保存の引き継ぎ。
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

const { grantTitle, loadProfile, recordGame, saveName, saveTitle } =
  await import("../src/game/profile.js");
const { DEFAULT_TITLE, TITLES, hasTitle, ownedTitles, titleNameOf, titleOf } =
  await import("../src/game/titles.js");

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
const names = (p) => ownedTitles(p).map((t) => t.name);

console.log("台帳");
is("id が重複しない", new Set(TITLES.map((t) => t.id)).size, TITLES.length);
is("名前が重複しない", new Set(TITLES.map((t) => t.name)).size, TITLES.length);
is(
  "既定の称号は最初から使える",
  !!TITLES.find((t) => t.id === DEFAULT_TITLE && t.free),
  true,
);
is(
  "手に入れ方が全部書いてある",
  TITLES.every((t) => typeof t.how === "string" && t.how.length > 0),
  true,
);

console.log("最初の状態");
saveName("しょうご");
let p = loadProfile();
is("使えるのは見習いだけ", names(p), ["見習い"]);
is("出す称号は見習い", titleOf(p).name, "見習い");

console.log("対局で手に入る");
let r = recordGame(true);
is(
  "1局遊ぶと初陣が新しく手に入る",
  r.earned.map((t) => t.name),
  ["初陣"],
);
is("使える称号に初陣が加わる", names(r), ["見習い", "初陣"]);
r = recordGame(false);
is("同じ称号は2度目には数えない", r.earned.length, 0);
for (let i = 0; i < 8; i++) r = recordGame(true);
is("10局で十戦の兵", names(r).includes("十戦の兵"), true);
is("10局のうち9勝なので十勝の勇はまだ", names(r).includes("十勝の勇"), false);
r = recordGame(true);
is(
  "10勝で十勝の勇",
  r.earned.map((t) => t.name),
  ["十勝の勇"],
);

console.log("選ぶ");
is("持っていない称号は選べない", saveTitle("rank-o").title, null);
is("持っている称号は選べる", saveTitle("first").title, "first");
is("選んだ称号が出る", titleOf(loadProfile()).name, "初陣");
is("保存を読み直しても残る", loadProfile().title, "first");

console.log("配られた称号");
is("配る前は使えない", hasTitle(loadProfile(), "rank-o"), false);
grantTitle("rank-o");
is("配られると使える", hasTitle(loadProfile(), "rank-o"), true);
is("配られた称号を選べる", saveTitle("rank-o").title, "rank-o");
  // 対局で焼き付いた称号も titles に入るので、rank-o が1つだけあることを見る
  is(
    "同じ称号を2度配っても1つ",
    grantTitle("rank-o").titles.filter((id) => id === "rank-o").length,
    1,
  );

console.log("持ち点が下がっても失わない");
{
  // 1600 に届いて「士の位」を選んだあと、負けて 1600 を割る
  store["tottery.account.v1"] = JSON.stringify({
    ...loadProfile(),
    rating: 1590,
    rated: 12,
    title: "novice",
    titles: [],
  });
  let r = recordGame(true, { foeRating: 1900 });
  is(
    "勝って 1600 を超えると士の位を手に入れる",
    r.earned.map((t) => t.name),
    ["士の位"],
  );
  is("士の位を選べる", saveTitle("rank-shi").title, "rank-shi");
  r = recordGame(false, { foeRating: 1500 });
  is("負けて持ち点が下がる", r.rating < 1600, true);
  is("それでも士の位は使える", titleOf(loadProfile()).name, "士の位");
  r = recordGame(true, { foeRating: 1900 });
  is("取り直しても新しく手に入れた扱いにならない", r.earned.length, 0);
}

console.log("相手から受け取った id");
is("知っている id は名前になる", titleNameOf("ten"), "十戦の兵");
is("知らない id は何も出さない", titleNameOf("brand-new"), null);
is("無ければ何も出さない", titleNameOf(null), null);

console.log("壊れた保存");
store["tottery.account.v1"] = JSON.stringify({
  ...loadProfile(),
  title: "brand-new",
});
is(
  "知らない称号が保存されていたら既定に戻す",
  titleOf(loadProfile()).name,
  "見習い",
);

console.log(`\n${ok} ok / ${fails.length} fail`);
process.exit(fails.length ? 1 : 0);
