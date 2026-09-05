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
  grantSkin,
  normalize,
} from "../src/skins/collection.js";
import { bestOf, ladderFor, ladderOf } from "../src/skins/reveal.js";
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
t("SSR は 0.4286%", Math.abs(each.SSR - 3 / 7) < 1e-9);
t(
  "SSR は7枚(竜騎士を含む)",
  POOL.filter((s) => s.rarity === "SSR").length === 7,
);
// 崩してもらえる量は、出にくさに比例している(丸めの幅は1割まで)
t(
  "SR は R の約2倍",
  near(DUST.SR / DUST.R, each.R / each.SR, 0.1 * (each.R / each.SR)),
);
t(
  "SSR は R の約37.9倍",
  near(DUST.SSR / DUST.R, each.R / each.SSR, 0.1 * (each.R / each.SSR)),
);
t(
  "作るのは崩すの4倍",
  ["R", "SR", "SSR"].every((r) => CRAFT[r] === DUST[r] * CRAFT_RATIO),
);

console.log("\n何回引くぶんか");
// 1回引くごとに入るエーテル(引いたものを全部崩した場合)
const perPull = ["R", "SR", "SSR"].reduce(
  (sum, r) => sum + (ODDS[r] / 100) * DUST[r],
  0,
);
const pulls = (rarity, only) => CRAFT.SSR / ((ODDS[only] / 100) * DUST[only]);
t("R だけを崩すと 約231回", Math.round(pulls("SSR", "R")) === 231);
t("SR だけを崩すと 約234回", Math.round(pulls("SSR", "SR")) === 234);
t("狙った SSR を運で当てるのは 233回", Math.round(100 / each.SSR) === 233);
t(
  "単一の格を崩す道は、運で当てるのとほぼ同じ手間(誤差2%以内)",
  near(pulls("SSR", "R"), 233, 5) && near(pulls("SSR", "SR"), 233, 5),
);
t("全部崩すと 約62回", Math.round(CRAFT.SSR / perPull) === 62);
t("全部崩す道のほうが速い", CRAFT.SSR / perPull < 100 / each.SSR);

console.log("\nSSR 1枚に要るダブりの数");
t("R なら150枚", sparesNeeded("angel-k", "zombie-male") === 150);
t("SR なら75枚", sparesNeeded("angel-k", "elf-male") === 75);
t("SSR なら4枚", sparesNeeded("angel-k", "demon-k") === 4);

console.log("\n早期特典は崩せない・作れない");
const limited = SKINS.filter((s) => s.rarity === "LIMITED");
t(
  "早期特典は天馬騎士の1枚だけ",
  limited.length === 1 && limited[0].id === "pegasus-knight",
);
t(
  "崩す値は0",
  limited.every((s) => dustOf(s) === 0),
);
t(
  "作る値は無い",
  limited.every((s) => costOf(s) === null),
);
t(
  "目印が付く",
  limited.every((s) => isKeepsake(s)),
);
t(
  "抽選には入らない",
  limited.every((s) => !POOL.includes(s)),
);
{
  const c = normalize({ owned: { "pegasus-knight": 3 }, ether: 9999 });
  t("3枚あっても崩せない", spareOf(c, "pegasus-knight") === 0);
  t("崩そうとすると断る", !dismantleCheck(c, "pegasus-knight").ok);
  t("作ろうとすると断る", !craftCheck(c, "pegasus-knight").ok);
}

