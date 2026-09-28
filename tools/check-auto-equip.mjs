/**
 * 手に入れたスキンの自動装備(2026-09-28 本人の指示)を確かめる。
 *
 * 決まり:
 *  - 装備していない段にだけ着せる
 *  - 通常とフォイルの両方を持っていればフォイルを優先
 *  - J・Q・K・10 のように2種類以上のキャラがある段は、何か装備していれば触らない
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { autoEquip, autoEquipChanges, rankHasChoice } from "../src/skins/auto-equip.js";
import { ALL_SKINS, baseSkinId } from "../src/skins/catalog.js";
import { applyPull, normalize } from "../src/skins/collection.js";

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
const st = (owned, equipped = {}) => ({
  owned: Object.fromEntries(owned.map((i) => [i, 1])),
  equipped,
});

console.log("2種類以上のキャラがある段");
// 台帳から数える。いまは 10(竜騎士・天馬騎士)と J・Q・K(天使・悪魔)
const ranks = [...new Set(ALL_SKINS.map((s) => s.rank))];
is("台帳から数えた段", ranks.filter(rankHasChoice).sort(), ["10", "J", "K", "Q"]);
is("2〜9 と A は1キャラだけ", ["2", "5", "9", "A"].some(rankHasChoice), false);

console.log("\n空いている段");
is("持っていれば着せる", autoEquip(st(["zombie-male"])).equipped["2"], "zombie-male");
is(
  "通常とフォイルならフォイル",
  autoEquip(st(["elf-male", "elf-male:foil"])).equipped["6"],
  "elf-male:foil",
);
is(
  "いま引いたものを先に着せる",
  autoEquip(st(["angel-j", "demon-j"]), { prefer: ["demon-j"] }).equipped["J"],
  "demon-j",
);
is("持っていない段は空のまま", "K" in autoEquip(st(["zombie-male"])).equipped, false);

console.log("\nすでに装備している段");
is(
  "1キャラの段: 同じキャラのフォイルが来たら差し替える",
  autoEquip(st(["elf-male", "elf-male:foil"], { 6: "elf-male" })).equipped["6"],
  "elf-male:foil",
);
is(
  "J: 天使を着ているところへ悪魔を引いても触らない",
  autoEquip(st(["angel-j", "demon-j"], { J: "angel-j" }), { prefer: ["demon-j"] })
    .equipped["J"],
  "angel-j",
);
is(
  "J: 天使のフォイルを着ていれば、悪魔のフォイルでも触らない",
  autoEquip(st(["angel-j:foil", "demon-j:foil"], { J: "angel-j:foil" }), {
    prefer: ["demon-j:foil"],
  }).equipped["J"],
  "angel-j:foil",
);
is(
  "J: 天使の通常を着ているところへ、同じ天使のフォイルが来ても触らない(2種類ある段だから)",
  autoEquip(st(["angel-j", "angel-j:foil"], { J: "angel-j" })).equipped["J"],
  "angel-j",
);
is(
  "10: 竜騎士を着ているところへ天馬を引いても触らない",
  autoEquip(st(["dragon-knight", "pegasus-knight"], { 10: "dragon-knight" }), {
    prefer: ["pegasus-knight"],
  }).equipped["10"],
  "dragon-knight",
);

console.log("\n持っていない札が装備されたまま(崩したあと)");
is(
  "持っているものに直す",
  autoEquip({ owned: { "pirate-male": 1 }, equipped: { 4: "pirate-male:foil" } })
    .equipped["4"],
  "pirate-male",
);
is(
  "1枚も持っていなければ外す",
  "4" in autoEquip({ owned: {}, equipped: { 4: "pirate-male" } }).equipped,
  false,
);

console.log("\nそのほか");
{
  const same = st(["zombie-male"], { 2: "zombie-male" });
  is("変わらなければ同じ state を返す", autoEquip(same) === same, true);
  is("owned が無ければ何もしない", autoEquip({}), {});
  const before = st(["elf-male"]);
  const after = autoEquip(before);
  is("変わった段を数え上げられる", autoEquipChanges(before, after), [
    { rank: "6", id: "elf-male", from: null },
  ]);
  // 装備する札は、必ずその段の札
  const all = autoEquip(st(ALL_SKINS.map((s) => s.id)));
  is(
    "どの段も、その段の札が入る",
    Object.entries(all.equipped).every(
      ([rank, id]) => ALL_SKINS.find((s) => s.id === id)?.rank === rank,
    ),
    true,
  );
  is(
    "全部持っていれば、どの段もフォイルになる",
    Object.values(all.equipped).every((id) => id !== baseSkinId(id)),
    true,
  );
}

console.log("\n配線");
{
  const col = fs.readFileSync(new URL("../src/skins/collection.js", import.meta.url), "utf8");
  is("ガチャの結果に自動装備をかける", /autoEquip\(\s*withHomePortraits\(/.test(col), true);
  is("引いた札を優先に渡す", /\{ prefer: ids \}/.test(col), true);
}

// 自動で着せたことが見て分かるように、その回に着せた札を控えておく
// (2026-09-28 本人の指示「自動で装着したとわかるエフェクトがあると良さそう」)
console.log("\n着せた札の控え");
{
  // 10連を1回。空っぽの所持なので、引いた札はどれも自動で着る
  const pulled = [
    "zombie-male",
    "zombie-female",
    "pirate-male",
    "pirate-female",
    "elf-male",
    "elf-female",
    "viking-male",
    "viking-female",
    "genie-magician",
    "angel-j",
  ];
  const base = normalize({ tickets: 999 });
  const after = applyPull(base, pulled, { free: true });
  const kept = [...(after.pending?.equipped ?? [])].sort();
  is("着せた札が控えに残る", kept.length > 0, true);
  is("控えるのは、その回に引いた札だけ", kept.every((id) => pulled.includes(id)), true);
  is(
    "開き直しても控えは消えない",
    [...(normalize(JSON.parse(JSON.stringify(after))).pending?.equipped ?? [])].sort(),
    kept,
  );
  // すでに着ている段は触らないので、二度目は控えが立たない
  const seen = { ...after, pending: null, lastCraft: null };
  const again = applyPull(seen, pulled, { free: true });
  is("二度目は着せ替えないので控えは空", again.pending?.equipped ?? [], []);

  const skins = fs.readFileSync(new URL("../src/ui/skins.jsx", import.meta.url), "utf8");
  is("札に「装備しました」を出す", /reveal-equipped/.test(skins), true);
  is("控えを演出に渡す", /equipped=\{collection\.pending\.equipped\}/.test(skins), true);
  // 同じ札を2枚引いても、着せたのは1枚。両方に印が出ないこと
  is("印は id ではなく枚数で数える", /equippedAt\.has\(i\)/.test(skins), true);
  const css = fs.readFileSync(new URL("../src/skins/styles.css", import.meta.url), "utf8");
  is("控え目の演出が用意されている", /\.reveal-equipped\b/.test(css), true);
}
console.log(`\n${ok} ok / ${fail.length} NG`);
if (fail.length) {
  console.error("NG: " + fail.join(", "));
  process.exit(1);
}
