import { areaRewardsFor } from "./area-rewards.js";
import { byId, foilId } from "./catalog.js";

export const DEFAULT_HOME_THEME = "default";

// 承認されたホーム装飾。盤面と同じフォイルの対応で解放する。
export const HOME_THEMES = Object.freeze(
  [
    {
      id: "earth",
      label: "土",
      name: "墓守のレヴナント",
      accent: "#92dfd7",
      panel: "#121f29",
      title: "霧の墓庭",
      condition: "2・3のいずれかのフォイルを獲得",
    },
    {
      id: "sea",
      label: "海",
      name: "黒潮の船長",
      accent: "#e9c182",
      panel: "#202329",
      title: "黒潮の航路",
      condition: "4・5のいずれかのフォイルを獲得",
    },
    {
      id: "forest",
      label: "森",
      name: "月影の射手",
      accent: "#b9d391",
      panel: "#12251e",
      title: "翠緑の聖域",
      condition: "6・7のいずれかのフォイルを獲得",
    },
    {
      id: "ice",
      label: "氷",
      name: "霜狼の戦斧",
      accent: "#b3e4ef",
      panel: "#172936",
      title: "氷海の誓い",
      condition: "8・9のいずれかのフォイルを獲得",
    },
    {
      id: "sky",
      label: "空",
      name: "焔翼の竜騎士",
      accent: "#dacbad",
      panel: "#20263c",
      title: "雲上の領域",
      condition: "10のフォイルを獲得",
    },
    {
      id: "heaven",
      label: "天界",
      name: "熾天使 ミカエル",
      accent: "#f2dba4",
      panel: "#282d3a",
      title: "天上の玉座",
      condition: "天使のJ・Q・Kのいずれかのフォイルを獲得",
    },
    {
      id: "hell",
      label: "魔界",
      name: "堕天王 ルシファー",
      accent: "#edb18a",
      panel: "#29191e",
      title: "黒炎の王座",
      condition: "悪魔のJ・Q・Kのいずれかのフォイルを獲得",
    },
  ].map((theme) => Object.freeze({ ...theme, area: theme.id })),
);

function ownedHomeRewards(collection) {
  const held = Object.entries(collection?.owned || {})
    .filter(([, count]) => Number.isSafeInteger(count) && count > 0)
    .map(([id]) => ({ id }));
  return areaRewardsFor(held);
}

/** 最後のフォイルは分解できないため、所持が獲得済みの証拠になる。 */
export function unlockedHomeThemes(collection) {
  const unlocked = new Set(
    ownedHomeRewards(collection).map((reward) => reward.theme),
  );
  return [
    DEFAULT_HOME_THEME,
    ...HOME_THEMES.filter((theme) => unlocked.has(theme.id)).map(
      (theme) => theme.id,
    ),
  ];
}

/** 旧保存・壊れた選択・未獲得の装飾は、いつものホームで表示する。 */
export function homeThemeOf(collection) {
  const selected = collection?.homeTheme;
  return unlockedHomeThemes(collection).includes(selected)
    ? selected
    : DEFAULT_HOME_THEME;
}

/** 装飾の選択だけを更新し、所持品や通貨、獲得結果には触れない。 */
export function setHomeTheme(collection, id) {
  if (
    id !== DEFAULT_HOME_THEME &&
    !HOME_THEMES.some((theme) => theme.id === id)
  )
    throw new Error("そのホーム装飾はありません。");
  if (!unlockedHomeThemes(collection).includes(id))
    throw new Error("対応するフォイルを獲得すると選べます。");
  return { ...collection, homeTheme: id };
}

const DEFAULT_PORTRAITS = Object.freeze({
  earth: "zombie-male",
  sea: "pirate-male",
  forest: "elf-female",
  ice: "viking-female",
  heaven: "angel-k",
  hell: "demon-k",
});
const PORTRAIT_THEMES = Object.keys(DEFAULT_PORTRAITS);
const PORTRAIT_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "J", "Q", "K"];

/** 各領域の表示に選べる通常版ID。対応するフォイルの所持が必要。 */
export function unlockedHomePortraits(collection, theme) {
  if (!PORTRAIT_THEMES.includes(theme)) return [];
  const reward = ownedHomeRewards(collection).find(
    (item) => item.theme === theme,
  );
  return (reward?.skins || [])
    .filter((skin) => PORTRAIT_RANKS.includes(skin.rank))
    .sort(
      (a, b) => PORTRAIT_RANKS.indexOf(a.rank) - PORTRAIT_RANKS.indexOf(b.rank),
    )
    .map((skin) => skin.baseId);
}

/** 旧保存は所持中の既定キャラを優先。選択済みなら新たな獲得で変えない。 */
export function homePortraitOf(collection, theme) {
  const available = unlockedHomePortraits(collection, theme);
  const saved = collection?.homePortraits;
  const selected =
    saved && typeof saved === "object" && !Array.isArray(saved)
      ? saved[theme]
      : null;
  return available.includes(selected)
    ? selected
    : available.includes(DEFAULT_PORTRAITS[theme])
      ? DEFAULT_PORTRAITS[theme]
      : available[available.length - 1] || null;
}

/** 有効な選択だけ保存する。初めての表示で選んだキャラも次回から維持する。 */
export function homePortraitsOf(collection) {
  return Object.fromEntries(
    PORTRAIT_THEMES.map((theme) => [
      theme,
      homePortraitOf(collection, theme),
    ]).filter(([, baseId]) => baseId !== null),
  );
}

/** 表示キャラだけを変更する。ホーム領域・カード装備・所持品は変えない。 */
export function setHomePortrait(collection, theme, baseId) {
  const skin = byId(baseId);
  if (
    !PORTRAIT_THEMES.includes(theme) ||
    !skin ||
    skin.foil ||
    !PORTRAIT_RANKS.includes(skin.rank) ||
    !areaRewardsFor([{ id: foilId(baseId) }]).some(
      (reward) => reward.theme === theme,
    )
  )
    throw new Error("この領域ではそのキャラクターを選べません。");
  if (!unlockedHomePortraits(collection, theme).includes(baseId))
    throw new Error("このキャラクターのフォイルを獲得すると選べます。");
  return {
    ...collection,
    homePortraits: { ...homePortraitsOf(collection), [theme]: baseId },
  };
}
