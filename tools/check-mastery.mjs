/**
 * スキンごとの熟練度(2026-09-22 着手。2026-09-24 で札ごと→所持スキンごとに変更)を確かめる。
 *
 * 決めごと:
 *   - **所持スキンを装備して王にし、貯めた点**で上がる。通常札(スキン無し)では貯まらない
 *   - 点: 王に選ぶ +5、駒を盤に出す +1/体、王として動かす +1(1局3点まで)、
 *     王で相手の駒を取る +1(10点まで)、王で相手の王を討つ +10
 *   - 段は5つで500点で頭打ち
 *   - J/Q/K・10 はスキンが複数あり、それぞれ別の枠(別の称号)
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
  MASTERY_POINTS,
  masteryPoints,
} = await import("../src/game/profile.js");
const { MASTERY_TITLES } = await import("../src/game/titles.js");
const { hasTitle, findTitle } = await import("../src/game/titles.js");
const { titleDesign } = await import("../src/ui/title-design.js");
const { MASTERY_SKINS } = await import("../src/game/constants.js");

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

console.log("数え方(スキンごと)");
reset();
is("何も使っていなければ持たない", loadProfile().mastery, null);
recordMastery({ "elf-male": 2 });
is("使ったスキンだけが増える", loadProfile().mastery, { "elf-male": 2 });
recordMastery({ "elf-male": 1, "angel-j": 1 });
is("次の局のぶんを足す", loadProfile().mastery, { "elf-male": 3, "angel-j": 1 });
reset();
recordMastery({ nope: 5, "": 3, X: 9 });
is("知らないスキンは数えない", loadProfile().mastery, null);

console.log("\n点の決まり(2026-09-24 本人の指示)");
is("王に選んだ +5", masteryPoints({ king: true }).total, MASTERY_POINTS.king);
is("王に選んだ点は 5", MASTERY_POINTS.king, 5);
is("駒を出した +1/体(複数で複数)", masteryPoints({ pieces: 4 }).pieces, 4);
is("王として動かした +1/手、3点まで", masteryPoints({ moves: 7 }).moves, MASTERY_PER_GAME);
is("王で取った +1/体", masteryPoints({ captures: 4 }).captures, 4);
is(`王で取った点は ${MASTERY_POINTS.captureMax} を超えない(細工よけ)`, masteryPoints({ captures: 99 }).captures, MASTERY_POINTS.captureMax);
is("王で相手の王を討った +10", masteryPoints({ kingCapture: true }).kingCapture, 10);
is("全部そろうと 5+2+3+4+10", masteryPoints({ king: true, pieces: 2, moves: 9, captures: 4, kingCapture: true }).total, 5 + 2 + 3 + 4 + 10);
is("負の数・文字は 0", masteryPoints({ moves: -3, captures: "x", pieces: -1 }).total, 0);
reset();
{
  const r = recordMastery({ "demon-k": { king: true, pieces: 2, moves: 2, captures: 1, kingCapture: true } });
  is("記録は点で足す", loadProfile().mastery, { "demon-k": 5 + 2 + 2 + 1 + 10 });
  is("内訳を返す", r.gains[0].points, { king: 5, pieces: 2, moves: 2, captures: 1, kingCapture: 10, total: 20 });
}

console.log("\n終局画面に出す上がり幅");
reset();
{
  const r = recordMastery({ "elf-male": { moves: 2 }, "angel-j": { moves: 1 } });
  is("上がったスキンだけを返す", r.gains.map((g) => g.skin).sort(), ["angel-j", "elf-male"]);
  is("何点上がったか", r.gains.find((g) => g.skin === "elf-male").added, 2);
  yes("メーターの進み具合を添える", r.gains[0].progress.ratio > 0);
  is("まだ称号は届かない", r.titles, []);
  const none = recordMastery({});
  is("何も使っていない局は上がり幅なし", none.gains, []);
}
{
  reset();
  for (let i = 0; i < 3; i++) recordMastery({ "elf-male": { moves: 3 } });
  const r = recordMastery({ "elf-male": { moves: 1 } });
  const g = r.gains[0];
  is("届く前の段", g.stepBefore, 0);
  is("届いた後の段", g.progress.step, 1);
  yes("段が上がったと分かる", g.progress.step > g.stepBefore);
}
{
  // 称号が届いた局は、その称号を返す(額縁つきで見せる)
  reset();
  const need = MASTERY_STEPS[2];
  for (let i = 0; i < Math.ceil(need / MASTERY_PER_GAME) - 1; i++)
    recordMastery({ "elf-male": { moves: MASTERY_PER_GAME } });
  const r = recordMastery({ "elf-male": { moves: MASTERY_PER_GAME } });
  is("届いた称号を返す", r.titles.map((t) => t.id), ["mastery-elf-male"]);
  is("名前も添える(スキンに合わせた称号)", r.titles[0].name, "翠風の狙撃手");
  yes("取得方法の文がある", /点ためる/.test(findTitle("mastery-elf-male").how));
}
{
  const p0 = masteryProgress(0);
  is("0点: 段0・次は10", [p0.step, p0.next, p0.into, p0.need], [0, 10, 0, 10]);
  const p1 = masteryProgress(10);
  is("10点: 段1・次は30・進み0", [p1.step, p1.next, p1.into, p1.need], [1, 30, 0, 20]);
  const top = masteryProgress(500);
  is("500点: 頭打ち", [top.step, top.done, top.ratio, top.left], [5, true, 1, 0]);
}
{
  const game = fs.readFileSync(new URL("../src/ui/game.jsx", import.meta.url), "utf8");
  yes("終局画面にメーターを出す", /<MasteryGains gains=\{mastery\.gains\}/.test(game));
  const ui = fs.readFileSync(new URL("../src/ui/mastery.jsx", import.meta.url), "utf8");
  yes("使ったスキンだけを並べる", /gains\.length/.test(ui));
  yes("届いた称号は額縁ごと見せる", /<TitleFrame/.test(ui));
}

console.log("\n段");
reset();
const bump = (skin, n) => {
  for (let i = 0; i < Math.ceil(n / MASTERY_PER_GAME); i++)
    recordMastery({ [skin]: { moves: MASTERY_PER_GAME } });
};
is("0点は段0", masteryStep(loadProfile(), "elf-male"), 0);
bump("elf-male", MASTERY_STEPS[0]);
is(`${MASTERY_STEPS[0]}点で段1`, masteryStep(loadProfile(), "elf-male"), 1);
bump("elf-male", MASTERY_STEPS[2] - MASTERY_STEPS[0]);
is(`${MASTERY_STEPS[2]}点で段3(称号が出る段)`, masteryStep(loadProfile(), "elf-male") >= 3, true);
is("段は5つ", MASTERY_STEPS.length, 5);
is("頭打ちは500点", MASTERY_STEPS[MASTERY_STEPS.length - 1], 500);

console.log("\n称号");
reset();
is("17スキンぶん＋通し2つ", MASTERY_TITLES.length, MASTERY_SKINS.length + 2);
is("対象スキンは17種", MASTERY_SKINS.length, 17);
for (const skin of MASTERY_SKINS)
  yes(`${skin} の称号がある`, MASTERY_TITLES.some((t) => t.mastery === skin));
yes("J は天使・悪魔で別の称号", MASTERY_TITLES.some((t) => t.mastery === "angel-j") && MASTERY_TITLES.some((t) => t.mastery === "demon-j"));
yes("10 は竜・天馬で別の称号", MASTERY_TITLES.some((t) => t.mastery === "dragon-knight") && MASTERY_TITLES.some((t) => t.mastery === "pegasus-knight"));
no("まだ何も使っていない人は名乗れない", hasTitle(loadProfile(), "mastery-elf-male"));
bump("elf-male", MASTERY_STEPS[2]);
yes("elf-male を80点ためると名乗れる", hasTitle(loadProfile(), "mastery-elf-male"));
no("他のスキンの称号は出ない", hasTitle(loadProfile(), "mastery-angel-j"));
yes(
  "届いた称号は焼き付く",
  loadProfile().titles.includes("mastery-elf-male"),
);
no("通しの称号はまだ出ない", hasTitle(loadProfile(), "mastery-all"));
reset();
for (const skin of MASTERY_SKINS) bump(skin, MASTERY_STEPS[2]);
yes("17スキンすべてで通しの称号が出る", hasTitle(loadProfile(), "mastery-all"));
yes("masteryAll が段3を認める", masteryAll(loadProfile(), 3));
no("最上位はまだ出ない", hasTitle(loadProfile(), "mastery-master"));

console.log("\n額縁");
for (const t of MASTERY_TITLES) {
  const d = titleDesign(t.id);
  yes(`${t.name} に意匠がある`, d && d.motif && d.palette);
}
is("スキン1つぶんは宝飾(段3)", titleDesign("mastery-elf-male").level, 3);
is("通しは絢爛(段5)", titleDesign("mastery-all").level, 5);
is("最上位は極煌(段6)", titleDesign("mastery-master").level, 6);
const names = MASTERY_TITLES.map((t) => t.name);
is("名前が重なっていない", new Set(names).size, names.length);
for (const t of MASTERY_TITLES)
  yes(`${t.name} に取得方法の文がある`, !!(t.how && t.how.length));

console.log("\n盤に効かせない(ここが崩れたら公平性が壊れる)");
{
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
  yes(
    "熟練度は装備している所持スキンごと(通常札では貯まらない)",
    /equippedSkinKey/.test(game) && /MASTERY_SKINS\.includes\(base\)/.test(game),
  );
  yes("王に選んだ +5・駒 +1 は play に入ったときに数える", /masteryTrack\(kingSkin\)\.king = 1/.test(game) && /masteryTrack\(skin\)\.pieces \+= 1/.test(game));
  yes("取った点は reducer の撃破の記録から数える", /d\.via !== "capture"/.test(game) && /a\.lastMove\?\.pieceId !== kingId/.test(game));
  yes("同じ撃破は seq で一度だけ", /d\.seq === masteryDefeatRef\.current/.test(game));
  yes("王を討てば旗を立てる(+10)", /t\.kingCapture = 1;/.test(game));
  yes("チュートリアルは数えない", /MOVE_PIECE" && !tutorial && !E\.__foe/.test(game));
}

console.log(`\n${ok} 件 ok / ${fails.length} 件 NG`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
