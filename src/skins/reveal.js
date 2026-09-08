/**
 * ガチャの開示演出の決まりごと。画面(skins.jsx)から切り離して検査できるようにする。
 *
 * - 前兆(omen): 束の中でいちばん強いレアリティで背景と札の光り方を決める。
 *   ただし SSR がいても低確率で SR の前兆に抑える(当てにならない前兆)。
 *   どの札が当たりかは分からないまま「何かいる」とだけ伝える
 * - 昇格(ladder): めくった札が最終のレアリティに至るまでに通る段階。
 *   SR は R→SR、SSR は R→SR→SSR と上がって見せるが、素でそのまま出ることもある
 *
 * 乱数は使わない。束の中身(id の並び)から決めるので、同じ束なら再読み込みしても
 * 同じ前兆・同じ昇格になり、演出の途中で閉じても話が変わらない。
 */
import { byId } from "./catalog.js";

export const POWER = { R: 1, SR: 2, SSR: 3, LIMITED: 3, SPECIAL: 3 };

/** SSR がいるのに SR の前兆で抑える割合 */
export const OMEN_FAKEOUT = 0.15;
/** 昇格を経ずに素で出る割合 */
export const STRAIGHT = { SSR: 0.4, SR: 0.5 };

/** 特典は見た目の格として SSR と同じ扱い。抽選対象は catalog の POOL で決める */
const tierOf = (rarity) =>
  rarity === "LIMITED" || rarity === "SPECIAL" ? "SSR" : rarity;

/**
 * 文字列から 0 以上 1 未満の値。同じ文字列なら同じ値。
 * 札の並びは似た文字列になりやすいので、簡単なハッシュ(FNV)では偏る。
 * 2本の32bit を掛け混ぜる cyrb53(bryc、パブリックドメイン)を使う
 */
export function roll(text, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return (n % 100000) / 100000;
}

/** 束の目印。前兆と昇格の種になる */
export const seedOf = (results) =>
  (results || []).map((r) => (r && r.id) || "?").join(",");

/** 束の中でいちばん強い格 */
export function bestOf(results) {
  let best = "R";
  for (const r of results || []) {
    const skin = byId(r && r.id);
    if (!skin) continue;
    const tier = tierOf(skin.rarity);
    if ((POWER[tier] || 0) > POWER[best]) best = tier;
  }
  return best;
}

/** 伏せた時点で見せる前兆。SSR がいても低確率で SR に抑える。強く見せすぎることは無い */
export function omenOf(results) {
  const best = bestOf(results);
  if (best === "SSR" && roll(`${seedOf(results)}#omen`) < OMEN_FAKEOUT)
    return "SR";
  return best;
}

/** 昇格を全部通る段階 */
export function ladderOf(rarity) {
  const top = tierOf(rarity);
  return ["R", "SR", "SSR"].slice(0, POWER[top] || 1);
}

/** その札が実際に通る段階。素で出る札は最終の格だけ */
export function ladderFor(rarity, seed) {
  const top = tierOf(rarity);
  if (top === "R") return ["R"];
  if (roll(`${seed}#straight`) < STRAIGHT[top]) return [top];
  return ladderOf(rarity);
}

/** 前兆の一言 */
export const OMEN_TEXT = {
  R: "運命が、目を覚ます。",
  SR: "光が、集まりはじめた。",
  SSR: "……ただならぬ気配。",
};
