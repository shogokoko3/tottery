/** ホーム装飾の解放条件と保存。通貨・スキン装備・獲得待ちを変えない。 */
import assert from "node:assert/strict";
import { ALL_FOIL_SKINS, SKINS, foilId } from "../src/skins/catalog.js";
import { grantSkin, normalize, shatter } from "../src/skins/collection.js";
import {
  DEFAULT_HOME_THEME,
  HOME_THEMES,
  homePortraitOf,
  homePortraitsOf,
  homeThemeOf,
  setHomePortrait,
  setHomeTheme,
  unlockedHomePortraits,
  unlockedHomeThemes,
} from "../src/skins/home-themes.js";

const defaults = ["default"];
const ids = ["earth", "sea", "forest", "ice", "sky", "heaven", "hell"];
assert.equal(DEFAULT_HOME_THEME, "default");
assert.deepEqual(
  HOME_THEMES.map((theme) => theme.id),
  ids,
);
assert.equal(homeThemeOf(null), "default");
assert.equal(normalize(null).homeTheme, "default");
assert.deepEqual(unlockedHomeThemes(), defaults);
assert.deepEqual(unlockedHomeThemes(normalize(null)), defaults);

// 各フォイルを単独で入手した場合。他の領域へ解放が漏れない。
const expected = {
  "zombie-male": "earth",
  "zombie-female": "earth",
  "pirate-male": "sea",
  "pirate-female": "sea",
  "elf-male": "forest",
  "elf-female": "forest",
  "viking-male": "ice",
  "viking-female": "ice",
  "dragon-knight": "sky",
  "angel-j": "heaven",
  "angel-q": "heaven",
  "angel-k": "heaven",
  "demon-j": "hell",
  "demon-q": "hell",
  "demon-k": "hell",
};
assert.deepEqual(
  ALL_FOIL_SKINS.map((skin) => skin.baseId).sort(),
  [...Object.keys(expected), "genie-magician"].sort(),
  "追加フォイルにはホーム解放の検査も必要",
);
for (const [base, theme] of Object.entries(expected)) {
  const acquired = grantSkin(normalize(null), foilId(base));
  assert.deepEqual(unlockedHomeThemes(acquired), ["default", theme], base);
  assert.equal(homeThemeOf(acquired), "default", "入手だけでは選択を変えない");
  const selected = setHomeTheme(acquired, theme);
  const restored = normalize(JSON.parse(JSON.stringify(selected)));
  assert.equal(homeThemeOf(restored), theme, `${base} の選択が保存される`);
  assert.equal(restored.homeTheme, theme);
  for (const other of ids.filter((id) => id !== theme))
    assert.throws(() => setHomeTheme(acquired, other), /フォイル/, other);
}

// 通常版・A・未知の「:foil」名では解放しない。装備の有無は条件にしない。
const normals = normalize({
  owned: Object.fromEntries(SKINS.map((skin) => [skin.id, 100])),
});
assert.deepEqual(unlockedHomeThemes(normals), defaults);
assert.deepEqual(
  unlockedHomeThemes(grantSkin(normals, "genie-magician:foil")),
  defaults,
  "Aフォイルはエリアを持たない",
);
assert.deepEqual(
  unlockedHomeThemes({
    owned: { "pegasus-knight:foil": 1, "unknown:foil": 1 },
    equipped: { 2: "zombie-male:foil" },
    acquired: { "zombie-male": 100 },
    foilMilestones: { "zombie-male": true },
  }),
  defaults,
  "実際の所持以外の情報からフォイルを推測しない",
);
assert.deepEqual(
  unlockedHomeThemes({
    owned: {
      "zombie-female:foil": 1,
      "demon-q:foil": 1,
      "angel-k:foil": 1,
      "zombie-male:foil": 7,
    },
  }),
  ["default", "earth", "heaven", "hell"],
  "同じ領域はまとめ、天界と魔界は分け、表示順を固定する",
);
const all = normalize({
  owned: Object.fromEntries(ALL_FOIL_SKINS.map((skin) => [skin.id, 1])),
});
assert.deepEqual(unlockedHomeThemes(all), ["default", ...ids]);

