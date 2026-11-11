import { FORMATION_EMBLEMS } from "./formation-honors.js";
import { L } from "../i18n/index.js";
/**
 * アカウントのアイコン。
 *
 * いまは記号だけの素朴なものを並べている。今後は対局で手に入るものを
 * 足していく予定なので、「持っているか」を profile.icons で持たせ、
 * 一覧はここのデータだけ書き足せば増える形にしてある。
 *
 * free: true は最初から使える。それ以外は how に手に入れ方を書く。
 */
export const ICONS = [
  { id: "initial", label: L("名前の頭文字"), mark: null, free: true },
  { id: "spade", label: L("スペード"), mark: "♠", free: true },
  { id: "heart", label: L("ハート"), mark: "♥", free: true },
  { id: "diamond", label: L("ダイヤ"), mark: "♦", free: true },
  { id: "club", label: L("クラブ"), mark: "♣", free: true },
  {
    id: "crown",
    label: L("王冠"),
    mark: "♛",
    how: L("ミッション「レベル10になる」"),
  },
  { id: "star", label: L("星"), mark: "★", how: L("ミッション「レベル30になる」") },
  // 布陣の紋章。エリア(フォイル)で手に入るので、フォイルを持たないうちは一覧に出さない
  ...FORMATION_EMBLEMS.map((e) => ({ ...e, foil: true })),
  { id: "flame", label: L("炎"), mark: "✦", how: L("これから手に入ります") },
];

/** 既定のアイコン。名前の頭文字を出す */
export const DEFAULT_ICON = "initial";

export function findIcon(id) {
  return ICONS.find((i) => i.id === id) || ICONS[0];
}

/** その人が使えるアイコンか */
export function hasIcon(profile, id) {
  const icon = findIcon(id);
  if (icon.free) return true;
  if (icon.titleId && profile?.titles?.includes(icon.titleId)) return true;
  const owned = (profile && profile.icons) || [];
  return owned.includes(id);
}

/** いま使えるアイコンの一覧 */
export function ownedIcons(profile) {
  return ICONS.filter((i) => hasIcon(profile, i.id));
}

/**
 * 実際に出すアイコン。
 * 持っていないものが設定されていたら、既定に戻す。
 * (手に入れ方が変わったり、古い保存が残っていたりしても壊れないように)
 */
export function iconOf(profile) {
  const id = (profile && profile.icon) || DEFAULT_ICON;
  return hasIcon(profile, id) ? findIcon(id) : findIcon(DEFAULT_ICON);
}
