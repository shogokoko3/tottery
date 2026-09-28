/**
 * 初回の10連(2026-09-28 本人の指示)。
 *
 * 名前を決めた直後、チュートリアルより先にこれを引く。
 * 「最初にワクワクさせる」ことと、**リセマラ(引き直し)をしやすくする**のが狙い。
 *
 * ふつうのガチャと違うところ:
 *  - **チケットを使わない**(まだ1枚も持っていないので)
 *  - **SSR が1枚以上確定**。10枚引いて1枚も出なければ、1枠を SSR に差し替える
 *  - **フォイルは出ない**。初回から最上位が出ると、そのあとの引きが薄くなる。
 *    フォイルは遊んで手に入れるもの、という線を崩さない
 *  - フリーズ(凍る)などの演出は**そのまま**。門も通常どおり
 *
 * 一度きり。引いたら控えを残し、二度目は出さない。
 */
import { POOL, baseSkinId, byId } from "./catalog.js";
import { resolveSummonFreeze } from "./summon-freeze.js";

/** 初回に引く枚数 */
export const FIRST_PULL_SIZE = 10;

/** 引いたことの控え(collection の中に持つ) */
export const FIRST_PULL_KEY = "firstPullDone";

/** 差し替えに使える SSR。フォイルは含まない */
const SSR_POOL = POOL.filter((s) => s.rarity === "SSR");

/** もう初回の10連を引いたか */
export function firstPullDone(state) {
  return !!(state && state[FIRST_PULL_KEY]);
}

/** その id が SSR か(フォイルでも、もとが SSR なら SSR) */
const isSsr = (id) => byId(baseSkinId(id))?.rarity === "SSR";

/**
 * 初回の10連を引く。返すのは id の並び(長さ FIRST_PULL_SIZE)。
 *
 * ふつうの抽選をそのまま使うが、**仕上げ(フォイル)の抽選は通さない**ので
 * 必ず通常版になる。SSR が1枚も無ければ、どこか1枠を SSR に差し替える。
 * random は 0〜1 を返す関数(検査で固定する)
 */
export function drawFirstPull(random = Math.random) {
  const pick = () => {
    const n = random();
    if (!Number.isFinite(n) || n < 0 || n >= 1)
      throw new Error("乱数の範囲が不正です");
    let threshold = n * 100;
    for (const skin of POOL) {
      // catalog.js の rate と同じ重み
      const share =
        ({ R: 65, SR: 32, SSR: 3 }[skin.rarity] || 0) /
        (POOL.filter((p) => p.rarity === skin.rarity).length || 1);
      threshold -= share;
      if (threshold < 0) return skin.id;
    }
    return POOL[POOL.length - 1].id;
  };
  const ids = Array.from({ length: FIRST_PULL_SIZE }, pick);
  if (ids.some(isSsr)) return ids;
  // 1枚も出なかった。どこか1枠を SSR にする(いつも同じ場所だと作り物に見える)
  const slot = Math.min(FIRST_PULL_SIZE - 1, Math.floor(random() * FIRST_PULL_SIZE));
  const ssr = SSR_POOL[Math.min(SSR_POOL.length - 1, Math.floor(random() * SSR_POOL.length))];
  ids[slot] = ssr.id;
  return ids;
}

/**
 * 初回の10連の結果(フリーズの演出つき)。applyPull にそのまま渡せる形。
 * フォイルが混ざっていないことは、ここでも念のため確かめる
 */
export function firstPullResult(random = Math.random) {
  const ids = drawFirstPull(random);
  if (ids.some((id) => id !== baseSkinId(id)))
    throw new Error("初回の10連にフォイルが混ざっています");
  if (!ids.some(isSsr)) throw new Error("初回の10連に SSR がありません");
  // フリーズの演出はそのまま。ただし**フォイルへの昇格だけは起こさない**
  const out = resolveSummonFreeze(ids, random, { allowFoil: false });
  if (out.skins.some((id) => id !== baseSkinId(id)))
    throw new Error("フリーズで初回の10連にフォイルが混ざりました");
  return out;
}

/** 引いたことを控える(二度目は出さない) */
export function markFirstPull(state) {
  return { ...state, [FIRST_PULL_KEY]: true };
}
