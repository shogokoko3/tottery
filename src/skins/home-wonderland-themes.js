import { ALICE_SKINS } from "./alice.js";

const ROOT = "skins/home-wonderland-characters-v1";
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

// IDの数字は旧ランク。解放はキャラID、表示順は現在のランクで決める。
export const WONDERLAND_HOME_THEMES = Object.freeze(
  [
    ["alice-A-alice", "金の鍵の庭", "#d9c38e", "#142d2a", "#8ca890"],
    ["alice-2-dodo", "コーカス・レース", "#e1bf83", "#242b31", "#9c764b"],
    ["alice-3-bill", "煙突屋根の街", "#d8b086", "#202b36", "#977356"],
    ["alice-4-hatter", "終わらないお茶会", "#dab891", "#302236", "#956782"],
    ["alice-5-march-hare", "春霞のお茶会", "#d2bf8b", "#1f3128", "#82a176"],
    ["alice-6-gryphon", "金翼の断崖", "#f0d191", "#172e3a", "#6ab6c4"],
    ["alice-7-mock-turtle", "追憶の海辺", "#c7dfd6", "#17303b", "#88bab3"],
    ["alice-8-white-rabbit", "時を追う回廊", "#ead5a3", "#26303c", "#c0b8a0"],
    [
      "alice-9-caterpillar",
      "蒼いキノコの聖域",
      "#bfc6ef",
      "#202139",
      "#849ac7",
    ],
    [
      "alice-10-cheshire-cat",
      "消える月影の森",
      "#d8c596",
      "#152b31",
      "#96b7be",
    ],
    ["alice-J-knave", "秘密のタルト庭園", "#edb99a", "#302027", "#b1666c"],
    ["alice-Q-queen", "紅薔薇の女王庭園", "#e7bb8b", "#2b1722", "#af4956"],
    ["alice-K-king", "ハート宮殿の王座", "#e8d2a8", "#2c2026", "#bb8b63"],
  ]
    .map(([id, title, accent, panel, secondary]) => {
      const skin = ALICE_SKINS.find((item) => item.id === id);
      const slug = id.slice("alice-".length);
      return Object.freeze({
        id,
        series: "alice",
        label: skin.name,
        name: skin.name,
        rank: skin.rank,
        title,
        accent,
        panel,
        secondary,
        unlockFoil: `${id}:foil`,
        condition: `${skin.rank} ${skin.name}のフォイルを獲得`,
        assets: Object.freeze({
          scene: `${ROOT}/${slug}.webp`,
          decoration: `${ROOT}/${slug}-decor.webp`,
          corner: `${ROOT}/frames/${slug}-corner.svg`,
          crest: `${ROOT}/frames/${slug}-crest.svg`,
          rail: `${ROOT}/frames/${slug}-rail.svg`,
        }),
      });
    })
    .sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank)),
);