console.log("\n特別スキンは抽選・錬成の対象外");
{
  const id = "genie-magician";
  const special = SKINS.find((s) => s.id === id);
  t(
    "A の特別スキンがある",
    special?.rank === "A" && special.rarity === "SPECIAL",
  );
  t("通常抽選の15種に入らない", POOL.length === 15 && !POOL.includes(special));
  t("錬成対象外の目印が付く", isKeepsake(id));
  t("分解量も作成価格もない", dustOf(id) === 0 && costOf(id) === null);
  const c = normalize({
    owned: { [id]: 3, "zombie-male": 2 },
    equipped: { A: id },
    ether: 9999,
  });
  t("複数所持でも分解対象は0枚", spareOf(c, id) === 0);
  t("分解一覧に出ない", !spares(c, SKINS).some((row) => row.skin.id === id));
  t("特別スキンの分解を断る", !dismantleCheck(c, id).ok);
  t("エーテルの量にかかわらず作成を断る", !craftCheck(c, id).ok);
  for (const [name, action] of [
    ["分解", dismantle],
    ["作成", craft],
  ]) {
    let threw = false;
    try {
      action(c, id);
    } catch {
      threw = true;
    }
    t(
      `${name}の直接呼び出しでも所持とエーテルを変えない`,
      threw && c.owned[id] === 3 && c.ether === 9999,
    );
  }
  const after = dismantleAll(c);
  t(
    "まとめて分解しても特別スキンと装備を保つ",
    after.owned[id] === 3 &&
      after.equipped.A === id &&
      after.owned["zombie-male"] === 1 &&
      after.ether === 10009,
  );
  t(
    "報酬からも既知スキンとして受け取れる",
    grantSkin(normalize({}), id).owned[id] === 1,
  );
  t(
    "報酬の名前が特別スキンの名前になる",
    giftLabel({ type: "skin", id }) === `スキン「${special?.name}」`,
  );
  t(
    "特別スキンの共通開示はSSR相当",
    bestOf([{ id }]) === "SSR" &&
      ladderOf("SPECIAL").join() === "R,SR,SSR" &&
      ladderFor("SPECIAL", "gift").at(-1) === "SSR",
  );
}

console.log("\n崩す");
{
  let c = normalize({
    owned: {
      "zombie-male": 5,
      "elf-male": 3,
      "angel-k": 1,
      "pegasus-knight": 1,
    },
    ether: 0,
  });
  t(
    "最後の1枚は数えない",
    spareOf(c, "zombie-male") === 4 && spareOf(c, "angel-k") === 0,
  );
  t(
    "崩せる一覧に早期特典は出ない",
    !spares(c, SKINS).some((r) => isKeepsake(r.skin)),
  );
  t("全部崩すと 4×10 + 2×20 = 80", totalOfSpares(c, SKINS) === 80);
  c = dismantle(c, "zombie-male");
  t(
    "1枚崩すと所持が減り、エーテルが増える",
    c.owned["zombie-male"] === 4 && c.ether === 10,
  );
  c = dismantleAll(c);
  t("まとめて崩すと 70 増える", c.ether === 80);
  t(
    "どの札も1枚は残る",
    SKINS.every((s) => (c.owned[s.id] || 0) <= 1),
  );
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
  let c = normalize({ owned: { "elf-male": 1 }, ether: 1500 });
  t(
    "足りないと断り、不足を返す",
    (() => {
      const r = craftCheck(normalize({ ether: 100 }), "angel-k");
      return !r.ok && r.short === 1400;
    })(),
  );
  c = craft(c, "demon-k");
  t("SSR を作ると 1500 減る", c.ether === 0 && c.owned["demon-k"] === 1);
  let threw = false;
  try {
    craft(c, "angel-k");
  } catch {
    threw = true;
  }
  t("足りないまま作ろうとすると止まる", threw);
  const dup = craft(
    normalize({ owned: { "elf-male": 1 }, ether: 80 }),
    "elf-male",
  );
  t(
    "持っている札も作れて、枚数が増える",
    dup.owned["elf-male"] === 2 && dup.ether === 0,
  );
  t(
    "装備している札は残る(崩すのはダブりだけ)",
    spareOf(normalize({ owned: { "elf-male": 1 } }), "elf-male") === 0,
  );
}

console.log("\n保存と受け渡し");
{
  t(
    "壊れた値は0に落ちる",
    etherOf(normalize({ ether: -5 })) === 0 &&
      etherOf(normalize({ ether: 1.5 })) === 0,
  );
  t("保存から読み直せる", normalize({ ether: 340 }).ether === 340);
  t("足せる", addEther(normalize({ ether: 10 }), 90).ether === 100);
  t(
    "0や負を足しても変わらない",
    addEther(normalize({ ether: 10 }), 0).ether === 10,
  );
  t(
    "褒美の形として通る",
    JSON.stringify(normalizeGift({ type: "ether", amount: 500 })) ===
      JSON.stringify({ type: "ether", amount: 500 }),
  );
  t(
    "褒美の呼び名",
    giftLabel({ type: "ether", amount: 1500 }) === "エーテル 1,500",
  );
  t("0以下の褒美は弾く", normalizeGift({ type: "ether", amount: 0 }) === null);
}

console.log(`\n${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
