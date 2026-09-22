/**
 * 札ごとの熟練度(2026-09-22 本人の決め)を確かめる。
 *
 * 決めごと:
 *   - **その札を盤に出して指した回数**で上がる。勝敗では動かない(負けても伸びる)
 *   - 1局で同じ札を数えるのは3回まで。無いと「わざと長引かせて同じ札を指す」のが
 *     一番効率のいい遊び方になり、盤がつまらなくなる
 *   - 段は5つで500回で頭打ち。青天井にすると、あとから始めた人が追いつけない
 *   - **恩恵は称号・アイコンだけ。盤の有利不利には一切効かせない**(「印」の案は取り下げ)
 * 通信はしない。
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
import fs from "node:fs";
const {
  loadProfile,
  recordMastery,
  masteryStep,
  masteryAll,
  masteryProgress,
  MASTERY_STEPS,
  MASTERY_PER_GAME,
} = await import("../src/game/profile.js");
const { MASTERY_TITLES } = await import("../src/game/titles.js");
const { hasTitle, findTitle } = await import("../src/game/titles.js");
const { titleDesign } = await import("../src/ui/title-design.js");
const { RANKS } = await import("../src/game/constants.js");

let ok = 0;
const fails = [];
const is = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) {
    ok++;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(label);
    console.log(`  NG   ${label}  ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
  }
};
const yes = (label, got) => is(label, !!got, true);
const no = (label, got) => is(label, !!got, false);
const reset = () => {
  for (const k of Object.keys(store)) delete store[k];
};

console.log("数え方");
reset();
is("何も指していなければ持たない", loadProfile().mastery, null);
recordMastery({ J: 2 });
is("指した札だけが増える", loadProfile().mastery, { J: 2 });
recordMastery({ J: 1, Q: 1 });
is("次の局のぶんを足す", loadProfile().mastery, { J: 3, Q: 1 });

reset();
recordMastery({ J: 99 });
is(
  `1局で数えるのは${MASTERY_PER_GAME}回まで(長引かせる遊びを得にしない)`,
  loadProfile().mastery,
  { J: MASTERY_PER_GAME },
);
reset();
recordMastery({ 王: 5, "": 3, X: 9 });
is("知らない札は数えない", loadProfile().mastery, null);
recordMastery({ J: -5, Q: 0.5 });
is("負の数・端数は数えない(切り捨てて0)", loadProfile().mastery, null);
recordMastery({ J: 2.9 });
is("端数は切り捨てて数える", loadProfile().mastery, { J: 2 });

console.log("\n終局画面に出す上がり幅(2026-09-22 本人の指示)");
reset();
{
  const r = recordMastery({ J: 2, Q: 1 });
  is("上がった札だけを返す", r.gains.map((g) => g.rank).sort(), ["J", "Q"]);
  is("何回上がったか", r.gains.find((g) => g.rank === "J").added, 2);
  is("上がる前の数", r.gains.find((g) => g.rank === "J").before, 0);
  is("上がった後の数", r.gains.find((g) => g.rank === "J").after, 2);
  yes("メーターの進み具合を添える", r.gains[0].progress.ratio > 0);
  is("まだ称号は届かない", r.titles, []);
  is("保存後のプロフィールも返す", r.profile.mastery, { J: 2, Q: 1 });
  const none = recordMastery({});
  is("何も指していない局は上がり幅なし", none.gains, []);
}
{
  // 段に届いた局は、届く前の段も添える(メーターが「上がった」と出せるように)
  reset();
  for (let i = 0; i < 3; i++) recordMastery({ J: 3 });
  const r = recordMastery({ J: 1 });
  const g = r.gains[0];
  is("届く前の段", g.stepBefore, 0);
  is("届いた後の段", g.progress.step, 1);
  yes("段が上がったと分かる", g.progress.step > g.stepBefore);
}
{
  // 称号が届いた局は、その称号を返す(額縁つきで見せる)
  reset();
  const need = MASTERY_STEPS[2];
  for (let i = 0; i < need / MASTERY_PER_GAME - 1; i++)
    recordMastery({ J: MASTERY_PER_GAME });
  const r = recordMastery({ J: MASTERY_PER_GAME });
  is("届いた称号を返す", r.titles.map((t) => t.id), ["mastery-J"]);
  is("名前も添える", r.titles[0].name, "縦横無尽");
}
{
  // メーターは「その段の中での進み具合」を出す。段をまたぐと振り出しに戻る
  const p0 = masteryProgress(0);
  is("0回: 段0・次は10", [p0.step, p0.next, p0.into, p0.need], [0, 10, 0, 10]);
  const p1 = masteryProgress(10);
  is("10回: 段1・次は30・進み0", [p1.step, p1.next, p1.into, p1.need], [1, 30, 0, 20]);
  const p2 = masteryProgress(20);
  is("20回: 段1・半分", [p2.step, p2.into, p2.need], [1, 10, 20]);
  const top = masteryProgress(500);
  is("500回: 頭打ち", [top.step, top.done, top.ratio, top.left], [5, true, 1, 0]);
  const over = masteryProgress(9999);
  is("それ以上指しても頭打ちのまま", [over.step, over.done], [5, true]);
}
{
  // 画面の配線。メーターはプレイヤーレベルのゲージとは別の欄に出す
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  yes("終局画面にメーターを出す", /<MasteryGains gains=\{mastery\.gains\}/.test(game));
  yes("上がり幅を持っておく", /setMasteryResult/.test(game));
  yes(
    "メーターはボタンの上(ホームへ等より先)に出す",
    game.indexOf("<MasteryGains") < game.indexOf('className="gameover-grid"'),
  );
  const ui = fs.readFileSync(new URL("../src/ui/mastery.jsx", import.meta.url), "utf8");
  yes("使った札だけを並べる(13本並べない)", /gains\.length/.test(ui));
  yes("届いた称号は額縁ごと見せる", /<TitleFrame/.test(ui));
}

console.log("\n段");
reset();
const bump = (rank, n) => {
  // 1局3回までなので、回数ぶん「対局」を重ねる
  for (let i = 0; i < Math.ceil(n / MASTERY_PER_GAME); i++)
    recordMastery({ [rank]: MASTERY_PER_GAME });
};
is("0回は段0", masteryStep(loadProfile(), "J"), 0);
bump("J", MASTERY_STEPS[0]);
is(`${MASTERY_STEPS[0]}回で段1`, masteryStep(loadProfile(), "J"), 1);
bump("J", MASTERY_STEPS[2] - MASTERY_STEPS[0]);
is(`${MASTERY_STEPS[2]}回で段3(称号が出る段)`, masteryStep(loadProfile(), "J") >= 3, true);
is("段は5つ", MASTERY_STEPS.length, 5);
is("頭打ちは500回", MASTERY_STEPS[MASTERY_STEPS.length - 1], 500);

console.log("\n称号");
reset();
is("札13種ぶん＋通し2つ", MASTERY_TITLES.length, RANKS.length + 2);
for (const rank of RANKS)
  yes(`${rank} の称号がある`, MASTERY_TITLES.some((t) => t.mastery === rank));
no("まだ何も指していない人は名乗れない", hasTitle(loadProfile(), "mastery-J"));
bump("J", MASTERY_STEPS[2]);
yes("Jを80回指すと名乗れる", hasTitle(loadProfile(), "mastery-J"));
no("他の札の称号は出ない", hasTitle(loadProfile(), "mastery-Q"));
yes(
  "届いた称号は焼き付く(熟練度の数字が無くても名乗れる)",
  loadProfile().titles.includes("mastery-J"),
);
no("通しの称号はまだ出ない", hasTitle(loadProfile(), "mastery-all"));
reset();
for (const rank of RANKS) bump(rank, MASTERY_STEPS[2]);
yes("13種すべてで通しの称号が出る", hasTitle(loadProfile(), "mastery-all"));
yes("masteryAll が段3を認める", masteryAll(loadProfile(), 3));
no("最上位はまだ出ない", hasTitle(loadProfile(), "mastery-master"));

console.log("\n額縁");
for (const t of MASTERY_TITLES) {
  const d = titleDesign(t.id);
  yes(`${t.name} に意匠がある`, d && d.motif && d.palette);
}
is("札1枚ぶんは宝飾(段3)", titleDesign("mastery-J").level, 3);
is("13種の通しは絢爛(段5)", titleDesign("mastery-all").level, 5);
is("最上位は極煌(段6)", titleDesign("mastery-master").level, 6);
const names = MASTERY_TITLES.map((t) => t.name);
is("名前が重なっていない", new Set(names).size, names.length);
for (const t of MASTERY_TITLES)
  yes(`${t.name} に取得方法の文がある`, !!(t.how && t.how.length));

console.log("\n盤に効かせない(ここが崩れたら公平性が壊れる)");
{
  // 「印」の案は本人が取り下げた。熟練度が配り札や合法手に触れていないことを見張る。
  // 触れさせたいときは、先にサーバー側の検証(src/server/verify-match.js)が要る
  for (const f of [
    "src/game/board.js",
    "src/game/reducer.js",
    "src/game/actions.js",
    "src/game/areas.js",
  ]) {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    no(`${f} は熟練度を見ない`, /mastery/i.test(src));
  }
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  yes(
    "自分の手だけを数える(CPU の手も同じ入口を通るので持ち主を見る)",
    /mover\.owner === mySeat/.test(game),
  );
  yes("チュートリアルは数えない", /MOVE_PIECE" && !tutorial && !E\.__foe/.test(game));
}

console.log(`\n${ok} 件 ok / ${fails.length} 件 NG`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
