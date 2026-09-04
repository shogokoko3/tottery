/**
 * 錬成の検査。
 * 値づけが抽選の確率と噛み合っているか、崩す・作るの決まりが守られているか。
 */
import {
  CRAFT,
  CRAFT_RATIO,
  DUST,
  costOf,
  craftCheck,
  dismantleCheck,
  dustOf,
  etherOf,
  isKeepsake,
  spareOf,
  spares,
  sparesNeeded,
  totalOfSpares,
} from "../src/skins/ether.js";
import { ODDS, POOL, SKINS, rate } from "../src/skins/catalog.js";
import {
  addEther,
  craft,
  dismantle,
  dismantleAll,
  normalize,
} from "../src/skins/collection.js";
import { giftLabel } from "../src/game/gifts.js";
import { normalizeGift } from "../src/net/letters.js";

let ok = 0,
  fail = 0;
const t = (name, cond) => {
  if (cond) {
    ok++;
    console.log("  ok  ", name);
  } else {
    fail++;
    console.log("  NG  ", name);
  }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log("値づけが確率と噛み合っているか");
// 1枚あたりの出る率。R 16.25% / SR 8% / SSR 0.5%
const each = {};
for (const r of ["R", "SR", "SSR"])
  each[r] = ODDS[r] / POOL.filter((s) => s.rarity === r).length;
t("R は 16.25%", each.R === 16.25);
t("SR は 8%", each.SR === 8);
t("SSR は 0.5%", each.SSR === 0.5);
// 崩してもらえる量は、出にくさに比例している(丸めの幅は1割まで)
t(
  "SR は R の約2倍",
  near(DUST.SR / DUST.R, each.R / each.SR, 0.1 * (each.R / each.SR)),
);
t(
  "SSR は R の約32.5倍",
  near(DUST.SSR / DUST.R, each.R / each.SSR, 0.1 * (each.R / each.SSR)),
);
t("作るのは崩すの4倍", ["R", "SR", "SSR"].every((r) => CRAFT[r] === DUST[r] * CRAFT_RATIO));

console.log("\n何回引くぶんか");
// 1回引くごとに入るエーテル(引いたものを全部崩した場合)
const perPull = ["R", "SR", "SSR"].reduce(
  (sum, r) => sum + (ODDS[r] / 100) * DUST[r],
  0,
);
const pulls = (rarity, only) =>
  CRAFT.SSR / ((ODDS[only] / 100) * DUST[only]);
t("R だけを崩すと 約197回", Math.round(pulls("SSR", "R")) === 197);
t("SR だけを崩すと 約200回", Math.round(pulls("SSR", "SR")) === 200);
t("狙った SSR を運で当てるのは 200回", Math.round(100 / each.SSR) === 200);
t(
  "単一の格を崩す道は、運で当てるのとほぼ同じ手間(誤差2%以内)",
  near(pulls("SSR", "R"), 200, 4) && near(pulls("SSR", "SR"), 200, 4),
);
t("全部崩すと 約57回", Math.round(CRAFT.SSR / perPull) === 57);
t("全部崩す道のほうが速い", CRAFT.SSR / perPull < 100 / each.SSR);

console.log("\nSSR 1枚に要るダブりの数");
t("R なら128枚", sparesNeeded("angel-k", "zombie-male") === 128);
t("SR なら64枚", sparesNeeded("angel-k", "elf-male") === 64);
t("SSR なら4枚", sparesNeeded("angel-k", "demon-k") === 4);

console.log("\n早期特典は崩せない・作れない");
const limited = SKINS.filter((s) => s.rarity === "LIMITED");
t("早期特典が2枚ある", limited.length === 2);
t("崩す値は0", limited.every((s) => dustOf(s) === 0));
t("作る値は無い", limited.every((s) => costOf(s) === null));
t("目印が付く", limited.every((s) => isKeepsake(s)));
t("抽選には入らない", limited.every((s) => !POOL.includes(s)));
{
  const c = normalize({ owned: { "dragon-knight": 3 }, ether: 9999 });
  t("3枚あっても崩せない", spareOf(c, "dragon-knight") === 0);
  t("崩そうとすると断る", !dismantleCheck(c, "dragon-knight").ok);
  t("作ろうとすると断る", !craftCheck(c, "dragon-knight").ok);
}

console.log("\n崩す");
{
  let c = normalize({
    owned: { "zombie-male": 5, "elf-male": 3, "angel-k": 1, "dragon-knight": 1 },
    ether: 0,
  });
  t("最後の1枚は数えない", spareOf(c, "zombie-male") === 4 && spareOf(c, "angel-k") === 0);
  t("崩せる一覧に早期特典は出ない", !spares(c, SKINS).some((r) => isKeepsake(r.skin)));
  t("全部崩すと 4×10 + 2×20 = 80", totalOfSpares(c, SKINS) === 80);
  c = dismantle(c, "zombie-male");
  t("1枚崩すと所持が減り、エーテルが増える", c.owned["zombie-male"] === 4 && c.ether === 10);
  c = dismantleAll(c);
  t("まとめて崩すと 70 増える", c.ether === 80);
  t("どの札も1枚は残る", SKINS.every((s) => (c.owned[s.id] || 0) <= 1));
  t("最後の1枚は断る", !dismantleCheck(c, "zombie-male").ok);
  let threw = false;
  try {
    dismantle(c, "angel-k");
  } catch {
    threw = true;
  }
  t("無理に崩そうとすると止まる", threw);
  t("持っていない札も断る", !dismantleCheck(c, "demon-k").ok);
  t("知らない id も断る", !dismantleCheck(c, "no-such-skin").ok);
}

console.log("\n作る");
{
  let c = normalize({ owned: { "elf-male": 1 }, ether: 1280 });
  t("足りないと断り、不足を返す", (() => {
    const r = craftCheck(normalize({ ether: 100 }), "angel-k");
    return !r.ok && r.short === 1180;
  })());
  c = craft(c, "demon-k");
  t("SSR を作ると 1280 減る", c.ether === 0 && c.owned["demon-k"] === 1);
  let threw = false;
  try {
    craft(c, "angel-k");
  } catch {
    threw = true;
  }
  t("足りないまま作ろうとすると止まる", threw);
  const dup = craft(normalize({ owned: { "elf-male": 1 }, ether: 80 }), "elf-male");
  t("持っている札も作れて、枚数が増える", dup.owned["elf-male"] === 2 && dup.ether === 0);
  t("装備している札は残る(崩すのはダブりだけ)", spareOf(normalize({ owned: { "elf-male": 1 } }), "elf-male") === 0);
}

console.log("\n保存と受け渡し");
{
  t("壊れた値は0に落ちる", etherOf(normalize({ ether: -5 })) === 0 && etherOf(normalize({ ether: 1.5 })) === 0);
  t("保存から読み直せる", normalize({ ether: 340 }).ether === 340);
  t("足せる", addEther(normalize({ ether: 10 }), 90).ether === 100);
  t("0や負を足しても変わらない", addEther(normalize({ ether: 10 }), 0).ether === 10);
  t("褒美の形として通る", JSON.stringify(normalizeGift({ type: "ether", amount: 500 })) === JSON.stringify({ type: "ether", amount: 500 }));
  t("褒美の呼び名", giftLabel({ type: "ether", amount: 1280 }) === "エーテル 1,280");
  t("0以下の褒美は弾く", normalizeGift({ type: "ether", amount: 0 }) === null);
}

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