// 不正な所持数や選択は外から渡されても表示・保存に通さない。
for (const count of [0, -1, 1.5, "1", true, null, NaN, Infinity, 2 ** 53]) {
  const raw = { owned: { "pirate-male:foil": count }, homeTheme: "sea" };
  assert.deepEqual(unlockedHomeThemes(raw), defaults, String(count));
  assert.equal(homeThemeOf(raw), "default");
  assert.equal(normalize(raw).homeTheme, "default");
}
assert.deepEqual(
  unlockedHomeThemes({
    owned: { "pirate-male:foil": Number.MAX_SAFE_INTEGER },
  }),
  ["default", "sea"],
);
for (const id of [
  undefined,
  null,
  "",
  "unknown",
  "__proto__",
  "constructor",
  "../../sea",
  "<img src=x onerror=alert(1)>",
  1,
  true,
  ["sea"],
  { id: "sea" },
]) {
  assert.equal(homeThemeOf({ ...all, homeTheme: id }), "default");
  assert.equal(normalize({ ...all, homeTheme: id }).homeTheme, "default");
  assert.throws(() => setHomeTheme(all, id), /ホーム装飾/);
}
assert.equal(
  normalize({ homeTheme: "sea", owned: ["pirate-female:foil"] }).homeTheme,
  "sea",
  "旧版の所持リストを正規化してから選択を検証する",
);
assert.equal(normalize({ homeTheme: "sea" }).homeTheme, "default");

// 選択を変更しても通貨・所持数・装備・獲得結果・受領印を保つ。
const state = normalize({
  owned: { "pirate-male:foil": 2, "angel-k:foil": 1 },
  tickets: 12,
  gems: 1500,
  gemsPaid: 1000,
  gemsFree: 500,
  ether: 80,
  shards: 5,
  draws: 99,
  entitlements: ["battlepass"],
  equipped: { 4: "pirate-male:foil" },
  pending: { results: [{ id: "pirate-male:foil", isNew: true }] },
  lastCraft: { id: "angel-k:foil", isNew: true, source: "exchange" },
});
const before = JSON.parse(JSON.stringify(state));
Object.freeze(state);
const selected = setHomeTheme(state, "sea");
assert.deepEqual(state, before, "入力を書き換えない");
assert.deepEqual(selected, { ...before, homeTheme: "sea" });
assert.strictEqual(selected.owned, state.owned);
assert.strictEqual(selected.pending, state.pending);
assert.strictEqual(selected.lastCraft, state.lastCraft);
assert.deepEqual(normalize(JSON.parse(JSON.stringify(selected))), selected);
assert.deepEqual(setHomeTheme(selected, "default"), before);
assert.equal(setHomeTheme(normalize(null), "default").homeTheme, "default");

// 余剰の1枚を崩しても装飾は使える。最後の1枚は残るため解放が消えない。
const afterShatter = shatter(selected, "pirate-male:foil");
assert.equal(afterShatter.owned["pirate-male:foil"], 1);
assert.equal(homeThemeOf(afterShatter), "sea");
assert.equal(normalize(afterShatter).homeTheme, "sea");
assert.throws(() => shatter(afterShatter, "pirate-male:foil"), /最後の1枚/);

