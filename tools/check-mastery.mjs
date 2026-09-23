/**
 * 札ごとの熟練度(2026-09-22 本人の決め)を確かめる。
 *
 * 決めごと:
 *   - **その札を王に選んでためた点**で上がる(2026-09-22 に本人が変更。2026-09-24 に点数へ:
 *     王に選ぶ +1、王として動かす +1(1局3回まで)、王で取る +1(相手の軍まで)、王で王を討つ +5)。
 *     勝敗では動かない(負けても伸びる)。1局で育つのは王にした1種類だけ
 *   - 動かした点は1局3回まで。無いと「わざと長引かせて同じ札を指す」のが
 *     一番効率のいい遊び方になり、盤がつまらなくなる
 *   - 段は5つで500点で頭打ち。青天井にすると、あとから始めた人が追いつけない
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
  `動かした点は1局${MASTERY_PER_GAME}回まで(長引かせる遊びを得にしない)`,
  loadProfile().mastery,
  { J: MASTERY_PER_GAME },
);

console.log("\n点の決まり(2026-09-24 本人の指示)");
is("王に選んだ +1", masteryPoints({ king: true }).total, 1);
is("王として動かした +1/手、3手まで", masteryPoints({ moves: 7 }).moves, 3);
is("王で取った +1/体", masteryPoints({ captures: 4 }).captures, 4);
is(`王で取った点は相手の軍(${MASTERY_POINTS.captureMax})を超えない(細工よけ)`, masteryPoints({ captures: 99 }).captures, MASTERY_POINTS.captureMax);
is("王で相手の王を討った +5", masteryPoints({ kingCapture: true }).kingCapture, 5);
is("全部そろうと 1+3+9+5", masteryPoints({ king: true, moves: 9, captures: 9, kingCapture: true }).total, 18);
is("負の数・文字は 0", masteryPoints({ moves: -3, captures: "x" }).total, 0);
is("数だけなら動かした回数として読む(旧い呼び方)", masteryPoints(2).total, 2);
reset();
{
  const r = recordMastery({ K: { king: true, moves: 2, captures: 1, kingCapture: true } });
  is("記録は点で足す", loadProfile().mastery, { K: 9 });
  is("内訳を返す", r.gains[0].points, { king: 1, moves: 2, captures: 1, kingCapture: 5, total: 9 });
}
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
  is("何点上がったか", r.gains.find((g) => g.rank === "J").added, 2);
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
  is("名前も添える", r.titles[0].name, "白衣の公子");
  yes("取得方法の文も王の言い方にそろえる", /王にして/.test(findTitle("mastery-J").how));
}
{
  // メーターは「その段の中での進み具合」を出す。段をまたぐと振り出しに戻る
  const p0 = masteryProgress(0);
  is("0点: 段0・次は10", [p0.step, p0.next, p0.into, p0.need], [0, 10, 0, 10]);
  const p1 = masteryProgress(10);
  is("10点: 段1・次は30・進み0", [p1.step, p1.next, p1.into, p1.need], [1, 30, 0, 20]);
  const p2 = masteryProgress(20);
  is("20点: 段1・半分", [p2.step, p2.into, p2.need], [1, 10, 20]);
  const top = masteryProgress(500);
  is("500点: 頭打ち", [top.step, top.done, top.ratio, top.left], [5, true, 1, 0]);
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
  // 動かした点は1局3回までなので、点のぶん「対局」を重ねる
  for (let i = 0; i < Math.ceil(n / MASTERY_PER_GAME); i++)
    recordMastery({ [rank]: MASTERY_PER_GAME });
};
is("0点は段0", masteryStep(loadProfile(), "J"), 0);
bump("J", MASTERY_STEPS[0]);
is(`${MASTERY_STEPS[0]}点で段1`, masteryStep(loadProfile(), "J"), 1);
bump("J", MASTERY_STEPS[2] - MASTERY_STEPS[0]);
is(`${MASTERY_STEPS[2]}点で段3(称号が出る段)`, masteryStep(loadProfile(), "J") >= 3, true);
is("段は5つ", MASTERY_STEPS.length, 5);
is("頭打ちは500点", MASTERY_STEPS[MASTERY_STEPS.length - 1], 500);

console.log("\n称号");
reset();
is("札13種ぶん＋通し2つ", MASTERY_TITLES.length, RANKS.length + 2);
for (const rank of RANKS)
  yes(`${rank} の称号がある`, MASTERY_TITLES.some((t) => t.mastery === rank));
no("まだ何も指していない人は名乗れない", hasTitle(loadProfile(), "mastery-J"));
bump("J", MASTERY_STEPS[2]);
yes("Jを80点ためると名乗れる", hasTitle(loadProfile(), "mastery-J"));
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
  // 2026-09-22 本人の変更: 王に選んだ札だけが貯まる
  yes(
    "王として動かした手だけを数える(王かどうかは席の kingId で見る。2026-09-24)",
    /mover\.owner === mySeat && a\.players\?\.\[mySeat\]\?\.kingId === mover\.id && mover\.rank/.test(game),
  );
  yes("王に選んだ点は play に入ったときに付ける", /t\.king = 1;/.test(game));
  yes("取った点は reducer の撃破の記録から数える", /d\.via !== "capture"/.test(game) && /a\.lastMove\?\.pieceId !== kingId/.test(game));
  yes("同じ撃破は seq で一度だけ", /d\.seq === masteryDefeatRef\.current/.test(game));
  yes("王を討てば +5 の旗", /t\.kingCapture = 1;/.test(game));
  yes("チュートリアルは数えない", /MOVE_PIECE" && !tutorial && !E\.__foe/.test(game));
}

console.log(`\n${ok} 件 ok / ${fails.length} 件 NG`);
if (fails.length) {
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
