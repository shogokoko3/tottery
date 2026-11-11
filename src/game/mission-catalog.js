import { FOIL_MISSION_DEFS } from "./foil-missions.js";
import { L } from "../i18n/index.js";

export const MISSIONS = [
  // 使用頻度 → 称号・スキン
  {
    id: "days-3",
    kind: "days",
    goal: 3,
    name: L("3日あそぶ"),
    reward: { type: "title", id: "regular" },
  },
  {
    id: "days-10",
    kind: "days",
    goal: 10,
    name: L("10日あそぶ"),
    reward: { type: "skin", id: "pirate-male" },
  },
  {
    id: "days-30",
    kind: "days",
    goal: 30,
    name: L("30日あそぶ"),
    reward: { type: "title", id: "devoted" },
  },

  // 実績のジェムは一律 500(2026-09-24 本人の決め)。一度きりなので、届いた区切りごとにバトルパス1枚分の3分の1
  // プレイヤーレベル → ジェム・アイコン
  {
    id: "level-5",
    kind: "level",
    goal: 5,
    name: L("レベル5になる"),
    reward: { type: "gems", amount: 500 },
  },
  {
    id: "level-10",
    kind: "level",
    goal: 10,
    name: L("レベル10になる"),
    reward: { type: "icon", id: "crown" },
  },
  {
    id: "level-20",
    kind: "level",
    goal: 20,
    name: L("レベル20になる"),
    reward: { type: "gems", amount: 500 },
  },
  {
    id: "level-30",
    kind: "level",
    goal: 30,
    name: L("レベル30になる"),
    reward: { type: "icon", id: "star" },
  },

  // 対戦回数 → ジェム
  {
    id: "battles-10",
    kind: "battles",
    goal: 10,
    name: L("10戦する"),
    reward: { type: "gems", amount: 500 },
  },
  {
    id: "battles-50",
    kind: "battles",
    goal: 50,
    name: L("50戦する"),
    reward: { type: "gems", amount: 500 },
  },
  {
    id: "battles-100",
    kind: "battles",
    goal: 100,
    name: L("100戦する"),
    reward: { type: "gems", amount: 500 },
  },
  {
    id: "battles-500",
    kind: "battles",
    goal: 500,
    name: L("500戦する"),
    reward: { type: "gems", amount: 500 },
  },
  ...FOIL_MISSION_DEFS.map((entry) => ({
    id: entry.missionId,
    kind: "foil",
    goal: 1,
    name: entry.missionName,
    baseId: entry.baseId,
    skinId: entry.skinId,
    reward: { type: "title", id: entry.titleId },
  })),
];