// 天界・魔界は、実際に持つJ・Q・Kのキャラを表示する。未所持のKを出さない。
assert.deepEqual(homePortraitsOf(null), {});
assert.deepEqual(normalize(null).homePortraits, {});
for (const [theme, family] of [
  ["heaven", "angel"],
  ["hell", "demon"],
]) {
  for (const rank of ["j", "q", "k"]) {
    const baseId = `${family}-${rank}`;
    const single = normalize({ owned: { [foilId(baseId)]: 1 } });
    assert.deepEqual(unlockedHomePortraits(single, theme), [baseId]);
    assert.equal(homePortraitOf(single, theme), baseId);
    assert.deepEqual(single.homePortraits, { [theme]: baseId });
    assert.equal(
      single.homeTheme,
      "default",
      "キャラ獲得でホーム領域は変えない",
    );
    const normal = normalize({ owned: { [baseId]: 100 } });
    assert.deepEqual(unlockedHomePortraits(normal, theme), []);
    assert.equal(homePortraitOf(normal, theme), null);
    assert.throws(() => setHomePortrait(normal, theme, baseId), /フォイル/);
  }
  const palace = normalize({
    owned: {
      [`${family}-k:foil`]: 1,
      [`${family}-j:foil`]: 1,
      [`${family}-q:foil`]: 1,
    },
  });
  assert.deepEqual(
    unlockedHomePortraits(palace, theme),
    [`${family}-j`, `${family}-q`, `${family}-k`],
    "キャラの並びは所持データ順に依存しない",
  );
  assert.equal(
    homePortraitOf(palace, theme),
    `${family}-k`,
    "旧保存は所持Kを優先",
  );
  for (const rank of ["j", "q", "k"]) {
    const changed = setHomePortrait(palace, theme, `${family}-${rank}`);
    const restored = normalize(JSON.parse(JSON.stringify(changed)));
    assert.equal(homePortraitOf(restored, theme), `${family}-${rank}`);
    assert.equal(homeThemeOf(restored), "default");
  }
  let first = normalize({ owned: { [`${family}-j:foil`]: 1 } });
  first = normalize(grantSkin(first, `${family}-q:foil`));
  first = normalize(grantSkin(first, `${family}-k:foil`));
  assert.equal(
    homePortraitOf(first, theme),
    `${family}-j`,
    "追加獲得で選択済みJを変えない",
  );
  const second = setHomePortrait(first, theme, `${family}-q`);
  assert.equal(
    homePortraitOf(normalize(grantSkin(second, `${family}-k:foil`)), theme),
    `${family}-q`,
    "明示的に選んだQも追加獲得で変えない",
  );
}
assert.deepEqual(homePortraitsOf(all), { heaven: "angel-k", hell: "demon-k" });
for (const theme of [
  "default",
  "earth",
  "sea",
  "forest",
  "ice",
  "sky",
  "__proto__",
  null,
]) {
  assert.deepEqual(unlockedHomePortraits(all, theme), []);
  assert.equal(homePortraitOf(all, theme), null);
  assert.throws(() => setHomePortrait(all, theme, "angel-j"), /領域/);
}
for (const invalid of [
  null,
  "unknown",
  "__proto__",
  "angel-j:foil",
  "demon-j",
  "zombie-male",
  "genie-magician",
  ["angel-j"],
  { id: "angel-j" },
])
  assert.throws(() => setHomePortrait(all, "heaven", invalid), /領域/);
for (const invalid of [
  null,
  [],
  "angel-j",
  1,
  { heaven: "angel-j:foil", hell: "angel-j" },
  { heaven: ["angel-j"], hell: "unknown", earth: "zombie-male" },
])
  assert.deepEqual(
    normalize({ ...all, homePortraits: invalid }).homePortraits,
    { heaven: "angel-k", hell: "demon-k" },
  );
assert.deepEqual(
  normalize({
    owned: { "angel-q:foil": 1, "demon-j:foil": 1 },
    homePortraits: { heaven: "angel-k", hell: "demon-q", earth: "zombie-male" },
  }).homePortraits,
  { heaven: "angel-q", hell: "demon-j" },
  "不正・未所持の選択は実際の所持キャラへ戻す",
);
assert.deepEqual(
  normalize({ owned: ["angel-j:foil"], homePortraits: { heaven: "angel-j" } })
    .homePortraits,
  { heaven: "angel-j" },
  "旧版の所持配列も先に正規化する",
);
for (const count of [0, -1, 0.5, "1", true, NaN, Infinity, 2 ** 53])
  assert.equal(
    homePortraitOf({ owned: { "angel-j:foil": count } }, "heaven"),
    null,
  );

const portraitState = normalize({
  ...before,
  owned: { ...before.owned, "angel-j:foil": 1, "demon-q:foil": 1 },
  homeTheme: "sea",
  homePortraits: { heaven: "angel-k", hell: "demon-q" },
});
Object.freeze(portraitState);
Object.freeze(portraitState.homePortraits);
const portraitChanged = setHomePortrait(portraitState, "heaven", "angel-j");
assert.deepEqual(
  portraitChanged,
  {
    ...portraitState,
    homePortraits: { heaven: "angel-j", hell: "demon-q" },
  },
  "片方のキャラだけを変更し、通貨・所持・装備・獲得結果・他領域を保持",
);
assert.equal(
  portraitState.homePortraits.heaven,
  "angel-k",
  "入力の選択を書き換えない",
);
assert.strictEqual(portraitChanged.owned, portraitState.owned);
assert.strictEqual(portraitChanged.pending, portraitState.pending);
assert.strictEqual(portraitChanged.lastCraft, portraitState.lastCraft);
assert.deepEqual(
  normalize(JSON.parse(JSON.stringify(portraitChanged))),
  portraitChanged,
);
assert.deepEqual(
  setHomeTheme(portraitChanged, "default").homePortraits,
  portraitChanged.homePortraits,
);

console.log(
  "ホーム装飾: フォイルごとの解放・領域とキャラの選択・保存・既存データの保持を確認",
);
